# 편의성 패치 4종

기준 main: `b7205bb` (PR #41). 유전·외형 엔진, 저장 포맷, 사육장 가격·확장 규칙은 변경하지 않는다.

## 구현

- `resources.tsx`, `hub.tsx`, `settings.tsx`, `convenience.tsx`: 사료·사육장 구매창을 분리했다. 자동 구매는 게임 ID별 기기 UI 설정(localStorage)이다. 같은 게임의 새로고침·백업 복원에서 유지하고, 같은 시드를 포함한 새 게임 생성이 저장된 뒤 OFF로 초기화한다. 게임 JSON·IndexedDB 스키마에는 필드를 추가하지 않는다.
- `end-turn.tsx`, `time-source.ts`, `model.ts`, `use-hardcore.ts`: 기존 급여 수요와 사료 단가로 부족분만 계산한다. 구매와 턴을 메모리에서 완성한 후 기존 IndexedDB 리비전 검사·단일 트랜잭션으로 저장한다. 자금 부족은 구매·턴을 모두 취소하고 기존 경고에서 구매창 이동 또는 미급여 진행을 선택한다. 턴 번호 검사, 공통 저장 잠금과 짧은 입력 잠금으로 연속 입력을 방어한다.
- `collection.tsx`, `use-collection-swipe.ts`: 정렬·필터 결과를 6개씩 렌더링하고 페이지 이동 시 대표 개체를 맞춘다. 조건 변경은 첫 페이지로 이동하며 기존 전체 목록의 전역 선택은 유지한다. 조건 변경·언마운트 시 이전 제스처의 예약 프레임을 취소해 초기화를 덮어쓰지 않게 한다. 카드 영역에서 가로 방향을 판별하고 세로 스크롤·멀티터치·드래그 후 클릭을 구별한다. 네이티브 touchend를 마친 뒤 카드를 교체하며, 마지막 페이지도 기존 데스크톱 두 행의 영역을 유지한다. 새 페이지 표시 UI는 추가하지 않는다.
- `collection-card.tsx`, `collection-catalog.tsx`, `incubator.tsx`, `shop.tsx`, `convenience.tsx`: 공통 관찰 팝업을 사용한다. 기존 `specimen` → `SpriteCanvas` 경로의 96×96 비트맵을 성장 축소 없이 픽셀 확대한다. 원래 화면의 성장 크기·카드 배치·가상 스크롤은 보존한다. 이미지별 대상·이동 거리·입력 이력을 검사하며 기존 선택·부모 확인과 별도 게임 행동 버튼을 유지한다.
- `breeding.tsx`, `incubator.tsx`, `hub.tsx`, `collection.tsx`: 컬렉션 대표 영역·카드·전체 목록, 상점, 교배 예약 부족, 사용 가능한 슬롯이 없는 인큐베이터 안내에서 실제 사육장 구매창을 연다. 대표 영역의 상태 문구는 기존 표시 크기를 유지한 버튼으로 연결한다.
- `convenience.css`, `layout.tsx`: 기존 공통 모달·프레임·버튼을 재사용하고 관찰 영역, 체크박스, 제스처 처리에 필요한 스타일만 추가한다.

## 검증

전체 CI의 실제 판정과 로그는 [PR #42 Checks](https://github.com/damyo-zip/gecko-lab/pull/42/checks)에 연결한다. 기존 워크플로의 아트 일치 검사, 타입 검사, 전체 단위 440건, 프로덕션 빌드, E2E 312건(레이아웃 2 + 기능 276 + 직렬 Rush 34)을 그대로 실행한다. 유전·외형·저장 코드의 변경 유무도 main과 비교했다.

로컬 실행 환경은 Node.js 24.19.0, Chromium 154.0.8037.57, CPU 할당 2개다. 전체 CI와 구분해 로컬에서 확인한 결과를 기록한다.

| 실행 | 실제 결과 |
| --- | --- |
| 최종 코드 `npm run typecheck`, `npm run build` | 모두 통과 |
| 신규 자동 구매 단위 검사 | 기본 시간 제한으로 6/6 통과 |
| 신규 편의성·공간 부족 연결 검사 | 모바일·PC 신규 38건과 기존 관련 6건, 총 44건 통과. 이후 CI에서 드러난 빠른 정렬 변경 경합은 별도 보완함 |
| 자동 구매의 다섯 진입점·연속 터치, 300마리 필터·스와이프·목록 선택, 18턴 교배→성체→재접속 | 모바일·PC 6/6 통과 (`a919961`; 이후 게임 동작 코드는 동일) |
| 로컬 전체 단위 검사 | 435/440 통과. 변경하지 않은 기존 검사 5건이 20~30초 제한 초과 |
| 위 시간 초과와 관련된 기존 세 파일 재검사 | 임시로 시간 한도만 240초로 늘려 43/43 통과. 데이터·검증문은 유지했고 세 파일을 원본 그대로 복원함 |
| 로컬 Rush 전체 검사 | 21/34 통과. 프레임 시점·PERFECT 판정·짧은 효과 관찰 관련 실패 13건 |
| 변경 전 main을 별도 체크아웃하여 Rush 비교 4건 | 2/4 통과. 모바일·PC의 기존 300마리 legacy 검사 모두 PERFECT 급여 ₩300 대신 GOOD ₩200을 받아 실패. 공통 헤더·인트로 검사는 두 프로젝트 모두 통과 |

로컬 Rush 결과를 전체 성공으로 표시하지 않는다. 해당 경로의 엔진·급여·배치·판정 규칙 및 검증문은 수정하지 않았다. 최종 통합 결과는 위 CI의 전체 검사로 확인한다. 테스트 실행 중 생성된 기존 리뷰 PNG·JSON은 PR 변경에서 제외한다.

`77c5df8`의 CI에서는 단위 440/440, 레이아웃 2/2, 기능 274/276이 통과했다. 실패한 신규 두 검사는 스와이프 직후 정렬 변경 시 예약 프레임이 첫 페이지 초기화를 덮어쓰는 경합을 검출했다. 검증문을 유지하고 제스처 수명 처리를 수정했다. 또한 터치의 페이지 교체 시점을 pointerup 이후의 실제 touchend에 연결해 다음 버튼의 네이티브 클릭을 보존했다. 이 변경의 최종 통합 판정은 PR Checks에서 확인할 수 있다.

추가 회귀 테스트:

- `tests/auto-food.test.ts`: ON/OFF, 충분한 재고, 정확한 부족분과 현재 단가, 자금 부족·정확히 일치하는 자금, 중복 턴 요청, 연속 턴, 먹이 면제, 빈 컬렉션, 원본 불변성·백업 왕복.
- `e2e/convenience-patches.spec.ts`: 5개 턴 진입점, 실제 빠른 연속 터치·동기 중복 클릭, 두 창의 저장 충돌, 새로고침·같은 시드의 새 게임, 부족 경고의 두 선택, 모든 공간 부족 연결, 0~7·12·13·37·300마리, 정렬·필터·페이지 경계, 카드·대표 영역·하단 프레임 보존, 가상 스크롤, 서로 다른 개체 터치, 이미지·버튼 분리, 부화 새끼 부모·수령, 96×96 원본 픽셀 해시·스무딩 OFF, 360·390·430px 및 PC 뷰포트.
- 기존 E2E의 구매창 이름과 분리된 구매 경로를 갱신하고 대표 영역의 공간 부족 링크 검증을 추가했다. 18턴 생애주기 시나리오는 각 턴의 저장·연속 탭 보호를 포함하므로 실행 한도만 30초에서 90초로 늘렸다. 기존 검증문을 삭제하거나 건너뛰지 않았다.

## 범위와 제한

- 자동 구매 설정은 해당 브라우저·기기의 UI 설정이며 백업 JSON에 포함하지 않는다. 다른 기기에 복원하면 기본값 OFF다.
- 모바일 검증은 Chromium의 실제 터치 이벤트 에뮬레이션을 사용한다. 물리 기기 및 Safari 검증은 별도다.

## 수정 파일

```text
src/app/convenience.css
src/app/layout.tsx
src/components/hardcore/breeding.tsx
src/components/hardcore/collection-card.tsx
src/components/hardcore/collection-catalog.tsx
src/components/hardcore/collection.tsx
src/components/hardcore/convenience.tsx
src/components/hardcore/end-turn.tsx
src/components/hardcore/hub.tsx
src/components/hardcore/incubator.tsx
src/components/hardcore/resources.tsx
src/components/hardcore/settings.tsx
src/components/hardcore/shop.tsx
src/components/hardcore/use-collection-swipe.ts
src/game/hardcore/model.ts
src/game/hardcore/time-source.ts
src/hooks/use-hardcore.ts
tests/auto-food.test.ts
e2e/collection-browser.spec.ts
e2e/collection-status.spec.ts
e2e/common-ui.spec.ts
e2e/convenience-patches.spec.ts
e2e/hardcore-game.spec.ts
e2e/helpers/hardcore-navigation.ts
e2e/reference-home.spec.ts
e2e/shop-viewport-actions.spec.ts
e2e/time-mode.spec.ts
docs/convenience-patches/verification.md
```
