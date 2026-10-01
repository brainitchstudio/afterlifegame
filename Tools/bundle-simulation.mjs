import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.join(root,'Assets/Afterlife/Simulation'),modules=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name.endsWith('.mjs')){const name=path.relative(source,file).split(path.sep).join('/');let code=fs.readFileSync(file,'utf8');code=code.replace(/(\bfrom\s*|\bimport\s*)(['"])(\.[^'"]+)\2/g,(_,prefix,q,spec)=>prefix+q+path.posix.normalize(path.posix.join(path.posix.dirname(name),spec))+q);modules.push({name,source:code});}}}
walk(source);modules.sort((a,b)=>a.name.localeCompare(b.name));
const target=path.join(root,'Assets/Afterlife/Resources/Simulation.json'),content=JSON.stringify({modules});
if(process.argv.includes('--check')) {
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content) {
    console.error('Simulation bundle is stale. Run node Tools/bundle-simulation.mjs.');
    process.exitCode=1;
  } else console.log(`Simulation bundle is current (${modules.length} modules).`);
} else {
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==content)fs.writeFileSync(target,content);
  console.log(`Bundled ${modules.length} simulation modules.`);
}
