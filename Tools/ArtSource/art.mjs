// World and character art from the Claude Design project (ui-kit/, imported unchanged):
// the Survival Tileset v2, buildings, survivor and zombie walk sheets, gunfire and molotov FX.
// Everything is generated once at 1 world unit per kit pixel, on the kit's 16 px grid.
import { Spr, buildAll, draw } from './ui-kit/pixel-assets-v2.js';
import { buildBuildings } from './ui-kit/pixel-buildings.js';
import { buildSurvivors, buildZombies, SURVIVORS, TYPES } from './ui-kit/pixel-zombies.js';
import { buildGunfire } from './ui-kit/pixel-gunfire.js';
import { buildMolotov } from './ui-kit/pixel-molotov.js';
import { buildDecor } from './ui-kit/pixel-decor.js';
import { buildWorld } from './ui-kit/pixel-world.js';
import { buildLightAssets } from './ui-kit/pixel-lights.js';

export const TILE = 16;
export const GUNFIRE_DIRS = 16;
// Walk cycles are authored at 6 fps scaled by each type's own pace.
export const WALK_FPS = 6;
export { SURVIVORS as SURVIVOR_TYPES, TYPES as ZOMBIE_TYPES };

let art = null;
export function kitArt() {
  if (art) return art;
  const tiles = buildAll(), zombies = buildZombies();
  const molotov = buildMolotov(zombies.frames);
  const decor = buildDecor();
  const world = buildWorld();
  const lights = buildLightAssets();
  art = {
    tiles,
    buildings: buildBuildings(),
    survivors: buildSurvivors().frames,
    zombies: zombies.frames,
    burning: molotov.frames.burn,
    decor,
    world,
    lights,
    gunfire: buildGunfire(GUNFIRE_DIRS).frames,
    molotov: molotov.frames,
    fireAnchor: molotov.anchor.fire
  };
  return art;
}

export function spriteCanvas(sprite, scale = 1) {
  const src = document.createElement('canvas'); draw(src, sprite);
  if (scale === 1) return src;
  const out = document.createElement('canvas'); out.width = sprite.w * scale; out.height = sprite.h * scale;
  const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

// Lays sprites side by side, bottoms aligned, centred in a plot of width `w`.
export function row(parts, w = 0) {
  const total = parts.reduce((sum, s) => sum + s.w, 0), h = Math.max(...parts.map(s => s.h)), out = new Spr(Math.max(w, total), h);
  let x = Math.floor((out.w - total) / 2);
  for (const s of parts) { out.blit(s, x, h - s.h); x += s.w; }
  return out;
}
// Blits [sprite, x, y] parts into a new w×h sprite, in order.
export function compose(w, h, parts) {
  const out = new Spr(w, h);
  for (const [s, x, y] of parts) out.blit(s, x, y);
  return out;
}
// Quarter turn clockwise, for the east and west gates.
export function rotate(s) {
  const out = new Spr(s.h, s.w);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) { const i = y * s.w + x, j = x * out.w + (s.h - 1 - y); out.p[j] = s.p[i]; out.sh[j] = s.sh[i]; }
  return out;
}
export function crop(s, x0, y0, w, h) {
  const out = new Spr(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { out.p[y * w + x] = s.get(x0 + x, y0 + y); out.sh[y * w + x] = s.in(x0 + x, y0 + y) ? s.sh[(y0 + y) * s.w + x0 + x] : 0; }
  return out;
}

// Each job has two outfits from the survivor sheet; a survivor's look picks one of the pair.
const OUTFITS = { guard: ['guard', 'ranger'], medic: ['doctor', 'nurse'], engineer: ['mechanic', 'engineer'], farmer: ['elder', 'grower'], scavenger: ['hunter', 'scavenger'] };
export const outfitOf = (job, look = 0) => OUTFITS[job]?.[look % 2] || 'guard';

// Head-and-shoulders crop of a survivor's front-facing frame, for HUD portraits.
const portraits = {};
export function portraitURL(outfit) {
  if (!portraits[outfit]) portraits[outfit] = spriteCanvas(crop(kitArt().survivors[outfit].s[0], 5, 3, 14, 14), 2).toDataURL();
  return portraits[outfit];
}
