import SwiftUI
import AVKit
import UIKit

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
