import {expect,test} from 'vitest';
import {parentCandidates,filterParents,publicGeneticTags,DEFAULT_PARENT_QUERY,type ParentQuery} from '@/components/hardcore/parent-search-query';
import {collectionStatusGame} from '../e2e/fixtures/collection-status';
import {breedingRiskFixture} from '../e2e/fixtures/breeding-risk';
import {exportBackup,parseBackup} from '@/game/hardcore/save';
import {breedingCheck} from '@/game/hardcore/breeding';
import {actWithTime} from '@/game/hardcore/time-source';
import {newGame,act} from '@/game/hardcore/play';
import {visibleGeneticMorphs} from '@/game/hardcore/adapter';
const q=(patch:Partial<ParentQuery>={}):ParentQuery=>({...DEFAULT_PARENT_QUERY,...patch});
test('only owned adult candidates of the requested sex, plus identical unsexed juveniles in both lists',()=>{
  const f=collectionStatusGame(),male=parentCandidates(f.game,'male',f.female),female=parentCandidates(f.game,'female',f.father);
  for(const [rows,sex] of [[male,'male'],[female,'female']] as const){expect(rows.every(r=>r.gecko.status==='owned'&&(r.gecko.stage!=='adult'||r.gecko.sex===sex))).toBe(true);expect(rows.find(r=>r.gecko.id===f.growing)!.selectable).toBe(false);}
  expect(male.find(r=>r.gecko.id===f.growing)!.morph).toBe(female.find(r=>r.gecko.id===f.growing)!.morph);
});
test('combined search, morph, stage, status, generation and relationship filters use actual public records',()=>{
  const f=collectionStatusGame(),rows=parentCandidates(f.game,'male',f.female),g=f.game.individuals[f.otherMale];
  const result=filterParents(rows,q({search:g.id,morph:'all',stage:'adult',status:'ready',generation:String(g.generation),relation:'unknown'}));expect(result.map(r=>r.gecko.id)).toEqual([g.id]);
  expect(filterParents(rows,q({search:'같은 이름',stage:'adult'}))).toHaveLength(2);expect(filterParents(rows,q({search:'아잔틱'})).map(r=>r.gecko.id)).toContain(f.growing);
  expect(filterParents(parentCandidates(f.game,'female',f.father),q({status:'rest'})).map(r=>r.gecko.id)).toEqual([f.mother]);
  expect(filterParents(rows,q({search:'no such record'}))).toHaveLength(0);
});
test('ready first, age, generation, name and actual registration order sorting',()=>{
  const f=collectionStatusGame(),rows=parentCandidates(f.game,'male','');
  expect(filterParents(rows,q())[0].status.ready).toBe(true);expect(filterParents(rows,q({sort:'age'})).at(-1)!.gecko.id).toBe(f.growing);
  expect(filterParents(rows,q({sort:'acquired'}))[0].gecko.id).toBe(f.otherMale);
  for(const sort of ['generation','name'] as const)expect(filterParents(rows,q({sort}))).toHaveLength(rows.length);
});
test('public possible het and confirmed traits never depend on hidden carrier alleles',()=>{
  const f=collectionStatusGame(),a=f.game.individuals[f.father];a.genetics!.knowledge.loci.axanthic.probabilities={'A/A':1/3,'A/ax':2/3};
  const b=structuredClone(a);a.genotype.loci.axanthic=['A','A'];b.genotype.loci.axanthic=['A','ax'];
  if(a.genetics!.genome)a.genetics!.genome.mendelian.loci.axanthic=['A','A'];if(b.genetics!.genome)b.genetics!.genome.mendelian.loci.axanthic=['A','ax'];
  expect(publicGeneticTags(a)).toEqual(publicGeneticTags(b));expect(publicGeneticTags(a).possible).toEqual([{id:'axanthic',label:'66.7% possible het 아잔틱'}]);
  const copy=structuredClone(f.game);copy.individuals[a.id]=b;
  const project=(game:typeof f.game)=>parentCandidates(game,'male',f.female).map(({gecko,...publicFields})=>({id:gecko.id,...publicFields}));expect(project(copy)).toEqual(project(f.game));
  for(const search of ['het','A/ax',a.id,'66.7'])expect(filterParents(parentCandidates(copy,'male',f.female),q({search,possible:'axanthic'})).map(r=>r.gecko.id)).toEqual(filterParents(parentCandidates(f.game,'male',f.female),q({search,possible:'axanthic'})).map(r=>r.gecko.id));
  a.genetics!.knowledge.loci.axanthic.probabilities=null;expect(publicGeneticTags(a).possible).toEqual([]);
  a.genetics!.knowledge.loci.axanthic.probabilities={'A/ax':1};expect(publicGeneticTags(a).confirmed).toContainEqual({id:'axanthic:carrier',label:'100% het 아잔틱'});
});
test('rest/growth countdowns and eligibility match the existing turn engine after restore',()=>{
  const f=collectionStatusGame();let game=f.game;for(const n of [2,1,0]){
    const rows=parentCandidates(game,'female',f.father);expect(rows.find(r=>r.gecko.id===f.mother)!.status.remainingTurns??0).toBe(n);
    const young=parentCandidates(game,'male',f.female).find(r=>r.gecko.id===f.growing)!;expect(young.selectable).toBe(n===0);expect(young.status.remainingTurns??0).toBe(n);
    game=parseBackup(exportBackup(game),game.lastDate);if(n)game=actWithTime(game,{type:'endTurn'},game.lastDate);
  }
  expect(breedingCheck(game,f.father,f.mother).reasons).toEqual([]);
});
test('confirmed trait and public possible-het filters combine without consulting true genotype',()=>{
  const f=collectionStatusGame(),g=f.game.individuals[f.mother];g.genetics!.knowledge.loci.axanthic.probabilities={'A/A':1/3,'A/ax':2/3};
  const rows=parentCandidates(f.game,'female',f.father),confirmed=publicGeneticTags(g).confirmed.find(t=>t.id==='lilly-white:Lilly White')!;
  expect(filterParents(rows,q({confirmed:confirmed.id,possible:'axanthic',status:'rest',stage:'adult'})).map(r=>r.gecko.id)).toEqual([g.id]);
  expect(filterParents(rows,q({confirmed:'axanthic:carrier',possible:'axanthic'}))).toHaveLength(0);
});
test('observed C/S/H morph filters include real genetically generated market animals',()=>{
  let game=newGame('parent-search-complex','2026-10-14',{initialMoney:5_000_000}),found=false;
  for(let batch=0;batch<20&&!found;batch++){
    const offer=Object.values(game.shop.offers).find(o=>publicGeneticTags(o.individual).confirmed.some(t=>t.id.startsWith('cappuccino-complex:')));
    if(offer){
      game=act(game,{type:'buyGecko',offerId:offer.id},game.lastDate);const g=game.individuals[offer.id],rows=parentCandidates(game,g.sex,'');
      const name=publicGeneticTags(g).confirmed.find(t=>t.id.startsWith('cappuccino-complex:'))!.id.slice('cappuccino-complex:'.length);expect(visibleGeneticMorphs(g).length).toBeGreaterThan(0);expect(filterParents(rows,q({morph:'visible:'+name})).map(r=>r.gecko.id)).toContain(g.id);expect(filterParents(rows,q({morph:'visible:not-a-morph'}))).toEqual([]);found=true;
    }else game=act(game,{type:'refreshShop'},game.lastDate);
  }
  expect(found).toBe(true);
});
test('low hearts keep a care warning without inventing an engine restriction',()=>{
  const f=collectionStatusGame();f.game.individuals[f.father].hearts=2;expect(breedingCheck(f.game,f.father,f.female).reasons).toEqual([]);expect(parentCandidates(f.game,'male',f.female).find(r=>r.gecko.id===f.father)!.status.ready).toBe(true);
});
test('sold/dead parents remain in relationship analysis, related candidates stay selectable, and new opponent changes relation',()=>{
  const f=breedingRiskFixture();f.game.individuals[f.normalId].status='sold';f.game.individuals[f.lillyFemaleId].status='dead';
  const rows=parentCandidates(f.game,'male',f.motherId),brother=rows.find(r=>r.gecko.id===f.fatherId)!;expect(brother.relationship.kind).toBe('sibling');expect(brother.selectable).toBe(true);expect(brother.status.ready).toBe(true);
  expect(rows.some(r=>r.gecko.id===f.normalId)).toBe(false);expect(parentCandidates(f.game,'male',f.lillyFemaleId).find(r=>r.gecko.id===f.fatherId)!.relationship.kind).toBe('parent');
},30000);
test('querying and JSON save restoration preserve all records and candidate public results',()=>{
  const f=collectionStatusGame(),before=structuredClone(f.game),rows=parentCandidates(f.game,'male',f.female);filterParents(rows,q({sort:'distant'}));expect(f.game).toEqual(before);
  expect(parentCandidates(parseBackup(exportBackup(f.game),f.game.lastDate),'male',f.female)).toEqual(rows);
});
