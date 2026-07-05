// ContentView.swift — 우리 아기 하루하루 (BabyDays)
//
// Swift Playground(맥)에서 "앱" 템플릿으로 새 프로젝트를 만든 뒤,
// 이 파일 내용으로 ContentView.swift 전체를 교체하세요.
// MyApp.swift(@main)는 템플릿 그대로 두면 됩니다 — ContentView()를 띄우기만 하면 돼요.
//
// ⚠️ 앨범 동기화 기능을 쓰려면 사진 보관함 권한이 필요합니다:
//    앱 설정(프로젝트 이름 클릭) → 기능(Capabilities) → 사진 보관함(Photo Library) 추가
//    + 사용 목적 문구 입력. 이 설정 없이 앨범 동기화를 열면 앱이 종료될 수 있어요.
//
// 기능: 생후 일수(태어난 날 = 1일) · 달력 기록(글/사진/영상) ·
//       기념일 D-day(50일/백일/200일/300일/돌) · 성장 그래프 · 탄생 이야기 ·
//       사진 앨범 날짜별 동기화 · 하루 기록 공유(카드 이미지/원본) ·
//       전체 화면 미디어 뷰어(스와이프 / ←→ 키 / Esc 닫기)
// 첨부: 사진 보관함 선택 + 파일 선택 + 드래그&드롭 + 클립보드 붙여넣기
// 저장: 앱 샌드박스 Documents/store.json + Documents/Media/ (변경 즉시 자동 저장)

import SwiftUI
import Foundation
import Combine
import Charts
import AVKit
import AVFoundation
import UIKit
import PhotosUI
import Photos
import UniformTypeIdentifiers

// MARK: - 진입점

struct ContentView: View {
    @StateObject private var store = Store()

    var body: some View {
        Group {
            if store.data.profile == nil {
                OnboardingView()
            } else {
                MainView()
            }
        }
        .environment(\.locale, .koreanWith24Hour)  // 년월일 표기 + 24시간제
        .preferredColorScheme(.light)              // 항상 밝은 테마
        .tint(Theme.accent)
        .environmentObject(store)
    }
}

enum AppSection: String, CaseIterable, Identifiable {
    case home = "홈"
    case calendar = "달력"
    case growth = "성장"
    case story = "탄생 이야기"

    var id: AppSection { self }

    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .calendar: return "calendar"
        case .growth: return "chart.line.uptrend.xyaxis"
        case .story: return "heart.fill"
        }
    }
}

struct MainView: View {
    @EnvironmentObject private var store: Store
    @State private var section: AppSection? = .home

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $section) { item in
                Label(item.rawValue, systemImage: item.icon)
                    .tag(item)
            }
            .navigationTitle(store.data.profile?.name ?? "우리 아기")
        } detail: {
            switch section ?? .home {
            case .home:
                HomeView(section: $section)
            case .calendar:
                CalendarView()
            case .growth:
                GrowthView()
            case .story:
                BirthStoryView()
            }
        }
    }
}


/// 앱 전체에서 쓰는 따뜻한 파스텔 톤 팔레트.
enum Theme {
    static let background = Color(red: 1.0, green: 0.973, blue: 0.945)   // 따뜻한 크림
    static let card = Color.white
    static let accent = Color(red: 0.96, green: 0.42, blue: 0.52)        // 코랄 핑크
    static let accentSoft = Color(red: 1.0, green: 0.90, blue: 0.90)
    static let peach = Color(red: 1.0, green: 0.93, blue: 0.85)
    static let mint = Color(red: 0.86, green: 0.96, blue: 0.90)
    static let lavender = Color(red: 0.93, green: 0.91, blue: 0.98)
    static let sky = Color(red: 0.88, green: 0.94, blue: 0.99)

    /// 홈 카운터 카드에 쓰는 코랄 → 살구 그라데이션.
    static let gradient = LinearGradient(
        colors: [
            Color(red: 0.98, green: 0.45, blue: 0.55),
            Color(red: 1.0, green: 0.63, blue: 0.45)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let milestonePastels: [Color] = [accentSoft, mint, lavender, peach, sky]
}

extension View {
    /// 크림색 배경 위에 얹는 흰색 라운드 카드.
    func card(_ color: Color = Theme.card, cornerRadius: CGFloat = 16) -> some View {
        self
            .padding(16)
            .background(RoundedRectangle(cornerRadius: cornerRadius).fill(color))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.black.opacity(0.05))
            )
            .shadow(color: Color.black.opacity(0.05), radius: 6, y: 2)
    }
}

extension Locale {
    /// 한국어 년월일 표기 + 24시간제. DatePicker 등 시스템 컨트롤에 적용한다.
    static let koreanWith24Hour: Locale = {
        var components = Locale.Components(identifier: "ko_KR")
        components.hourCycle = .zeroToTwentyThree
        return Locale(components: components)
    }()
}


// MARK: - 데이터 모델

struct BabyProfile: Codable {
    var name: String
    var birthDate: Date
    var birthPlace: String = ""
}

enum MediaType: String, Codable {
    case photo
    case video
}

struct MediaAttachment: Codable, Identifiable, Hashable {
    var id: UUID
    var fileName: String
    var type: MediaType
}

/// 하루 기록. 날짜당 하나이며 "yyyy-MM-dd" 형식의 dayKey로 식별한다.
struct DailyRecord: Codable, Identifiable {
    var id: UUID
    var dayKey: String
    var text: String
    var attachments: [MediaAttachment]

    var isEmpty: Bool {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.isEmpty
    }
}

struct GrowthEntry: Codable, Identifiable {
    var id: UUID
    var date: Date
    var heightCm: Double?
    var weightKg: Double?
}

struct BirthStory: Codable {
    var letter: String = ""
    var birthHeightCm: Double?
    var birthWeightKg: Double?
    var coverPhotoFileName: String?
}

/// 앱 전체 데이터. store.json 하나로 직렬화된다.
struct AppData: Codable {
    var profile: BabyProfile?
    var records: [String: DailyRecord]
    var growth: [GrowthEntry]
    var story: BirthStory

    // 사진 앨범 동기화 상태
    var syncedAlbumId: String?
    var syncedAlbumName: String?
    var syncedAssetIds: Set<String>
    var lastSyncDate: Date?

    init() {
        profile = nil
        records = [:]
        growth = []
        story = BirthStory()
        syncedAssetIds = []
    }

    // 이후 버전에서 필드가 추가되어도 기존 파일을 읽을 수 있도록 관대하게 디코딩한다.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        profile = try container.decodeIfPresent(BabyProfile.self, forKey: .profile)
        records = try container.decodeIfPresent([String: DailyRecord].self, forKey: .records) ?? [:]
        growth = try container.decodeIfPresent([GrowthEntry].self, forKey: .growth) ?? []
        story = try container.decodeIfPresent(BirthStory.self, forKey: .story) ?? BirthStory()
        syncedAlbumId = try container.decodeIfPresent(String.self, forKey: .syncedAlbumId)
        syncedAlbumName = try container.decodeIfPresent(String.self, forKey: .syncedAlbumName)
        syncedAssetIds = try container.decodeIfPresent(Set<String>.self, forKey: .syncedAssetIds) ?? []
        lastSyncDate = try container.decodeIfPresent(Date.self, forKey: .lastSyncDate)
    }
}

struct Milestone: Identifiable {
    var id: String { name }
    let name: String
    let date: Date
}

// MARK: - 날짜 계산

enum Day {
    static let calendar = Calendar.current

    /// "yyyy-MM-dd" 키. 기록 저장과 달력 셀 매칭에 사용한다.
    static func key(for date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func date(from key: String) -> Date {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return Date() }
        var c = DateComponents()
        c.year = parts[0]
        c.month = parts[1]
        c.day = parts[2]
        return calendar.date(from: c) ?? Date()
    }

    /// 생후 일수. 태어난 날을 1일로 센다 (백일 = 생일 + 99일).
    static func daysSinceBirth(birth: Date, on date: Date = Date()) -> Int {
        let start = calendar.startOfDay(for: birth)
        let end = calendar.startOfDay(for: date)
        let diff = calendar.dateComponents([.day], from: start, to: end).day ?? 0
        return diff + 1
    }

    /// "만 3개월 12일" / "만 1살 2개월" 형태의 만 나이 문자열.
    static func ageText(birth: Date) -> String {
        let comps = calendar.dateComponents(
            [.month, .day],
            from: calendar.startOfDay(for: birth),
            to: calendar.startOfDay(for: Date())
        )
        let months = comps.month ?? 0
        let days = comps.day ?? 0
        if months >= 12 {
            return "만 \(months / 12)살 \(months % 12)개월"
        }
        return "만 \(months)개월 \(days)일"
    }

    /// 생일 기준 기념일 목록: 50일, 백일, 200일, 300일, 첫돌과 매년 생일.
    static func milestones(birth: Date) -> [Milestone] {
        let start = calendar.startOfDay(for: birth)
        var result: [Milestone] = []

        for (n, name) in [(50, "50일"), (100, "백일"), (200, "200일"), (300, "300일")] {
            if let d = calendar.date(byAdding: .day, value: n - 1, to: start) {
                result.append(Milestone(name: name, date: d))
            }
        }

        let ageYears = calendar.dateComponents(
            [.year], from: start, to: calendar.startOfDay(for: Date())
        ).year ?? 0
        for year in 1...max(2, ageYears + 2) {
            if let d = calendar.date(byAdding: .year, value: year, to: start) {
                result.append(Milestone(name: year == 1 ? "첫돌" : "\(year)번째 생일", date: d))
            }
        }

        return result.sorted { $0.date < $1.date }
    }

    static func ddayText(to date: Date) -> String {
        let today = calendar.startOfDay(for: Date())
        let target = calendar.startOfDay(for: date)
        let diff = calendar.dateComponents([.day], from: today, to: target).day ?? 0
        if diff == 0 { return "오늘 🎉" }
        return diff > 0 ? "D-\(diff)" : "\(-diff)일 지남"
    }

    // MARK: 달력 그리드

    static func firstOfMonth(_ date: Date) -> Date {
        let comps = calendar.dateComponents([.year, .month], from: date)
        return calendar.date(from: comps) ?? date
    }

    static func addMonths(_ value: Int, to date: Date) -> Date {
        calendar.date(byAdding: .month, value: value, to: date) ?? date
    }

    /// 일요일 시작 달력 그리드. 앞쪽 빈 칸은 nil.
    static func gridDays(for month: Date) -> [Date?] {
        let first = firstOfMonth(month)
        let leading = calendar.component(.weekday, from: first) - 1
        let count = calendar.range(of: .day, in: .month, for: first)?.count ?? 30
        var days: [Date?] = Array(repeating: nil, count: leading)
        for offset in 0..<count {
            days.append(calendar.date(byAdding: .day, value: offset, to: first))
        }
        return days
    }

    // MARK: 표시용 문자열

    private static func formatter(_ format: String) -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = format
        return f
    }

    private static let longFormatter = formatter("yyyy년 M월 d일 (E)")
    private static let monthFormatter = formatter("yyyy년 M월")
    private static let timeFormatter = formatter("H시 m분")

    static func longString(_ date: Date) -> String { longFormatter.string(from: date) }
    static func monthTitle(_ date: Date) -> String { monthFormatter.string(from: date) }
    static func timeString(_ date: Date) -> String { timeFormatter.string(from: date) }
}

func parseDouble(_ text: String) -> Double? {
    Double(text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "."))
}


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


/// 첫 실행 시 한 번만 보이는 아이 등록 화면.
struct OnboardingView: View {
    @EnvironmentObject private var store: Store

    @State private var name = ""
    @State private var birthDate = Day.calendar.startOfDay(for: Date())
    @State private var birthPlace = ""
    @State private var heightText = ""
    @State private var weightText = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(Theme.accentSoft)
                            .frame(width: 96, height: 96)
                        Text("🐥")
                            .font(.system(size: 48))
                    }
                    Text("우리 아기 하루하루")
                        .font(.largeTitle.bold())
                    Text("아이의 정보를 입력하면 기록을 시작할 수 있어요")
                        .foregroundColor(.secondary)
                }
                .padding(.top, 48)

                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("이름").font(.headline)
                        TextField("아이 이름 또는 태명", text: $name)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("태어난 날짜와 시간").font(.headline)
                        DatePicker(
                            "생년월일",
                            selection: $birthDate,
                            displayedComponents: [.date, .hourAndMinute]
                        )
                        .labelsHidden()
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("태어난 곳 (선택)").font(.headline)
                        TextField("예: ○○병원", text: $birthPlace)
                            .textFieldStyle(.roundedBorder)
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("출생 키·몸무게 (선택)").font(.headline)
                        HStack {
                            TextField("키 cm", text: $heightText)
                            TextField("몸무게 kg", text: $weightText)
                        }
                        .textFieldStyle(.roundedBorder)
                        Text("입력하면 성장 그래프의 첫 데이터가 돼요")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                .card(cornerRadius: 20)
                .frame(maxWidth: 440)

                Button(action: start) {
                    Text("시작하기")
                        .font(.headline)
                        .frame(maxWidth: 408)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(Theme.accent)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)

                Spacer(minLength: 40)
            }
            .frame(maxWidth: .infinity)
            .padding()
        }
        .background(Theme.background.ignoresSafeArea())
    }

    private func start() {
        let height = parseDouble(heightText)
        let weight = parseDouble(weightText)

        store.data.profile = BabyProfile(
            name: name.trimmingCharacters(in: .whitespaces),
            birthDate: birthDate,
            birthPlace: birthPlace.trimmingCharacters(in: .whitespaces)
        )
        store.data.story.birthHeightCm = height
        store.data.story.birthWeightKg = weight
        if height != nil || weight != nil {
            store.addGrowth(GrowthEntry(id: UUID(), date: birthDate, heightCm: height, weightKg: weight))
        }
    }
}


/// 생후 일수가 가장 크게 보이는 메인 화면.
struct HomeView: View {
    @EnvironmentObject private var store: Store
    @Binding var section: AppSection?

    // 창을 며칠씩 켜 둬도 자정이 지나면 일수가 갱신되도록 1분마다 새로 그린다
    @State private var now = Date()
    private let minuteTimer = Timer.publish(every: 60, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            if let profile = store.data.profile {
                VStack(spacing: 24) {
                    dayCounter(profile: profile)
                    milestonesSection
                    todaySection
                    Spacer(minLength: 20)
                }
                .frame(maxWidth: 640)
                .frame(maxWidth: .infinity)
                .padding()
            }
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("홈")
        .onReceive(minuteTimer) { now = $0 }
    }

    private func dayCounter(profile: BabyProfile) -> some View {
        VStack(spacing: 6) {
            Text(profile.name)
                .font(.title2.bold())
            Text("태어난 지")
                .font(.title3)
                .opacity(0.9)
            Text("\(Day.daysSinceBirth(birth: profile.birthDate, on: now))일")
                .font(.system(size: 88, weight: .heavy, design: .rounded))
            Text("\(Day.ageText(birth: profile.birthDate)) · \(Day.longString(profile.birthDate)) 태어남")
                .font(.subheadline)
                .opacity(0.9)
        }
        .foregroundColor(.white)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 36)
        .background(RoundedRectangle(cornerRadius: 24).fill(Theme.gradient))
        .shadow(color: Theme.accent.opacity(0.35), radius: 12, y: 5)
        .padding(.top, 16)
    }

    @ViewBuilder
    private var milestonesSection: some View {
        let upcoming = store.upcomingMilestones(limit: 3)
        if !upcoming.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("다가오는 기념일")
                    .font(.headline)
                HStack(spacing: 12) {
                    ForEach(upcoming.indices, id: \.self) { index in
                        let milestone = upcoming[index]
                        VStack(spacing: 6) {
                            Text(milestone.name)
                                .font(.headline)
                            Text(Day.longString(milestone.date))
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(Day.ddayText(to: milestone.date))
                                .font(.title3.bold())
                                .foregroundColor(Theme.accent)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Theme.milestonePastels[index % Theme.milestonePastels.count])
                        )
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private var todaySection: some View {
        let todayKey = Day.key(for: Date())
        VStack(alignment: .leading, spacing: 12) {
            Text("오늘")
                .font(.headline)
            if let record = store.data.records[todayKey], !record.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    if !record.text.isEmpty {
                        Text(record.text)
                            .lineLimit(3)
                    }
                    if !record.attachments.isEmpty {
                        Label("사진·영상 \(record.attachments.count)개", systemImage: "paperclip")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Button("달력에서 보기") {
                        section = .calendar
                    }
                    .font(.subheadline)
                    .foregroundColor(Theme.accent)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .card()
            } else {
                Button {
                    section = .calendar
                } label: {
                    Label("오늘을 기록해 보세요", systemImage: "square.and.pencil")
                        .font(.headline)
                        .foregroundColor(Theme.accent)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 18)
                        .background(
                            RoundedRectangle(cornerRadius: 16)
                                .fill(Theme.accentSoft)
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}


/// 월간 달력 + 선택한 날짜의 기록 편집기.
struct CalendarView: View {
    @EnvironmentObject private var store: Store
    @State private var month = Day.firstOfMonth(Date())
    @State private var selectedKey = Day.key(for: Date())
    @State private var showingAlbumSync = false

    private static let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    monthHeader
                    weekdayHeader
                    monthGrid
                }
                .card(cornerRadius: 20)

                Button {
                    showingAlbumSync = true
                } label: {
                    Label(
                        store.data.syncedAlbumName.map { "'\($0)' 앨범 동기화" } ?? "사진 앨범 동기화",
                        systemImage: "arrow.triangle.2.circlepath"
                    )
                    .font(.caption)
                }
                .buttonStyle(.bordered)
                .tint(Theme.accent)
                .padding(.top, 12)

                Spacer(minLength: 0)
            }
            .padding()
            .frame(minWidth: 380, maxWidth: 520)

            Divider()

            RecordEditorView(dayKey: selectedKey)
                .id(selectedKey)
                .frame(maxWidth: .infinity)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("달력")
        .sheet(isPresented: $showingAlbumSync) {
            AlbumSyncView()
        }
    }

    private var monthHeader: some View {
        HStack {
            Button {
                month = Day.firstOfMonth(Day.addMonths(-1, to: month))
            } label: {
                Image(systemName: "chevron.left")
            }

            Spacer()
            Text(Day.monthTitle(month))
                .font(.title3.bold())
            Spacer()

            Button("오늘") {
                month = Day.firstOfMonth(Date())
                selectedKey = Day.key(for: Date())
            }
            .font(.caption)

            Button {
                month = Day.firstOfMonth(Day.addMonths(1, to: month))
            } label: {
                Image(systemName: "chevron.right")
            }
        }
    }

    private var weekdayHeader: some View {
        HStack {
            ForEach(Self.weekdaySymbols, id: \.self) { symbol in
                Text(symbol)
                    .font(.caption.bold())
                    .foregroundColor(
                        symbol == "일" ? .red : symbol == "토" ? .blue : .secondary
                    )
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var monthGrid: some View {
        let days = Day.gridDays(for: month)
        return LazyVGrid(
            columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7),
            spacing: 4
        ) {
            ForEach(days.indices, id: \.self) { index in
                if let day = days[index] {
                    DayCell(
                        date: day,
                        isSelected: Day.key(for: day) == selectedKey
                    ) {
                        selectedKey = Day.key(for: day)
                    }
                } else {
                    Color.clear
                        .frame(minHeight: 52)
                }
            }
        }
    }
}

private struct DayCell: View {
    @EnvironmentObject private var store: Store
    let date: Date
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        let key = Day.key(for: date)
        let hasRecord = store.data.records[key] != nil
        let milestone = store.milestoneName(on: date)
        let isToday = key == Day.key(for: Date())
        let weekday = Day.calendar.component(.weekday, from: date)

        Button(action: onTap) {
            VStack(spacing: 3) {
                Text("\(Day.calendar.component(.day, from: date))")
                    .font(.callout.weight(isToday || isSelected ? .bold : .regular))
                    .foregroundColor(
                        isSelected ? .white
                        : weekday == 1 ? .red
                        : weekday == 7 ? .blue
                        : .primary
                    )
                HStack(spacing: 3) {
                    if milestone != nil {
                        Text("🎉").font(.system(size: 9))
                    }
                    if hasRecord {
                        Circle()
                            .fill(isSelected ? Color.white : Theme.accent)
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(height: 11)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(isSelected ? Theme.accent : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isToday && !isSelected ? Theme.accent : Color.clear, lineWidth: 1.5)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}


/// 하루 기록 편집기. 글은 입력 즉시 저장되고,
/// 사진·영상은 파일 선택 / 드래그&드롭 / 클립보드 붙여넣기로 첨부한다.
struct RecordEditorView: View {
    @EnvironmentObject private var store: Store
    let dayKey: String

    @State private var text = ""
    @State private var showingImporter = false
    @State private var confirmingDelete = false
    @State private var viewer: MediaViewerContext?
    @State private var dropTargeted = false
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showingShareDialog = false
    @State private var shareItems: [Any]?

    private var record: DailyRecord { store.record(for: dayKey) }
    private var date: Date { Day.date(from: dayKey) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                textEditor
                attachmentsSection
                addButtons
                dropZone

                if !record.isEmpty {
                    Button(role: .destructive) {
                        confirmingDelete = true
                    } label: {
                        Label("이 날의 기록 삭제", systemImage: "trash")
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background)
        .onDrop(of: [.image, .movie, .fileURL], isTargeted: $dropTargeted, perform: handleDrop)
        .onAppear { text = record.text }
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.image, .movie],
            allowsMultipleSelection: true
        ) { result in
            if case .success(let urls) = result {
                appendAttachments(store.importAttachments(from: urls))
            }
        }
        .confirmationDialog(
            "이 날의 글과 사진·영상을 모두 삭제할까요?",
            isPresented: $confirmingDelete,
            titleVisibility: .visible
        ) {
            Button("삭제", role: .destructive) {
                store.deleteRecord(for: dayKey)
                text = ""
            }
        }
        .fullScreenCover(item: $viewer) { context in
            MediaViewerView(attachments: context.attachments, startIndex: context.startIndex)
        }
        .confirmationDialog(
            "이 날의 기록을 어떻게 공유할까요?",
            isPresented: $showingShareDialog,
            titleVisibility: .visible
        ) {
            Button("카드 이미지로 공유") { shareAsCard() }
            Button("글·사진 원본 공유") { shareOriginals() }
        }
        .sheet(isPresented: Binding(
            get: { shareItems != nil },
            set: { if !$0 { shareItems = nil } }
        )) {
            ActivityView(items: shareItems ?? [])
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Day.longString(date))
                    .font(.title2.bold())
                HStack(spacing: 8) {
                    if let daysLabel {
                        Text(daysLabel)
                            .foregroundColor(Theme.accent)
                    }
                    if let milestone = store.milestoneName(on: date) {
                        Text("🎉 \(milestone)")
                    }
                }
                .font(.subheadline)
            }
            Spacer()
            if !record.isEmpty {
                Button {
                    showingShareDialog = true
                } label: {
                    Label("공유", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
                .tint(Theme.accent)
            }
        }
    }

    private var daysLabel: String? {
        guard let birth = store.data.profile?.birthDate else { return nil }
        let days = Day.daysSinceBirth(birth: birth, on: date)
        return days >= 1 ? "생후 \(days)일" : nil
    }

    private var textEditor: some View {
        TextEditor(text: $text)
            .font(.body)
            .frame(minHeight: 180)
            .padding(8)
            .scrollContentBackground(.hidden)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.black.opacity(0.07))
            )
            .overlay(alignment: .topLeading) {
                if text.isEmpty {
                    Text("오늘의 이야기를 자유롭게 남겨 보세요…")
                        .foregroundColor(.secondary)
                        .padding(.top, 16)
                        .padding(.leading, 14)
                        .allowsHitTesting(false)
                }
            }
            .onChange(of: text) { newValue in
                var updated = record
                updated.text = newValue
                store.update(updated)
            }
    }

    @ViewBuilder
    private var attachmentsSection: some View {
        let attachments = record.attachments
        if !attachments.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
                    ForEach(attachments.indices, id: \.self) { index in
                        let attachment = attachments[index]
                        Group {
                            if attachment.type == .photo {
                                StoredImage(fileName: attachment.fileName, thumbnailSize: 240)
                            } else {
                                VideoThumbnail(fileName: attachment.fileName)
                            }
                        }
                        .id(attachment.id)
                        .frame(width: 110, height: 110)
                        .clipped()
                        .cornerRadius(10)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            viewer = MediaViewerContext(attachments: attachments, startIndex: index)
                        }
                        .contextMenu { deleteButton(attachment) }
                    }
                }
                Text("클릭하면 크게 보고, 우클릭하면 삭제할 수 있어요")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var addButtons: some View {
        HStack(spacing: 12) {
            PhotosPicker(
                selection: $pickerItems,
                matching: .any(of: [.images, .videos])
            ) {
                Label("사진 보관함", systemImage: "photo.stack")
            }
            Button {
                showingImporter = true
            } label: {
                Label("파일에서", systemImage: "folder")
            }
            Button(action: pasteFromClipboard) {
                Label("붙여넣기", systemImage: "doc.on.clipboard")
            }
        }
        .buttonStyle(.bordered)
        .tint(Theme.accent)
        .onChange(of: pickerItems) { items in
            guard !items.isEmpty else { return }
            Task {
                var new: [MediaAttachment] = []
                for item in items {
                    let isVideo = item.supportedContentTypes.contains {
                        $0.conforms(to: .movie) || $0.conforms(to: .audiovisualContent)
                    }
                    guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                    let ext = item.supportedContentTypes.first?.preferredFilenameExtension
                        ?? (isVideo ? "mov" : "jpg")
                    if let attachment = store.addMediaData(
                        data,
                        fileExtension: ext,
                        type: isVideo ? .video : .photo
                    ) {
                        new.append(attachment)
                    }
                }
                appendAttachments(new)
                pickerItems = []
            }
        }
    }

    private var dropZone: some View {
        VStack(spacing: 6) {
            Image(systemName: "square.and.arrow.down.on.square")
                .font(.title3)
            Text("사진 앱이나 Finder에서 사진·영상을 여기로 끌어다 놓아도 돼요")
                .font(.caption)
        }
        .foregroundColor(dropTargeted ? Theme.accent : .secondary)
        .frame(maxWidth: .infinity, minHeight: 84)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(dropTargeted ? Theme.accentSoft : Color.white)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6]))
                .foregroundColor(dropTargeted ? Theme.accent : Color.secondary.opacity(0.35))
        )
    }

    private func deleteButton(_ attachment: MediaAttachment) -> some View {
        Button(role: .destructive) {
            store.deleteAttachment(attachment, from: dayKey)
        } label: {
            Label("삭제", systemImage: "trash")
        }
    }

    // MARK: - 첨부 추가 경로들

    private func appendAttachments(_ new: [MediaAttachment]) {
        guard !new.isEmpty else { return }
        var updated = record
        updated.attachments.append(contentsOf: new)
        store.update(updated)
    }

    /// 클립보드의 이미지를 첨부한다 (스크린샷, 복사한 그림 등).
    private func pasteFromClipboard() {
        let pasteboard = UIPasteboard.general
        if let images = pasteboard.images, !images.isEmpty {
            appendAttachments(images.compactMap { store.addImage($0) })
        } else if let image = pasteboard.image, let attachment = store.addImage(image) {
            appendAttachments([attachment])
        }
    }

    // MARK: - 공유

    /// 하루 기록을 한 장의 카드 이미지로 렌더링해 공유한다.
    @MainActor
    private func shareAsCard() {
        let card = ShareCardView(
            babyName: store.data.profile?.name ?? "",
            daysText: daysLabel,
            dateText: Day.longString(date),
            bodyText: record.text,
            images: loadedPhotoImages(limit: 4)
        )
        let renderer = ImageRenderer(content: card)
        renderer.scale = 2
        if let image = renderer.uiImage {
            shareItems = [image]
        }
    }

    /// 요약 글 + 사진 원본 + 영상 파일을 그대로 공유한다.
    private func shareOriginals() {
        var summary = store.data.profile?.name ?? ""
        if let daysLabel {
            summary += summary.isEmpty ? daysLabel : " · \(daysLabel)"
        }
        summary += " · \(Day.longString(date))"
        if !record.text.isEmpty {
            summary += "\n\n" + record.text
        }

        var items: [Any] = [summary]
        for attachment in record.attachments {
            let url = store.mediaFileURL(attachment.fileName)
            if attachment.type == .photo, let image = UIImage(contentsOfFile: url.path) {
                items.append(image)
            } else {
                items.append(url)
            }
        }
        shareItems = items
    }

    private func loadedPhotoImages(limit: Int) -> [UIImage] {
        record.attachments
            .filter { $0.type == .photo }
            .prefix(limit)
            .compactMap { attachment in
                let path = store.mediaFileURL(attachment.fileName).path
                guard let image = UIImage(contentsOfFile: path) else { return nil }
                return image.preparingThumbnail(of: CGSize(width: 900, height: 900)) ?? image
            }
    }

    /// 사진 앱·Finder 등에서 드래그해 온 항목을 첨부한다.
    private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        var handled = false
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                handled = true
                provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, _ in
                    guard let url else { return }
                    // 원본 임시 파일은 이 핸들러가 끝나면 사라지므로 여기서 바로 복사해 둔다
                    let ext = url.pathExtension.isEmpty ? "mov" : url.pathExtension
                    let copied = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString + "." + ext)
                    do {
                        try FileManager.default.copyItem(at: url, to: copied)
                    } catch {
                        return
                    }
                    DispatchQueue.main.async {
                        appendAttachments(store.importAttachments(from: [copied]))
                        try? FileManager.default.removeItem(at: copied)
                    }
                }
            } else if provider.canLoadObject(ofClass: UIImage.self) {
                handled = true
                provider.loadObject(ofClass: UIImage.self) { object, _ in
                    guard let image = object as? UIImage else { return }
                    DispatchQueue.main.async {
                        if let attachment = store.addImage(image) {
                            appendAttachments([attachment])
                        }
                    }
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                handled = true
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    var url: URL?
                    if let data = item as? Data {
                        url = URL(dataRepresentation: data, relativeTo: nil)
                    } else if let direct = item as? URL {
                        url = direct
                    }
                    guard let url else { return }
                    DispatchQueue.main.async {
                        appendAttachments(store.importAttachments(from: [url]))
                    }
                }
            }
        }
        return handled
    }
}


private struct GrowthPoint: Identifiable {
    let date: Date
    let value: Double
    var id: Date { date }
}

/// 키/몸무게 입력과 추이 그래프.
struct GrowthView: View {
    @EnvironmentObject private var store: Store

    @State private var date = Date()
    @State private var heightText = ""
    @State private var weightText = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                inputCard
                chartSection(
                    title: "키 (cm)",
                    color: .blue,
                    values: store.data.growth.compactMap { entry in
                        entry.heightCm.map { GrowthPoint(date: entry.date, value: $0) }
                    }
                )
                chartSection(
                    title: "몸무게 (kg)",
                    color: .orange,
                    values: store.data.growth.compactMap { entry in
                        entry.weightKg.map { GrowthPoint(date: entry.date, value: $0) }
                    }
                )
                historyList
            }
            .padding()
            .frame(maxWidth: 720)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("성장")
    }

    private var inputCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("새 기록")
                .font(.headline)
            DatePicker("날짜", selection: $date, displayedComponents: .date)
            HStack {
                TextField("키 (cm)", text: $heightText)
                TextField("몸무게 (kg)", text: $weightText)
                Button("추가", action: add)
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.accent)
                    .disabled(parseDouble(heightText) == nil && parseDouble(weightText) == nil)
            }
            .textFieldStyle(.roundedBorder)
        }
        .card()
    }

    private func add() {
        store.addGrowth(
            GrowthEntry(
                id: UUID(),
                date: date,
                heightCm: parseDouble(heightText),
                weightKg: parseDouble(weightText)
            )
        )
        heightText = ""
        weightText = ""
    }

    @ViewBuilder
    private func chartSection(title: String, color: Color, values: [GrowthPoint]) -> some View {
        if !values.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.headline)
                Chart {
                    ForEach(values) { point in
                        LineMark(
                            x: .value("날짜", point.date),
                            y: .value(title, point.value)
                        )
                        .foregroundStyle(color)
                        PointMark(
                            x: .value("날짜", point.date),
                            y: .value(title, point.value)
                        )
                        .foregroundStyle(color)
                    }
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 220)
            }
            .card()
        }
    }

    @ViewBuilder
    private var historyList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("기록 목록")
                .font(.headline)
            if store.data.growth.isEmpty {
                Text("아직 성장 기록이 없어요. 위에서 첫 기록을 추가해 보세요.")
                    .foregroundColor(.secondary)
            }
            ForEach(store.data.growth.reversed()) { entry in
                HStack {
                    Text(Day.longString(entry.date))
                    if let birth = store.data.profile?.birthDate {
                        Text("(생후 \(Day.daysSinceBirth(birth: birth, on: entry.date))일)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    if let height = entry.heightCm {
                        Text("\(height, specifier: "%.1f") cm")
                            .foregroundColor(.blue)
                    }
                    if let weight = entry.weightKg {
                        Text("\(weight, specifier: "%.2f") kg")
                            .foregroundColor(.orange)
                    }
                    Button(role: .destructive) {
                        store.deleteGrowth(entry)
                    } label: {
                        Image(systemName: "trash")
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
                Divider()
            }
        }
    }
}


/// 탄생 순간을 기억하는 고정 페이지. 탄생 정보 수정도 여기서 한다.
struct BirthStoryView: View {
    @EnvironmentObject private var store: Store

    @State private var showingPhotoImporter = false
    @State private var coverPickerItem: PhotosPickerItem?
    @State private var coverDropTargeted = false
    @State private var showingCoverViewer = false
    @State private var heightText = ""
    @State private var weightText = ""
    @State private var letter = ""
    @State private var loaded = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                coverSection
                birthSummary
                infoCard
                measurementsCard
                letterCard
            }
            .padding()
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("탄생 이야기")
        .onAppear(perform: loadOnce)
        .fileImporter(
            isPresented: $showingPhotoImporter,
            allowedContentTypes: [.image],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                store.setCoverPhoto(from: url)
            }
        }
    }

    private func loadOnce() {
        guard !loaded else { return }
        loaded = true
        letter = store.data.story.letter
        if let height = store.data.story.birthHeightCm { heightText = String(height) }
        if let weight = store.data.story.birthWeightKg { weightText = String(weight) }
    }

    private var coverSection: some View {
        VStack(spacing: 12) {
            coverImageArea
                .onDrop(
                    of: [.image, .fileURL],
                    isTargeted: $coverDropTargeted,
                    perform: handleCoverDrop
                )

            HStack(spacing: 12) {
                PhotosPicker(selection: $coverPickerItem, matching: .images) {
                    Label("사진 보관함", systemImage: "photo.stack")
                }
                Button {
                    showingPhotoImporter = true
                } label: {
                    Label("파일에서", systemImage: "folder")
                }
                Button(action: pasteCover) {
                    Label("붙여넣기", systemImage: "doc.on.clipboard")
                }
            }
            .buttonStyle(.bordered)
            .tint(Theme.accent)
        }
        .onChange(of: coverPickerItem) { item in
            guard let item else { return }
            Task {
                if let data = try? await item.loadTransferable(type: Data.self),
                   let image = UIImage(data: data),
                   let attachment = store.addImage(image) {
                    store.replaceCoverPhoto(with: attachment)
                }
                coverPickerItem = nil
            }
        }
    }

    @ViewBuilder
    private var coverImageArea: some View {
        if let fileName = store.data.story.coverPhotoFileName {
            StoredImage(fileName: fileName, fill: false)
                .frame(maxHeight: 320)
                .cornerRadius(16)
                .contentShape(Rectangle())
                .onTapGesture { showingCoverViewer = true }
                .fullScreenCover(isPresented: $showingCoverViewer) {
                    MediaViewerView(
                        attachments: [MediaAttachment(id: UUID(), fileName: fileName, type: .photo)],
                        startIndex: 0
                    )
                }
        } else {
            VStack(spacing: 8) {
                Image(systemName: "photo.badge.plus")
                    .font(.system(size: 40))
                Text("탄생 사진 추가")
                Text("사진 앱에서 끌어다 놓거나 아래 버튼을 눌러 주세요")
                    .font(.caption)
            }
            .foregroundColor(coverDropTargeted ? Theme.accent : .secondary)
            .frame(maxWidth: .infinity, minHeight: 180)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(coverDropTargeted ? Theme.accentSoft : Color.white.opacity(0.6))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6]))
                    .foregroundColor(coverDropTargeted ? Theme.accent : .secondary.opacity(0.5))
            )
        }
    }

    /// 클립보드의 이미지를 탄생 사진으로 넣는다.
    private func pasteCover() {
        guard let image = UIPasteboard.general.image,
              let attachment = store.addImage(image) else { return }
        store.replaceCoverPhoto(with: attachment)
    }

    /// 사진 앱·Finder에서 끌어온 이미지를 탄생 사진으로 넣는다.
    private func handleCoverDrop(_ providers: [NSItemProvider]) -> Bool {
        guard let provider = providers.first else { return false }
        if provider.canLoadObject(ofClass: UIImage.self) {
            provider.loadObject(ofClass: UIImage.self) { object, _ in
                guard let image = object as? UIImage else { return }
                DispatchQueue.main.async {
                    if let attachment = store.addImage(image) {
                        store.replaceCoverPhoto(with: attachment)
                    }
                }
            }
            return true
        }
        if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                var url: URL?
                if let data = item as? Data {
                    url = URL(dataRepresentation: data, relativeTo: nil)
                } else if let direct = item as? URL {
                    url = direct
                }
                guard let url else { return }
                DispatchQueue.main.async {
                    store.setCoverPhoto(from: url)
                }
            }
            return true
        }
        return false
    }

    @ViewBuilder
    private var birthSummary: some View {
        if let profile = store.data.profile {
            VStack(spacing: 4) {
                Text("\(profile.name)는(은)")
                    .foregroundColor(.secondary)
                Text("\(Day.longString(profile.birthDate)) \(Day.timeString(profile.birthDate))")
                    .font(.title3.bold())
                if !profile.birthPlace.isEmpty {
                    Text("\(profile.birthPlace)에서")
                        .foregroundColor(.secondary)
                }
                Text("우리에게 왔어요 💗")
                    .foregroundColor(.secondary)
            }
        }
    }

    private var infoCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("탄생 정보")
                .font(.headline)
            TextField("이름", text: binding(\.name))
                .textFieldStyle(.roundedBorder)
            DatePicker(
                "태어난 날짜와 시간",
                selection: birthDateBinding,
                displayedComponents: [.date, .hourAndMinute]
            )
            TextField("태어난 곳", text: binding(\.birthPlace))
                .textFieldStyle(.roundedBorder)
        }
        .card()
    }

    private var measurementsCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("태어났을 때")
                .font(.headline)
            HStack {
                TextField("키 cm", text: $heightText)
                    .onChange(of: heightText) { newValue in
                        store.data.story.birthHeightCm = parseDouble(newValue)
                    }
                TextField("몸무게 kg", text: $weightText)
                    .onChange(of: weightText) { newValue in
                        store.data.story.birthWeightKg = parseDouble(newValue)
                    }
            }
            .textFieldStyle(.roundedBorder)
        }
        .card()
    }

    private var letterCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("아이에게 보내는 첫 편지")
                .font(.headline)
            TextEditor(text: $letter)
                .font(.body)
                .frame(minHeight: 200)
                .padding(8)
                .scrollContentBackground(.hidden)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Theme.accentSoft.opacity(0.5))
                )
                .onChange(of: letter) { newValue in
                    store.data.story.letter = newValue
                }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - 프로필 바인딩

    private func binding(_ keyPath: WritableKeyPath<BabyProfile, String>) -> Binding<String> {
        Binding(
            get: { store.data.profile?[keyPath: keyPath] ?? "" },
            set: { store.data.profile?[keyPath: keyPath] = $0 }
        )
    }

    private var birthDateBinding: Binding<Date> {
        Binding(
            get: { store.data.profile?.birthDate ?? Date() },
            set: { store.data.profile?.birthDate = $0 }
        )
    }
}


struct AlbumInfo: Identifiable {
    let id: String
    let title: String
    let count: Int
}

/// 사진 앱의 특정 앨범을 골라, 그 안의 사진·영상을 촬영 날짜에 맞는
/// 달력 기록으로 가져오는 동기화 화면.
struct AlbumSyncView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    @State private var albums: [AlbumInfo] = []
    @State private var status: PHAuthorizationStatus = .notDetermined
    @State private var isSyncing = false
    @State private var progressText = ""
    @State private var resultText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("사진 앨범 동기화")
                    .font(.title3.bold())
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
            }

            Text("선택한 앨범의 사진·영상을 촬영 날짜에 맞춰 달력 기록에 자동으로 넣어 줘요. 이미 가져온 항목은 다시 가져오지 않으니 새 사진이 생길 때마다 동기화하면 됩니다.")
                .font(.caption)
                .foregroundColor(.secondary)

            switch status {
            case .authorized, .limited:
                albumList
            case .denied, .restricted:
                Text("사진 보관함 접근이 거부되어 있어요.\n시스템 설정 > 개인정보 보호 및 보안 > 사진에서 이 앱을 허용해 주세요.")
                    .foregroundColor(.secondary)
            default:
                HStack(spacing: 8) {
                    ProgressView()
                    Text("사진 보관함 접근 권한을 확인하는 중…")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(24)
        .frame(minWidth: 440, minHeight: 500)
        .background(Theme.background)
        .task { await load() }
    }

    private var albumList: some View {
        VStack(alignment: .leading, spacing: 12) {
            if albums.isEmpty {
                Text("사용자 앨범이 없어요. 사진 앱에서 앨범을 만들고 아기 사진을 담아 주세요.")
                    .foregroundColor(.secondary)
            } else {
                ScrollView {
                    VStack(spacing: 2) {
                        ForEach(albums) { album in
                            Button {
                                store.data.syncedAlbumId = album.id
                                store.data.syncedAlbumName = album.title
                                resultText = ""
                            } label: {
                                HStack {
                                    Image(systemName: store.data.syncedAlbumId == album.id
                                          ? "checkmark.circle.fill" : "circle")
                                        .foregroundColor(Theme.accent)
                                    Text(album.title)
                                    Spacer()
                                    Text("\(album.count)개")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding(.vertical, 8)
                                .padding(.horizontal, 10)
                                .background(
                                    RoundedRectangle(cornerRadius: 10)
                                        .fill(store.data.syncedAlbumId == album.id
                                              ? Theme.accentSoft : Color.white)
                                )
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxHeight: 260)
            }

            if let last = store.data.lastSyncDate {
                Text("마지막 동기화: \(Day.longString(last)) \(Day.timeString(last))")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            if isSyncing {
                HStack(spacing: 8) {
                    ProgressView()
                    Text(progressText)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else if !resultText.isEmpty {
                Text(resultText)
                    .font(.caption.bold())
                    .foregroundColor(Theme.accent)
            }

            Button {
                Task { await sync() }
            } label: {
                Label("지금 동기화", systemImage: "arrow.triangle.2.circlepath")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            .disabled(store.data.syncedAlbumId == nil || isSyncing)
        }
    }

    // MARK: - 권한과 앨범 목록

    private func load() async {
        status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        if status == .notDetermined {
            status = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
        }
        guard status == .authorized || status == .limited else { return }

        var found: [AlbumInfo] = []
        let fetch = PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any, options: nil)
        fetch.enumerateObjects { collection, _, _ in
            let count = PHAsset.fetchAssets(in: collection, options: nil).count
            found.append(AlbumInfo(
                id: collection.localIdentifier,
                title: collection.localizedTitle ?? "이름 없는 앨범",
                count: count
            ))
        }
        albums = found
    }

    // MARK: - 동기화

    private func sync() async {
        guard let albumId = store.data.syncedAlbumId else { return }
        let collections = PHAssetCollection.fetchAssetCollections(
            withLocalIdentifiers: [albumId], options: nil
        )
        guard let collection = collections.firstObject else {
            resultText = "앨범을 찾을 수 없어요. 다시 선택해 주세요."
            return
        }

        isSyncing = true
        resultText = ""
        defer { isSyncing = false }

        var assets: [PHAsset] = []
        PHAsset.fetchAssets(in: collection, options: nil).enumerateObjects { asset, _, _ in
            assets.append(asset)
        }
        let fresh = assets.filter {
            !store.data.syncedAssetIds.contains($0.localIdentifier) && $0.creationDate != nil
        }

        var imported = 0
        for (index, asset) in fresh.enumerated() {
            progressText = "가져오는 중… \(index + 1)/\(fresh.count)"
            guard let creationDate = asset.creationDate else { continue }
            do {
                if let attachment = try await importAsset(asset) {
                    var record = store.record(for: Day.key(for: creationDate))
                    record.attachments.append(attachment)
                    store.update(record)
                    store.data.syncedAssetIds.insert(asset.localIdentifier)
                    imported += 1
                }
            } catch {
                print("앨범 항목 가져오기 실패: \(error)")
            }
        }

        store.data.lastSyncDate = Date()
        progressText = ""
        resultText = imported == 0
            ? "새로 가져올 항목이 없어요"
            : "사진·영상 \(imported)개를 날짜별 기록에 넣었어요"
    }

    /// 원본 리소스를 Media 폴더로 내려받아 첨부를 만든다.
    private func importAsset(_ asset: PHAsset) async throws -> MediaAttachment? {
        let resources = PHAssetResource.assetResources(for: asset)
        let isVideo = asset.mediaType == .video
        let resource: PHAssetResource?
        if isVideo {
            resource = resources.first { $0.type == .fullSizeVideo }
                ?? resources.first { $0.type == .video }
                ?? resources.first
        } else {
            resource = resources.first { $0.type == .fullSizePhoto }
                ?? resources.first { $0.type == .photo }
                ?? resources.first
        }
        guard let resource else { return nil }

        var ext = (resource.originalFilename as NSString).pathExtension.lowercased()
        if ext.isEmpty { ext = isVideo ? "mov" : "jpg" }
        let fileName = UUID().uuidString + "." + ext
        let fileURL = store.mediaFileURL(fileName)

        let options = PHAssetResourceRequestOptions()
        options.isNetworkAccessAllowed = true   // iCloud에만 있는 원본도 내려받기
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHAssetResourceManager.default().writeData(for: resource, toFile: fileURL, options: options) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
        return MediaAttachment(id: UUID(), fileName: fileName, type: isVideo ? .video : .photo)
    }
}


/// 시스템 공유 시트 (AirDrop, 메시지, 메일, 저장 등).
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// 하루 기록을 한 장의 이미지로 만드는 카드. ImageRenderer로 렌더링한다.
struct ShareCardView: View {
    let babyName: String
    let daysText: String?
    let dateText: String
    let bodyText: String
    let images: [UIImage]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text(babyName)
                    .font(.title.bold())
                if let daysText {
                    Text(daysText)
                        .font(.title3.bold())
                        .foregroundColor(Theme.accent)
                }
                Spacer()
                Text(dateText)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            if !images.isEmpty {
                photoGrid
            }

            if !bodyText.isEmpty {
                Text(bodyText)
                    .font(.body)
                    .lineSpacing(5)
            }

            HStack {
                Spacer()
                Text("우리 아기 하루하루 🐥")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(28)
        .frame(width: 640)
        .background(Theme.background)
    }

    private var photoGrid: some View {
        let columns = images.count == 1 ? 1 : 2
        let side: CGFloat = columns == 1 ? 584 : 286
        let rows: [[UIImage]] = stride(from: 0, to: images.count, by: columns).map {
            Array(images[$0..<min($0 + columns, images.count)])
        }
        return VStack(spacing: 12) {
            ForEach(rows.indices, id: \.self) { rowIndex in
                HStack(spacing: 12) {
                    ForEach(rows[rowIndex].indices, id: \.self) { columnIndex in
                        Image(uiImage: rows[rowIndex][columnIndex])
                            .resizable()
                            .scaledToFill()
                            .frame(width: side, height: columns == 1 ? 420 : side)
                            .clipped()
                            .cornerRadius(14)
                    }
                }
            }
        }
    }
}


/// Media 폴더에 저장된 이미지를 표시하는 공용 뷰.
/// thumbnailSize를 주면 그 픽셀 크기로 축소해 메모리를 아낀다.
struct StoredImage: View {
    @EnvironmentObject private var store: Store
    let fileName: String
    var thumbnailSize: CGFloat? = nil
    var fill: Bool = true

    @State private var image: UIImage?

    var body: some View {
        Group {
            if let image {
                if fill {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                }
            } else {
                ZStack {
                    Color.gray.opacity(0.1)
                    ProgressView()
                }
            }
        }
        .onAppear(perform: load)
    }

    private func load() {
        guard image == nil else { return }
        let path = store.mediaFileURL(fileName).path
        let side = thumbnailSize
        DispatchQueue.global(qos: .userInitiated).async {
            var loaded = UIImage(contentsOfFile: path)
            if let side, let original = loaded {
                loaded = original.preparingThumbnail(
                    of: CGSize(width: side, height: side)
                ) ?? original
            }
            DispatchQueue.main.async {
                self.image = loaded
            }
        }
    }
}

/// 영상 첨부의 썸네일 (대표 프레임 + 재생 아이콘 + 길이).
struct VideoThumbnail: View {
    @EnvironmentObject private var store: Store
    let fileName: String

    @State private var image: UIImage?
    @State private var durationText: String?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Color.black.opacity(0.75)
            }

            Image(systemName: "play.circle.fill")
                .font(.system(size: 30))
                .foregroundColor(.white.opacity(0.9))
                .shadow(radius: 3)

            if let durationText {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Text(durationText)
                            .font(.caption2.monospacedDigit())
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(Color.black.opacity(0.55))
                            )
                            .padding(5)
                    }
                }
            }
        }
        .task { await generate() }
    }

    private func generate() async {
        guard image == nil else { return }
        let asset = AVURLAsset(url: store.mediaFileURL(fileName))
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 480, height: 480)

        if let result = try? await generator.image(at: CMTime(value: 1, timescale: 2)) {
            image = UIImage(cgImage: result.image)
        } else if let result = try? await generator.image(at: .zero) {
            image = UIImage(cgImage: result.image)
        }

        if let duration = try? await asset.load(.duration), duration.seconds.isFinite {
            let seconds = Int(duration.seconds.rounded())
            durationText = String(format: "%d:%02d", seconds / 60, seconds % 60)
        }
    }
}

/// 뷰어 페이지 안의 영상. 화면에 보이는 페이지일 때만 재생한다
/// (페이지 스와이프 시 옆 페이지가 미리 생성되어도 소리가 나지 않도록).
struct ViewerVideoView: View {
    let url: URL
    let isActive: Bool
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                if player == nil {
                    player = AVPlayer(url: url)
                }
                if isActive { player?.play() }
            }
            .onChange(of: isActive) { active in
                if active {
                    player?.play()
                } else {
                    player?.pause()
                }
            }
            .onDisappear {
                player?.pause()
                player = nil
            }
    }
}

// MARK: - 전체 화면 미디어 뷰어

/// 뷰어를 띄울 때 넘기는 정보 (그 날의 첨부 목록 + 시작 위치).
struct MediaViewerContext: Identifiable {
    let id = UUID()
    let attachments: [MediaAttachment]
    let startIndex: Int
}

/// 창 전체를 덮는 어두운 미디어 뷰어.
/// 좌우 은은한 화살표(호버 시 진해짐)와 ←/→ 키로 이동, Esc나 X로 닫는다.
struct MediaViewerView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    let attachments: [MediaAttachment]
    let startIndex: Int

    @State private var index = 0
    @State private var hoveringPrev = false
    @State private var hoveringNext = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // 페이지 스와이프: 아이폰·아이패드는 손가락, 맥은 트랙패드 스와이프
            TabView(selection: $index) {
                ForEach(attachments.indices, id: \.self) { pageIndex in
                    Group {
                        if attachments[pageIndex].type == .photo {
                            StoredImage(fileName: attachments[pageIndex].fileName, fill: false)
                        } else {
                            ViewerVideoView(
                                url: store.mediaFileURL(attachments[pageIndex].fileName),
                                isActive: index == pageIndex
                            )
                        }
                    }
                    .padding(.horizontal, 60)
                    .padding(.vertical, 50)
                    .tag(pageIndex)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            HStack {
                navButton(
                    systemName: "chevron.left",
                    key: .leftArrow,
                    disabled: index <= 0,
                    hovering: $hoveringPrev
                ) { withAnimation { index -= 1 } }
                Spacer()
                navButton(
                    systemName: "chevron.right",
                    key: .rightArrow,
                    disabled: index >= attachments.count - 1,
                    hovering: $hoveringNext
                ) { withAnimation { index += 1 } }
            }
            .padding(.horizontal, 14)

            VStack {
                HStack {
                    if attachments.count > 1 {
                        Text("\(index + 1) / \(attachments.count)")
                            .font(.callout.monospacedDigit())
                            .foregroundColor(.white.opacity(0.75))
                    }
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.body.bold())
                            .foregroundColor(.white.opacity(0.85))
                            .padding(10)
                            .background(Circle().fill(Color.white.opacity(0.15)))
                    }
                    .buttonStyle(.plain)
                    .keyboardShortcut(.cancelAction)   // Esc로 닫기
                }
                .padding(16)
                Spacer()
            }
        }
        .onAppear { index = startIndex }
    }

    private func navButton(
        systemName: String,
        key: KeyEquivalent,
        disabled: Bool,
        hovering: Binding<Bool>,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.title3.bold())
                .foregroundColor(.white)
                .padding(13)
                .background(
                    Circle().fill(Color.white.opacity(hovering.wrappedValue ? 0.32 : 0.10))
                )
        }
        .buttonStyle(.plain)
        .opacity(disabled ? 0 : (hovering.wrappedValue ? 1.0 : 0.5))
        .disabled(disabled)
        .onHover { hovering.wrappedValue = $0 }
        .keyboardShortcut(key, modifiers: [])
        .animation(.easeInOut(duration: 0.15), value: hovering.wrappedValue)
    }
}
