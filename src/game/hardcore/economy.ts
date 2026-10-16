import type { Gecko, HardcoreGame } from "./model";
import { freeSlots } from "./survival";
import { valueGecko, MARKET, type PriceTable } from "./market";

function spend(g: HardcoreGame, amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || g.money < amount) throw new Error("자금이 부족합니다.");
  g.money -= amount;
}
export function buyFood(g: HardcoreGame, amount: number): void {
  if (!Number.isInteger(amount) || amount < 1 || amount > 1000 || g.food + amount > 1e6) throw new Error("먹이는 한 번에 1~1,000개 구입할 수 있습니다.");
  spend(g, amount * g.rules.foodUnitPrice); g.food += amount;
}
export function buyGecko(g: HardcoreGame, offerId: string): void {
  const offer = g.shop.offers[offerId]; if (!offer || offer.purchased) throw new Error("이미 판매되었거나 갱신된 매물입니다.");
  if (freeSlots(g) < 1) throw new Error("사육장 공간이 부족합니다. 예약 공간도 사용량에 포함됩니다.");
  const parents=offer.family?[offer.family.father,offer.family.mother]:[];
  if (Object.keys(g.individuals).length + 1 + parents.filter(p=>!g.individuals[p.id]).length > 30000) throw new Error("이 슬롯의 개체 기록 한도에 도달했습니다.");
  spend(g, offer.askPrice);
  g.individuals[offerId] = structuredClone(offer.individual);
  for(const parent of parents)if(!g.individuals[parent.id])g.individuals[parent.id]=structuredClone(parent);
  if(g.saveVersion>=7)offer.purchased=true;else delete g.shop.offers[offerId];
}
/** Shared restriction; UI and actual sale use the same pending-mother rule. */
export function saleRestriction(game:HardcoreGame,gecko:Gecko|undefined):string|null {
  if(!gecko || gecko.status!=="owned" || gecko.hearts===0)return "보유 중인 생존 개체만 분양할 수 있습니다.";
  if(Object.values(game.matings).some(m=>m.parents.motherId===gecko.id&&["pending","fertilized"].includes(m.status)))return "산란 전 번식 일정이 있는 암컷은 분양할 수 없습니다.";
  return null;
}
export function sellGecko(g: HardcoreGame, id: string, table: PriceTable = MARKET): void {
  const i=g.individuals[id],restriction=saleRestriction(g,i);if(restriction)throw new Error(restriction);
  const quote = valueGecko(i, table);
  if (g.money + quote.sell > 1e12) throw new Error("게임 자금 한도에 도달했습니다.");
  i.status = "sold"; g.money += quote.sell;
  g.sales.push({ id: "sale-" + (g.sales.length + 1), individualId: id, date: g.lastDate,
    price: quote.sell, marketVersion: quote.marketVersion, marketBase: quote.marketBase, valuation: quote.valuation });
}
export function expansionPrice(g: HardcoreGame): number { return g.rules.expansionBasePrice * (g.expansions + 1); }
export function expand(g: HardcoreGame): void {
  if (g.capacity >= g.rules.maxCapacity) throw new Error("최대 사육장 용량입니다.");
  spend(g, expansionPrice(g)); g.capacity = Math.min(g.rules.maxCapacity, g.capacity + g.rules.expansionSlots); g.expansions++;
}
