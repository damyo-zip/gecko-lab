/** Compose untouched browser captures. Labels/gutters stay outside UI pixels. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const folder='docs/incubator-reference',hash=b=>createHash('sha256').update(b).digest('hex');
const reference=await readFile('references/gecko-incubator-exact.jpg'),current=await readFile(folder+'/after-607.png'),baseline=await readFile(folder+'/before-390.png');
const rm=await sharp(reference).metadata(),cm=await sharp(current).metadata();
if(rm.width!==cm.width||rm.height!==cm.height)throw new Error('Native comparison dimensions differ');
const glyphs={A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',C:'01111/10000/10000/10000/10000/10000/01111',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',I:'11111/00100/00100/00100/00100/00100/11111',L:'10000/10000/10000/10000/10000/10000/11111',M:'10001/11011/10101/10001/10001/10001/10001',N:'10001/11001/10101/10011/10001/10001/10001',O:'01110/10001/10001/10001/10001/10001/01110',P:'11110/10001/10001/11110/10000/10000/10000',R:'11110/10001/10001/11110/10100/10010/10001',T:'11111/00100/00100/00100/00100/00100/00100'};
function label(text,x){return [...text].flatMap((c,i)=>glyphs[c].split('/').flatMap((row,y)=>[...row].flatMap((bit,xx)=>bit==='1'?[`<rect x="${x+i*12+xx*2}" y="${10+y*2}" width="2" height="2"/>`]:[]))).join('');}
async function pair(left,right,leftLabel,rightLabel,file){
 const l=await sharp(left).metadata(),r=await sharp(right).metadata(),width=l.width+r.width+48,height=Math.max(l.height,r.height)+48;
 const header=Buffer.from(`<svg width="${width}" height="32"><rect width="100%" height="100%" fill="#06121c"/><g fill="#b4e398">${label(leftLabel,16)}${label(rightLabel,l.width+32)}</g></svg>`);
 await sharp({create:{width,height,channels:4,background:'#06121c'}}).composite([{input:header,left:0,top:0},{input:left,left:16,top:32},{input:right,left:l.width+32,top:32}]).png().toFile(folder+'/'+file);
}
await pair(reference,current,'REFERENCE','IMPLEMENTATION','reference-comparison.png');
const beforeViewport=await sharp(baseline).extract({left:0,top:0,width:390,height:844}).png().toBuffer();
await pair(beforeViewport,await readFile(folder+'/after-390.png'),'BEFORE','AFTER','before-after.png');
const captures=[];
for(const name of ['after-360.png','after-390.png','after-430.png','after-607.png','after-390-full.png']){const b=await readFile(folder+'/'+name),m=await sharp(b).metadata();captures.push({file:name,width:m.width,height:m.height,sha256:hash(b)});}
const state=JSON.parse(await readFile(folder+'/capture-report.json','utf8'));
if(!state.unchangedGame||state.errors.length||state.captures.some(c=>c.overflow||c.cta.bottom>c.nav.top))throw new Error('Invalid capture verification');
await writeFile(folder+'/report.json',JSON.stringify({reference:{file:'references/gecko-incubator-exact.jpg',width:rm.width,height:rm.height,sha256:hash(reference)},baselineCommit:'90afd5476f4b83ff7307af8851b4698e4485713c',baselineSha256:hash(baseline),unchangedGame:true,fixtureSha256:state.fixtureSha256,captures,comparison:{nativeScale:1,labelsOutsideScreens:true,beforeViewportCrop:'top 390×844; original full capture retained'},notes:['Actual production app, independent same-origin scene PNG and seeded Canvas shell. Reference screenshot is not an app asset.','Real fixture has four active eggs and two usable slots from two staggered matings, rather than the reference example of three.','Empty plus means parent selection; reserved slots are separate and cannot be used.','95% is conditional fertilized-egg hatch chance. Help shows 5% infertile / 90.25% overall.']},null,2));
console.log(JSON.stringify({nativeReference:[rm.width,rm.height],unchangedGame:true,captures:captures.length}));
