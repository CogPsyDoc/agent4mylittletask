import SwiftUI
import Photos

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
        status = PHPhotoLibrary.authorizationStatus(for: .readOnly)
        if status == .notDetermined {
            status = await PHPhotoLibrary.requestAuthorization(for: .readOnly)
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
