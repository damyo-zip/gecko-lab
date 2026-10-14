import type { Individual } from './model';
import { ancestorDistances } from './lineage';

type Pedigree = Record<string, Pick<Individual,'id'|'parents'>>;
/** Exact additive relationship recursion on the recorded pedigree (including inbred ancestors).
 * Unrecorded founders/parents are assumed unrelated and non-inbred, never certified unrelated.
 * Sparse pair memoization and explicit stacks avoid a full N² matrix/recursive stack overflow. */
export function pedigreeCoefficient(fatherId: string, motherId: string, records: Pedigree) {
  const ranks = new Map<string,number>(), state = new Map<string,number>();
  const founders = new Set<string>();
  for (const root of [fatherId,motherId]) {
    const stack: {id:string; exit:boolean}[] = [{id:root,exit:false}];
    while (stack.length) {
      const {id,exit} = stack.pop()!;
      if (exit) { state.set(id,2); ranks.set(id,ranks.size); continue; }
      if (state.get(id) === 2) continue;
      if (state.get(id) === 1) throw new Error('혈통 기록에 순환 관계가 있습니다.');
      state.set(id,1); stack.push({id,exit:true});
      const p = records[id]?.parents;
      if (!p) founders.add(id);
      else { stack.push({id:p.motherId,exit:false}); stack.push({id:p.fatherId,exit:false}); }
    }
  }
  type Pair = readonly [string|null,string|null];
  const memo = new Map<string,number>();
  const normalize = ([a,b]:Pair):Pair => a && b && ranks.get(a)! < ranks.get(b)! ? [b,a] : [a,b];
  const key = ([a,b]:Pair) => JSON.stringify([a,b]);
  const pending: Pair[] = [normalize([fatherId,motherId])];
  while (pending.length) {
    const pair = pending.at(-1)!, [a,b] = pair, k = key(pair);
    if (memo.has(k)) { pending.pop(); continue; }
    if (!a || !b) { memo.set(k,0); pending.pop(); continue; }
    const p = records[a]?.parents;
    const deps:Pair[] = a === b ? p ? [normalize([p.fatherId,p.motherId])] : [] :
      p ? [normalize([p.fatherId,b]),normalize([p.motherId,b])] : [];
    const missing = deps.filter(d => !memo.has(key(d)));
    if (missing.length) { pending.push(...missing); continue; }
    const result = a === b ? .5*(1+(deps.length ? memo.get(key(deps[0]))! : 0)) :
      deps.reduce((sum,d) => sum+memo.get(key(d))!,0)/2;
    memo.set(k,result); pending.pop();
  }
  return { coefficient: memo.get(key(normalize([fatherId,motherId])))!, founderAssumptions: founders.size,
    basis: 'recorded-pedigree' as const };
}

export function pedigreeRelationship(a: Individual, b: Individual, records: Record<string,Individual>) {
  if (a.id === b.id) return '동일 개체';
  const aa = ancestorDistances(a.id,records), bb = ancestorDistances(b.id,records);
  if (aa.get(b.id) === 1 || bb.get(a.id) === 1) return '부모·자식';
  if (aa.has(b.id) || bb.has(a.id)) return '직계 조상·후손';
  if (a.parents && b.parents) {
    const f = a.parents.fatherId === b.parents.fatherId, m = a.parents.motherId === b.parents.motherId;
    if (f && m) return '친형제자매';
    if (f || m) return '이복형제자매';
  }
  const shared = [...aa.keys()].filter(id => bb.has(id));
  if (shared.some(id => aa.get(id) === 2 && bb.get(id) === 2)) return '사촌 관계';
  if (shared.length) return shared.some(id => aa.get(id)! <= 2 && bb.get(id)! <= 2) ? '가까운 공통 조상' : '먼 공통 조상';
  return '기록상 공통 조상 없음';
}
