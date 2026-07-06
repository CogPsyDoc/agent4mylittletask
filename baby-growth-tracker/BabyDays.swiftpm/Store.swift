import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// 인코딩과 파일 쓰기를 백그라운드에서 순서대로 처리하는 작성기.
/// generation이 낮은(더 오래된) 스냅숏은 건너뛰어 항상 최신 데이터만 디스크에 남긴다.
private actor StoreWriter {
    private var lastGeneration = 0

    func write(_ snapshot: AppData, generation: Int, to url: URL) {
        guard generation > lastGeneration else { return }
        lastGeneration = generation
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.sortedKeys]
            let raw = try encoder.encode(snapshot)
            try raw.write(to: url, options: .atomic)
        } catch {
            print("저장 실패: \(error)")
        }
    }
}

/// 앱 데이터 저장소.
/// - 데이터: Documents/store.json — 연속 변경을 0.8초 단위로 묶어 백그라운드에서 저장
/// - 복구: 실행 시 정상 데이터를 store.previous.json으로 남겨, 본 파일 손상 시 자동 복구
/// - 미디어: Documents/Media/ 폴더에 원본을 복사해 보관
@MainActor
final class Store: ObservableObject {
    @Published var data: AppData {
        didSet { scheduleSave() }
    }

    private let storeURL: URL
    private let previousURL: URL
    private let mediaDirectoryURL: URL
    private let writer = StoreWriter()
    private var saveTask: Task<Void, Never>?
    private var saveGeneration = 0
    private var pendingSince: Date?

    var documentsURL: URL { storeURL.deletingLastPathComponent() }

    init() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        storeURL = documents.appendingPathComponent("store.json")
        previousURL = documents.appendingPathComponent("store.previous.json")
        mediaDirectoryURL = documents.appendingPathComponent("Media", isDirectory: true)
        try? FileManager.default.createDirectory(at: mediaDirectoryURL, withIntermediateDirectories: true)

        data = Store.loadData(storeURL: storeURL, previousURL: previousURL)

        // 이번 실행에서 정상적으로 읽은 파일을 복구용 사본으로 남긴다
        if FileManager.default.fileExists(atPath: storeURL.path) {
            try? FileManager.default.removeItem(at: previousURL)
            try? FileManager.default.copyItem(at: storeURL, to: previousURL)
        }
    }

    private static func loadData(storeURL: URL, previousURL: URL) -> AppData {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let raw = try? Data(contentsOf: storeURL),
           let decoded = try? decoder.decode(AppData.self, from: raw) {
            return decoded
        }
        // 본 파일을 읽지 못하면: 손상 파일을 지우지 말고 옆으로 치워 둔 뒤 직전 사본으로 복구한다
        if FileManager.default.fileExists(atPath: storeURL.path) {
            let corrupt = storeURL.deletingLastPathComponent()
                .appendingPathComponent("store.corrupt.json")
            try? FileManager.default.removeItem(at: corrupt)
            try? FileManager.default.moveItem(at: storeURL, to: corrupt)
        }
        if let raw = try? Data(contentsOf: previousURL),
           let decoded = try? decoder.decode(AppData.self, from: raw) {
            return decoded
        }
        return AppData()
    }

    // MARK: - 저장

    /// 연속 변경(타이핑, 동기화 등)을 0.8초 단위로 묶고, 5초 넘게 미뤄지면 즉시 저장한다.
    private func scheduleSave() {
        if pendingSince == nil { pendingSince = Date() }
        saveTask?.cancel()
        if let since = pendingSince, Date().timeIntervalSince(since) > 5 {
            performSave()
            return
        }
        saveTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 800_000_000)
            guard !Task.isCancelled else { return }
            self?.performSave()
        }
    }

    private func performSave() {
        pendingSince = nil
        saveGeneration += 1
        let generation = saveGeneration
        let snapshot = data
        let url = storeURL
        Task { await writer.write(snapshot, generation: generation, to: url) }
    }

    /// 대기 없이 곧바로 저장을 시작한다 (앱이 백그라운드로 갈 때, 온보딩 완료 등).
    func saveNow() {
        saveTask?.cancel()
        performSave()
    }

    /// 저장이 디스크에 반영될 때까지 기다린다 (백업 직전, 동기화 중간·마무리용).
    func flush() async {
        saveTask?.cancel()
        pendingSince = nil
        saveGeneration += 1
        let generation = saveGeneration
        await writer.write(data, generation: generation, to: storeURL)
    }

    /// 디스크의 내용으로 메모리 데이터를 교체한다 (백업 복원 후).
    func reloadFromDisk() {
        saveTask?.cancel()
        data = Store.loadData(storeURL: storeURL, previousURL: previousURL)
    }

    func mediaFileURL(_ fileName: String) -> URL {
        mediaDirectoryURL.appendingPathComponent(fileName)
    }

    // MARK: - 하루 기록

    func record(for dayKey: String) -> DailyRecord {
        data.records[dayKey] ?? DailyRecord(id: UUID(), dayKey: dayKey, text: "", attachments: [])
    }

    func update(_ record: DailyRecord) {
        data.records[record.dayKey] = record.isEmpty ? nil : record
    }

    func deleteRecord(for dayKey: String) {
        if let record = data.records[dayKey] {
            for attachment in record.attachments {
                try? FileManager.default.removeItem(at: mediaFileURL(attachment.fileName))
            }
        }
        data.records[dayKey] = nil
    }

    func deleteAttachment(_ attachment: MediaAttachment, from dayKey: String) {
        var updated = record(for: dayKey)
        updated.attachments.removeAll { $0.id == attachment.id }
        try? FileManager.default.removeItem(at: mediaFileURL(attachment.fileName))
        update(updated)
    }

    // MARK: - 미디어 가져오기

    /// 고른 파일들을 앱의 Media 폴더로 복사한다.
    /// 복사는 백그라운드에서 실행해 몇 GB짜리 영상도 UI를 멈추지 않는다.
    func importAttachments(from urls: [URL]) async -> [MediaAttachment] {
        let directory = mediaDirectoryURL
        return await Task.detached(priority: .userInitiated) {
            Store.copyMediaFiles(urls, into: directory)
        }.value
    }

    nonisolated private static func copyMediaFiles(_ urls: [URL], into directory: URL) -> [MediaAttachment] {
        var result: [MediaAttachment] = []
        for url in urls {
            let scoped = url.startAccessingSecurityScopedResource()
            defer {
                if scoped { url.stopAccessingSecurityScopedResource() }
            }

            let type: MediaType
            if let utType = UTType(filenameExtension: url.pathExtension),
               utType.conforms(to: .movie) || utType.conforms(to: .video) {
                type = .video
            } else {
                type = .photo
            }

            let ext = url.pathExtension.isEmpty ? "dat" : url.pathExtension
            let fileName = UUID().uuidString + "." + ext
            let destination = directory.appendingPathComponent(fileName)
            do {
                try FileManager.default.copyItem(at: url, to: destination)
                result.append(MediaAttachment(id: UUID(), fileName: fileName, type: type))
            } catch {
                // 복사가 막히면 데이터로 읽어서 쓰는 경로를 한 번 더 시도한다
                if let data = try? Data(contentsOf: url),
                   (try? data.write(to: destination)) != nil {
                    result.append(MediaAttachment(id: UUID(), fileName: fileName, type: type))
                } else {
                    print("미디어 복사 실패: \(error)")
                }
            }
        }
        return result
    }

    /// 드래그&드롭이나 클립보드 붙여넣기로 들어온 이미지를 JPEG으로 저장한다.
    func addImage(_ image: UIImage) -> MediaAttachment? {
        guard let data = image.jpegData(compressionQuality: 0.9) else { return nil }
        let fileName = UUID().uuidString + ".jpg"
        do {
            try data.write(to: mediaFileURL(fileName))
            return MediaAttachment(id: UUID(), fileName: fileName, type: .photo)
        } catch {
            print("이미지 저장 실패: \(error)")
            return nil
        }
    }

    /// 사진 보관함 등에서 받은 원본 데이터를 확장자 그대로 저장한다.
    func addMediaData(_ data: Data, fileExtension: String, type: MediaType) -> MediaAttachment? {
        let fileName = UUID().uuidString + "." + fileExtension
        do {
            try data.write(to: mediaFileURL(fileName))
            return MediaAttachment(id: UUID(), fileName: fileName, type: type)
        } catch {
            print("미디어 저장 실패: \(error)")
            return nil
        }
    }

    func setCoverPhoto(from url: URL) async {
        replaceCoverPhoto(with: await importAttachments(from: [url]).first)
    }

    func replaceCoverPhoto(with attachment: MediaAttachment?) {
        guard let attachment else { return }
        if let old = data.story.coverPhotoFileName {
            try? FileManager.default.removeItem(at: mediaFileURL(old))
        }
        data.story.coverPhotoFileName = attachment.fileName
    }

    // MARK: - 성장 기록

    func addGrowth(_ entry: GrowthEntry) {
        data.growth.append(entry)
        data.growth.sort { $0.date < $1.date }
    }

    func deleteGrowth(_ entry: GrowthEntry) {
        data.growth.removeAll { $0.id == entry.id }
    }

    // MARK: - 기념일

    func milestones() -> [Milestone] {
        guard let profile = data.profile else { return [] }
        return Day.milestones(birth: profile.birthDate)
    }

    func upcomingMilestones(limit: Int = 3) -> [Milestone] {
        let today = Day.calendar.startOfDay(for: Date())
        return Array(milestones().filter { $0.date >= today }.prefix(limit))
    }

    func milestoneName(on date: Date) -> String? {
        let key = Day.key(for: date)
        return milestones().first { Day.key(for: $0.date) == key }?.name
    }

    // MARK: - 백업·복원

    /// 선택한 폴더 안에 날짜가 붙은 백업 폴더를 만들고 전체 데이터를 복사한다.
    nonisolated static func performBackup(from documents: URL, to destination: URL) throws -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HHmmss"
        let name = "BabyDays 백업 " + formatter.string(from: Date())
        let target = destination.appendingPathComponent(name, isDirectory: true)
        let fm = FileManager.default

        try fm.createDirectory(at: target, withIntermediateDirectories: true)
        try fm.copyItem(
            at: documents.appendingPathComponent("store.json"),
            to: target.appendingPathComponent("store.json")
        )
        let media = documents.appendingPathComponent("Media", isDirectory: true)
        if fm.fileExists(atPath: media.path) {
            try fm.copyItem(at: media, to: target.appendingPathComponent("Media", isDirectory: true))
        }
        return name
    }

    /// 백업 폴더의 내용으로 현재 데이터를 교체한다. 복사 전에 백업 파일이 유효한지 검증한다.
    nonisolated static func performRestore(from backup: URL, into documents: URL) throws {
        let fm = FileManager.default
        let backupStore = backup.appendingPathComponent("store.json")
        let raw = try Data(contentsOf: backupStore)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        _ = try decoder.decode(AppData.self, from: raw)   // 유효한 백업인지 먼저 확인

        try raw.write(to: documents.appendingPathComponent("store.json"), options: .atomic)

        let liveMedia = documents.appendingPathComponent("Media", isDirectory: true)
        let backupMedia = backup.appendingPathComponent("Media", isDirectory: true)
        try? fm.removeItem(at: liveMedia)
        if fm.fileExists(atPath: backupMedia.path) {
            try fm.copyItem(at: backupMedia, to: liveMedia)
        } else {
            try fm.createDirectory(at: liveMedia, withIntermediateDirectories: true)
        }
    }

    nonisolated static func folderSize(at url: URL) -> Int64 {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: url, includingPropertiesForKeys: [.fileSizeKey]) else {
            return 0
        }
        var total: Int64 = 0
        for file in files {
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
            total += Int64(size)
        }
        return total
    }
}
