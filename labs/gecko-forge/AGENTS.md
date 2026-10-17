# GECKO FORGE 작업 범위

- 이 폴더는 독립 Vite 앱이다. Next 본게임을 실행하거나 분석할 필요가 없다. 먼저 README.md의 파일 지도/API만 읽는다.
- 일반 외형 실험: `src/engine/appearance.ts`, `src/engine/renderer.ts`와 실험실 안의 아트 파일만 수정한다. UI 작업은 `src/main.ts`, `src/style.css`, `src/ui/`.
- `../../src/genetics/`, `../../src/engine/`, `../../src/phenotype/`는 검증된 **읽기 전용 공유 기준**이다. 실험을 위해 상속 함수/기존 렌더러/본게임 저장 구조를 바꾸지 않는다. 새 렌더러는 lab 내부에서 `AppearanceRenderer`를 구현한다.
- 유전 좌위는 멘델 3좌위 + 다유전자 60좌위. 유전형·점수·관찰값·이름을 구분한다. 새 미검증 외형 파라미터를 유전체에 넣지 않는다.
- 수정 중 기본 검증: 이 폴더에서 `npm run typecheck && npm test`. 렌더 경계/API 변경은 `npm run build:engine`, UI 변경은 필요한 `npm run test:e2e -- --grep ...`와 `npm run build`.
- `npm run test:integration`은 최초 추출 검증/최종 본게임 이식 또는 공유 기준 변경 때만 실행한다. 루트 게임의 전체 테스트 수백 개와 전체 빌드를 외형 수정 때마다 실행하지 않는다. 이 작업의 테스트 정책은 사용자가 명시한 요구를 따른다.
- `results/`, `dist/`, `dist-engine/`, `test-results/`, `playwright-report/`는 임시 결과이며 Git에서 제외한다. 새 비교 이미지를 본게임 `public/`에 넣지 않는다.
- 본게임 통합은 사용자가 별도로 결정한다. 이 폴더의 결과를 게임에 자동 적용하지 않는다.
