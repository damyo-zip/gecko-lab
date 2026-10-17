export const CANDIDATES = [
 {id:'A',label:'A · 최소 수정',description:'원래 체색·무늬를 유지하고 얼굴 일부·꼬리 표식·작은 크라운만 보강합니다.',
  faceReach:.30,faceStart:.70,bodyWhite:0,cappTint:.10,tailBase:.12,tailTip:.12,highwayReach:.14,sideReduction:.12,sableTint:.16,crown:.42,axRange:.36},
 {id:'B',label:'B · 균형 보강',description:'원화 명암 위에 얼굴 백색·유전 명도·등 확장·꼬리·크라운을 선명하게 반영합니다.',
  faceReach:.70,faceStart:.40,bodyWhite:.32,cappTint:.24,tailBase:.23,tailTip:.21,highwayReach:.29,sideReduction:.43,sableTint:.30,crown:.72,axRange:.72},
 {id:'C',label:'C · 확장 보강',description:'고발현 얼굴·넓은 등·군집 패턴까지 확장하되 원화의 픽셀 명암을 사용합니다.',
  faceReach:1,faceStart:.16,bodyWhite:.64,cappTint:.36,tailBase:.32,tailTip:.28,highwayReach:.48,sideReduction:.70,sableTint:.44,crown:1,axRange:1},
] as const;
export type CandidateId=typeof CANDIDATES[number]['id'];
export type CandidatePolicy=typeof CANDIDATES[number];
export const COMPARISONS = [
 {id:'authored',label:'이전 정식',version:'2.1.0',description:'c934363의 PNG·patterns-1 렌더러'},
 {id:'regional',label:'현재 v2',version:'regional-2',description:'현재 게임에서 사용하는 명암 개선 v2'},
 ...CANDIDATES.map(p=>({id:p.id,label:p.label,version:'authored-candidate-'+p.id.toLowerCase()+'-1',description:p.description})),
] as const;
export type ComparisonId=typeof COMPARISONS[number]['id'];
