// ContentView.swift — 우리 아기 하루하루 (BabyDays)
//
// Swift Playground(맥)에서 "앱" 템플릿으로 새 프로젝트를 만든 뒤,
// 이 파일 내용으로 ContentView.swift 전체를 교체하세요.
// MyApp.swift(@main)는 템플릿 그대로 두면 됩니다 — ContentView()를 띄우기만 하면 돼요.
//
// 기능: 생후 일수(태어난 날 = 1일) · 달력 기록(글/사진/영상) ·
//       기념일 D-day(50일/백일/200일/300일/돌) · 성장 그래프 · 탄생 이야기
// 저장: 앱 샌드박스 Documents/store.json + Documents/Media/ (변경 즉시 자동 저장)

import SwiftUI
import Foundation
import Charts
import AVKit
import UIKit
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

    init() {
        profile = nil
        records = [:]
        growth = []
        story = BirthStory()
    }

    // 이후 버전에서 필드가 추가되어도 기존 파일을 읽을 수 있도록 관대하게 디코딩한다.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        profile = try container.decodeIfPresent(BabyProfile.self, forKey: .profile)
        records = try container.decodeIfPresent([String: DailyRecord].self, forKey: .records) ?? [:]
        growth = try container.decodeIfPresent([GrowthEntry].self, forKey: .growth) ?? []
        story = try container.decodeIfPresent(BirthStory.self, forKey: .story) ?? BirthStory()
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
    private static let timeFormatter = formatter("a h시 m분")

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
                print("미디어 복사 실패: \(error)")
            }
        }
        return result
    }

    func setCoverPhoto(from url: URL) {
        if let old = data.story.coverPhotoFileName {
            try? FileManager.default.removeItem(at: mediaFileURL(old))
        }
        data.story.coverPhotoFileName = importAttachments(from: [url]).first?.fileName
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
                VStack(spacing: 8) {
                    Text("👶")
                        .font(.system(size: 64))
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
                .frame(maxWidth: 420)

                Button(action: start) {
                    Text("시작하기")
                        .font(.headline)
                        .frame(maxWidth: 420)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(.pink)
                .disabled(name.trimmingCharacters(in: .whitespaces).isEmpty)

                Spacer(minLength: 40)
            }
            .frame(maxWidth: .infinity)
            .padding()
        }
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

    var body: some View {
        ScrollView {
            if let profile = store.data.profile {
                VStack(spacing: 32) {
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
        .navigationTitle("홈")
    }

    private func dayCounter(profile: BabyProfile) -> some View {
        VStack(spacing: 6) {
            Text(profile.name)
                .font(.title2.bold())
            Text("태어난 지")
                .font(.title3)
                .foregroundColor(.secondary)
            Text("\(Day.daysSinceBirth(birth: profile.birthDate))일")
                .font(.system(size: 88, weight: .heavy, design: .rounded))
                .foregroundColor(.pink)
            Text("\(Day.ageText(birth: profile.birthDate)) · \(Day.longString(profile.birthDate)) 태어남")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .padding(.top, 32)
    }

    @ViewBuilder
    private var milestonesSection: some View {
        let upcoming = store.upcomingMilestones(limit: 3)
        if !upcoming.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("다가오는 기념일")
                    .font(.headline)
                HStack(spacing: 12) {
                    ForEach(upcoming) { milestone in
                        VStack(spacing: 6) {
                            Text(milestone.name)
                                .font(.headline)
                            Text(Day.longString(milestone.date))
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(Day.ddayText(to: milestone.date))
                                .font(.title3.bold())
                                .foregroundColor(.pink)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(Color.pink.opacity(0.08))
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
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color.gray.opacity(0.08))
                )
            } else {
                Button {
                    section = .calendar
                } label: {
                    Label("오늘을 기록해 보세요", systemImage: "square.and.pencil")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 14)
                                .fill(Color.pink.opacity(0.12))
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

    private static let weekdaySymbols = ["일", "월", "화", "수", "목", "금", "토"]

    var body: some View {
        HStack(spacing: 0) {
            VStack(spacing: 12) {
                monthHeader
                weekdayHeader
                monthGrid
                Spacer(minLength: 0)
            }
            .padding()
            .frame(minWidth: 380, maxWidth: 520)

            Divider()

            RecordEditorView(dayKey: selectedKey)
                .id(selectedKey)
                .frame(maxWidth: .infinity)
        }
        .navigationTitle("달력")
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
                    .font(.caption)
                    .foregroundColor(symbol == "일" ? .red : .secondary)
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

        Button(action: onTap) {
            VStack(spacing: 3) {
                Text("\(Day.calendar.component(.day, from: date))")
                    .font(.callout.weight(isToday ? .bold : .regular))
                HStack(spacing: 3) {
                    if milestone != nil {
                        Text("🎉").font(.system(size: 9))
                    }
                    if hasRecord {
                        Circle()
                            .fill(Color.pink)
                            .frame(width: 5, height: 5)
                    }
                }
                .frame(height: 11)
            }
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? Color.pink.opacity(0.18) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isToday ? Color.pink : Color.clear, lineWidth: 1.5)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}


/// 하루 기록 편집기. 글은 입력 즉시 저장되고, 사진·영상은 파일에서 골라 첨부한다.
struct RecordEditorView: View {
    @EnvironmentObject private var store: Store
    let dayKey: String

    @State private var text = ""
    @State private var showingImporter = false
    @State private var confirmingDelete = false
    @State private var viewingPhoto: MediaAttachment?

    private var record: DailyRecord { store.record(for: dayKey) }
    private var date: Date { Day.date(from: dayKey) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                textEditor
                attachmentsSection

                Button {
                    showingImporter = true
                } label: {
                    Label("사진·영상 추가", systemImage: "photo.on.rectangle.angled")
                }

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
        .onAppear { text = record.text }
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.image, .movie],
            allowsMultipleSelection: true
        ) { result in
            if case .success(let urls) = result {
                let imported = store.importAttachments(from: urls)
                var updated = record
                updated.attachments.append(contentsOf: imported)
                store.update(updated)
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
        .sheet(item: $viewingPhoto) { attachment in
            FullPhotoView(fileName: attachment.fileName)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(Day.longString(date))
                .font(.title2.bold())
            HStack(spacing: 8) {
                if let birth = store.data.profile?.birthDate {
                    let days = Day.daysSinceBirth(birth: birth, on: date)
                    if days >= 1 {
                        Text("생후 \(days)일")
                            .foregroundColor(.pink)
                    }
                }
                if let milestone = store.milestoneName(on: date) {
                    Text("🎉 \(milestone)")
                }
            }
            .font(.subheadline)
        }
    }

    private var textEditor: some View {
        TextEditor(text: $text)
            .font(.body)
            .frame(minHeight: 180)
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.gray.opacity(0.08))
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
        let photos = record.attachments.filter { $0.type == .photo }
        let videos = record.attachments.filter { $0.type == .video }

        if !photos.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 8)], spacing: 8) {
                ForEach(photos) { attachment in
                    StoredImage(fileName: attachment.fileName, thumbnailSize: 240)
                        .frame(width: 100, height: 100)
                        .clipped()
                        .cornerRadius(10)
                        .contentShape(Rectangle())
                        .onTapGesture { viewingPhoto = attachment }
                        .contextMenu { deleteButton(attachment) }
                }
            }
        }

        ForEach(videos) { attachment in
            VideoAttachmentView(url: store.mediaFileURL(attachment.fileName))
                .frame(height: 240)
                .cornerRadius(10)
                .contextMenu { deleteButton(attachment) }
        }
    }

    private func deleteButton(_ attachment: MediaAttachment) -> some View {
        Button(role: .destructive) {
            store.deleteAttachment(attachment, from: dayKey)
        } label: {
            Label("삭제", systemImage: "trash")
        }
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
                    .tint(.pink)
                    .disabled(parseDouble(heightText) == nil && parseDouble(weightText) == nil)
            }
            .textFieldStyle(.roundedBorder)
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.08))
        )
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
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.gray.opacity(0.06))
            )
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

    @ViewBuilder
    private var coverSection: some View {
        if let fileName = store.data.story.coverPhotoFileName {
            VStack(spacing: 8) {
                StoredImage(fileName: fileName, fill: false)
                    .frame(maxHeight: 320)
                    .cornerRadius(16)
                Button("사진 변경") {
                    showingPhotoImporter = true
                }
                .font(.caption)
            }
        } else {
            Button {
                showingPhotoImporter = true
            } label: {
                VStack(spacing: 8) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 40))
                    Text("탄생 사진 추가")
                }
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, minHeight: 180)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6]))
                        .foregroundColor(.secondary.opacity(0.5))
                )
            }
            .buttonStyle(.plain)
        }
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
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.06))
        )
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
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color.gray.opacity(0.06))
        )
    }

    private var letterCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("아이에게 보내는 첫 편지")
                .font(.headline)
            TextEditor(text: $letter)
                .font(.body)
                .frame(minHeight: 200)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color.pink.opacity(0.05))
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

/// 사진을 크게 보는 시트.
struct FullPhotoView: View {
    @Environment(\.dismiss) private var dismiss
    let fileName: String

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .padding()
            }
            StoredImage(fileName: fileName, fill: false)
                .padding([.horizontal, .bottom])
        }
        .frame(minWidth: 400, minHeight: 400)
    }
}

/// 첨부된 영상을 인라인 재생하는 뷰.
struct VideoAttachmentView: View {
    let url: URL
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                if player == nil {
                    player = AVPlayer(url: url)
                }
            }
            .onDisappear {
                player?.pause()
            }
    }
}
