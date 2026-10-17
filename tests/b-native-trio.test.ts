import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {decodePNG} from '../scripts/png.mjs';

const path='public/lab/b-native-trio/';
const reference=readFileSync('docs/b-native-trio/B-original-reference.png');
const original=decodePNG(reference);

test('first B is preserved as the exact original PNG, not a regenerated normal',()=>{
 expect(createHash('sha256').update(reference).digest('hex')).toBe('487aa44664d047f20a6875c48715f3a083ee876ddc524d5c01150ac9f03959de');
 expect(readFileSync(path+'original.png')).toEqual(reference);
});

test('native pattern edits keep the original silhouette, face, limbs and structural shadows',()=>{
 const colours=new Set<string>(),deep=new Set(['57,34,29,255','91,40,27,255','65,36,25,255','38,10,7,255','65,24,15,255','30,23,22,255']);
 for(let p=0;p<original.pixels.length;p+=4)colours.add([...original.pixels.subarray(p,p+4)].join(','));
 for(const id of ['ribbon','islands']){
  const image=decodePNG(readFileSync(path+id+'.png'));expect([image.width,image.height]).toEqual([96,96]);
  const violations:string[]=[];let changed=0;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++){
   const p=(y*96+x)*4,a=original.pixels.subarray(p,p+4),b=image.pixels.subarray(p,p+4),key=[...a].join(',');
   if(a.some((v:number,n:number)=>v!==b[n])){
    changed++;
    const edge=[-97,-96,-95,-1,1,95,96,97].some(offset=>!original.pixels[(y*96+x+offset)*4+3]);
    const limb=(x<=43&&y>=43&&y<=65)||(x>=63&&x<=79&&y>=45&&y<=65);
    const belly=x>=40&&x<=62&&y>=49&&y<=53;
    const pigmentPoint=x===52&&y===37;
    if(x<=35||y<=28||edge||limb||belly||(deep.has(key)&&!pigmentPoint))violations.push(x+','+y);
   }
   if(a[3]!==b[3]||!colours.has([...b].join(',')))violations.push('alpha/palette '+x+','+y);
  }
  expect(violations).toEqual([]);expect(changed).toBeGreaterThan(0);
 }
});
