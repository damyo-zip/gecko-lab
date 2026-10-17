# 엔진 인터페이스와 향후 이식

공개 진입점은 `src/engine/index.ts`. 브라우저 없이 사용할 수 있다.

```ts
import { createFounder, createOffspring, calculatePhenotype, renderAppearance } from './src/engine/index';

const father = createFounder({ id: 'f', seed: 'father', sex: 'male' });
const mother = createFounder({ id: 'm', seed: 'mother', sex: 'female' });
const child = createOffspring(father, mother, { id: 'c', seed: 'cross-1' });
const phenotype = calculatePhenotype(child.genome);
const sprite = renderAppearance({ phenotype, seed: child.visualSeed, fire: 'up' });
// width = height = 96, pixels = Uint8ClampedArray (straight RGBA)
```

| API | 입력 | 출력 |
| --- | --- | --- |
| `createFounder` | ID, 생성 시드, 선택 성별/멘델 유전형/외형 시드 | 60좌위 생성 + 멘델 유전체를 가진 ForgeGecko |
| `createOffspring` | 수컷/암컷 ForgeGecko, 새 ID, 교배 시드 | 기존 멘델·다유전자 상속 결과, 부모 ID·세대 |
| `calculatePhenotype` | Genome | 유전 표현형, PatternTraits, 좌위별 발현 |
| `renderAppearance` | 표현형, 외형 시드, 파이어, 선택 AppearanceRenderer | 96×96 RGBA와 레이어 |
| `describeAppearance` | 표현형, 외형 시드 | 관찰값·무늬 분류·대표 명칭 |
| `renderIndividual` | ForgeGecko | 캐시 보호된 이미지. 기존 비생존 유전형은 null |

`Genome.version = 1`, 멘델 `loci`는 대립유전자 문자열 쌍, 다유전자 `loci`는 60개 좌위 각각 0~4의 실제 대립유전자 인덱스 쌍이다. 한 부모에게서 사본 하나씩 전달한다. 점수 평균으로 자손을 생성하지 않는다. 생성 시드와 외형 시드는 분리되고 ID/이름은 렌더 난수에 쓰이지 않는다. 같은 유전체·시드·파이어·엔진 버전은 같은 픽셀을 만든다.

새 외형은 `AppearanceRenderer`를 구현한다. `renderAppearance(input, renderer)`로 전달할 수 있다. 기존 모델에 없는 시각 매개변수는 유전체를 바꾸지 않는 별도 렌더 설정으로 확장한다. 기준 렌더러의 출력 버전은 `patterns-1 / 2.1.0`이다.

`npm run build:engine`은 `dist-engine/gecko-forge.js` 단일 ES 모듈을 만든다. 외부 런타임 패키지, DOM, 게임 상태 없이 Node/브라우저에서 import할 수 있다. 타입 계약의 원본은 `src/engine/model.ts`와 `src/core/genetics/advanced/model.ts`다.

향후 이식할 때에는 게임 개체에서 **실제 Genome·외형 시드·파이어**를 공통 어댑터 한 곳으로 전달한다. 이름·점수·그림에서 유전체를 역추정하지 않는다. 기존 게임 유전 모델과 같다면 검증된 상속 코드를 중복 이식하지 말고 새 표현형/렌더러만 연결한다. 모델을 의도적으로 바꾼 경우에는 버전·상속·저장 검증을 별도로 진행한다.

게임 UI, ForgeGecko 실험 목록, localStorage, PNG 다운로드는 이식하지 않는다. 본게임 상점·경제·턴·저장 시스템은 이 프로젝트에 없다. 브라우저 전용 포트는 `src/ui/browser.ts`에서만 처리한다.

실험 JSON 형식은 `src/engine/workspace.ts`에서 버전/유전체/부모 관계를 검증한다. 프로젝트 v0.2.0 추출 과정에서 기존 실험 JSON v1 형식과 저장 키를 바꾸지 않았다.
