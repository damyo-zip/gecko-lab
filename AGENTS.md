# 작업 안내

- `references/`: 디자인 참고 이미지. 제공된 이미지는 `gecko-morph-concept.png`, `gecko-mobile-ui.png` 이름으로 보관합니다.
- `src/`: 애플리케이션 소스 코드.
- `public/`: 정적 파일.
- 프로젝트 설명과 실행 방법은 `README.md`에 기록합니다.
- 참고 이미지 원본은 수정하지 않습니다.

## 개발 원칙

- Node.js 24 LTS와 `npm ci`를 사용합니다.
- `src/engine/`은 React와 DOM에 의존하지 않는 결정적 렌더링 코드입니다. Canvas 출력은 `canvas.ts`에 둡니다.
- Phase 6 기본 아트는 public/art/gecko-v2의 실제 PNG와 마스크입니다. compile-gecko-art.mjs로 런타임 데이터를 생성하고 --check로 해시/픽셀 일치를 검증합니다. 정식 외형은 명암 개선 실험본 v2를 옮긴 src/engine/regional의 regional-2 한 경로만 사용합니다. 정식 경로에는 구형 렌더러·전환 모드를 추가하지 않습니다. 사용자 요청의 원화 보존 후보 비교는 src/lab/appearance와 /lab/appearance/candidates 안에서만 허용하며 게임·저장·평가 모듈이 실험 코드를 import하지 않도록 합니다. 96×96·8레이어·고정 시드와 기존 50/75/100% 성장 표시를 유지합니다.
- 원화 준비 스크립트를 무조건 실행해 아티스트의 편집 PNG를 덮어쓰지 않습니다. 아트 변경 시 실제 전후·6모프·12시드·모바일 캡처를 검토하고 과장된 품질 주장을 하지 않습니다.
- 유전학은 src/genetics, 게임 상태·혈통은 src/game, 그래픽 연결은 game/adapter.ts에 분리합니다.
- Phase 3 정식 게임은 src/game/hardcore, src/components/hardcore, storage/hardcore.ts입니다. `/lab/breeding`의 Phase 2 회귀 시뮬레이터는 `phase2-lab` 슬롯을 사용하며 정식 `active` 슬롯에 쓰지 않습니다.
- v1.2는 수동 턴만 사용하며 1턴=7일입니다. 정확히 12턴 성체, 생존 보유 개체당 기본 사료 1개 자동 급여, 부족 시 턴 전 경고를 적용합니다. 완료한 서로 다른 브리딩 도전 수(0~5개)만큼 턴당 무료 급여하며 소비는 max(0, 보유 수−완료 수)입니다. 하트가 낮은 개체부터 면제·재고 사료를 적용하고 무료 급여도 회복합니다. 새 해칭 보상은 다음 턴 급여부터 적용하며 기존 feedExemptionSlots 필드는 저장 호환용으로만 보존합니다. 이전 현실 시간 어댑터는 삭제하지 않고 v5 회귀용으로 보존합니다. 정식 저장 v11/규칙 버전 4는 모든 개체·배아에 regional-2와 유전체를 요구합니다. 구형 저장은 자동 이전·삭제하지 않고 새 게임을 안내합니다. 명시적 새 게임은 기존 원본을 원자적으로 아카이브에 남깁니다. 역사적 이전 함수는 회귀용이며 정식 readSave는 호출하지 않습니다. v7 상점은 4개 매물·확정 부모 원본·구매 완료 상태·재고 배치 번호를 저장합니다. 외부 부모는 pedigree 기록이며 보유 개체·급여·사육장 점유에 포함하지 않습니다.
- 턴 시작 개체 자동 급여·미급여 하트 감소·노령 자연사 후 산란·부화·성장·재고 갱신 순서를 지킵니다. 교배 +2턴에 한 번만 2알을 산란하며 추가 산란은 없습니다. 알 수거+4턴 판정·산란+4턴 휴식입니다. 50턴 노령·60턴 은퇴·65턴부터 확정 구간 확률·90턴 자연사를 적용합니다. 판매·폐사·부모 기록을 삭제하지 않으며 교배 시작 시 빈 슬롯 2칸을 예약하고 산란 시 수거 대기 알 예약으로 전환합니다. v10은 알을 수거해야 부화가 시작되고, 새끼 수령·실패 알 제거 전까지 슬롯을 유지합니다. 실제 나이는 부화 턴부터 계산하며 인큐베이터는 부화 당시 해칭 모습(기존 공통 50% scale 한 번)으로 표시합니다. 수령 시 기존 6/12턴 성장 단계를 적용합니다. 이전 부화 중 알의 카운터와 이미 처리한 과거 결과는 보존합니다. 이전 일정의 아직 산란하지 않은 추가 예약만 해제하고 이미 산란한 알과 기록을 보존합니다.
- 혈통 앨범은 기존 individuals·lineages를 단일 기록으로 사용합니다. v8은 lineage의 founderId·favorite만 추가하며 부모·유전체·알·거래를 재생성하지 않습니다. 시조가 불명확한 이전 이름은 null로 보존합니다. 관심 해제는 역사 기록을 지우지 않으며 숨은 유전형·연구 통계는 기본 앨범에 표시하지 않습니다.
- 시장 가격은 market/prices.json과 sources.json으로 관리합니다. 확인하지 못한 가격을 검증 시세로 표시하지 않습니다. 이미 완료된 판매의 금액·날짜·시장 버전을 바꾸지 않습니다.
- Phase 5의 신규 유전체·공개 지식은 src/genetics/advanced에 둡니다. 화면·예측·가격은 공개 지식을 사용하고 숨은 Aa를 조회하지 않습니다. 가상 60좌위는 게임 가정이며 이전 수치에서 임의로 복원하지 않습니다. 새 시즌 자손의 유전체는 수정 시 확정하고 자손 외형 관찰만 부모 지식에 반영합니다.
- 유전형과 게임용 잠재 외형 수치, 모프 이름을 혼동하지 않습니다. 미검토 유전자에 정확한 확률을 부여하지 않습니다.
- 정식 regional-2는 기존 60좌위와 PatternPlan의 무늬 기하를 재사용하고, 최종 재질·픽셀에서 면적·명도·반점·선 연결을 측정합니다. 이름·가격·도전은 같은 regionalObservation을 사용하며 구형 creamArea를 새 백색 면적으로 치환하지 않습니다. 넓은 백색 피복을 풀핀으로 판정하지 않습니다. C/S/H 복합·동형접합 외형은 잠정 게임 모델이며 상속·치사율은 변경하지 않습니다. 픽셀 캐시 32개·관찰 캐시 4096개로 제한합니다. 계약·한계는 docs/regional-engine.md에 기록합니다.
- 정식 v9는 근친·Lilly·잠정 복합 위험 교배를 공개 정보 기반 통합 경고 확인 후 허용합니다. 성별·성체·은퇴·회복·2칸 예약은 유지합니다. F는 전체 혈통의 φ로 계산하며 질병 확률/하트 벌점으로 쓰지 않습니다. 게임 전용 건강 열성 좌위 2개는 실제 사본을 상속하며 숨은 진실을 경고로 공개하지 않습니다. 기본 무정란5%·생존 가능한 수정란 부화95%와 별도 유전적 영향은 고정 시드로 판정하고 실패 원인을 구분합니다. 비생존 배아는 정상 개체로 등록할 수 없습니다. 이전 교배 riskModel=null은 확정 결과를 보존하고 가상 건강 효과는 새 교배부터 적용합니다. 복합 계통에 근거 없는 치사율을 부여하지 않습니다. 유전 결과는 수정 시 확정하며 부화 시 다시 추첨하지 않습니다.
- 저장 버전과 부모 ID, 고유 외형 시드, 다음 클러치 카운터를 유지합니다. 저장 완료 전 게임 행동을 화면에 반영하지 않습니다.
- 크레 러시는 별도 정면 아트를 사용하며 카페 크레는 보유 개체/유전형이 아닙니다. 신규 v3는 `game/rush-shifts.ts`의 독립된 난이도·업무량 추첨으로 6~20마리와 전체 웨이브를 시작 시 저장합니다. 종료 전에는 총량·남은 시간·전체 진행률·업무량을 공개하지 않습니다. 급여는 max(0,10320+1000P+500G−1500M)입니다. v1·v2 기록은 원래 25초·6웨이브·10마리·최대 3000원 규칙을 보존하며 재계산하지 않습니다. v9의 선택적 cafeRush 버전 1·2·3와 동일 IndexedDB 트랜잭션의 게임별 진행/수령 상한 기록을 함께 보존합니다. 백업 복원으로 수령 기록을 초기화하거나 복원 중 급여를 자동 가산하지 않습니다. 급여는 기존 money에 한 번만 지급하며 알바로 게임 턴·번식 RNG를 진행하지 않습니다. 같은 턴의 규칙 버전 변경으로 기록을 재추첨하지 않습니다. 추첨·난이도·급여·배치 규칙 변경 시 기존 버전을 유지하고 새 규칙 버전을 추가합니다. Worker 저장·작은 패치·배경 화면 동결 최적화를 보존합니다.
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
