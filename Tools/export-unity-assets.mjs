// Reproducible, dependency-free export of the original pixel generators to Unity.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { kitArt, row, compose } from './ArtSource/art.mjs';
import { Spr } from './ArtSource/ui-kit/pixel-assets-v2.js';
import { DOORS, buildBuildings } from './ArtSource/ui-kit/pixel-buildings.js';
import { buildWorld } from './ArtSource/ui-kit/pixel-world.js';
import { buildDecor } from './ArtSource/ui-kit/pixel-decor.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'Assets/Afterlife/Resources');
fs.mkdirSync(out, {recursive:true});
const art = kitArt(), entries = [];
function collect(value, key) {
  if (value?.p && value?.sh && value?.w) { entries.push({key, s:value, ax:.5, ay:1}); return; }
  if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) collect(v, key ? key+'/'+k : k);
}
collect(art, '');
for (const sea of ['spring', 'fall', 'winter']) {
  const bSea = buildBuildings(sea);
  for (const [k, v] of Object.entries(bSea)) {
    if (!k.includes('_door_')) entries.push({ key: `buildings/${k}`, s: v, ax: .5, ay: 1 });
  }
  const wSea = buildWorld(sea);
  for (const [k, v] of Object.entries(wSea)) entries.push({ key: `world/${k}`, s: v, ax: .5, ay: 1 });
  const dSea = buildDecor(sea);
  for (const [k, v] of Object.entries(dSea)) entries.push({ key: `decor/${k}`, s: v, ax: .5, ay: 1 });
}

function sliceFrame(spr, k, frameWidth) {
  const s = new Spr(frameWidth, spr.h);
  for (let y = 0; y < spr.h; y++) {
    for (let x = 0; x < frameWidth; x++) {
      const srcIdx = y * spr.w + (k * frameWidth + x);
      const dstIdx = y * frameWidth + x;
      s.p[dstIdx] = spr.p[srcIdx];
      s.sh[dstIdx] = spr.sh[srcIdx];
    }
  }
  return s;
}

function towerOverlay(src, roof) {
  const s = new Spr(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const rail = y >= 18 && y <= 28 && !(x >= 13 && x <= 18 && y <= 25);
    if (rail || (roof && y <= 13)) {
      s.p[y * src.w + x] = src.p[y * src.w + x];
      s.sh[y * src.w + x] = src.sh[y * src.w + x];
    }
  }
  return s;
}

const plots = {
  core:[['town_hall'],['town_hall']],
  farm:[['farm'],['farm']],
  barracks:[['barracks'],['barracks']],
  dorm:[['bunkhouse'],['bunkhouse','shelter']],
  workshop:[['workshop','armory'],['lumber_mill','armory']],
  clinic:[['clinic','shelter'],['lab','shelter']],
  shelter:[['shelter'],['shelter']],
  lumber_mill:[['lumber_mill'],['lumber_mill']],
  storage:[['storage'],['storage']],
  lab:[['lab'],['lab']],
  armory:[['armory'],['armory']]
};
const plotWidths = {
  core: 80,
  farm: 80,
  barracks: 80,
  dorm: 80,
  workshop: 80,
  clinic: 80,
  shelter: 32,
  lumber_mill: 48,
  storage: 48,
  lab: 48,
  armory: 32
};

for (const [type,levels] of Object.entries(plots)) {
  const pw = plotWidths[type] || 80;
  for(let level=0;level<2;level++) {
    const s=row(levels[level].map(k=>art.buildings['bld_'+k]), pw);
    entries.push({key:`plots/${type}/${level}`,s,ax:.5,ay:(s.h-16)/s.h});
    for (let k = 0; k < 4; k++) {
      const parts = levels[level].map(kName => {
        const doorKey = 'bld_' + kName + '_door';
        if (art.buildings[doorKey]) {
          const raw = art.buildings['bld_' + kName];
          return sliceFrame(art.buildings[doorKey], k, raw.w);
        }
        return art.buildings['bld_' + kName];
      });
      const dk = row(parts, pw);
      entries.push({key:`plots/${type}/${level}/${k}`,s:dk,ax:.5,ay:(dk.h-16)/dk.h});
    }
  }
}

for (const sea of ['spring', 'fall', 'winter']) {
  const seasonalBuildings = buildBuildings(sea);
  for (const [type, levels] of Object.entries(plots)) {
    const pw = plotWidths[type] || 80;
    for (let level = 0; level < 2; level++) {
      const s = row(levels[level].map(k => seasonalBuildings[`bld_${k}_${sea}`]), pw);
      entries.push({ key: `plots/${type}/${level}_${sea}`, s, ax: .5, ay: (s.h - 16) / s.h });
      for (let frame = 0; frame < 4; frame++) {
        const parts = levels[level].map(name => {
          const door = seasonalBuildings[`bld_${name}_door_${sea}`];
          const raw = seasonalBuildings[`bld_${name}_${sea}`];
          return door ? sliceFrame(door, frame, raw.w) : raw;
        });
        const sprite = row(parts, pw);
        entries.push({ key: `plots/${type}/${level}/${frame}_${sea}`, s: sprite, ax: .5, ay: (sprite.h - 16) / sprite.h });
      }
    }
  }
}

for (const [k, d] of Object.entries(DOORS)) {
  const name = k.replace('bld_', '');
  const doorSpr = art.buildings[k + '_door'];
  const rawSpr = art.buildings[k];
  if (doorSpr && rawSpr) {
    for (let f = 0; f < 4; f++) {
      const s = sliceFrame(doorSpr, f, rawSpr.w);
      entries.push({ key: `doors/${name}/${f}`, s, ax: .5, ay: (s.h - 16) / s.h });
    }
  }
}

for(let level=0;level<2;level++) {
  const s=art.tiles[level?'tower_roofed':'tower_open'];
  entries.push({key:`plots/tower/${level}`,s,ax:.5,ay:(s.h-16)/s.h});
  const over = towerOverlay(s, level === 1);
  entries.push({key:`plots/tower/overlay/${level}`,s:over,ax:.5,ay:(over.h-16)/over.h});
  for (const sea of ['spring', 'fall', 'winter']) {
    const seasonal = art.tiles[`${level ? 'tower_roofed' : 'tower_open'}_${sea}`];
    entries.push({ key: `plots/tower/${level}_${sea}`, s: seasonal, ax: .5, ay: (seasonal.h - 16) / seasonal.h });
    const seasonalOverlay = towerOverlay(seasonal, level === 1);
    entries.push({ key: `plots/tower/overlay/${level}_${sea}`, s: seasonalOverlay, ax: .5, ay: (seasonalOverlay.h - 16) / seasonalOverlay.h });
  }
}
for (const material of ['palisade','planks','scrap']) for(let vertical=0;vertical<2;vertical++) {
  const T=art.tiles, wall=T[`wall_${material}_${vertical?'v':'h'}`];
  const s=vertical?compose(16,44,[[wall,0,0],[wall,0,16]]):row([wall,wall]);
  entries.push({key:`plots/barricade/${material}/${vertical}`,s,ax:.5,ay:vertical?16/44:(s.h-8)/s.h});
  for(let open=0;open<2;open++) {
    const gateMaterial = material === 'scrap' ? 'metal' : 'wood';
    if (!vertical) {
      const g=T[`gate_${gateMaterial}_${open?'open':'closed'}`];
      const sprite=row([wall,g,wall]);
      entries.push({key:`plots/gate/${material}/0/${open}`,s:sprite,ax:.5,ay:(sprite.h-8)/sprite.h});
      continue;
    }
    // The kit authors distinct vertical and east/west open frames. Rotating a
    // horizontal gate loses the posts and gives the door the wrong silhouette.
    const closed=T[`gate_${gateMaterial}_v_closed`];
    if (!open) {
      const sprite=compose(32,76,[[wall,8,0],[closed,8,16],[wall,8,48]]);
      entries.push({key:`plots/gate/${material}/1/0`,s:sprite,ax:.5,ay:32/76});
    } else for (const side of ['e','w']) {
      const gate=T[`gate_${gateMaterial}_v_open_${side}`];
      const sprite=compose(32,76,[[wall,8,0],[gate,0,16],[wall,8,48]]);
      entries.push({key:`plots/gate/${material}/1/1/${side}`,s:sprite,ax:.5,ay:32/76});
    }
  }
}
const width=2048; let x=1,y=1,shelf=0;
for(const e of entries) { if(x+e.s.w+1>width){x=1;y+=shelf+2;shelf=0;} Object.assign(e,{x,y});x+=e.s.w+2;shelf=Math.max(shelf,e.s.h); }
const height=2**Math.ceil(Math.log2(y+shelf+2)), pixels=Buffer.alloc(height*(1+width*4));
for(const e of entries) for(let py=0;py<e.s.h;py++) for(let px=0;px<e.s.w;px++) {
  const i=py*e.s.w+px,at=(e.y+py)*(width*4+1)+1+(e.x+px)*4,c=e.s.p[i];
  if(c){const n=parseInt(c.slice(1),16);pixels[at]=n>>16&255;pixels[at+1]=n>>8&255;pixels[at+2]=n&255;pixels[at+3]=255;}
  else if(e.s.sh[i]>0){pixels[at]=10;pixels[at+1]=8;pixels[at+2]=12;pixels[at+3]=Math.round(e.s.sh[i]*255);}
}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function chunk(type,data){const t=Buffer.from(type),b=Buffer.concat([t,data]);let crc=0xffffffff;for(const v of b)crc=crcTable[(crc^v)&255]^(crc>>>8);const h=Buffer.alloc(4),f=Buffer.alloc(4);h.writeUInt32BE(data.length);f.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([h,b,f]);}
const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
fs.writeFileSync(path.join(out,'AfterlifeAtlas.png'),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
fs.writeFileSync(path.join(out,'AfterlifeAtlas.json'),JSON.stringify({width,height,fireAnchor:art.fireAnchor,entries:entries.map(e=>({key:e.key,x:e.x,y:e.y,w:e.s.w,h:e.s.h,ax:e.ax,ay:e.ay}))}));
console.log(`Exported ${entries.length} original sprites to ${width}×${height} atlas.`);
