/** Frozen historical GAME targets for raw backup/regression validation. */
export const LEGACY_CHALLENGES = [
 {id:'midnight',name:'칠흑의 완성',target:'극도로 어두운 블랙 표현형',description:'검은 체색이 극단적으로 발달한 개체를 탄생시키세요.',hint:'블랙베이스 혈통과 팬텀 형질',title:'칠흑의 브리더'},
 {id:'sun',name:'타오르는 태양',target:'솔리드 오렌지 표현형',description:'몸 전체가 진한 오렌지색으로 발달한 개체를 탄생시키세요.',hint:'오렌지 발색이 강한 혈통의 선택 교배',title:'태양의 브리더'},
 {id:'stars',name:'별이 내린 밤',target:'최상급 슈퍼달마시안 표현형',description:'밀도 높고 균형 잡힌 점무늬를 가진 개체를 탄생시키세요.',hint:'달마시안 점의 밀도와 분포',title:'별을 수놓는 브리더'},
 {id:'white',name:'순백의 계승자',target:'고피복 릴리화이트',description:'넓은 면적에 흰색이 발달한 릴리화이트를 탄생시키세요.',hint:'릴리화이트 형질과 화이트 피복률',title:'순백의 브리더'},
 {id:'monochrome',name:'흑백의 걸작',target:'고피복 릴리화이트 아잔틱 (릴잔틱)',description:'아잔틱과 릴리화이트가 결합된 고피복 개체를 탄생시키세요.',hint:'아잔틱과 릴리화이트 혈통의 조합',title:'흑백의 마에스트로'},
] as const;
export type LegacyChallengeId=typeof LEGACY_CHALLENGES[number]['id'];
export const LEGACY_CHALLENGE_LOCK_TURNS=10;
export const CHALLENGE_LOCK_TURNS=5;
export const CHALLENGE_THRESHOLDS={
 darkLuminance:58,darkBaseArea:.72,orangeStrength:.75,orangeBaseArea:.70,
 solidMaxSpots:5,superSpots:65,regionSpots:3,whiteArea:.48,whiteExpression:.90,
} as const;
/** Version 2 goals are measured on the native fired-up pixels. */
export const BREEDING_CHALLENGES = [
 {id:'lilly-dalmatian',name:'눈밭의 달마시안',target:'릴리화이트 달마시안',description:'흰 몸에 선명한 검은 점이 전신에 고르게 발달한 새끼를 탄생시키세요.',hint:'높은 베일과 고밀도 점무늬를 함께 선별',title:'눈꽃의 브리더'},
 {id:'halloween',name:'할로윈의 밤',target:'할로윈',description:'어두운 바탕과 선명한 주황 무늬가 대비되는 새끼를 탄생시키세요.',hint:'어두운 체색과 주황 무늬색을 독립적으로 선별',title:'호박빛 브리더'},
 {id:'red-tricolor',name:'세 가지 불꽃',target:'레드 트라이컬러 할리퀸',description:'붉은 바탕·주황·크림이 구별되는 할리퀸 새끼를 탄생시키세요.',hint:'무늬 면적뿐 아니라 세 색의 노출과 대비도 필요',title:'삼색의 브리더'},
 {id:'sable-lilly',name:'빛과 그림자',target:'세이블 릴리화이트',description:'밝은 화이트와 짙은 부분이 함께 남은 세이블 릴리화이트를 탄생시키세요.',hint:'베일이 너무 높으면 어두운 부분이 사라집니다',title:'그림자의 브리더'},
 {id:'gold-tiger',name:'황금의 호랑이',target:'골드 타이거',description:'황금색 바탕에 어두운 세로 줄이 뚜렷한 새끼를 탄생시키세요.',hint:'황금 발색과 길고 구별되는 타이거 줄무늬',title:'황금의 브리더'},
 {id:'red-superdalmatian',name:'붉은 별무리',target:'레드 슈퍼달마시안',description:'붉은 몸 전체에 검은 점이 고밀도로 발달한 새끼를 탄생시키세요.',hint:'붉은 바탕을 충분히 남기면서 전신에 점을 선별',title:'붉은 별의 브리더'},
 {id:'frappuccino',name:'밀크와 커피',target:'프라푸치노',description:'커피빛 부분과 밀크빛 부분이 구별되는 프라푸치노를 탄생시키세요.',hint:'카푸치노·릴리화이트와 두 색의 면적·대비',title:'커피빛 브리더'},
 {id:'tricolor-superstripe',name:'왕관의 능선',target:'트라이컬러 슈퍼스트라이프',description:'연결된 밝은 등줄과 중앙줄, 삼색 옆무늬를 가진 새끼를 탄생시키세요.',hint:'엠티백·풀 핀·크림 면적과 실제 등줄 연결',title:'능선의 브리더'},
] as const;
export type CurrentChallengeId=typeof BREEDING_CHALLENGES[number]['id'];
export type ChallengeId=CurrentChallengeId|LegacyChallengeId;
export const isCurrentChallengeId=(id:unknown):id is CurrentChallengeId=>BREEDING_CHALLENGES.some(c=>c.id===id);
export const isLegacyChallengeId=(id:unknown):id is LegacyChallengeId=>LEGACY_CHALLENGES.some(c=>c.id===id);
export const challengeById=(id:ChallengeId)=>[...BREEDING_CHALLENGES,...LEGACY_CHALLENGES].find(c=>c.id===id)!;
export const isChallengeId=(id:unknown):id is ChallengeId=>isCurrentChallengeId(id)||isLegacyChallengeId(id);
export const CHALLENGE_REWARD={money:150_000,food:30,finalBonus:300_000} as const;
