# 작업 안내

- `references/`: 디자인 참고 이미지. 제공된 이미지는 `gecko-morph-concept.png`, `gecko-mobile-ui.png` 이름으로 보관합니다.
- `src/`: 애플리케이션 소스 코드.
- `public/`: 정적 파일.
- 프로젝트 설명과 실행 방법은 `README.md`에 기록합니다.
- 참고 이미지 원본은 수정하지 않습니다.

## Phase 1 개발

- Node.js 24 LTS와 `npm ci`를 사용합니다.
- `src/engine/`은 React와 DOM에 의존하지 않는 결정적 렌더링 코드입니다. Canvas 출력은 `canvas.ts`에 둡니다.
- 개체 외형(`appearance`)과 일시적 발색(`state.fire`)을 분리합니다. 이번 단계에는 유전학·교배 로직을 추가하지 않습니다.
- 레퍼런스와 코드로 제작한 베이스의 품질 차이를 명시합니다.
- 변경 후 `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`를 실행합니다.
- 시스템 Chromium을 쓰려면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`을 지정합니다.
- 기능 브랜치와 main 대상 PR로 리뷰합니다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
