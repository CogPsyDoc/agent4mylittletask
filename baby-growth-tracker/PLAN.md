# 우리 아기 하루하루 — 앱 기획서

macOS용 SwiftUI 앱 · Swift Playgrounds(App Playground, `.swiftpm`)에서 실행

## 1. 컨셉

아이의 탄생을 기억하고, 하루하루의 성장을 기록하는 부모용 개인 기록 앱.
앱을 열면 언제나 "아이가 태어난 지 며칠째인지"가 가장 먼저 보이고,
달력에서 아무 날이나 골라 글·사진·영상을 자유로운 분량으로 남길 수 있다.

- 사용자: 부모 (로컬 개인 사용, 로그인/서버 없음)
- 대상 아이: 한 명 (첫 실행 시 등록)
- 날짜 계산: **태어난 날 = 1일** (한국식 — 100일째 되는 날이 백일)

## 2. 핵심 기능

| # | 기능 | 설명 |
|---|------|------|
| 1 | 생후 일수 표시 | 홈 화면 상단에 "태어난 지 ㅇㅇ일" 을 항상 크게 표시. 개월 수(만 나이) 병기 |
| 2 | 달력 기록 | 월간 달력에서 날짜를 선택해 글/사진/영상을 기록. 분량 제한 없음, 미디어 여러 개 첨부 가능. 기록이 있는 날은 달력에 점(●) 표시 |
| 3 | 기념일 자동 계산 | 생일 기준으로 50일, 백일(100일), 200일, 300일, 첫돌(1년), 이후 매년 생일을 자동 계산해 D-day 목록으로 표시. 지난 기념일은 "ㅇㅇ일 전"으로 회고 |
| 4 | 성장 수치 기록 | 키(cm)/몸무게(kg)를 날짜별로 입력하고 Swift Charts 추이 그래프로 확인 |
| 5 | 탄생 스토리 | 탄생 순간을 담는 고정 페이지 — 태어난 날짜·시간, 출생 시 키/몸무게, 사진, 부모가 아이에게 남기는 첫 편지 |

## 3. 화면 구성

사이드바(NavigationSplitView) 기반의 전형적인 macOS 앱 레이아웃.

```
┌────────────┬──────────────────────────────┐
│  사이드바   │           콘텐츠              │
│            │                              │
│ 🏠 홈       │  홈: 생후 ㅇㅇ일 (크게)        │
│ 📅 달력     │      + 다가오는 기념일 D-day   │
│ 📈 성장     │      + 오늘의 기록 바로가기     │
│ 💌 탄생이야기│                              │
└────────────┴──────────────────────────────┘
```

### 3.1 온보딩 (첫 실행 시 1회)
- 아이 이름, 생년월일(+ 태어난 시간, 선택) 입력
- 출생 시 키/몸무게 (선택) → 성장 그래프의 첫 데이터가 됨
- 저장하면 홈으로 이동. 이후 실행부터는 바로 홈

### 3.2 홈
- 상단: 아이 이름 + **"태어난 지 128일"** (앱의 얼굴, 가장 큰 글씨)
- 보조 표기: 만 ㅇ개월 ㅇ일, 생년월일
- 다가오는 기념일 카드: "백일까지 D-3" 처럼 가까운 순 2~3개
- 오늘 기록 미리보기: 오늘 쓴 기록이 있으면 요약 표시, 없으면 "오늘을 기록해 보세요" 버튼 → 달력의 오늘 기록 편집으로 이동

### 3.3 달력 (핵심 화면)
- 월간 그리드(LazyVGrid 7열) + 이전/다음 달 이동, "오늘로" 버튼
- 각 날짜 셀: 날짜 숫자, 기록 있으면 ● 표시, 사진이 있으면 썸네일 배경(여유가 되면)
- 생일과 기념일(백일 등)에는 🎂/🎉 뱃지
- 날짜 클릭 → 우측/하단에 해당 날짜의 기록 상세
- 기록 편집기:
  - 텍스트: 자유 분량 (TextEditor)
  - 사진/영상: `fileImporter`로 파일 선택 → 앱 데이터 폴더로 복사해 보관 (여러 개 가능)
  - 사진은 그리드 미리보기, 영상은 AVKit `VideoPlayer`로 인라인 재생
  - 첨부 삭제, 기록 전체 삭제 가능

### 3.4 성장
- 키/몸무게 입력 폼(날짜 + 수치) 및 기록 목록(수정/삭제)
- Swift Charts 라인 그래프 2개(키 추이, 몸무게 추이), 데이터 포인트에 값 표시

### 3.5 탄생 이야기
- 편집 가능한 고정 페이지: 대표 사진, 태어난 날짜·시간·장소, 출생 키/몸무게, "아이에게 보내는 첫 편지"(자유 글)
- 홈이 "오늘"이라면 이 페이지는 "시작점"을 기억하는 공간

## 4. 데이터 모델

```swift
struct BabyProfile: Codable {          // 아이 정보 (1명)
    var name: String
    var birthDate: Date                // 날짜+시간
    var birthPlace: String?
}

struct DailyRecord: Codable, Identifiable {   // 하루 기록 (날짜당 1개)
    var id: UUID
    var date: DateComponents           // 연/월/일 (시간대 문제 방지)
    var text: String
    var attachments: [MediaAttachment]
}

struct MediaAttachment: Codable, Identifiable {
    var id: UUID
    var fileName: String               // Media/ 폴더 내 파일명
    var type: MediaType                // photo | video
}

struct GrowthEntry: Codable, Identifiable {   // 성장 수치
    var id: UUID
    var date: Date
    var heightCm: Double?
    var weightKg: Double?
}

struct BirthStory: Codable {           // 탄생 이야기
    var letter: String                 // 첫 편지
    var birthHeightCm: Double?
    var birthWeightKg: Double?
    var coverPhotoFileName: String?
}
```

### 생후 일수 계산 (핵심 로직)
```
생후 일수 = (오늘 자정 - 생일 자정)의 일수 차이 + 1   // 태어난 날 = 1일
기념일 날짜 = 생일 + (N - 1)일                        // 백일 = 생일 + 99일
```

## 5. 저장 방식

Swift Playgrounds 앱은 샌드박스 컨테이너를 가지므로, 그 안의 Documents 폴더 사용:

```
Documents/
├── store.json        // 프로필 + 기록 + 성장 + 스토리 전체 (JSON 직렬화)
└── Media/            // 첨부한 사진·영상 원본 복사본
    ├── <uuid>.jpg
    └── <uuid>.mov
```

- SwiftData/CoreData 대신 **Codable + JSON 파일** 선택: Playgrounds에서 가장 안정적이고 의존성이 없음. 개인 기록 규모(수백~수천 건)에는 충분
- 저장 시점: 변경이 생길 때마다 즉시 저장 (앱 강제 종료에도 안전)
- 미디어는 JSON에 넣지 않고 파일로 복사 → JSON은 가볍게 유지

## 6. 기술 스택과 Playgrounds 제약

| 항목 | 선택 | 이유 |
|------|------|------|
| UI | SwiftUI (macOS 13+) | Playgrounds App 템플릿 기본 |
| 내비게이션 | NavigationSplitView | macOS 표준 사이드바 UX |
| 그래프 | Swift Charts | macOS 13+ 기본 제공 |
| 영상 재생 | AVKit VideoPlayer | 추가 설정 불필요 |
| 사진/영상 선택 | fileImporter | Playgrounds에서 PhotosPicker보다 안정적, Mac에선 Finder 선택이 자연스러움 |
| 이미지 표시 | NSImage 로드 | 로컬 파일 표시 |
| 저장 | FileManager + Codable JSON | 외부 의존성 없음 |

제약 대응:
- 외부 패키지 없이 시스템 프레임워크만 사용
- 파일을 기능별로 분리하되(아래 7절) 전부 한 `.swiftpm`에 들어가도록 구성
- 앱 삭제 시 데이터도 삭제됨을 README에 명시 (백업 = 컨테이너 폴더 복사)

## 7. 코드 파일 구성 (예정)

```
BabyDays.swiftpm/
├── Package.swift            // App Playground 매니페스트
├── BabyDaysApp.swift        // @main, 온보딩/메인 분기
├── Models.swift             // 4절의 데이터 모델 + 일수/기념일 계산
├── Store.swift              // ObservableObject, JSON 로드/저장, 미디어 파일 관리
├── OnboardingView.swift
├── HomeView.swift
├── CalendarView.swift       // 월간 그리드 + 날짜 셀
├── RecordEditorView.swift   // 글/사진/영상 편집
├── GrowthView.swift         // 입력 + Charts 그래프
├── BirthStoryView.swift
└── MediaViews.swift         // 썸네일, 이미지/비디오 표시 공용 뷰
```

## 8. 개발 단계

1. **M1 — 뼈대**: 데이터 모델 + 저장소 + 온보딩 + 홈(생후 일수)
2. **M2 — 달력**: 월간 달력 + 텍스트 기록 CRUD
3. **M3 — 미디어**: 사진/영상 첨부·표시·재생
4. **M4 — 확장**: 기념일 D-day, 성장 그래프, 탄생 이야기
5. **M5 — 다듬기**: 빈 상태 화면, 색·타이포, README(Playgrounds에서 여는 방법)

한 번에 전체를 만들어 전달하되, 위 순서로 검증하며 진행.
