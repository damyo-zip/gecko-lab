import {readArchiveSave} from '@/game/hardcore/save';
import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {lineageFixture} from '../e2e/fixtures/lineage-reference';
import {newGame,act} from '@/game/hardcore/play';
import {actWithTime} from '@/game/hardcore/time-source';
import {familyTree,pedigreeIndex,descendantIds,familySummary,recordedAge,searchIndividuals} from '@/game/hardcore/family-album';
import {migrateAlbum} from '@/game/hardcore/migrate-album';
import {makeSave,readSave,exportBackup,parseBackup,checksum} from '@/game/hardcore/save';
import {renderSprite} from '@/engine/render';
import {specimen,visualName} from '@/game/hardcore/adapter';
import type {HardcoreGame} from '@/game/hardcore/model';
import {newGame as legacyGame} from './helpers/legacy-hardcore';
const DATE='2026-10-14';

test('living migrated adults use canonical turn age even when the preserved historical birth date uses the previous daily calendar',()=>{
 let old=legacyGame('album-old-age',DATE);const id=Object.keys(old.shop.offers)[0];old=act(old,{type:'buyGecko',offerId:id},DATE);
 const current=readArchiveSave(makeSave(old),DATE),g=current.individuals[id],age=recordedAge(current,g);
 expect(age.turns).toBe(current.turn-g.birthTurn);expect(age.turns).toBeGreaterThanOrEqual(12);expect(age.days).toBe(age.turns*7);expect(g.birthDate).toBe(old.individuals[id].birthDate);
});

test('three generation tree contains exactly the real records, including the four purchased outside grandparents',()=>{
 const {game,selectedId,fatherId,motherId}=lineageFixture(),t=familyTree(game,selectedId);
 expect(Object.keys(t)).toHaveLength(7);expect(t.current).toBe(game.individuals[selectedId]);expect(t.father).toBe(game.individuals[fatherId]);expect(t.mother).toBe(game.individuals[motherId]);
 expect(t.paternalGrandfather).toBe(game.individuals[t.father!.parents!.fatherId]);expect(t.paternalGrandmother).toBe(game.individuals[t.father!.parents!.motherId]);
 expect(t.maternalGrandfather).toBe(game.individuals[t.mother!.parents!.fatherId]);expect(t.maternalGrandmother).toBe(game.individuals[t.mother!.parents!.motherId]);
 expect(t.paternalGrandfather!.status).toBe('pedigree');expect(familyTree(game,t.paternalGrandfather!.id).father).toBeUndefined();
 expect(familyTree(game,fatherId).current).toBe(t.father);expect(descendantIds(pedigreeIndex(game),fatherId).has(selectedId)).toBe(true);
});
test('favorite lineage follows the actual founder, not color/morph; rename/unregister/reactivate preserve IDs, genomes, matings and future descendants',()=>{
 let {game,selectedId,fatherId,motherId}=lineageFixture();const line=Object.values(game.lineages).find(l=>l.founderId===fatherId)!,frozen=structuredClone(game),index=pedigreeIndex(game);
 const summary=familySummary(game,line,index);expect(summary.founder).toBe(game.individuals[fatherId]);expect(summary.members).toContain(selectedId);expect(summary.members).not.toContain(motherId);expect(summary.maxGeneration).toBe(3);
 expect(()=>act(game,{type:'lineage',id:fatherId,name:'중복'},game.lastDate)).toThrow('이미');
 game=act(game,{type:'renameLineage',lineageId:line.id,name:'  첫 가문  '},game.lastDate);expect(game.lineages[line.id].name).toBe('첫 가문');
 game=act(game,{type:'unfavoriteLineage',lineageId:line.id},game.lastDate);expect(game.lineages[line.id].favorite).toBe(false);
 expect(game.individuals).toEqual(frozen.individuals);expect(game.matings).toEqual(frozen.matings);expect(game.eggs).toEqual(frozen.eggs);expect(game.money).toBe(frozen.money);
 const counter=game.nextLineage;game=act(game,{type:'lineage',id:fatherId,name:'다시 시작'},game.lastDate);expect(game.nextLineage).toBe(counter);expect(game.lineages[line.id]).toMatchObject({founderId:fatherId,favorite:true,name:'다시 시작'});
 expect(parseBackup(exportBackup(game),DATE)).toEqual(game);
});
test('registering during a pending mating updates real embryos and eggs and retains family membership through hatch and backup',()=>{
 let game=newGame('album-pending',DATE,{initialMoney:2_000_000,initialCapacity:20});const [f,m]=Object.keys(game.shop.offers);
 for(const id of [f,m])game=act(game,{type:'buyGecko',offerId:id},DATE);game=act(game,{type:'buyFood',amount:100},DATE);game=act(game,{type:'breed',fatherId:f,motherId:m},DATE);
 const genomes=Object.values(game.matings)[0].lifecycle!.offspring.map(o=>o.embryo.genetics!.genome);
 game=act(game,{type:'lineage',id:f,name:'앞으로의 가족'},DATE);const id=Object.keys(game.lineages)[0];
 expect(Object.values(game.matings)[0].lifecycle!.offspring.every(o=>o.embryo.lineageIds.includes(id))).toBe(true);
 for(let n=0;n<6;n++)game=actWithTime(game,{type:'endTurn'},DATE);
 expect(Object.values(game.eggs).map(e=>e.embryo.genetics!.genome)).toEqual(genomes);
 for(const e of Object.values(game.eggs)){expect(e.embryo.lineageIds).toContain(id);if(e.status==='hatched')expect(game.individuals[e.embryo.id].lineageIds).toContain(id);}
 expect(parseBackup(exportBackup(game),DATE)).toEqual(game);
});
test('actual v7 upgrade preserves all data except lineage metadata and version, derives a unique actual founder, and is idempotent',()=>{
 const envelope=JSON.parse(readFileSync('docs/lineage-reference/baseline-game.json','utf8')),original=structuredClone(envelope),game=readArchiveSave(envelope,DATE);
 expect(envelope).toEqual(original);expect(game.saveVersion).toBe(10);
 const stripped={...structuredClone(game),saveVersion:7};for(const line of Object.values(stripped.lineages)){delete line.founderId;delete line.favorite;}
 for(const g of [...Object.values(stripped.individuals),...Object.values(stripped.eggs).map(e=>e.embryo),...Object.values(stripped.shop.offers).flatMap(o=>[o.individual,...(o.family?[o.family.father,o.family.mother]:[])]),...Object.values(stripped.matings).flatMap(m=>m.lifecycle?.offspring.map(o=>o.embryo)??[])])delete g.healthGenome;for(const m of Object.values(stripped.matings))delete m.riskModel;
 expect(stripped).toEqual(original.game);expect(game.lineages[Object.keys(game.lineages)[0]].founderId).toBe(JSON.parse(readFileSync('docs/lineage-reference/baseline.json','utf8')).fatherId);
 for(const g of Object.values(game.individuals)){expect(renderSprite(specimen(g)).pixels).toEqual(renderSprite(specimen(original.game.individuals[g.id])).pixels);expect(visualName(g)).toBe(visualName(original.game.individuals[g.id]));}
 expect(migrateAlbum(game)).toBe(game);expect(readArchiveSave(makeSave(game),DATE)).toBe(game);
});
test('ambiguous old family membership never fabricates a founder and retains its original name',()=>{
 const envelope=JSON.parse(readFileSync('docs/lineage-reference/baseline-game.json','utf8')),game=envelope.game as HardcoreGame;
 const [line]=Object.keys(game.lineages),mother=Object.values(game.individuals).find(g=>g.name==='라임')!;mother.lineageIds.push(line);envelope.checksum=checksum(game);
 const next=readArchiveSave(envelope,DATE);expect(next.lineages[line]).toMatchObject({name:game.lineages[line].name,founderId:null,favorite:true});expect(familySummary(next,next.lineages[line]).founder).toBeUndefined();expect(familySummary(next,next.lineages[line]).representative).toBeDefined();expect(familySummary(next,next.lineages[line]).descendantCount).toBeNull();
});
test('sold and dead records retain relationships and pixel/name identity; recorded age stops at the actual event date',()=>{
 let {game,selectedId,fatherId}=lineageFixture();const original=structuredClone(game.individuals[fatherId]);game=act(game,{type:'sell',id:fatherId},game.lastDate);
 const saleAge=recordedAge(game,game.individuals[fatherId]);for(let n=0;n<5;n++)game=actWithTime(game,{type:'endTurn'},DATE);
 expect(recordedAge(game,game.individuals[fatherId])).toEqual(saleAge);expect(familyTree(game,selectedId).father!.id).toBe(fatherId);expect(renderSprite(specimen(game.individuals[fatherId])).pixels).toEqual(renderSprite(specimen(original)).pixels);
 expect(visualName(game.individuals[fatherId])).toBe(visualName(original));expect(searchIndividuals(game,fatherId).items[0].status).toBe('sold');
 // Genuine starvation is processed by the existing engine; no death record is invented.
 const mother=game.individuals[selectedId].parents!.motherId;game.food=0;for(let n=0;n<5;n++)game=actWithTime(game,{type:'endTurn'},DATE);
 expect(game.individuals[mother].status).toBe('dead');expect(familyTree(game,selectedId).mother!.id).toBe(mother);
 const deadAge=recordedAge(game,game.individuals[mother]);game=actWithTime(game,{type:'endTurn'},DATE);expect(recordedAge(game,game.individuals[mother])).toEqual(deadAge);expect(parseBackup(exportBackup(game),DATE)).toEqual(game);
});
test('v8 closed metadata rejects missing founders, unrelated lineage members, wrong types and tampered checksums',()=>{
 const {game,fatherId,motherId}=lineageFixture(),id=Object.values(game.lineages).find(l=>l.founderId===fatherId)!.id;
 for(const edit of [(g:HardcoreGame)=>{g.lineages[id].founderId='missing';},(g:HardcoreGame)=>{delete g.lineages[id].favorite;},(g:HardcoreGame)=>{g.individuals[motherId].lineageIds.push(id);},(g:HardcoreGame)=>{g.lineages[id].favorite=1 as never;}]){
  const envelope=makeSave(structuredClone(game));edit(envelope.game);envelope.checksum=checksum(envelope.game);expect(()=>readSave(envelope,DATE)).toThrow();
 }
 const envelope=makeSave(structuredClone(game));envelope.game.lineages[id].name+='modified';expect(()=>readSave(envelope,DATE)).toThrow('무결성');
});
test('fixed-size tree and paginated search remain bounded for thousands of records; iterative descendants handle deep histories',()=>{
 const {game,fatherId}=lineageFixture(),base=game.individuals[fatherId];
 for(let n=0;n<2500;n++){const id='scale-'+n;game.individuals[id]={...base,id,name:'기록 '+n,parents:n?{fatherId:'scale-'+(n-1),motherId:fatherId}:null};}
 const index=pedigreeIndex(game);expect(descendantIds(index,'scale-0').size).toBe(2499);expect(Object.keys(familyTree(game,'scale-2499'))).toHaveLength(7);
 const page=searchIndividuals(game,'기록',2400,24);expect(page.items).toHaveLength(24);expect(page.total).toBe(2500);expect(searchIndividuals(game,'scale-2499').items.map(g=>g.id)).toEqual(['scale-2499']);
});
