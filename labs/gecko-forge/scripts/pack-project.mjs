/** Self-contained source archive: no git, sibling checkout, external tar tool,
 * node_modules, credentials, caches or build output required/included. */
import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git','node_modules','dist','dist-engine','exports','results','test-results','playwright-report','.cache','coverage','.DS_Store']);
const files = [];
async function walk(dir) {
  for (const name of (await readdir(dir)).sort()) {
    if (ignored.has(name) || name.endsWith('.tsbuildinfo') || (name.startsWith('.env') && name !== '.env.example')) continue;
    const path = resolve(dir, name), stat = await lstat(path);
    if (stat.isSymbolicLink()) throw new Error('Project archive cannot contain symlinks: ' + relative(root, path));
    if (stat.isDirectory()) await walk(path);
    else if (stat.isFile()) files.push({ file: relative(root, path).replaceAll('\\','/'), bytes: await readFile(path) });
  }
}
await walk(root);
function tarEntry(file, data) {
  if (Buffer.byteLength(file) > 100) throw new Error('Tar entry name exceeds 100 bytes: ' + file);
  const header = Buffer.alloc(512);
  header.write(file,0,100); header.write('0000644\0',100); header.write('0000000\0',108); header.write('0000000\0',116);
  header.write(data.length.toString(8).padStart(11,'0')+'\0',124); header.write('00000000000\0',136);
  header.fill(32,148,156); header[156]=48; header.write('ustar\0',257); header.write('00',263);
  const sum=header.reduce((a,b)=>a+b,0); header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);
  return Buffer.concat([header,data,Buffer.alloc((512-data.length%512)%512)]);
}
const packageInfo = JSON.parse(await readFile(resolve(root,'package.json'),'utf8'));
const name = `gecko-forge-${packageInfo.version}`, out = resolve(root,'exports');
const archive = gzipSync(Buffer.concat([...files.map(f=>tarEntry('gecko-forge/'+f.file,f.bytes)),Buffer.alloc(1024)]),{level:9});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(out,{recursive:true});
await writeFile(resolve(out,name+'.tar.gz'),archive);
await writeFile(resolve(out,name+'.files.json'),JSON.stringify({archive:name+'.tar.gz',sha256:hash(archive),files:files.map(f=>({file:f.file,sha256:hash(f.bytes)}))},null,2)+'\n');
console.log(`Packed ${files.length} files (${archive.length} bytes): exports/${name}.tar.gz`);
