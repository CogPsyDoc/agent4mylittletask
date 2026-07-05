import Foundation

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
    private static let timeFormatter = formatter("H시 m분")

    static func longString(_ date: Date) -> String { longFormatter.string(from: date) }
    static func monthTitle(_ date: Date) -> String { monthFormatter.string(from: date) }
    static func timeString(_ date: Date) -> String { timeFormatter.string(from: date) }
}

func parseDouble(_ text: String) -> Double? {
    Double(text.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "."))
}
