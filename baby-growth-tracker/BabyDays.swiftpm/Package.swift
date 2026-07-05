// swift-tools-version: 5.8

// 이 파일은 Swift Playground(구 Swift Playgrounds) 앱 프로젝트의 매니페스트입니다.
// Swift Playground에서 BabyDays.swiftpm 폴더를 열면 자동으로 인식됩니다.

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "BabyDays",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "BabyDays",
            targets: ["AppModule"],
            bundleIdentifier: "com.mylittletask.babydays",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .barChart),
            accentColor: .presetColor(.pink),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft
            ],
            capabilities: [
                .photoLibrary(purposeString: "선택한 앨범의 사진을 날짜별 기록으로 가져오기 위해 사진 보관함에 접근합니다.")
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: "."
        )
    ]
)
