/** Display vocabulary only. Engine labels, probabilities and saved names stay unchanged.
 * Korean usage and deliberate fallbacks: docs/morph-display-names.md. */
export const MORPH_KOREAN: Readonly<Record<string,string>> = {
  "Lilly White":"릴리화이트", "Lilly":"릴리", "Axanthic":"아잔틱", "Ax":"아잔틱",
  "Frappuccino":"프라푸치노", "Sorak":"설악", "Luwak":"루왁",
  "Super Cappuccino":"슈퍼 카푸치노", "Cappuccino":"카푸치노",
  "Super Sable":"슈퍼 세이블", "Sable":"세이블",
  "Super Highway":"슈퍼 하이웨이", "Highway":"하이웨이",
  "Tricolor Harlequin":"트라이컬러 할리퀸", "Tricolor":"트라이컬러",
  "Harlequin":"할리퀸", "Dalmatian":"달마시안", "Normal":"노멀",
};

/** Exact sets, not a global priority that could erase another expressed morph.
 * Existing genetics already supplies Frappuccino/Sorak/Luwak classifications. */
export const REPRESENTATIVE_COMBINATIONS = [
  {morphs:["Lilly White","Axanthic"],name:"릴리 아잔틱"},
  {morphs:["Lilly White","Sable"],name:"릴리 세이블"},
  {morphs:["Lilly White","Luwak"],name:"루왁 릴리"},
] as const;

export const SINGLE_GENETIC_NAMES: Readonly<Record<string,string>> = {
  Axanthic:"아잔틱", Highway:"하이웨이", Cappuccino:"카푸치노", Sable:"세이블",
  Frappuccino:"프라푸치노", Luwak:"루왁", "Super Sable":"슈퍼 세이블",
  "Super Cappuccino":"슈퍼 카푸치노", "Sorak · 건강 위험":"설악 · 건강 위험",
};
