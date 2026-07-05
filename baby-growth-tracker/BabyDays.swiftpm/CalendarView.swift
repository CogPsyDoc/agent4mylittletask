import SwiftUI

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
