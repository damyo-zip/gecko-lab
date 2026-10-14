import type { Gecko, HardcoreGame } from "./model";

export function owned(game: Pick<HardcoreGame,"individuals">): Gecko[] { return Object.values(game.individuals).filter(g => g.status === "owned"); }
export function reserved(game: Pick<HardcoreGame,"matings"|"eggs">): number {
  return Object.values(game.matings).filter(m => m.status === "pending" || m.status === "fertilized")
    .reduce((total,m)=>total+(m.lifecycle?(m.lifecycle.maxClutches-m.lifecycle.clutchesLaid)*2:2),0) +
    Object.values(game.eggs).filter(e => e.status === "incubating").length;
}
export function freeSlots(game: Pick<HardcoreGame,"individuals"|"matings"|"eggs"|"capacity">): number { return game.capacity - owned(game).length - reserved(game); }
export function feedable(game: HardcoreGame, g: Gecko): boolean {
  return g.status === "owned" && g.hearts > 0 && g.hearts < 5 && g.lastFedDate !== game.lastDate;
}
/** Mutates only the reducer's private clone. Stable ID order makes partial bulk feeding predictable. */
export function feed(game: HardcoreGame, id: string): void {
  const g = game.individuals[id];
  if (!g || !feedable(game, g)) throw new Error("살아 있는 개체에게 하루 한 번, 하트 5 미만일 때 급여할 수 있습니다.");
  if (game.food < 1) throw new Error("먹이 재고가 부족합니다.");
  g.hearts++; g.lastFedDate = game.lastDate; game.food--;
}
export function feedAll(game: HardcoreGame): void {
  const eligible = owned(game).filter(g => feedable(game, g)).sort((a, b) => a.hearts - b.hearts || a.id.localeCompare(b.id));
  if (!eligible.length) throw new Error("오늘 급여할 수 있는 개체가 없습니다.");
  if (!game.food) throw new Error("먹이 재고가 부족합니다.");
  let count = 0;
  for (const g of eligible) { if (!game.food) break; feed(game, g.id); count++; }
  game.notices.push(`${count}마리 급여 완료${count < eligible.length ? " · 재고 부족으로 일부 미급여" : ""}`);
}
export function loseHearts(game: HardcoreGame): void {
  for (const g of owned(game)) {
    g.hearts--;
    if (g.hearts === 0) {
      g.status = "dead"; g.diedDate = game.lastDate;
      game.notices.push(g.name + " 폐사 · 혈통 기록은 보존됩니다.");
    }
  }
}
