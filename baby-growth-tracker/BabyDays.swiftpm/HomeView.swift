import SwiftUI

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
