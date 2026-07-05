import SwiftUI
import Foundation

/// 앱 전체에서 쓰는 따뜻한 파스텔 톤 팔레트.
enum Theme {
    static let background = Color(red: 1.0, green: 0.973, blue: 0.945)   // 따뜻한 크림
    static let card = Color.white
    static let accent = Color(red: 0.96, green: 0.42, blue: 0.52)        // 코랄 핑크
    static let accentSoft = Color(red: 1.0, green: 0.90, blue: 0.90)
    static let peach = Color(red: 1.0, green: 0.93, blue: 0.85)
    static let mint = Color(red: 0.86, green: 0.96, blue: 0.90)
    static let lavender = Color(red: 0.93, green: 0.91, blue: 0.98)
    static let sky = Color(red: 0.88, green: 0.94, blue: 0.99)

    /// 홈 카운터 카드에 쓰는 코랄 → 살구 그라데이션.
    static let gradient = LinearGradient(
        colors: [
            Color(red: 0.98, green: 0.45, blue: 0.55),
            Color(red: 1.0, green: 0.63, blue: 0.45)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let milestonePastels: [Color] = [accentSoft, mint, lavender, peach, sky]
}

extension View {
    /// 크림색 배경 위에 얹는 흰색 라운드 카드.
    func card(_ color: Color = Theme.card, cornerRadius: CGFloat = 16) -> some View {
        self
            .padding(16)
            .background(RoundedRectangle(cornerRadius: cornerRadius).fill(color))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.black.opacity(0.05))
            )
            .shadow(color: Color.black.opacity(0.05), radius: 6, y: 2)
    }
}

extension Locale {
    /// 한국어 년월일 표기 + 24시간제. DatePicker 등 시스템 컨트롤에 적용한다.
    static let koreanWith24Hour: Locale = {
        var components = Locale.Components(identifier: "ko_KR")
        components.hourCycle = .zeroToTwentyThree
        return Locale(components: components)
    }()
}
