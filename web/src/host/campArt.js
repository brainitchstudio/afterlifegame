// The overseer's supply cache, drawn like the design kit's Starter Camp workbench (pixel-camp.js):
// stacked plank crates with a stencilled drop mark, a steel footlocker and a rolled bedroll. The other
// camp fixtures use the atlas's decor art. Each season gets its own dressing: snow in winter, leaves
// in fall, tufts in spring.
import { Spr, M, draw } from '../engine/ui-kit/pixel-assets-v2.js';
import { box, crate, dress, SEASONS, seasonKey } from './campArtKit.js';
import { buildableSprites } from './campBuildArt.js';

function cache() {
  const s = new Spr(32, 22);
  s.ellipseShadow(16, 19.5, 15, 2.5, 0.4);
  crate(s, 1, 8, 14, 19);
  crate(s, 3, 2, 12, 7);
  // The drop mark stencilled on the big crate.
  for (const [x, y] of [[7, 12], [8, 12], [6, 13], [9, 13], [7, 14], [8, 14]]) s.set(x, y, '#c4a24a');
  // A steel footlocker with brass latches and a handle.
  box(s, 16, 12, 30, 19, (x, y) => y === 12 ? M[3] : y === 19 ? M[1] : x === 16 || x === 30 ? M[1] : y === 15 ? M[1] : M[2]);
  for (const x of [19, 27]) { s.set(x, 14, '#e6c874'); s.set(x, 15, '#c4a24a'); }
  box(s, 21, 11, 25, 11, M[1]);
  // A rolled bedroll strapped on top.
  box(s, 18, 7, 28, 10, (x, y) => y === 7 ? '#728558' : y === 10 ? '#3e4a32' : x === 18 || x === 28 ? '#3e4a32' : '#566645');
  for (const x of [21, 25]) box(s, x, 7, x, 10, '#5a4832');
  return s;
}

// Canvases keyed like the atlas: camp_cache, camp_cache_spring, _fall, _winter, and the same for each
// buildable's world sprite (camp_stash, camp_garden, ...).
export function buildCampArt() {
  const out = {};
  for (const season of SEASONS) {
    const canvas = document.createElement('canvas');
    draw(canvas, dress(cache(), season));
    out[seasonKey('camp_cache', season)] = canvas;
    for (const [name, make] of Object.entries(buildableSprites)) {
      const c = document.createElement('canvas');
      draw(c, dress(make(), season));
      out[seasonKey('camp_' + name, season)] = c;
    }
  }
  return out;
}
