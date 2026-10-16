/** Observations guide art; none of these sources establish the numerical model.
 * No external image/code is copied. Sources read on 2026-10-16. */
export const APPEARANCE_EVIDENCE = [
  {morph:'릴리화이트',url:'https://www.corchgeckos.com/lillywhite.html',level:'브리더 관찰',
    observation:'다양한 크림·화이트 피복, 꼬리·측면의 밝은 영역과 성장 중 확장.',
    approximation:'얼굴까지 확장하는 수치·분포는 요청에 따른 게임용 모델. 실제 빈도·발현 유전자는 미확정.'},
  {morph:'아잔틱',url:'https://www.gecktopia.com/morphs/axanthic',level:'2차 정리 자료',
    observation:'따뜻한 색소가 감소하고 회색~검정 바탕과 밝은 무늬가 남음.',
    approximation:'독립 색소·명도·명암 채널의 수치와 멜라닌 공간 분포는 게임용 근사.'},
  {morph:'카푸치노',url:'https://www.pangeareptile.com/blogs/blog/cappuccino-frappuccino-melanistic',level:'RCK 브리더 프로젝트 기록',
    observation:'밝은 꼬리 기부·어두운 꼬리 끝, 다양한 체색·발현 강도와 등 패턴 변화.',
    approximation:'꼬리 길이 좌표의 발현 경계·색 혼합은 게임용. 이 표식만으로 유전형을 추론하지 않음.'},
  {morph:'하이웨이',url:'https://www.gecktopia.com/morphs/highway',level:'Omni 관찰의 2차 정리',
    observation:'등선이 안쪽으로 번지고 강한 개체는 가운데에서 만남. 측면 패턴은 약함.',
    approximation:'옆모습에 투영한 등 폭과 확장 강도는 게임용. 원문 https://omnigeckos.com/highway/ 는 HTTP 406으로 직접 확인 불가.'},
  {morph:'세이블',url:'https://www.gecktopia.com/morphs/sable',level:'Gecko Haven 관찰의 2차 정리',
    observation:'머리·볏의 화이트 크라운, 등에서 확장되는 밝은 반점과 어두운 바탕.',
    approximation:'반점의 군집·크기와 대비는 게임용. 원문 https://geckohaven.com/our-news/sable-update/ 는 HTTP 503으로 직접 확인 불가.'},
] as const;
export const COMPLEX_EVIDENCE = 'https://lmreptiles.com/fg-sablevscapp/';
