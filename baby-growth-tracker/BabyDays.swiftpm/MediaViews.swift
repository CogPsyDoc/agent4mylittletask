import SwiftUI
import AVKit
import AVFoundation
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

/// 영상 첨부의 썸네일 (대표 프레임 + 재생 아이콘 + 길이).
struct VideoThumbnail: View {
    @EnvironmentObject private var store: Store
    let fileName: String

    @State private var image: UIImage?
    @State private var durationText: String?

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Color.black.opacity(0.75)
            }

            Image(systemName: "play.circle.fill")
                .font(.system(size: 30))
                .foregroundColor(.white.opacity(0.9))
                .shadow(radius: 3)

            if let durationText {
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Text(durationText)
                            .font(.caption2.monospacedDigit())
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 5)
                                    .fill(Color.black.opacity(0.55))
                            )
                            .padding(5)
                    }
                }
            }
        }
        .task { await generate() }
    }

    private func generate() async {
        guard image == nil else { return }
        let asset = AVURLAsset(url: store.mediaFileURL(fileName))
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 480, height: 480)

        if let result = try? await generator.image(at: CMTime(value: 1, timescale: 2)) {
            image = UIImage(cgImage: result.image)
        } else if let result = try? await generator.image(at: .zero) {
            image = UIImage(cgImage: result.image)
        }

        if let duration = try? await asset.load(.duration), duration.seconds.isFinite {
            let seconds = Int(duration.seconds.rounded())
            durationText = String(format: "%d:%02d", seconds / 60, seconds % 60)
        }
    }
}

/// 뷰어 페이지 안의 영상. 화면에 보이는 페이지일 때만 재생한다
/// (페이지 스와이프 시 옆 페이지가 미리 생성되어도 소리가 나지 않도록).
struct ViewerVideoView: View {
    let url: URL
    let isActive: Bool
    @State private var player: AVPlayer?

    var body: some View {
        VideoPlayer(player: player)
            .onAppear {
                if player == nil {
                    player = AVPlayer(url: url)
                }
                if isActive { player?.play() }
            }
            .onChange(of: isActive) { active in
                if active {
                    player?.play()
                } else {
                    player?.pause()
                }
            }
            .onDisappear {
                player?.pause()
                player = nil
            }
    }
}

// MARK: - 전체 화면 미디어 뷰어

/// 뷰어를 띄울 때 넘기는 정보 (그 날의 첨부 목록 + 시작 위치).
struct MediaViewerContext: Identifiable {
    let id = UUID()
    let attachments: [MediaAttachment]
    let startIndex: Int
}

/// 창 전체를 덮는 어두운 미디어 뷰어.
/// 좌우 은은한 화살표(호버 시 진해짐)와 ←/→ 키로 이동, Esc나 X로 닫는다.
struct MediaViewerView: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    let attachments: [MediaAttachment]
    let startIndex: Int

    @State private var index = 0
    @State private var hoveringPrev = false
    @State private var hoveringNext = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            // 페이지 스와이프: 아이폰·아이패드는 손가락, 맥은 트랙패드 스와이프
            TabView(selection: $index) {
                ForEach(attachments.indices, id: \.self) { pageIndex in
                    Group {
                        if attachments[pageIndex].type == .photo {
                            StoredImage(fileName: attachments[pageIndex].fileName, fill: false)
                        } else {
                            ViewerVideoView(
                                url: store.mediaFileURL(attachments[pageIndex].fileName),
                                isActive: index == pageIndex
                            )
                        }
                    }
                    .padding(.horizontal, 60)
                    .padding(.vertical, 50)
                    .tag(pageIndex)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .ignoresSafeArea()

            HStack {
                navButton(
                    systemName: "chevron.left",
                    key: .leftArrow,
                    disabled: index <= 0,
                    hovering: $hoveringPrev
                ) { withAnimation { index -= 1 } }
                Spacer()
                navButton(
                    systemName: "chevron.right",
                    key: .rightArrow,
                    disabled: index >= attachments.count - 1,
                    hovering: $hoveringNext
                ) { withAnimation { index += 1 } }
            }
            .padding(.horizontal, 14)

            VStack {
                HStack {
                    if attachments.count > 1 {
                        Text("\(index + 1) / \(attachments.count)")
                            .font(.callout.monospacedDigit())
                            .foregroundColor(.white.opacity(0.75))
                    }
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.body.bold())
                            .foregroundColor(.white.opacity(0.85))
                            .padding(10)
                            .background(Circle().fill(Color.white.opacity(0.15)))
                    }
                    .buttonStyle(.plain)
                    .keyboardShortcut(.cancelAction)   // Esc로 닫기
                }
                .padding(16)
                Spacer()
            }
        }
        .onAppear { index = startIndex }
    }

    private func navButton(
        systemName: String,
        key: KeyEquivalent,
        disabled: Bool,
        hovering: Binding<Bool>,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.title3.bold())
                .foregroundColor(.white)
                .padding(13)
                .background(
                    Circle().fill(Color.white.opacity(hovering.wrappedValue ? 0.32 : 0.10))
                )
        }
        .buttonStyle(.plain)
        .opacity(disabled ? 0 : (hovering.wrappedValue ? 1.0 : 0.5))
        .disabled(disabled)
        .onHover { hovering.wrappedValue = $0 }
        .keyboardShortcut(key, modifiers: [])
        .animation(.easeInOut(duration: 0.15), value: hovering.wrappedValue)
    }
}
