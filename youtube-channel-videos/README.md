# Channel Reel — HTML + JavaScript only

서버, npm, Node, 파이썬 **없이** 동작합니다.  
`index.html`을 브라우저로 열면 끝입니다.

## 필요한 것

- 최신 브라우저 (Chrome / Edge 권장)
- Google Cloud의 **YouTube Data API v3** 키
- 인터넷 연결 (YouTube API 호출용)

## 실행 방법

1. 폴더 `youtube-channel-videos`에서 **`index.html`을 더블클릭**하거나
2. 브라우저에서 **파일 열기**로 `index.html`을 선택합니다.

그게 전부입니다. 로컬 서버를 띄울 필요 없습니다.

> Firefox 등 일부 환경은 `file://`에서 외부 API 호출을 막을 수 있습니다. 그때는 Chrome 또는 Edge로 열어 주세요.

## API 키 발급

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성/선택
2. **APIs & Services → Library**에서 **YouTube Data API v3** 사용 설정
3. **Credentials → Create credentials → API key**
4. (권장) API 키를 YouTube Data API v3로 제한
5. 키는 **앱 입력란에만** 넣고, 코드·README·Git에 커밋하지 마세요

### 채널 ID 찾는 법

- URL 예: `https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx` → `UC…` 부분이 ID
- `@핸들`은 이 앱의 채널 ID가 아닙니다

## 사용

1. **YouTube API 키** 입력
2. **채널 ID** (`UC…`) 입력
3. **영상 불러오기** 클릭  
→ 제목, 썸네일, 링크, 게시일이 표시됩니다.

## 파일 구성

```
youtube-channel-videos/
├── index.html   # 페이지 (이것만 열면 됨)
├── app.js       # API 호출 + UI
├── styles.css   # 스타일
└── README.md
```

## 참고

- API 키는 브라우저에 노출됩니다. 개인/학습용으로 키를 제한해 쓰세요.
- 잘못된 키, 없는 채널, 빈 목록, 할당량 초과 시 화면에 메시지를 표시합니다.
- 비공개/삭제된 항목은 목록에서 제외합니다.
