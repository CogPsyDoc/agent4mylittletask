import SwiftUI
import AVKit
import UniformTypeIdentifiers

/// 하루 기록 편집기. 글은 입력 즉시 저장되고, 사진·영상은 파일에서 골라 첨부한다.
struct RecordEditorView: View {
    @EnvironmentObject private var store: Store
    let dayKey: String

    @State private var text = ""
    @State private var showingImporter = false
    @State private var confirmingDelete = false
    @State private var viewingPhoto: MediaAttachment?

    private var record: DailyRecord { store.record(for: dayKey) }
    private var date: Date { Day.date(from: dayKey) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                textEditor
                attachmentsSection

                Button {
                    showingImporter = true
                } label: {
                    Label("사진·영상 추가", systemImage: "photo.on.rectangle.angled")
                }

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
        .onAppear { text = record.text }
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.image, .movie],
            allowsMultipleSelection: true
        ) { result in
            if case .success(let urls) = result {
                let imported = store.importAttachments(from: urls)
                var updated = record
                updated.attachments.append(contentsOf: imported)
                store.update(updated)
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
        .sheet(item: $viewingPhoto) { attachment in
            FullPhotoView(fileName: attachment.fileName)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(Day.longString(date))
                .font(.title2.bold())
            HStack(spacing: 8) {
                if let birth = store.data.profile?.birthDate {
                    let days = Day.daysSinceBirth(birth: birth, on: date)
                    if days >= 1 {
                        Text("생후 \(days)일")
                            .foregroundColor(.pink)
                    }
                }
                if let milestone = store.milestoneName(on: date) {
                    Text("🎉 \(milestone)")
                }
            }
            .font(.subheadline)
        }
    }

    private var textEditor: some View {
        TextEditor(text: $text)
            .font(.body)
            .frame(minHeight: 180)
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.gray.opacity(0.08))
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
        let photos = record.attachments.filter { $0.type == .photo }
        let videos = record.attachments.filter { $0.type == .video }

        if !photos.isEmpty {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 8)], spacing: 8) {
                ForEach(photos) { attachment in
                    StoredImage(fileName: attachment.fileName, thumbnailSize: 240)
                        .frame(width: 100, height: 100)
                        .clipped()
                        .cornerRadius(10)
                        .contentShape(Rectangle())
                        .onTapGesture { viewingPhoto = attachment }
                        .contextMenu { deleteButton(attachment) }
                }
            }
        }

        ForEach(videos) { attachment in
            VideoAttachmentView(url: store.mediaFileURL(attachment.fileName))
                .frame(height: 240)
                .cornerRadius(10)
                .contextMenu { deleteButton(attachment) }
        }
    }

    private func deleteButton(_ attachment: MediaAttachment) -> some View {
        Button(role: .destructive) {
            store.deleteAttachment(attachment, from: dayKey)
        } label: {
            Label("삭제", systemImage: "trash")
        }
    }
}
