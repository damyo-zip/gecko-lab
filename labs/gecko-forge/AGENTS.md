# GECKO FORGE — 새 세션 시작 안내

- 이 디렉터리가 프로젝트 루트다. 이 파일과 README.md를 읽으면 시작할 수 있다. 이전 대화나 본게임 체크아웃을 찾지 않는다.
- Node 24 LTS, `npm ci`, `npm run dev` (5174). 기본 검증은 `npm run typecheck && npm test`. 전체 게임 테스트/빌드는 존재하지 않으며 필요 없다.
- 외형 작업은 `src/engine/renderer.ts`, `appearance.ts`와 프로젝트 내부 새 아트만 우선 수정한다. `src/core/`의 원본 상속 모델은 외형 실험을 위해 변경하지 않는다.
- 기존 멘델 3좌위·다유전자 60좌위·PRNG 도메인·부모별 사본 상속을 유지한다. 형질 점수, 유전체, 이름을 구분한다. 미검증 외형 매개변수는 실험 설정으로 분리한다.
- 출력은 96×96 네이티브 RGBA. 블러/부드러운 보간 금지. 얼굴/실루엣 등 아트 변경은 실제 PNG를 보고 판단하며 테스트 통과를 미적 완성도의 증거로 삼지 않는다.
- `@/`는 내부 `src/core/` 별칭이다. 외부 디렉터리, 다른 저장소, symlink, 별도 게임 설치에 의존하지 않는다. 공개 엔진 API는 DOM/React/게임 상태를 import하지 않는다.
- 변경 영역 단위 테스트를 우선 실행한다. API/렌더 경계 변경은 `npm run build:engine`, UI 변경은 관련 `npm run test:e2e`, 배포 전 `npm run build`를 추가한다.
- 고정 기준은 `fixtures/baseline-v1/`, 출처는 `provenance/source-manifest.json`. 대형 원본 JSON을 반복해서 읽지 말고 manifest와 `npm run test:baseline`을 사용한다. 테스트를 통과시키려고 원본 기준값을 덮어쓰지 않는다. 의도적인 새 외형에는 새 버전의 별도 기준을 추가한다.
- 기존 원화 PNG는 `art/source/`; `npm run art:check`는 읽기만 한다. `art:compile`은 런타임 데이터를 덮어쓰므로 검토한 아트 변경 때만 사용한다. 초기 B 원본과 원본 기준 아트는 보존한다.
- 본게임 이식 경계는 `docs/API.md`. 이식은 별도 결정이며 UI/실험 저장을 게임에 넣지 않는다.
- `exports/`, `results/`, `dist*`, `test-results/`, `playwright-report/`는 임시 산출물이며 Git에서 제외한다. 이관 묶음은 `npm run pack:project`로 만든다.
