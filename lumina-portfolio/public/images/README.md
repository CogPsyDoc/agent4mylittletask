# 사진 넣는 곳 / Drop your photos here

이 폴더에 이미지 파일을 넣고, `site.config.ts` 에서 경로를 적으면 됩니다.

예) 파일을 `public/images/series-1/cover.jpg` 로 저장했다면,
`site.config.ts` 에서:

```ts
cover: "/images/series-1/cover.jpg",
```

- 경로는 항상 `/images/...` 로 시작합니다 (`public/` 은 빼고 씁니다).
- 값을 비워두면("") 부드러운 회색 플레이스홀더가 대신 보입니다.
- 권장 형식: JPG 또는 WebP. 큰 사진은 미리 적당한 크기로 줄여서 올리면 빠릅니다.
