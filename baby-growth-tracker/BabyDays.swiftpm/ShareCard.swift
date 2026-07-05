import SwiftUI
import UIKit

/// 시스템 공유 시트 (AirDrop, 메시지, 메일, 저장 등).
struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// 하루 기록을 한 장의 이미지로 만드는 카드. ImageRenderer로 렌더링한다.
struct ShareCardView: View {
    let babyName: String
    let daysText: String?
    let dateText: String
    let bodyText: String
    let images: [UIImage]

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline) {
                Text(babyName)
                    .font(.title.bold())
                if let daysText {
                    Text(daysText)
                        .font(.title3.bold())
                        .foregroundColor(Theme.accent)
                }
                Spacer()
                Text(dateText)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            if !images.isEmpty {
                photoGrid
            }

            if !bodyText.isEmpty {
                Text(bodyText)
                    .font(.body)
                    .lineSpacing(5)
            }

            HStack {
                Spacer()
                Text("우리 아기 하루하루 🐥")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(28)
        .frame(width: 640)
        .background(Theme.background)
    }

    private var photoGrid: some View {
        let columns = images.count == 1 ? 1 : 2
        let side: CGFloat = columns == 1 ? 584 : 286
        let rows: [[UIImage]] = stride(from: 0, to: images.count, by: columns).map {
            Array(images[$0..<min($0 + columns, images.count)])
        }
        return VStack(spacing: 12) {
            ForEach(rows.indices, id: \.self) { rowIndex in
                HStack(spacing: 12) {
                    ForEach(rows[rowIndex].indices, id: \.self) { columnIndex in
                        Image(uiImage: rows[rowIndex][columnIndex])
                            .resizable()
                            .scaledToFill()
                            .frame(width: side, height: columns == 1 ? 420 : side)
                            .clipped()
                            .cornerRadius(14)
                    }
                }
            }
        }
    }
}
