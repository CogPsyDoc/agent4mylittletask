import Foundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// 앱 데이터 저장소.
/// - 데이터: Documents/store.json (변경 시마다 즉시 저장)
/// - 미디어: Documents/Media/ 폴더에 원본을 복사해 보관
@MainActor
final class Store: ObservableObject {
    @Published var data: AppData {
        didSet { save() }
    }

    private let storeURL: URL
    private let mediaDirectoryURL: URL

    init() {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        storeURL = documents.appendingPathComponent("store.json")
        mediaDirectoryURL = documents.appendingPathComponent("Media", isDirectory: true)
        try? FileManager.default.createDirectory(at: mediaDirectoryURL, withIntermediateDirectories: true)

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        if let raw = try? Data(contentsOf: storeURL),
           let decoded = try? decoder.decode(AppData.self, from: raw) {
            data = decoded
        } else {
            data = AppData()
        }
    }

    private func save() {
        do {
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .iso8601
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
            let raw = try encoder.encode(data)
            try raw.write(to: storeURL, options: .atomic)
        } catch {
            print("저장 실패: \(error)")
        }
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

    /// fileImporter로 고른 파일들을 앱의 Media 폴더로 복사한다.
    func importAttachments(from urls: [URL]) -> [MediaAttachment] {
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
            do {
                try FileManager.default.copyItem(at: url, to: mediaFileURL(fileName))
                result.append(MediaAttachment(id: UUID(), fileName: fileName, type: type))
            } catch {
                // 복사가 막히면 데이터로 읽어서 쓰는 경로를 한 번 더 시도한다
                if let data = try? Data(contentsOf: url),
                   (try? data.write(to: mediaFileURL(fileName))) != nil {
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

    func setCoverPhoto(from url: URL) {
        replaceCoverPhoto(with: importAttachments(from: [url]).first)
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
}
