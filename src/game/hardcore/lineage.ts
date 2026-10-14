import { ancestorDistances } from "@/game/lineage";
import type { HardcoreGame } from "./model";
import {descendantIds,pedigreeIndex} from './family-album';

/** Iterative descendant traversal includes sold/dead animals and arbitrary generations. */
export function descendants(game: HardcoreGame, id: string): Set<string> {
  return descendantIds(pedigreeIndex(game),id);
}
export function nameLineage(game: HardcoreGame, id: string, name: string): void {
  name = name.trim(); const root = game.individuals[id];
  if (!root || !name || name.length > 40) throw new Error("개체와 1~40자의 혈통 이름이 필요합니다.");
  if(game.saveVersion>=8){
    const existing=Object.values(game.lineages).find(l=>l.founderId===id);
    if(existing){if(existing.favorite)throw new Error("이미 관심 혈통의 시조로 등록된 개체입니다.");existing.name=name;existing.favorite=true;return;}
  }
  const ids = new Set([id, ...descendants(game, id)]);
  if(Object.keys(game.lineages).length>=30000||[...ids].some(child=>game.individuals[child].lineageIds.length>=100))throw new Error("혈통 이름 기록 한도에 도달했습니다.");
  const lineId = game.gameId + "-line-" + game.nextLineage++;
  game.lineages[lineId] = { id: lineId, name, createdDate: game.lastDate,...(game.saveVersion>=8?{founderId:id,favorite:true}:{}) };
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
export function renameLineage(game:HardcoreGame,id:string,name:string):void {
  const line=game.lineages[id];name=name.trim();
  if(!line||!name||name.length>40)throw new Error("관심 혈통과 1~40자의 이름이 필요합니다.");
  line.name=name;
}
export function unfavoriteLineage(game:HardcoreGame,id:string):void {
  const line=game.lineages[id];
  if(game.saveVersion<8||!line)throw new Error("등록된 관심 혈통이 없습니다.");
  // Retain the lineage ID on animals/eggs/matings and every historical record.
  line.favorite=false;
}
export function ancestors(game: HardcoreGame, id: string) { return ancestorDistances(id, game.individuals); }
