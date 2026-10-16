/** Provisional GAME targets, not breeder standards or a new genetic model. */
export const BREEDING_CHALLENGES = [
 {id:'midnight',name:'칠흑의 완성',target:'극도로 어두운 블랙 표현형',description:'검은 체색이 극단적으로 발달한 개체를 탄생시키세요.',hint:'블랙베이스 혈통과 팬텀 형질',title:'칠흑의 브리더'},
 {id:'sun',name:'타오르는 태양',target:'솔리드 오렌지 표현형',description:'몸 전체가 진한 오렌지색으로 발달한 개체를 탄생시키세요.',hint:'오렌지 발색이 강한 혈통의 선택 교배',title:'태양의 브리더'},
 {id:'stars',name:'별이 내린 밤',target:'최상급 슈퍼달마시안 표현형',description:'밀도 높고 균형 잡힌 점무늬를 가진 개체를 탄생시키세요.',hint:'달마시안 점의 밀도와 분포',title:'별을 수놓는 브리더'},
 {id:'white',name:'순백의 계승자',target:'고피복 릴리화이트',description:'넓은 면적에 흰색이 발달한 릴리화이트를 탄생시키세요.',hint:'릴리화이트 형질과 화이트 피복률',title:'순백의 브리더'},
 {id:'monochrome',name:'흑백의 걸작',target:'고피복 릴리화이트 아잔틱 (릴잔틱)',description:'아잔틱과 릴리화이트가 결합된 고피복 개체를 탄생시키세요.',hint:'아잔틱과 릴리화이트 혈통의 조합',title:'흑백의 마에스트로'},
] as const;
export type ChallengeId=typeof BREEDING_CHALLENGES[number]['id'];
export const CHALLENGE_LOCK_TURNS=10;
export const CHALLENGE_THRESHOLDS={
 darkLuminance:58,darkBaseArea:.72,orangeStrength:.75,orangeBaseArea:.70,
 solidMaxSpots:5,superSpots:65,regionSpots:3,whiteArea:.48,whiteExpression:.90,
} as const;
export const challengeById=(id:ChallengeId)=>BREEDING_CHALLENGES.find(c=>c.id===id)!;
export const isChallengeId=(id:unknown):id is ChallengeId=>BREEDING_CHALLENGES.some(c=>c.id===id);
