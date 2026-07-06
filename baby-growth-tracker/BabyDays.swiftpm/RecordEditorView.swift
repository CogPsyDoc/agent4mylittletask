import SwiftUI
import AVKit
import UIKit
import PhotosUI
import UniformTypeIdentifiers

/// 하루 기록 편집기. 글은 입력 즉시 저장되고,
/// 사진·영상은 파일 선택 / 드래그&드롭 / 클립보드 붙여넣기로 첨부한다.
struct RecordEditorView: View {
    @EnvironmentObject private var store: Store
    let dayKey: String

    @State private var text = ""
    @State private var showingImporter = false
    @State private var confirmingDelete = false
    @State private var viewer: MediaViewerContext?
    @State private var dropTargeted = false
    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showingShareDialog = false
    @State private var shareItems: [Any]?

    private var record: DailyRecord { store.record(for: dayKey) }
    private var date: Date { Day.date(from: dayKey) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                textEditor
                attachmentsSection
                addButtons
                dropZone

                if !record.isEmpty {
                    Button(role: .destructive) {
                        confirmingDelete = true
                    } label: {
                        Label("이 날의 기록 삭제", systemImage: "trash")
                    }
                }
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(Theme.background)
        .onDrop(of: [.image, .movie, .fileURL], isTargeted: $dropTargeted, perform: handleDrop)
        .onAppear { text = record.text }
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.image, .movie],
            allowsMultipleSelection: true
        ) { result in
            if case .success(let urls) = result {
                Task {
                    appendAttachments(await store.importAttachments(from: urls))
                }
            }
        }
        .confirmationDialog(
            "이 날의 글과 사진·영상을 모두 삭제할까요?",
            isPresented: $confirmingDelete,
            titleVisibility: .visible
        ) {
            Button("삭제", role: .destructive) {
                store.deleteRecord(for: dayKey)
                text = ""
            }
        }
        .fullScreenCover(item: $viewer) { context in
            MediaViewerView(attachments: context.attachments, startIndex: context.startIndex)
        }
        .confirmationDialog(
            "이 날의 기록을 어떻게 공유할까요?",
            isPresented: $showingShareDialog,
            titleVisibility: .visible
        ) {
            Button("카드 이미지로 공유") { shareAsCard() }
            Button("글·사진 원본 공유") { shareOriginals() }
        }
        .sheet(isPresented: Binding(
            get: { shareItems != nil },
            set: { if !$0 { shareItems = nil } }
        )) {
            ActivityView(items: shareItems ?? [])
        }
    }

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(Day.longString(date))
                    .font(.title2.bold())
                HStack(spacing: 8) {
                    if let daysLabel {
                        Text(daysLabel)
                            .foregroundColor(Theme.accent)
                    }
                    if let milestone = store.milestoneName(on: date) {
                        Text("🎉 \(milestone)")
                    }
                }
                .font(.subheadline)
            }
            Spacer()
            if !record.isEmpty {
                Button {
                    showingShareDialog = true
                } label: {
                    Label("공유", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
                .tint(Theme.accent)
            }
        }
    }

    private var daysLabel: String? {
        guard let birth = store.data.profile?.birthDate else { return nil }
        let days = Day.daysSinceBirth(birth: birth, on: date)
        return days >= 1 ? "생후 \(days)일" : nil
    }

    private var textEditor: some View {
        TextEditor(text: $text)
            .font(.body)
            .frame(minHeight: 180)
            .padding(8)
            .scrollContentBackground(.hidden)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color.black.opacity(0.07))
            )
            .overlay(alignment: .topLeading) {
                if text.isEmpty {
                    Text("오늘의 이야기를 자유롭게 남겨 보세요…")
                        .foregroundColor(.secondary)
                        .padding(.top, 16)
                        .padding(.leading, 14)
                        .allowsHitTesting(false)
                }
            }
            .onChange(of: text) { newValue in
                var updated = record
                updated.text = newValue
                store.update(updated)
            }
    }

    @ViewBuilder
    private var attachmentsSection: some View {
        let attachments = record.attachments
        if !attachments.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 110), spacing: 8)], spacing: 8) {
                    ForEach(attachments.indices, id: \.self) { index in
                        let attachment = attachments[index]
                        Group {
                            if attachment.type == .photo {
                                StoredImage(fileName: attachment.fileName, thumbnailSize: 240)
                            } else {
                                VideoThumbnail(fileName: attachment.fileName)
                            }
                        }
                        .id(attachment.id)
                        .frame(width: 110, height: 110)
                        .clipped()
                        .cornerRadius(10)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            viewer = MediaViewerContext(attachments: attachments, startIndex: index)
                        }
                        .contextMenu { deleteButton(attachment) }
                    }
                }
                Text("클릭하면 크게 보고, 우클릭하면 삭제할 수 있어요")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var addButtons: some View {
        HStack(spacing: 12) {
            PhotosPicker(
                selection: $pickerItems,
                matching: .any(of: [.images, .videos])
            ) {
                Label("사진 보관함", systemImage: "photo.stack")
            }
            Button {
                showingImporter = true
            } label: {
                Label("파일에서", systemImage: "folder")
            }
            Button(action: pasteFromClipboard) {
                Label("붙여넣기", systemImage: "doc.on.clipboard")
            }
        }
        .buttonStyle(.bordered)
        .tint(Theme.accent)
        .onChange(of: pickerItems) { items in
            guard !items.isEmpty else { return }
            Task {
                var new: [MediaAttachment] = []
                for item in items {
                    let isVideo = item.supportedContentTypes.contains {
                        $0.conforms(to: .movie) || $0.conforms(to: .audiovisualContent)
                    }
                    if isVideo {
                        // 영상은 메모리에 통째로 올리지 않고 임시 파일로 받는다
                        guard let video = try? await item.loadTransferable(type: PickedVideo.self) else { continue }
                        new.append(contentsOf: await store.importAttachments(from: [video.url]))
                        try? FileManager.default.removeItem(at: video.url)
                    } else {
                        guard let data = try? await item.loadTransferable(type: Data.self) else { continue }
                        let ext = item.supportedContentTypes.first?.preferredFilenameExtension ?? "jpg"
                        if let attachment = store.addMediaData(data, fileExtension: ext, type: .photo) {
                            new.append(attachment)
                        }
                    }
                }
                appendAttachments(new)
                pickerItems = []
            }
        }
    }

    private var dropZone: some View {
        VStack(spacing: 6) {
            Image(systemName: "square.and.arrow.down.on.square")
                .font(.title3)
            Text("사진 앱이나 Finder에서 사진·영상을 여기로 끌어다 놓아도 돼요")
                .font(.caption)
        }
        .foregroundColor(dropTargeted ? Theme.accent : .secondary)
        .frame(maxWidth: .infinity, minHeight: 84)
        .background(
            RoundedRectangle(cornerRadius: 14)
                .fill(dropTargeted ? Theme.accentSoft : Color.white)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [6]))
                .foregroundColor(dropTargeted ? Theme.accent : Color.secondary.opacity(0.35))
        )
    }

    private func deleteButton(_ attachment: MediaAttachment) -> some View {
        Button(role: .destructive) {
            store.deleteAttachment(attachment, from: dayKey)
        } label: {
            Label("삭제", systemImage: "trash")
        }
    }

    // MARK: - 첨부 추가 경로들

    private func appendAttachments(_ new: [MediaAttachment]) {
        guard !new.isEmpty else { return }
        var updated = record
        updated.attachments.append(contentsOf: new)
        store.update(updated)
    }

    /// 클립보드의 이미지를 첨부한다 (스크린샷, 복사한 그림 등).
    private func pasteFromClipboard() {
        let pasteboard = UIPasteboard.general
        if let images = pasteboard.images, !images.isEmpty {
            appendAttachments(images.compactMap { store.addImage($0) })
        } else if let image = pasteboard.image, let attachment = store.addImage(image) {
            appendAttachments([attachment])
        }
    }

    // MARK: - 공유

    /// 하루 기록을 한 장의 카드 이미지로 렌더링해 공유한다.
    @MainActor
    private func shareAsCard() {
        let card = ShareCardView(
            babyName: store.data.profile?.name ?? "",
            daysText: daysLabel,
            dateText: Day.longString(date),
            bodyText: record.text,
            images: loadedPhotoImages(limit: 4)
        )
        let renderer = ImageRenderer(content: card)
        renderer.scale = 2
        if let image = renderer.uiImage {
            shareItems = [image]
        }
    }

    /// 요약 글 + 사진 원본 + 영상 파일을 그대로 공유한다.
    private func shareOriginals() {
        var summary = store.data.profile?.name ?? ""
        if let daysLabel {
            summary += summary.isEmpty ? daysLabel : " · \(daysLabel)"
        }
        summary += " · \(Day.longString(date))"
        if !record.text.isEmpty {
            summary += "\n\n" + record.text
        }

        var items: [Any] = [summary]
        for attachment in record.attachments {
            let url = store.mediaFileURL(attachment.fileName)
            if attachment.type == .photo, let image = UIImage(contentsOfFile: url.path) {
                items.append(image)
            } else {
                items.append(url)
            }
        }
        shareItems = items
    }

    private func loadedPhotoImages(limit: Int) -> [UIImage] {
        record.attachments
            .filter { $0.type == .photo }
            .prefix(limit)
            .compactMap { attachment in
                let path = store.mediaFileURL(attachment.fileName).path
                guard let image = UIImage(contentsOfFile: path) else { return nil }
                return image.preparingThumbnail(of: CGSize(width: 900, height: 900)) ?? image
            }
    }

    /// 사진 앱·Finder 등에서 드래그해 온 항목을 첨부한다.
    private func handleDrop(_ providers: [NSItemProvider]) -> Bool {
        var handled = false
        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) {
                handled = true
                provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { url, _ in
                    guard let url else { return }
                    // 원본 임시 파일은 이 핸들러가 끝나면 사라지므로 여기서 바로 복사해 둔다
                    let ext = url.pathExtension.isEmpty ? "mov" : url.pathExtension
                    let copied = FileManager.default.temporaryDirectory
                        .appendingPathComponent(UUID().uuidString + "." + ext)
                    do {
                        try FileManager.default.copyItem(at: url, to: copied)
                    } catch {
                        return
                    }
                    Task { @MainActor in
                        appendAttachments(await store.importAttachments(from: [copied]))
                        try? FileManager.default.removeItem(at: copied)
                    }
                }
            } else if provider.canLoadObject(ofClass: UIImage.self) {
                handled = true
                provider.loadObject(ofClass: UIImage.self) { object, _ in
                    guard let image = object as? UIImage else { return }
                    DispatchQueue.main.async {
                        if let attachment = store.addImage(image) {
                            appendAttachments([attachment])
                        }
                    }
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                handled = true
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    var url: URL?
                    if let data = item as? Data {
                        url = URL(dataRepresentation: data, relativeTo: nil)
                    } else if let direct = item as? URL {
                        url = direct
                    }
                    guard let url else { return }
                    Task { @MainActor in
                        appendAttachments(await store.importAttachments(from: [url]))
                    }
                }
            }
        }
        return handled
    }
}
