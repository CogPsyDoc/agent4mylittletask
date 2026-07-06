import SwiftUI
import UniformTypeIdentifiers

/// 데이터 백업·복원 화면.
/// 기록 전체(store.json + Media 폴더)를 사용자가 고른 폴더로 내보내거나 되가져온다.
struct BackupView: View {
    @EnvironmentObject private var store: Store

    private enum FolderPickerMode {
        case backup
        case restore
    }

    @State private var pickerMode: FolderPickerMode?
    @State private var showingPicker = false
    @State private var confirmingRestore = false
    @State private var pendingRestoreURL: URL?
    @State private var isWorking = false
    @State private var message = ""
    @State private var mediaSizeText = "계산 중…"

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                statsCard
                backupCard
                restoreCard
                statusSection
            }
            .padding()
            .frame(maxWidth: 640)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background.ignoresSafeArea())
        .navigationTitle("백업")
        .task { await loadStats() }
        .fileImporter(
            isPresented: $showingPicker,
            allowedContentTypes: [.folder],
            allowsMultipleSelection: false
        ) { result in
            guard case .success(let urls) = result, let url = urls.first else { return }
            switch pickerMode {
            case .backup:
                runBackup(to: url)
            case .restore:
                pendingRestoreURL = url
                confirmingRestore = true
            case nil:
                break
            }
        }
        .confirmationDialog(
            "지금 앱에 있는 모든 기록이 선택한 백업 내용으로 교체됩니다. 계속할까요?",
            isPresented: $confirmingRestore,
            titleVisibility: .visible
        ) {
            Button("백업 내용으로 교체", role: .destructive) {
                if let url = pendingRestoreURL {
                    runRestore(from: url)
                }
            }
        }
    }

    // MARK: - 카드들

    private var statsCard: some View {
        let attachments = store.data.records.values.flatMap { $0.attachments }
        let photoCount = attachments.filter { $0.type == .photo }.count
        let videoCount = attachments.filter { $0.type == .video }.count
        return VStack(alignment: .leading, spacing: 12) {
            Text("지금까지의 기록").font(.headline)
            HStack(spacing: 24) {
                stat("기록한 날", "\(store.data.records.count)일")
                stat("사진", "\(photoCount)장")
                stat("영상", "\(videoCount)개")
                stat("미디어 용량", mediaSizeText)
            }
            Text("모든 데이터는 이 앱 안에만 저장돼요. 앱(프로젝트)을 삭제하면 기록도 함께 사라지니, 주기적으로 백업해 두는 것을 권해요.")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private func stat(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.headline)
                .foregroundColor(Theme.accent)
        }
    }

    private var backupCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("백업 만들기").font(.headline)
            Text("폴더를 고르면 그 안에 'BabyDays 백업 (날짜)' 폴더가 만들어지고 글과 사진·영상 전체가 복사돼요. iCloud Drive나 외장 디스크 폴더를 고르면 더 안전합니다.")
                .font(.caption)
                .foregroundColor(.secondary)
            Button {
                pickerMode = .backup
                showingPicker = true
            } label: {
                Label("백업 폴더 선택…", systemImage: "externaldrive.badge.plus")
            }
            .buttonStyle(.borderedProminent)
            .tint(Theme.accent)
            .disabled(isWorking)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    private var restoreCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("백업에서 복원").font(.headline)
            Text("이전에 만든 'BabyDays 백업 …' 폴더를 고르면 그 시점의 기록으로 되돌립니다. 지금 앱에 있는 기록은 백업 내용으로 교체돼요.")
                .font(.caption)
                .foregroundColor(.secondary)
            Button {
                pickerMode = .restore
                showingPicker = true
            } label: {
                Label("백업 폴더에서 복원…", systemImage: "clock.arrow.circlepath")
            }
            .buttonStyle(.bordered)
            .tint(Theme.accent)
            .disabled(isWorking)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .card()
    }

    @ViewBuilder
    private var statusSection: some View {
        if isWorking {
            HStack(spacing: 8) {
                ProgressView()
                Text("복사 중… 사진·영상이 많으면 시간이 걸려요")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        } else if !message.isEmpty {
            Text(message)
                .font(.callout.bold())
                .foregroundColor(Theme.accent)
        }
    }

    // MARK: - 동작

    private func loadStats() async {
        let mediaURL = store.documentsURL.appendingPathComponent("Media", isDirectory: true)
        let size = await Task.detached(priority: .utility) {
            Store.folderSize(at: mediaURL)
        }.value
        mediaSizeText = ByteCountFormatter.string(fromByteCount: size, countStyle: .file)
    }

    private func runBackup(to folder: URL) {
        isWorking = true
        message = ""
        Task {
            await store.flush()   // 마지막 변경까지 디스크에 반영한 뒤 복사한다
            let documents = store.documentsURL
            let scoped = folder.startAccessingSecurityScopedResource()
            defer {
                if scoped { folder.stopAccessingSecurityScopedResource() }
            }
            do {
                let name = try await Task.detached(priority: .userInitiated) {
                    try Store.performBackup(from: documents, to: folder)
                }.value
                message = "백업 완료! 만들어진 폴더: \(name)"
            } catch {
                message = "백업 실패: \(error.localizedDescription)"
            }
            isWorking = false
        }
    }

    private func runRestore(from folder: URL) {
        isWorking = true
        message = ""
        Task {
            let documents = store.documentsURL
            let scoped = folder.startAccessingSecurityScopedResource()
            defer {
                if scoped { folder.stopAccessingSecurityScopedResource() }
            }
            do {
                try await Task.detached(priority: .userInitiated) {
                    try Store.performRestore(from: folder, into: documents)
                }.value
                store.reloadFromDisk()
                message = "복원 완료!"
                await loadStats()
            } catch {
                message = "복원 실패: 선택한 폴더에 올바른 백업(store.json)이 없어요. (\(error.localizedDescription))"
            }
            isWorking = false
        }
    }
}
