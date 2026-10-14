/** Put actual browser captures side by side without repainting or resizing UI. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
const folder='docs/shop-reference',hash=b=>createHash('sha256').update(b).digest('hex');
const left=await readFile(folder+'/before-390.png'),right=await readFile(folder+'/after-390.png');
const l=await sharp(left).metadata(),r=await sharp(right).metadata();
if(l.width!==390||r.width!==390)throw new Error('Expected 390px browser captures');
const width=828,height=Math.max(l.height,r.height)+48;
const glyphs={A:'01110/10001/10001/11111/10001/10001/10001',B:'11110/10001/10001/11110/10001/10001/11110',E:'11111/10000/10000/11110/10000/10000/11111',F:'11111/10000/10000/11110/10000/10000/10000',O:'01110/10001/10001/10001/10001/10001/01110',R:'11110/10001/10001/11110/10100/10010/10001',T:'11111/00100/00100/00100/00100/00100/00100'};
const label=(text,x)=>[...text].flatMap((c,i)=>glyphs[c].split('/').flatMap((row,y)=>[...row].flatMap((bit,xx)=>bit==='1'?[`<rect x="${x+i*12+xx*2}" y="${10+y*2}" width="2" height="2"/>`]:[]))).join('');
const labels=Buffer.from(`<svg width="${width}" height="32"><rect width="100%" height="100%" fill="#06121c"/><g fill="#b4e398">${label('BEFORE',16)}${label('AFTER',422)}</g></svg>`);
await sharp({create:{width,height,channels:4,background:'#06121c'}}).composite([{input:labels,left:0,top:0},{input:left,left:16,top:32},{input:right,left:422,top:32}]).png().toFile(folder+'/before-after.png');
await writeFile(folder+'/capture-report.json',JSON.stringify({baselineCommit:'093ee6decc402a677cc97dfa6636912e80c87fc7',viewport:{width:390,height:844},sameGameState:false,reason:'Original six-offer market versus new four-offer real-family market; actual game data differs.',comparison:{scale:1,labelsOutsideImages:true},captures:[{file:'before-390.png',width:l.width,height:l.height,sha256:hash(left)},{file:'after-390.png',width:r.width,height:r.height,sha256:hash(right)}]},null,2)+'\n');
console.log('390px real browser comparison composed without changing screenshot pixels.');

const compactBefore=await readFile(folder+'/before-compact-390.png'),bm=await sharp(compactBefore).metadata();
const baseline=JSON.parse(await readFile(folder+'/compact-baseline.json','utf8')),state=JSON.parse(await readFile(folder+'/state.json','utf8'));
if(baseline.gameChecksum!==state.checksum)throw new Error('Compact comparison game states differ');
await sharp({create:{width,height:Math.max(bm.height,r.height)+48,channels:4,background:'#06121c'}}).composite([{input:labels,left:0,top:0},{input:compactBefore,left:16,top:32},{input:right,left:422,top:32}]).png().toFile(folder+'/compact-comparison.png');
console.log('Compact comparison uses identical saved game data.');
