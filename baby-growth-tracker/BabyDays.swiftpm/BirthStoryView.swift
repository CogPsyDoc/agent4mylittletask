import SwiftUI
import UniformTypeIdentifiers

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
