/** Node-only harness for the DOM-free lab modules; always removed after use. */
import ts from 'typescript';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {join,dirname,relative,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {existsSync} from 'node:fs';

export async function appearanceRuntime(run) {
  const root=await mkdtemp(join(tmpdir(),'gecko-appearance-'));
  try {
    await writeFile(join(root,'package.json'),'{"type":"module"}');
    async function compile(dir){for(const e of await readdir(dir,{withFileTypes:true})){
      const file=join(dir,e.name);if(e.isDirectory()){await compile(file);continue;}if(!file.endsWith('.ts'))continue;
      const target=join(root,relative('src',file).replace(/\.ts$/,'.js'));
      const js=ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
          .replace(/from (["'])([^"']+)\1/g,(m,q,s)=>s.startsWith('@/')?`from ${q}${pathToFileURL(join(root,s.slice(2)+(existsSync('src/'+s.slice(2)+'/index.ts')?'/index':'')+'.js'))}${q}`:
          s.endsWith('.json')?`from ${q}${pathToFileURL(resolve(dirname(file),s))}${q}`:s.startsWith('.')?`from ${q}${s}${existsSync(resolve(dirname(file),s,'index.ts'))?'/index':''}.js${q}`:m);
      await mkdir(dirname(target),{recursive:true});await writeFile(target,js);
    }}
    for(const d of ['engine','genetics','phenotype','game','lab'])await compile('src/'+d);
    return await run(p=>import(pathToFileURL(join(root,p+'.js'))));
  } finally {await rm(root,{recursive:true,force:true});}
}
