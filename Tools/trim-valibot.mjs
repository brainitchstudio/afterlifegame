// Optional build-time operation. Usage: ESBUILD=/path/to/esbuild node Tools/trim-valibot.mjs
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const schema=fs.readFileSync(path.join(root,'Assets/Afterlife/Simulation/saveSchema.mjs'),'utf8');
const names=[...new Set([...schema.matchAll(/\bv\.([a-zA-Z]+)/g)].map(m=>m[1]))].sort();
const entry=path.join(root,'Tools/VendorSource/valibot-entry.mjs');
fs.writeFileSync(entry,`export { ${names.join(', ')} } from './valibot-full.mjs';\n`);
execFileSync(process.env.ESBUILD||'esbuild',[entry,'--bundle','--format=esm','--platform=neutral','--target=es2022','--tree-shaking=true','--outfile='+path.join(root,'Assets/Afterlife/Simulation/vendor/valibot.mjs'),'--banner:js=// Valibot 1.5.0 (MIT), tree-shaken with esbuild 0.25.0 to the unchanged save-schema validators. Full source: Tools/VendorSource/valibot-full.mjs.'],{stdio:'inherit'});
