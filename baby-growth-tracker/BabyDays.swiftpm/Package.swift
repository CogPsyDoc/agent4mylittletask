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
