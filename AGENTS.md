# 작업 안내

- `references/`: 디자인 참고 이미지. 제공된 이미지는 `gecko-morph-concept.png`, `gecko-mobile-ui.png` 이름으로 보관합니다.
- `src/`: 애플리케이션 소스 코드.
- `public/`: 정적 파일.
- 프로젝트 설명과 실행 방법은 `README.md`에 기록합니다.
- 참고 이미지 원본은 수정하지 않습니다.

## 개발 원칙

- Node.js 24 LTS와 `npm ci`를 사용합니다.
- `src/engine/`은 React와 DOM에 의존하지 않는 결정적 렌더링 코드입니다. Canvas 출력은 `canvas.ts`에 둡니다.
- 기존 그래픽 엔진과 결과는 보존합니다. Phase 1 연구실은 /lab에 유지합니다.
- 유전학은 src/genetics, 게임 상태·혈통은 src/game, 그래픽 연결은 game/adapter.ts에 분리합니다.
- Phase 3 정식 게임은 src/game/hardcore, src/components/hardcore, storage/hardcore.ts입니다. `/lab/breeding`의 Phase 2 회귀 시뮬레이터는 `phase2-lab` 슬롯을 사용하며 정식 `active` 슬롯에 쓰지 않습니다.
- 현실 날짜는 Asia/Seoul 자정이며 UI·렌더러와 분리합니다. 자동 급여·장기 미접속 보호·정식 시간 진행 버튼은 구현하지 않습니다. 테스트는 주입한 시계로 날짜를 진행합니다.
- 생존 감소·폐사 확정 후 번식, 산란·부화, 성장, 일일 재고 순서를 지킵니다. 판매·폐사 개체와 부모 참조를 삭제하지 않습니다. 새끼 공간은 교배부터 예약합니다.
- 시장 가격은 market/prices.json과 sources.json으로 관리합니다. 확인하지 못한 가격을 검증 시세로 표시하지 않습니다. 이미 완료된 판매의 금액·날짜·시장 버전을 바꾸지 않습니다.
- 유전형과 게임용 잠재 외형 수치, 모프 이름을 혼동하지 않습니다. 미검토 유전자에 정확한 확률을 부여하지 않습니다.
- 위험 교배와 가까운 근친은 확률 표시 후 실행 전에 차단합니다. 알은 산란 시 결과를 확정하고 부화 시 다시 추첨하지 않습니다.
- 저장 버전과 부모 ID, 고유 외형 시드, 다음 클러치 카운터를 유지합니다. 저장 완료 전 게임 행동을 화면에 반영하지 않습니다.
- 기존 테스트를 삭제·건너뛰지 않고 실제 360px 터치 플레이와 IndexedDB 복원을 검증합니다.
- 레퍼런스와 코드로 제작한 베이스의 품질 차이를 명시합니다.
- 변경 후 `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e`를 실행합니다.
- 시스템 Chromium을 쓰려면 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`을 지정합니다.
- 기능 브랜치와 main 대상 PR로 리뷰합니다.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
