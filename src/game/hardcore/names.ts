/** One rule for existing details, card editing and saved gameplay actions. */
export function validatedGeckoName(value:string):string {
 const name=value.trim();
 if(!name||name.length>24)throw new Error('개체 이름은 1~24자여야 합니다.');
 return name;
}
