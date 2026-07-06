import SwiftUI

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
        store.saveNow()   // 첫 등록 정보는 바로 디스크에 남긴다
    }
}
