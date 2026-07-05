import SwiftUI

@main
struct BabyDaysApp: App {
    @StateObject private var store = Store()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var store: Store

    var body: some View {
        if store.data.profile == nil {
            OnboardingView()
        } else {
            MainView()
        }
    }
}

enum AppSection: String, CaseIterable, Identifiable {
    case home = "홈"
    case calendar = "달력"
    case growth = "성장"
    case story = "탄생 이야기"

    var id: AppSection { self }

    var icon: String {
        switch self {
        case .home: return "house.fill"
        case .calendar: return "calendar"
        case .growth: return "chart.line.uptrend.xyaxis"
        case .story: return "heart.fill"
        }
    }
}

struct MainView: View {
    @EnvironmentObject private var store: Store
    @State private var section: AppSection? = .home

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $section) { item in
                Label(item.rawValue, systemImage: item.icon)
                    .tag(item)
            }
            .navigationTitle(store.data.profile?.name ?? "우리 아기")
        } detail: {
            switch section ?? .home {
            case .home:
                HomeView(section: $section)
            case .calendar:
                CalendarView()
            case .growth:
                GrowthView()
            case .story:
                BirthStoryView()
            }
        }
    }
}
