import {expect,test} from 'vitest';
import {relationshipSearch,compareRelationshipDistance} from '@/game/relative-search';
import type {Individual} from '@/game/model';
type Records=Record<string,Pick<Individual,'id'|'parents'>>;
function family(){
  const r:Records={};const add=(id:string,f?:string,m?:string)=>r[id]={id,parents:f&&m?{fatherId:f,motherId:m}:null};
  ['a','b','c','d','e','f'].forEach(id=>add(id));
  add('father','a','b');add('aunt','a','b');add('mother','c','d');add('stranger','e','f');
  add('target','father','mother');add('sibling','father','mother');add('half','father','stranger');
  add('cousin','aunt','stranger');add('child','target','stranger');add('grandchild','child','stranger');add('greatgrandchild','grandchild','stranger');
  return r;
}
test('parent IDs distinguish direct, full/half sibling, grandparent, avuncular, cousin and distant relations in both directions',()=>{
  const r=family(),find=relationshipSearch(r,'target');
  for(const [id,kind] of Object.entries({father:'parent',child:'parent',sibling:'sibling',half:'halfSibling',a:'grandparent',grandchild:'grandparent',aunt:'avuncular',cousin:'cousin',greatgrandchild:'lineal'})){
    expect(find(id).kind,id).toBe(kind);expect(relationshipSearch(r,id)('target').kind,id+' reverse').toBe(kind);
  }
  expect(find('stranger')).toMatchObject({kind:'none',label:'기록상 공통 조상 없음',incomplete:false});
  expect(find('a')).toMatchObject({tone:'orange',distance:2});expect(find('father').tone).toBe('red');expect(find('cousin').tone).toBe('yellow');
  expect(find('sibling').additional).not.toContain('사촌');expect(find('target')).toMatchObject({kind:'same',additional:[]});
});
test('multiple paths retain the closest genuine relationship and safe additional relations',()=>{
  const r=family();r.overlap={id:'overlap',parents:{fatherId:'target',motherId:'mother'}};
  const relation=relationshipSearch(r,'target')('overlap');expect(relation.kind).toBe('parent');expect(relation.additional).toContain('이복형제자매');
  r.remote={id:'remote',parents:{fatherId:'cousin',motherId:'stranger'}};
  expect(relationshipSearch({...r},'sibling')('remote')).toMatchObject({kind:'distant',group:'distant',distance:5});
});
test('missing founders are unknown, missing referenced ancestors do not erase a known close relation',()=>{
  const r=family();expect(relationshipSearch(r,'target')('e').kind).toBe('unknown');
  delete r.a;const find=relationshipSearch({...r},'target');expect(find('stranger').kind).toBe('unknown');expect(find('sibling')).toMatchObject({kind:'sibling',incomplete:true});
  expect(find('missing').kind).toBe('unknown');expect(relationshipSearch(r,'missing')('sibling').kind).toBe('unknown');
});
test('partial parent slots never incorrectly establish half rather than full siblings',()=>{
  const r=family();r.sibling.parents!.motherId='';const relation=relationshipSearch(r,'target')('sibling');expect(relation.incomplete).toBe(true);expect(relation.label).toBe('형제자매 · 공통 부모 1명 확인');
});
test('cycles and their descendants terminate without labeling them unrelated',()=>{
  const r=family();r.a.parents={fatherId:'target',motherId:'b'};const find=relationshipSearch(r,'stranger');
  expect(find('target')).toMatchObject({kind:'unknown',incomplete:true});expect(relationshipSearch(r,'target')('stranger').kind).toBe('unknown');
  expect(relationshipSearch(r,'')('target').kind).toBe('waiting');
});
test('unknown and partial records are last when sorting by distance',()=>{
  const r=family(),find=relationshipSearch(r,'target');const ids=['father','e','cousin','sibling','stranger'];ids.sort((a,b)=>compareRelationshipDistance(find(a),find(b)));
  expect(ids).toEqual(['stranger','cousin','sibling','father','e']);
  const partial={...find('cousin'),incomplete:true};expect(compareRelationshipDistance(partial,find('father'))).toBeGreaterThan(0);
});
test('a 10,000-record pedigree is indexed iteratively and reused without per-candidate ancestor walks',()=>{
  const r:Records={root:{id:'root',parents:null},mate:{id:'mate',parents:null}};
  for(let i=0;i<10000;i++){const id='g'+i;r[id]={id,parents:{fatherId:i?'g'+(i-1):'root',motherId:'mate'}};}
  const find=relationshipSearch(r,'g9999');expect(find('root')).toMatchObject({kind:'lineal',distance:10000});
  for(let i=0;i<10000;i+=10)expect(find('g'+i).kind).not.toBe('unknown');
});
