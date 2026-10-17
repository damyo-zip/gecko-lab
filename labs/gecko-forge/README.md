# GECKO FORGE

유전·개체 생성·96×96 픽셀 렌더링을 실험하는 **완전 독립 프로젝트**. 이 폴더의 내용 전체를 새 GitHub 저장소의 루트로 옮기면 된다. 다른 체크아웃, Next, React, 본게임 빌드가 필요 없다. 새 세션에서는 `AGENTS.md`부터 읽는다.

## 시작

Node **24 LTS** 권장 (최소 22.12).

```sh
npm ci
npm run dev           # 포트 5174
npm test              # 로컬 단위·고정 기준값·원화 일치 검사
npm run build         # 독립 정적 앱 → dist/
```

`npm run typecheck`, `npm run build:engine`으로 타입과 DOM 없는 단일 ES 모듈도 검사할 수 있다. 브라우저 검증은 최초 `npx playwright install chromium` 후 `npm run test:e2e`; 기존 개발 서버를 재사용하지 않고 전용 5184 포트에서 실행한다. npm 캐시는 `.npmrc`에 지정한 프로젝트 내부 `.cache/npm`을 사용하며 Git/이관 압축에서 제외한다.

## 기능

- 랜덤/유전형 지정 생성, 기존 60좌위 확인·직접 편집, 외형 시드 변경·동일 조건 재현.
- 96×96 원본/픽셀 확대/최초 B 원본 비교, PNG 내보내기.
- 부모 선택, 1~64개 자손 배치 생성, 자손을 다시 부모로 선택하는 다세대 교배.
- 즐겨찾기, 실험 전용 브라우저 저장, 유전체·시드·부모·설정 JSON 내보내기/복원.

교배는 기존 멘델 3좌위와 다유전자 60좌위의 실제 사본을 상속한다. 슬라이더는 점수를 덮어쓰지 않고 해당 6좌위의 대립유전자를 편집한다. 편집본은 부모를 수정하지 않는 별도 개체다. `동일 조건 재현`은 전체 유전체·시드·파이어를 복사한다. 저장 키는 `gecko-forge:*`이며 게임 저장 시스템은 포함하지 않는다.

## 수정할 파일

| 위치 | 역할 |
| --- | --- |
| `src/engine/renderer.ts` | 렌더러 인터페이스·교체 지점, 96×96 RGBA 출력 |
| `src/engine/appearance.ts` | 유전체 → 표현형·렌더 형질 매핑 |
| `src/engine/individual.ts` | 최초 개체·자손 생성 API |
| `src/core/` | 프로젝트 내부에 보존한 원본 유전·렌더·무늬 코드 25개 |
| `src/main.ts`, `src/ui/`, `src/style.css` | 실험 UI·Canvas·PNG·실험 저장 |
| `art/source/`, `public/reference/` | 기존 원화/PNG 마스크와 최초 B 원본 |
| `fixtures/baseline-v1/` | 원본으로 캡처한 유전·픽셀 기준 결과 |
| `provenance/` | 출처·기준 커밋·파일별 SHA-256 |

`@/`는 **이 프로젝트의 `src/core/`**만 가리킨다. 부모 디렉터리를 찾는 설정이나 외부 저장소 참조는 없다. `src/core`는 비교 기준이므로 외형 실험은 우선 `src/engine/`의 새 렌더러로 진행한다. 유전 모델에 없는 매개변수는 별도 실험 설정으로 두고 유전체에 추가하지 않는다.

## 검증과 이관

`npm test`는 본게임 없이 실행하며, 원화/런타임 일치, 전이 의존성의 프로젝트 내부 한정, 원본 파일 해시, 개체 6마리·자손 96마리·확률표 3개·렌더 120조건·기준 PNG 6장을 검사한다. 기준 결과는 자동 갱신하지 않는다. `npm run test:baseline`은 고정 기준값만 검사한다. `test:integration`은 이 명령의 호환 이름이며 외부 프로젝트를 불러오지 않는다.

```sh
npm run pack:project
# exports/gecko-forge-0.2.0.tar.gz 와 파일별 해시 목록 생성
```

압축은 소스·아트·문서·테스트·lock·독립 GitHub CI를 포함한다. Git 이력, node_modules, 임시 결과, 빌드 산출물, 환경 파일은 제외한다. 압축을 푼 `gecko-forge` 디렉터리에서 위 시작 명령을 그대로 실행한다. 새 저장소에는 이 디렉터리 **내부 내용**을 루트로 올린다.

향후 게임에 이식할 API는 [docs/API.md](docs/API.md), 정확한 출처는 [provenance/README.md](provenance/README.md), 실제 검증 범위는 [VALIDATION.md](VALIDATION.md)에 있다. 실험 UI와 실험 저장소는 이식 대상이 아니다.

현재 기준 외형은 **patterns-1 / 2.1.0**이며 새 디자인은 만들지 않았다. C/S/H 유전과 조합은 보존했지만 전용 외형은 아직 없다. 최초 B는 수정 없는 비교 아트다. 기존 Lilly 동형접합 비생존만 유지하고 미검증 조합에 새로운 치사율을 추가하지 않았다.
