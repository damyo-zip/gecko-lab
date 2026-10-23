import {seededRandom} from '@/genetics/random';

export const SHOP_NICKNAMES=[
 '모찌','두부','콩이','보리','호두','밤이','도토리','땅콩',
 '찹쌀','찰떡','만두','고미','푸딩','쿠키','와플','머핀',
 '치즈','버터','크림','라떼','코코','초코','카라멜','마카롱',
 '솜이','구름','안개','이슬','새벽','노을','달이','별이',
 '하루','마루','나루','누리','다온','라온','도담','토리',
 '루루','미루','모모','포포','피코','포비','단추','방울',
 '우디','버찌','앵두','자두','살구','복숭아','망고','유자',
 '오디','머루','수박','참외','포도','무화과','단풍','솔이',
] as const;

/** Independent naming stream: no morph, sex, inheritance or catalog RNG input. */
export function shopNickname(seed:string,used:ReadonlySet<string>):string {
 const start=Math.floor(seededRandom(seed,'family-shop:nickname:1')()*SHOP_NICKNAMES.length);
 for(let n=0;n<SHOP_NICKNAMES.length;n++){
  const name=SHOP_NICKNAMES[(start+n)%SHOP_NICKNAMES.length];if(!used.has(name))return name;
 }
 const base=SHOP_NICKNAMES[start];let suffix=2;while(used.has(base+suffix))suffix++;
 return base+suffix;
}
