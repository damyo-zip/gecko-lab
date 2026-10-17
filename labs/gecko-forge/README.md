# GECKO FORGE

유전·개체 생성·96×96 외형만 실행하는 독립 실험실. 새로운 게코 디자인은 추가하지 않았다.

## 실행

Node 24 LTS 권장 (최소 22.12). 저장소 루트의 `npm ci`, Next, React 또는 게임 빌드는 필요 없다.

```sh
cd labs/gecko-forge
npm ci
npm run dev
```

개발 서버 포트는 **5174**. 클라우드처럼 기본 npm 캐시 경로를 쓸 수 없는 환경에서는 `npm ci --cache /tmp/gecko-forge-npm-cache`를 사용한다. 네트워크 없이 실행 시에도 npm 설치 후에는 로컬 파일만 사용한다. 브라우저 설치가 필요한 최초 E2E 실행 전에는 `npx playwright install chromium`을 실행한다.

```sh
npm run typecheck
npm test                 # 독립 단위·의존성 테스트만
npm run build            # 독립 정적 웹 앱 → dist/
npm run preview          # 빌드된 앱 확인, 포트 5174
npm run build:engine     # DOM·외부 런타임 의존성 없는 ES 모듈 → dist-engine/gecko-forge.js
npm run test:e2e         # 독립 앱의 데스크톱/모바일 Chromium 테스트만
npm run test:integration # 최초 추출/최종 이식 시 본게임과 동등성 검사
```

테스트 Chromium이 `/tmp/gecko-ci-browsers`에 설치된 클라우드에서는 `PLAYWRIGHT_BROWSERS_PATH=/tmp/gecko-ci-browsers npm run test:e2e`.

GitHub CI도 변경 경로를 구분한다. `labs/gecko-forge/`만 바꾸면 독립 실험실 테스트·빌드·브라우저 검사만 실행한다. 공유 엔진/본게임 또는 루트 설정 변경은 기존 게임 검증을 유지하며, 공유 유전·렌더 코드가 바뀌면 실험실도 함께 검증한다.

## 공유와 독립의 경계

기준 소스는 `main`의 **c934363**이다. 체크아웃에 없는 실험 브랜치의 regional v1/v2를 임의로 섞지 않았다. 기준 렌더러는 **patterns-1 / 2.1.0**이며, 최초 B는 별도 원본 아트 비교 자료다.

```
labs/gecko-forge/               자체 package.json / lock / Vite / Vitest / Playwright
  src/engine/genetics.ts       기존 유전 함수를 직접 재수출 (복제 없음)
  src/engine/individual.ts     최초 개체·자손 생성, 생존 여부와 ID/부모 메타데이터
  src/engine/appearance.ts     유전체 → 표현형·무늬 형질, 관찰값/명칭
  src/engine/renderer.ts       표현형+시드 → RGBA, 교체 가능한 외형 어댑터
  src/engine/model.ts          엔진/UI 사이의 작은 인터페이스
  src/engine/workspace.ts      실험 JSON 형식·검증 (게임 세이브 아님)
  src/ui/browser.ts            Canvas, PNG 다운로드, 실험 전용 localStorage
  src/main.ts / style.css      실험 UI
  public/reference/            최초 B 원본 PNG (수정 없음)
  tests/                      빠른 엔진·보존·의존성 테스트
  integration/                최초 추출/최종 이식용 본게임 동등성 테스트
  e2e/                        생성·교배·편집·복원·PNG 브라우저 테스트

../../src/genetics/            읽기 전용 공유: 멘델/60좌위/PRNG/표현형
../../src/engine/              읽기 전용 공유: 현재 96×96 원화·기준 렌더러
../../src/phenotype/           읽기 전용 공유: 무늬 형질/한국어 명칭 규칙
```

실험실은 위 **순수 소스**를 직접 번들링한다. 상속 코드를 실험실에 복사해 수정하는 구조가 아니다. `game/`, `storage/`, 게임 UI, Next/React를 앱·엔진 번들에 포함하면 빌드 경계 검사에서 실패한다. 공개 엔진 API의 전이 의존성도 단위 테스트로 검사한다. 루트 `tsconfig.json`에서 `labs`를 제외하여 서로의 앱/테스트를 함께 타입 검사하지 않게 했으며, CI에는 경로별 검증 분기를 추가했다. 본게임 로직·렌더러·저장 코드는 수정하지 않았다.

완성 코드의 이식 단위는 `src/engine/appearance.ts`와 선택한 `AppearanceRenderer` 구현이다. 본게임 공통 어댑터에서 `Genome`과 기존 외형 시드를 전달하면 된다. 실험실 UI·localStorage·실험 개체 목록은 이식 대상이 아니다. 배포된 단일 ES 모듈은 저장소 밖에서도 실행할 수 있으며, 소스 통합 시에는 기존 공유 모듈을 재사용하므로 상속 코드를 중복 반입하지 않는다.

## 다음 외형 작업에서 볼 파일

1. **외형만 바꾸기:** `src/engine/renderer.ts`에서 `AppearanceRenderer.render()`를 구현한다. `../../src/engine/render.ts`를 수정하지 않는다. 기존 원화/순수 도우미는 가져와 사용할 수 있다. 새 아트는 이 실험실 안에 둔다.
2. **기존 60좌위를 새로운 외형 표현으로 매핑:** `src/engine/appearance.ts`만 수정한다. `genetics.ts`와 공유 상속 구현은 유지한다.
3. **유전 모델에 없는 외형 매개변수:** 실험용 설정을 `model.ts`의 별도 설정/렌더 입력으로 추가한다. Genome에 추가하지 않는다. 아직 그런 매개변수를 만들지는 않았다.
4. **UI에서 조작 항목 추가:** `main.ts`/`style.css`. 실험 결과와 설정을 보존한다면 `workspace.ts`의 JSON 버전/검증도 갱신한다.

렌더러의 의미가 바뀌는 새 실험에는 별도의 렌더러 버전을 기록해야 한다. 같은 유전체/시드의 결정적 재현은 **동일한 엔진 버전** 안에서 보장된다.

## 이식 가능한 API

아래 함수는 모두 `src/engine/index.ts`에서 공개한다. React, Canvas, 게임 개체 타입 또는 턴 인자가 없다.

```ts
const father = createFounder({ id: 'f', seed: 'father', sex: 'male' });
const mother = createFounder({ id: 'm', seed: 'mother', sex: 'female' });
const child = createOffspring(father, mother, { id: 'c', seed: 'cross-1' });

const phenotype = calculatePhenotype(child.genome);
const sprite = renderAppearance({ phenotype, seed: child.visualSeed, fire: 'up' });
// sprite.width/height = 96, pixels = straight RGBA Uint8ClampedArray
// renderIndividual(child)는 기존 비생존 유전형이면 null 반환
```

| API | 입력 | 출력 |
| --- | --- | --- |
| `createFounder` | 유전체 생성 시드, 선택 멘델 유전형, 선택 외형 시드, ID/성별 | 기존 founderPoly로 생성한 60좌위 + 멘델 유전체/메타데이터 |
| `createOffspring` | 부모 2개, 교배 시드, 새 ID | 기존 inherit + inheritPoly 결과, 실제 부모 ID·세대 |
| `calculatePhenotype` | Genome | 기존 표현형 계산값 + 렌더용 PatternTraits + 발현 좌위 |
| `renderAppearance` | 위 표현형, 외형 시드, 파이어 상태, 선택 렌더러 | 96×96 RGBA 및 기존 레이어 |
| `describeAppearance` | 표현형, 외형 시드 | 기존 실제 무늬 관찰값·분류·대표 명칭 |
| `exportWorkspace` / `importWorkspace` | Workspace / JSON 문자열 | 버전·유전체·부모 관계 검증을 통과한 JSON / Workspace |

`genetics.ts`는 `inherit`, `inheritPoly`, `founderPoly`, `phenotype` 등 기존 함수 그대로를 노출한다. 생성과 상속의 PRNG 도메인도 변경하지 않았다. UI의 랜덤 버튼은 새 시드를 뽑을 뿐이고, 선택한 멘델 유전형은 유지한다. 교배 시드는 `입력 시드|자손 인덱스`이므로 같은 부모/교배 시드로 같은 유전 결과를 반복 생성할 수 있다. ID는 실험 내 고유 식별자이며 외형 난수에 쓰지 않는다.

## 조작·보존

- 모프 프리셋 또는 3좌위 각각의 대립유전자 쌍을 선택한다. `유전체 생성 시드`로 **60좌위 재생성** 버튼을 누르면 동일 시드의 founderPoly를 재현한다.
- 10개 슬라이더는 해당 형질의 6좌위/12사본을 실제로 편집한다. 로지스틱 점수·다면발현은 기존 `polyScores`로 재계산한다. 연속적인 점수를 가짜 유전체로 역추정하지 않는다. 필요하면 **60좌위 직접 편집**에서 각 사본을 변경한다.
- **설정으로 개체 생성**은 편집 조건의 새 개체를 보관한다. 선택 개체·기존 부모는 바꾸지 않는다. 편집본은 실제 상속 자손으로 위장하지 않으며 `origin: edited`, `derivedFrom`으로 구분한다.
- **동일 조건 재현**은 저장된 전체 유전체/외형 시드/파이어 상태를 복사한다. 부모 및 유전체 비교는 카드와 하단 상세에서 가능하다.
- 카드는 최대 24개씩 그린다. 전체 결과는 JSON에 보존하고, 페이지 이동과 즐겨찾기 필터로 탐색한다. 렌더링 캐시는 128개로 제한하며 반환 버퍼 변경이 캐시를 훼손하지 않는다.
- 부모 두 마리를 고르고 1~64개의 자손을 생성한다. 자손도 부모 슬롯에서 선택해 반복 교배한다. 실험 개체는 최대 1,000마리, JSON 최대 8MB.
- PNG 버튼은 확대 화면의 스크린샷이 아니라 **원본 96×96 투명 PNG**를 내보낸다. 확대 화면은 최근접 픽셀 표시다.
- 브라우저 저장 키는 `gecko-forge:workspace:1`. 게임 저장 키나 IndexedDB를 사용하지 않는다. JSON 가져오기/새 실험 전에 `gecko-forge:before-import:1`로 이전 실험을 백업한다. 손상된 가져오기는 전체 검증 후 거부하며 현재 실험을 대체하지 않는다. 장기 보관은 JSON 내보내기를 사용한다. 편집 중 미생성 draft는 미저장이다.
- JSON에는 전체 유전체·시드·파이어·부모·세대·즐겨찾기·선택 부모·교배 시드/수량·보기 설정이 포함된다. 게임 세이브 JSON은 가져오지 않는다.

## 기준 아트와 한계

최초 B는 원본 커밋 `c9cb231db4afacaffc52b6e9655d57bc9f5a6f26`의 `public/lab/base-study/B-normal.png`를 바이트 그대로 보존했다. SHA-256: `487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de`. B는 비교용이며 새 렌더러라고 설명하지 않는다.

기준 patterns-1 렌더러에는 C/S/H 전용 재질·해부학적 표현이 없다. 유전·복합 명칭은 기존 모델 그대로 계산하지만 카푸치노·하이웨이·세이블만의 새로운 외형을 이번에 제작하지 않았다. 실험실은 이 간극을 향후 외형 작업에서 개선하기 위한 환경이다.

기존 Lilly 동형접합 비생존은 유지한다. C/S/H의 보고된 위험과 미확인 사망률을 혼동하지 않고 추가 치사율을 만들지 않았다. 게임의 급여·인큐베이터·수정/부화 확률·턴·사육 공간·게임 전용 건강/근친 시스템은 실험실 범위 밖이다. 유전 결과를 배아 단계에서 바로 비교하므로 정상 부화나 생존이 보장된 개체라고 표시하지 않는다. 유전형·60좌위는 게임용 근사 모델이며 분자유전학적 확정 사실이 아니다.

## 검증 범위

외형 반복 작업은 `npm test`와 해당 시각 확인만 수행한다. 이번 최초 분리 검증에는 독립 단위 테스트, 기존 본게임 함수와의 유전체 동등성, **120개 유전형/파이어 조합의 정확한 픽셀 일치**, 데스크톱·모바일 Chromium의 생성/재현/PNG/교배/세대/JSON 복원, 루트 타입 검사·관련 유전/렌더 테스트·빌드를 포함한다. 실제 Android 기기 검증과 모바일 에뮬레이션은 구분한다. 결과 수치는 작업 완료 시 `VALIDATION.md`에 기록한다.
