import { ancestorDistances } from "@/game/lineage";
import type { HardcoreGame } from "./model";

/** Iterative descendant traversal includes sold/dead animals and arbitrary generations. */
export function descendants(game: HardcoreGame, id: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const g of Object.values(game.individuals)) if (g.parents)
    for (const parent of [g.parents.fatherId, g.parents.motherId]) children.set(parent, [...(children.get(parent) ?? []), g.id]);
  const result = new Set<string>(), queue = [id];
  for (let n = 0; n < queue.length; n++) for (const child of children.get(queue[n]) ?? [])
    if (!result.has(child)) { result.add(child); queue.push(child); }
  return result;
}
export function nameLineage(game: HardcoreGame, id: string, name: string): void {
  name = name.trim(); const root = game.individuals[id];
  if (!root || !name || name.length > 40) throw new Error("개체와 1~40자의 혈통 이름이 필요합니다.");
  const lineId = game.gameId + "-line-" + game.nextLineage++;
  game.lineages[lineId] = { id: lineId, name, createdDate: game.lastDate };
  const ids = new Set([id, ...descendants(game, id)]);
  for (const child of ids) game.individuals[child].lineageIds.push(lineId);
  // Existing pending matings/eggs must also retain a new ancestral line.
  for (const m of Object.values(game.matings))
    if (ids.has(m.parents.fatherId) || ids.has(m.parents.motherId)) {
      m.lineageIds.push(lineId);
      for(const o of m.lifecycle?.offspring??[])if(!o.embryo.lineageIds.includes(lineId))o.embryo.lineageIds.push(lineId);
    }
  for (const e of Object.values(game.eggs)) if (e.embryo.parents && (ids.has(e.embryo.parents.fatherId) || ids.has(e.embryo.parents.motherId)))
    if (!e.embryo.lineageIds.includes(lineId)) e.embryo.lineageIds.push(lineId);
}
export function ancestors(game: HardcoreGame, id: string) { return ancestorDistances(id, game.individuals); }
