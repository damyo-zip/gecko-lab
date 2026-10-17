/** Visual design annotations only. These are NOT genetic loci or game records. */
export const DESIGNS=[
 {id:'A',name:'A · 동글 친화형',short:'동글이',description:'큰 눈·짧은 몸·넓은 발. 작은 카드에서도 얼굴을 먼저 읽는 수집형.',tradeoff:'몸통이 짧아 복잡한 측면 무늬의 공간은 상대적으로 작습니다.',
  eye:{x:34,y:27,rx:4,ry:6},head:[4,5,55,44],torso:[[36,38],[54,43],[75,61],[67,73],[46,63],[35,49]],dorsal:[[39,35],[54,48],[68,61],[81,75],[76,85],[65,86]]},
 {id:'B',name:'B · 브리딩 감상형',short:'여울',description:'옆모습·넓은 몸통·완만한 꼬리. 등과 측면의 무늬를 감상하기 좋은 표본형.',tradeoff:'48px에서는 눈과 발가락의 세부가 A보다 작게 보입니다.',
  eye:{x:21,y:25,rx:3,ry:4},head:[3,13,40,35],torso:[[29,28],[65,36],[74,52],[59,61],[39,51],[29,42]],dorsal:[[34,28],[50,31],[68,37],[82,48],[88,65],[77,83],[58,82]]},
 {id:'C',name:'C · 자연 자세형',short:'나무',description:'대각선 자세·긴 팔다리·접착 발가락. 실제 크레의 움직임과 형태를 강조한 유형.',tradeoff:'기울어진 몸통 때문에 등·측면 무늬를 비교할 때 방향 보정이 필요합니다.',
  eye:{x:24,y:16,rx:3,ry:4},head:[5,4,43,32],torso:[[34,28],[54,34],[68,53],[60,65],[39,51],[28,36]],dorsal:[[35,26],[46,33],[58,43],[71,56],[80,74],[73,86],[58,87]]},
] as const;
export type BaseId=typeof DESIGNS[number]['id'];
export const VARIANTS=[{id:'normal',label:'노멀 기본'},{id:'bright',label:'밝은 개체'},{id:'dark',label:'어두운 개체'},{id:'sparse',label:'패턴 적음'},{id:'rich',label:'패턴 많음'}] as const;
export type VariantId=typeof VARIANTS[number]['id'];
