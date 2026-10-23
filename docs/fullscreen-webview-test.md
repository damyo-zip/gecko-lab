# 카카오톡 내장 브라우저 전체화면 실험

독립 URL: `https://gecko-lab.vercel.app/fullscreen-test`

- 기존 게임 화면, 저장소, 설치 안내, PWA 설정, 유전·외형 엔진은 바꾸지 않습니다.
- 전체화면 요청은 버튼 클릭 동기 이벤트 안에서 `document.documentElement.requestFullscreen()`으로 실행합니다.
- `fullscreenchange`, `fullscreenerror`, Promise 거절, API 미지원 결과를 화면에 출력합니다.
- 브라우저가 제공한 `window.innerHeight`, `visualViewport.height`, `screen.height`, `fullscreenEnabled`, `fullscreenElement` 상태를 기록합니다.
- 테스트 통과 시에도 카톡 주소창과 하단 메뉴가 실제 사라졌는지 **육안으로 확인**해야 합니다. WebView 호스트 앱 자체가 전체화면을 막을 수 있습니다.
- 원클릭 설치, 강제 브라우저 이동, 게임 상태 변경은 하지 않습니다.

## 테스트 방법

1. PR 미리보기 배포에서 `/fullscreen-test` 접속 (main 병합 후 위 URL 사용).
2. 카카오톡 채팅에 링크를 전송하고 카카오톡에서 직접 열기.
3. 시작 화면을 캡처하고 **전체화면 요청**을 탭.
4. 카톡 주소창 및 하단 메뉴가 실제로 사라졌는지, `현재 높이`가 증가했는지 확인.
5. **결과 텍스트 복사**를 눌러 진단 결과 전달. 복사가 제한되면 스크린샷 전달.

## 검증 명령

- `npm run typecheck`
- `npm run build`
- `npx playwright test e2e/fullscreen-test.spec.ts`

실제 카카오톡 호스트의 전체화면 지원 여부는 자동화 브라우저 테스트만으로 판단할 수 없고 Android 기기에서 검증해야 합니다.
