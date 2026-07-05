import SwiftUI
import Combine

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
