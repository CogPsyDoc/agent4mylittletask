import SwiftUI
import Charts

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
