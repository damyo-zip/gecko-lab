/** Shape recipes, not painted sprites. Each recipe rearranges and stretches
 * the preserved reference branches before the same ventral growth solver. */
export interface HarlequinVariant {
  id: number;
  name: string;
  description: string;
  branches: number;
  height: number;
  rhythm: readonly number[];
  lean: number;
  baseRise: number;
  order: readonly number[];
  targetCoverage: number;
  legStrength: number;
}
export const HARLEQUIN_VARIANTS: readonly HarlequinVariant[] = [
  { id: 1, name: '굵은 세 갈래', description: '넓은 가지 세 개와 깊은 골', branches: 3, height: 1.35, rhythm: [1, .76, 1.1], lean: 0, baseRise: .12, order: [1, 2, 1], targetCoverage: .54, legStrength: .6 },
  { id: 2, name: '큰 가지 교차', description: '큰 가지와 낮은 가지의 교대', branches: 4, height: 1.45, rhythm: [.65, 1.1, .7, 1.05], lean: -.12, baseRise: .16, order: [2, 1, 3, 2], targetCoverage: .57, legStrength: .5 },
  { id: 3, name: '다섯 손가락', description: '폭이 다른 다섯 개의 상승 면', branches: 5, height: 1.4, rhythm: [.72, 1, .82, 1.12, .68], lean: .08, baseRise: .1, order: [2, 1, 2, 1, 3], targetCoverage: .55, legStrength: .65 },
  { id: 4, name: '가느다란 빗살', description: '좁고 긴 가지와 뚜렷한 세로 골', branches: 7, height: 1.7, rhythm: [.75, 1, .65, 1.1, .8, 1, .7], lean: -.08, baseRise: .08, order: [2, 1, 3, 1, 2, 1, 3], targetCoverage: .51, legStrength: .35 },
  { id: 5, name: '앞쪽 큰 불꽃', description: '목 뒤와 몸통 앞쪽에 큰 크림 면', branches: 4, height: 1.55, rhythm: [1.2, 1.05, .65, .5], lean: -.12, baseRise: .15, order: [1, 2, 1, 3], targetCoverage: .54, legStrength: .8 },
  { id: 6, name: '뒤쪽 큰 불꽃', description: '뒤로 갈수록 높아지는 가지', branches: 4, height: 1.55, rhythm: [.5, .65, 1.05, 1.2], lean: .12, baseRise: .15, order: [3, 1, 2, 1], targetCoverage: .54, legStrength: .5 },
  { id: 7, name: '앞으로 기운 가지', description: '주둥이 쪽으로 굽어 올라가는 흐름', branches: 4, height: 1.65, rhythm: [.8, 1.05, .7, 1], lean: -.48, baseRise: .1, order: [2, 1, 2, 1], targetCoverage: .56, legStrength: .65 },
  { id: 8, name: '뒤로 흐르는 가지', description: '꼬리 방향으로 길게 휘는 흐름', branches: 4, height: 1.65, rhythm: [1, .7, 1.05, .8], lean: .48, baseRise: .1, order: [1, 2, 1, 2], targetCoverage: .56, legStrength: .45 },
  { id: 9, name: '넓은 두 기둥', description: '굵은 두 덩어리 사이의 큰 갈색 골', branches: 2, height: 1.65, rhythm: [.85, 1.1], lean: .06, baseRise: .08, order: [1, 2], targetCoverage: .56, legStrength: .75 },
  { id: 10, name: '가운데 왕관', description: '몸통 중앙의 높은 가지와 낮은 양끝', branches: 5, height: 1.75, rhythm: [.45, .72, 1.2, .7, .45], lean: 0, baseRise: .12, order: [3, 2, 1, 2, 3], targetCoverage: .53, legStrength: .4 },
  { id: 11, name: '양끝의 봉우리', description: '앞뒤는 높고 가운데는 깊게 패인 면', branches: 5, height: 1.7, rhythm: [1.15, .8, .4, .8, 1.15], lean: 0, baseRise: .16, order: [1, 2, 3, 2, 1], targetCoverage: .53, legStrength: .8 },
  { id: 12, name: '겹친 크림 물결', description: '넓게 연결되는 낮은 물결과 두 봉우리', branches: 3, height: 1.4, rhythm: [1, .65, 1.05], lean: .25, baseRise: .34, order: [2, 3, 1], targetCoverage: .64, legStrength: .6 },
  { id: 13, name: '높은 가지 숲', description: '여섯 개의 높은 가지와 좁은 틈', branches: 6, height: 1.8, rhythm: [.8, 1.05, .9, 1.1, .85, 1], lean: .12, baseRise: .1, order: [1, 2, 1, 2, 1, 2], targetCoverage: .67, legStrength: .9 },
  { id: 14, name: '갈라진 큰 손', description: '참고 무늬의 갈라진 끝을 넓게 확장', branches: 3, height: 1.75, rhythm: [.8, 1.1, .9], lean: -.18, baseRise: .14, order: [1, 1, 1], targetCoverage: .62, legStrength: .75 },
  { id: 15, name: '둥근 잎사귀', description: '둥근 끝의 굵은 가지 네 개', branches: 4, height: 1.65, rhythm: [.85, 1.05, .75, 1], lean: .2, baseRise: .08, order: [2, 2, 2, 2], targetCoverage: .55, legStrength: .5 },
  { id: 16, name: '작고 큰 일곱 갈래', description: '짧고 긴 가지가 번갈아 솟는 리듬', branches: 7, height: 1.9, rhythm: [.5, 1.05, .58, 1.1, .52, 1, .55], lean: -.18, baseRise: .12, order: [3, 1, 3, 2, 3, 1, 3], targetCoverage: .52, legStrength: .55 },
  { id: 17, name: '앞쪽 크림 망토', description: '앞쪽은 넓고 뒤쪽에는 가는 가지', branches: 3, height: 1.9, rhythm: [1.25, .8, .5], lean: -.3, baseRise: .25, order: [1, 2, 3], targetCoverage: .65, legStrength: 1 },
  { id: 18, name: '뒤쪽 크림 망토', description: '뒷다리 위로 모이는 넓은 크림 면', branches: 3, height: 1.9, rhythm: [.5, .8, 1.25], lean: .3, baseRise: .25, order: [3, 2, 1], targetCoverage: .65, legStrength: .75 },
  { id: 19, name: '깊은 골의 강한 할리퀸', description: '높은 발현에서도 남는 긴 갈색 골', branches: 4, height: 2.1, rhythm: [.85, 1, .8, 1.05], lean: -.08, baseRise: .08, order: [1, 2, 1, 2], targetCoverage: .72, legStrength: 1 },
  { id: 20, name: '넓게 연결된 크림', description: '배 위의 넓은 띠와 큰 상승 면', branches: 4, height: 1.8, rhythm: [.75, 1.1, .8, 1], lean: .22, baseRise: .42, order: [2, 1, 2, 1], targetCoverage: .75, legStrength: .9 },
];
