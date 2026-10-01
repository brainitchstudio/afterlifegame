// World art for the camp buildables the player learns to build: a supply stash, garden plot, field
// workbench, aid station, lookout post, guard post, radio kit, makeshift shelter and salvage pile.
// Drawn like the supply cache (campArt.js): chunky 3/4 top-down pixels on the design kit's palettes,
// an ellipse shadow and a dark outline added by dress(). The tent and campfire already have atlas art.
// Each factory returns an undressed Spr; campArt.js dresses it for the season and tools/ bakes the
// menu cards and placement ghosts from the same sprites.
import { Spr, W, M, S, X } from '../engine/ui-kit/pixel-assets-v2.js';
import { box, crate, hh } from './campArtKit.js';

const CANVAS = ['#3e4a32', '#566645', '#728558'];
const KHAKI = ['#8f8768', '#b5ab86', '#d3c9a0'];
const RED = ['#7c2a22', '#a8382e', '#c9473a'];
const SOIL = ['#3e2e20', '#553f2b', '#6e5339'];
const LEAF = ['#2f4029', '#50673f', '#739052', '#8fae66'];
const DARK = '#15170f';

const px = (s, c, pts) => { for (const [x, y] of pts) s.set(x, y, c); };
const disc = (s, cx, cy, r, c) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= r * r) s.set(x, y, typeof c === 'function' ? c(x, y) : c); };
// A stuffed sandbag: lit top, shaded belly, round ends.
function bag(s, x, y, w = 6) {
  box(s, x + 1, y, x + w - 2, y, S[3]);
  box(s, x, y + 1, x + w - 1, y + 2, (px2, py) => py === y + 2 ? S[1] : S[2]);
  s.set(x, y + 1, S[1]); s.set(x + w - 1, y + 1, S[1]);
  px(s, S[1], [[x + 2, y + 1], [x + w - 3, y + 2]]);
}

// A tarp-covered crate beside a banded barrel.
function stash() {
  const s = new Spr(24, 20);
  s.ellipseShadow(12, 17.5, 11.5, 2.3, 0.4);
  crate(s, 1, 8, 12, 16);
  // The tarp, lashed down with rope and ragged along its hem.
  box(s, 1, 5, 12, 10, (x, y) => y === 5 ? CANVAS[2] : y >= 9 ? CANVAS[0] : CANVAS[1]);
  px(s, CANVAS[0], [[1, 11], [3, 11], [6, 11], [9, 11], [12, 11], [2, 12], [10, 12]]);
  px(s, CANVAS[2], [[3, 7], [4, 6], [8, 7], [9, 6], [7, 8]]);
  for (const x of [4, 9]) box(s, x, 5, x, 10, W[1]);
  // The barrel: staves, two steel hoops and a lid.
  box(s, 15, 4, 21, 5, (x, y) => y === 4 ? W[4] : W[2]);
  box(s, 14, 6, 22, 13, (x) => x <= 15 ? W[1] : x >= 21 ? W[1] : x === 17 ? W[4] : W[3]);
  box(s, 15, 14, 21, 16, (x) => x <= 15 || x >= 21 ? W[1] : W[2]);
  for (const y of [7, 12]) box(s, 14, y, 22, y, M[2]);
  px(s, M[3], [[17, 7], [17, 12]]);
  px(s, W[0], [[16, 4], [20, 4]]);
  return s;
}

// A fenced plank bed of tilled soil with two rows of crops.
function garden() {
  const s = new Spr(32, 22);
  s.ellipseShadow(16, 19.5, 15, 2.3, 0.35);
  // Back posts with a twine line between them.
  for (const x of [2, 29]) { box(s, x, 1, x, 8, (xx, y) => y === 1 ? W[4] : W[2]); s.set(x + 1, 3, W[1]); }
  s.line(3, 3, 28, 3, (x, y) => s.set(x, y, hh(x, y, 11) < .8 ? KHAKI[2] : KHAKI[0]));
  // The raised bed: a lit back board, soil, and a planked front.
  box(s, 1, 8, 30, 8, W[4]);
  box(s, 1, 9, 30, 16, (x, y) => x <= 2 || x >= 29 ? W[2] : SOIL[y % 4 < 2 ? 1 : (y % 4 === 2 ? 0 : 1)]);
  box(s, 3, 9, 28, 9, SOIL[0]);
  for (const y of [11, 14]) box(s, 3, y, 28, y, SOIL[2]);
  box(s, 1, 17, 30, 18, (x, y) => x === 1 || x === 30 ? W[1] : y === 18 ? W[1] : x % 9 === 4 ? W[1] : W[3]);
  // Crops: leafy sprouts, cabbages, tomatoes and carrot tops.
  const plant = (x, y, kind) => {
    s.set(x, y, LEAF[1]);
    if (kind === 0) px(s, LEAF[2], [[x - 1, y - 1], [x + 1, y - 1], [x, y - 2], [x, y - 1]]);
    if (kind === 1) { disc(s, x, y - 1, 2, LEAF[2]); px(s, LEAF[3], [[x - 1, y - 2], [x, y - 2]]); px(s, LEAF[1], [[x + 1, y]]); }
    if (kind === 2) { px(s, LEAF[2], [[x - 1, y - 2], [x + 1, y - 2], [x, y - 2], [x, y - 1], [x, y - 3]]); px(s, RED[2], [[x - 1, y - 1], [x + 1, y]]); px(s, RED[1], [[x + 1, y - 1]]); }
    if (kind === 3) { px(s, LEAF[3], [[x - 1, y - 2], [x, y - 3], [x + 1, y - 2], [x, y - 2], [x, y - 1]]); s.set(x, y, '#c4703a'); }
  };
  [0, 1, 2, 3, 1, 0].forEach((k, i) => plant(5 + i * 4, 11, k));
  [3, 0, 1, 2, 0, 3].forEach((k, i) => plant(7 + i * 4, 14, k));
  // A trowel left standing in the corner of the bed.
  px(s, M[3], [[27, 12], [27, 13]]); px(s, W[4], [[27, 10], [27, 11]]);
  return s;
}

// A plank bench with a pegboard of tools above it, a vise, scrap parts and a lantern.
function fieldWorkbench() {
  const s = new Spr(32, 22);
  s.ellipseShadow(16, 19.5, 15, 2.3, 0.4);
  // The pegboard back wall and what hangs on it.
  box(s, 2, 1, 29, 8, (x, y) => x % 4 === 2 ? W[1] : y === 1 ? W[3] : W[2]);
  box(s, 4, 3, 11, 4, M[3]); px(s, M[2], [[5, 4], [7, 4], [9, 4]]); box(s, 12, 3, 13, 4, W[4]);
  box(s, 16, 2, 16, 6, W[4]); box(s, 15, 2, 18, 3, M[2]); px(s, M[3], [[15, 2]]);
  box(s, 21, 2, 21, 5, M[3]); box(s, 20, 2, 22, 2, M[2]); px(s, M[1], [[20, 5], [22, 5]]);
  px(s, X[2], [[25, 3], [26, 3], [25, 4], [26, 4]]); px(s, X[3], [[25, 3]]);
  // The bench top and its front lip.
  box(s, 1, 9, 30, 12, (x, y) => y === 9 ? W[4] : y === 12 ? W[1] : (x + y) % 7 === 0 ? W[2] : W[3]);
  // Legs, a low shelf, a jerrycan and a small crate.
  for (const x of [2, 28]) box(s, x, 13, x + 1, 19, W[1]);
  box(s, 3, 17, 27, 18, (x, y) => y === 17 ? W[3] : W[1]);
  box(s, 6, 13, 10, 17, (x, y) => y === 13 ? CANVAS[2] : x === 6 || x === 10 ? CANVAS[0] : CANVAS[1]); px(s, M[3], [[8, 12]]);
  crate(s, 16, 13, 23, 17);
  // On the bench: a vise, a gear, a hammer and a lit lantern.
  box(s, 3, 5, 8, 8, (x, y) => y === 5 ? M[3] : x === 3 || x === 8 ? M[1] : M[2]); box(s, 5, 6, 6, 8, M[1]); px(s, W[4], [[9, 7], [10, 7], [11, 7]]);
  disc(s, 15, 7, 2.6, M[2]); px(s, M[3], [[14, 6], [15, 6]]); px(s, M[0], [[15, 7], [14, 7]]); px(s, M[3], [[15, 4], [15, 10], [12, 7], [18, 7]]);
  box(s, 19, 8, 24, 8, W[4]); box(s, 24, 7, 25, 8, M[2]); px(s, M[3], [[24, 7]]);
  box(s, 27, 5, 29, 8, (x, y) => y === 5 || y === 8 ? M[1] : M[2]); box(s, 28, 6, 28, 7, X[0]); px(s, X[5], [[28, 6]]);
  return s;
}

// An open canvas lean-to over a cot, an IV stand and a medkit; a red cross marks the roof.
function aidStation() {
  const s = new Spr(32, 26);
  s.ellipseShadow(16, 23.5, 15, 2.4, 0.4);
  // Dark inside, then the cot, the IV stand and the medkit.
  box(s, 4, 11, 27, 21, (x, y) => y < 13 ? '#2a2a20' : '#3a3828');
  box(s, 8, 16, 23, 18, (x, y) => y === 16 ? '#e6e6dc' : y === 17 ? '#c8c8bc' : CANVAS[1]); box(s, 9, 15, 13, 16, '#f2f2ea');
  box(s, 8, 19, 23, 19, W[1]); for (const x of [8, 9, 22, 23]) box(s, x, 19, x, 21, W[1]);
  box(s, 6, 12, 6, 21, M[3]); box(s, 5, 12, 7, 12, M[2]); box(s, 5, 13, 7, 15, '#9fc3d0'); px(s, '#d6eaf0', [[5, 13]]); px(s, '#bdd2d8', [[6, 16]]);
  box(s, 24, 18, 28, 21, (x, y) => y === 18 ? '#eeeee6' : x === 24 || x === 28 ? '#b9b9ae' : '#dcdcd2'); box(s, 26, 19, 26, 20, RED[1]); box(s, 25, 20, 27, 20, RED[1]);
  // Corner posts.
  for (const x of [2, 28]) box(s, x, 9, x + 1, 22, (xx) => xx === x ? W[3] : W[1]);
  // The canvas roof: a slope from ridge to eave, scalloped along the hem.
  for (let y = 1; y <= 9; y++) {
    const x0 = Math.round(8 - (y - 1) * 0.9), x1 = Math.round(23 + (y - 1) * 0.9);
    box(s, x0, y, x1, y, y === 1 ? KHAKI[2] : y >= 8 ? KHAKI[0] : y % 3 === 0 ? KHAKI[1] : (x => x < x0 + 2 ? KHAKI[1] : KHAKI[2]));
    s.set(x0, y, KHAKI[0]); s.set(x1, y, KHAKI[0]);
  }
  for (let x = 1; x <= 30; x++) { s.set(x, 10, x % 4 < 2 ? KHAKI[1] : KHAKI[0]); if (x % 4 < 2) s.set(x, 11, KHAKI[0]); }
  box(s, 14, 3, 17, 8, RED[1]); box(s, 12, 5, 19, 6, RED[1]); box(s, 15, 3, 16, 3, RED[2]); box(s, 12, 5, 13, 5, RED[2]);
  return s;
}

// A tall lashed-timber tower with a ladder, a railed deck and a patched tarp roof.
function lookoutPost() {
  const s = new Spr(20, 44);
  s.ellipseShadow(10, 41.5, 9, 2.2, 0.4);
  // Back legs first, then the crossed bracing, then the front legs and ladder.
  for (const x of [5, 14]) box(s, x, 18, x, 37, W[1]);
  for (const y of [25, 32]) box(s, 4, y, 15, y, W[1]);
  s.line(3, 20, 8, 31, (x, y) => s.set(x, y, W[2])); s.line(16, 20, 11, 31, (x, y) => s.set(x, y, W[2]));
  s.line(3, 31, 8, 37, (x, y) => s.set(x, y, W[2])); s.line(16, 31, 11, 37, (x, y) => s.set(x, y, W[2]));
  for (const x of [3, 16]) box(s, x, 18, x, 39, (xx, y) => y % 6 === 4 ? X[5] : W[2]);
  for (const x of [8, 11]) box(s, x, 19, x, 39, W[3]);
  for (let y = 21; y <= 38; y += 3) box(s, 9, y, 10, y, W[4]);
  px(s, X[5], [[3, 25], [16, 25], [3, 32], [16, 32]]);
  // The deck, its lip and its railing.
  box(s, 0, 16, 19, 18, (x, y) => y === 16 ? W[4] : y === 18 ? W[1] : (x + y) % 5 === 0 ? W[2] : W[3]);
  box(s, 9, 16, 10, 17, DARK);
  for (const x of [1, 18]) box(s, x, 8, x, 15, W[2]);
  box(s, 1, 12, 18, 12, W[2]); box(s, 1, 14, 18, 14, W[1]); box(s, 1, 8, 18, 8, W[3]);
  // The roof: a stretched tarp on two tall posts.
  for (const x of [1, 18]) box(s, x, 4, x, 8, W[1]);
  box(s, 0, 1, 19, 3, (x, y) => y === 1 ? CANVAS[2] : y === 3 ? CANVAS[0] : CANVAS[1]);
  px(s, CANVAS[0], [[2, 4], [5, 4], [9, 4], [13, 4], [17, 4]]); box(s, 11, 1, 14, 2, W[2]); px(s, KHAKI[1], [[12, 2]]);
  return s;
}

// A horseshoe of sandbags round a bare patch of ground, with a lantern pole and a pennant.
function guardPost() {
  const s = new Spr(24, 22);
  s.ellipseShadow(12, 19.5, 11.5, 2.3, 0.4);
  // The trodden ground inside the ring.
  box(s, 5, 9, 18, 17, (x, y) => (x * 3 + y) % 7 === 0 ? '#736b50' : '#625b44');
  // The back wall in two staggered courses, then the side walls and the front shoulders.
  for (const x of [3, 9, 15]) bag(s, x, 6);
  bag(s, 0, 6, 3); bag(s, 21, 6, 3);
  for (const x of [0, 6, 12, 18]) bag(s, x, 9);
  for (const y of [12, 15]) { bag(s, 0, y); bag(s, 18, y); }
  bag(s, 4, 16, 4); bag(s, 16, 16, 4);
  // The pole, its lantern and a pennant stand on the ground inside.
  box(s, 10, 0, 10, 15, W[2]); box(s, 11, 0, 11, 15, W[1]);
  box(s, 7, 2, 9, 5, M[1]); px(s, X[0], [[7, 3], [8, 3], [8, 4], [9, 3]]); px(s, X[5], [[8, 3]]); px(s, M[3], [[8, 2]]);
  box(s, 12, 1, 18, 3, (x, y) => y === 1 ? RED[2] : RED[1]); px(s, RED[0], [[16, 3], [17, 2], [18, 2]]);
  return s;
}

// A field radio on a crate: speaker, dial, display, a whip antenna and a battery on the ground.
function radioKit() {
  const s = new Spr(22, 22);
  s.ellipseShadow(11, 19.5, 10.5, 2.2, 0.4);
  crate(s, 1, 12, 13, 18);
  // The set: olive casing, grille, knobs and an amber display.
  box(s, 1, 5, 12, 11, (x, y) => y === 5 ? '#6b7d4f' : y === 11 ? '#2f3a28' : x === 1 || x === 12 ? '#2f3a28' : '#4a5a3a');
  box(s, 2, 7, 6, 10, (x, y) => (x + y) % 2 ? M[0] : M[1]);
  box(s, 8, 6, 11, 7, X[0]); px(s, X[5], [[8, 6]]);
  px(s, M[3], [[8, 9], [9, 9], [11, 9]]); px(s, M[2], [[10, 10]]);
  // The antenna and the lead down to the battery.
  s.line(11, 4, 14, 0, (x, y) => s.set(x, y, M[3])); px(s, RED[2], [[14, 0]]);
  s.line(12, 10, 16, 13, (x, y) => s.set(x, y, '#22221c'));
  box(s, 15, 14, 20, 18, (x, y) => y === 14 ? '#5b6a78' : x === 15 || x === 20 ? '#252d36' : y === 18 ? '#252d36' : '#3a4450');
  px(s, RED[2], [[16, 13]]); px(s, M[3], [[19, 13]]); box(s, 17, 16, 18, 16, X[0]);
  return s;
}

// A hunched lean-to of corrugated iron, a patched tarp and pallets, with a dark doorway.
function makeshiftShelter() {
  const s = new Spr(32, 22);
  s.ellipseShadow(16, 19.5, 15, 2.4, 0.4);
  // The doorway and the bedroll inside it.
  box(s, 9, 9, 22, 18, (x, y) => y > 15 && x < 14 ? CANVAS[1] : DARK);
  box(s, 9, 16, 13, 16, CANVAS[2]); box(s, 13, 15, 13, 17, X[2]);
  // Pallet walls either side.
  const pallet = (x0, x1) => { box(s, x0, 9, x1, 18, (x, y) => y % 3 === 0 ? W[0] : (x - x0) % 4 === 3 ? W[1] : W[3]); box(s, x0, 9, x1, 9, W[4]); };
  pallet(1, 8); pallet(23, 30);
  // The roof: corrugated iron on the left, a patched tarp on the right, stones to hold it down.
  for (let y = 2; y <= 8; y++) {
    const x0 = Math.round(10 - (y - 2) * 1.4), x1 = Math.round(21 + (y - 2) * 1.4);
    box(s, x0, y, x1, y, (x) => x < 16 ? ((x + y) % 3 === 0 ? M[3] : (x + y) % 3 === 1 ? M[2] : M[1]) : (y % 2 ? CANVAS[1] : CANVAS[2]));
    s.set(x0, y, M[1]); s.set(x1, y, CANVAS[0]);
  }
  box(s, 0, 9, 31, 9, (x) => x < 16 ? M[1] : CANVAS[0]);
  box(s, 18, 4, 21, 6, W[3]); px(s, W[1], [[19, 5], [20, 6]]); px(s, X[5], [[16, 4], [16, 7]]);
  px(s, S[2], [[3, 8], [4, 8], [28, 8], [27, 8]]); px(s, S[3], [[3, 7], [28, 7]]);
  return s;
}

// A heap of tyres, sheet metal, pipes and cans.
function salvagePile() {
  const s = new Spr(28, 20);
  s.ellipseShadow(14, 17.5, 13.5, 2.3, 0.4);
  const cols = [M[1], M[2], X[2], X[3], S[1], '#4a4438', M[0]];
  for (let y = 5; y <= 16; y++) {
    const half = 3 + (y - 5) * 1.1, x0 = Math.round(14 - half), x1 = Math.round(14 + half);
    for (let x = x0; x <= x1; x++) s.set(x, y, cols[Math.floor(hh(x >> 1, y >> 1, 77) * cols.length)]);
  }
  box(s, 6, 15, 22, 16, (x) => hh(x, 3, 5) < .5 ? M[0] : '#4a4438');
  // A tyre at the front left, a bent sheet leaning on the heap, a pipe and a bucket.
  disc(s, 7, 12, 4.4, '#22221c'); disc(s, 7, 12, 1.8, M[1]); px(s, M[2], [[6, 11], [5, 10], [9, 10]]); px(s, '#34342c', [[4, 12], [10, 12]]);
  s.line(12, 4, 19, 9, (x, y) => { s.set(x, y, M[3]); s.set(x, y + 1, M[2]); }); s.line(12, 6, 18, 11, (x, y) => s.set(x, y + 1, M[1]));
  s.line(15, 12, 25, 10, (x, y) => { s.set(x, y, M[3]); s.set(x, y + 1, M[1]); });
  box(s, 21, 13, 25, 16, (x, y) => y === 13 ? M[3] : x === 21 || x === 25 ? X[2] : X[3]); box(s, 22, 13, 24, 13, M[0]);
  px(s, X[0], [[12, 13], [16, 15], [3, 15]]); px(s, RED[1], [[14, 12], [11, 15]]);
  return s;
}

// Phase 2 structures, drawn at the spec's footprints (3x2, 5x4 and 5x4 tiles).
// A pinboard of regional maps on two posts, with a folding table, a radio and mission crates in front.
function operationsBoard() {
  const s = new Spr(48, 40);
  s.ellipseShadow(24, 36.5, 23, 2.6, 0.4);
  // Posts and the board: cork with a timber frame.
  for (const x of [5, 41]) box(s, x, 4, x + 1, 30, (xx) => xx === x ? W[3] : W[1]);
  box(s, 3, 2, 44, 21, (x, y) => y === 2 || y === 21 || x === 3 || x === 44 ? W[1] : y === 3 ? W[4] : (x + y * 3) % 11 === 0 ? '#9a7a4e' : '#b48f5c');
  // Two pinned maps, a photo, a list and the red string between them.
  box(s, 6, 5, 19, 14, (x, y) => (x + y) % 5 === 0 ? '#c9c3a0' : (x * y) % 7 === 0 ? '#8fa070' : '#ddd6b0'); box(s, 6, 5, 19, 5, '#eee8c6');
  px(s, '#6f8c9c', [[9, 8], [10, 8], [10, 9], [11, 10], [12, 10], [13, 11], [14, 11]]); px(s, '#7a6444', [[15, 7], [16, 8], [16, 9]]);
  box(s, 23, 6, 33, 16, (x, y) => (x + y) % 4 === 0 ? '#c4bd96' : '#e2dbb4'); box(s, 23, 6, 33, 6, '#f0eacc');
  px(s, '#8fa070', [[25, 9], [26, 9], [27, 10], [28, 12], [29, 12], [30, 13]]); px(s, '#6f8c9c', [[24, 14], [25, 13], [26, 13]]);
  box(s, 36, 5, 41, 10, '#d8d4c4'); box(s, 37, 6, 40, 8, '#5a6a72'); box(s, 36, 13, 41, 19, '#efeadf');
  for (let y = 14; y <= 18; y += 2) box(s, 37, y, 40, y, '#7d7a70');
  px(s, RED[2], [[8, 6], [27, 7], [38, 5], [38, 13], [16, 12], [31, 15]]);
  s.line(8, 6, 27, 7, (x, y) => s.set(x, y, RED[1])); s.line(27, 7, 38, 13, (x, y) => s.set(x, y, RED[1])); s.line(16, 12, 31, 15, (x, y) => s.set(x, y, RED[0]));
  // The folding table, a field radio with its aerial, a clipboard and two crates of provisions.
  box(s, 8, 24, 39, 26, (x, y) => y === 24 ? M[3] : y === 26 ? M[1] : M[2]);
  for (const x of [10, 37]) box(s, x, 27, x, 33, M[1]);
  box(s, 11, 20, 18, 23, (x, y) => y === 20 ? KHAKI[2] : x === 11 || x === 18 ? KHAKI[0] : KHAKI[1]); box(s, 13, 21, 14, 22, M[1]); px(s, X[5], [[16, 21]]); box(s, 17, 14, 17, 19, M[3]);
  box(s, 24, 22, 29, 23, '#e8e2cc'); box(s, 25, 21, 28, 21, M[2]);
  crate(s, 30, 27, 37, 33); crate(s, 13, 28, 20, 33);
  return s;
}

// A chain-link yard: sorted bins, a scrap heap, a sorting bench and a hand-cranked press.
function salvageYard() {
  const s = new Spr(80, 70);
  s.ellipseShadow(40, 66.5, 39, 3, 0.35);
  // Packed dirt inside the fence.
  box(s, 2, 10, 77, 66, (x, y) => hh(x >> 1, y >> 1, 9) < .15 ? SOIL[0] : hh(x, y, 4) < .5 ? SOIL[1] : SOIL[2]);
  // The fence: posts every 8, wire mesh along the back and both sides, open at the front.
  for (let x = 2; x <= 77; x += 8) box(s, x, 3, x, 12, M[3]);
  for (let y = 4; y <= 11; y++) for (let x = 2; x <= 77; x++) if ((x + y) % 3 === 0 || (x - y + 99) % 3 === 0) s.set(x, y, M[2]);
  box(s, 2, 3, 77, 3, M[3]);
  for (const x of [1, 78]) { box(s, x, 3, x, 62, M[3]); for (let y = 6; y <= 62; y += 3) s.set(x, y, M[2]); }
  // The heap at the back right.
  for (let y = 12; y <= 34; y++) {
    const half = 2 + (y - 12) * 0.9, x0 = Math.round(60 - half), x1 = Math.round(60 + half);
    for (let x = Math.max(40, x0); x <= Math.min(76, x1); x++) s.set(x, y, [M[1], M[2], X[2], X[3], S[1], '#4a4438', M[0]][Math.floor(hh(x >> 1, y >> 1, 21) * 7)]);
  }
  disc(s, 50, 30, 4, '#22221c'); disc(s, 50, 30, 1.6, M[1]); disc(s, 70, 31, 3.6, '#22221c'); disc(s, 70, 31, 1.4, M[1]);
  s.line(52, 16, 64, 24, (x, y) => { s.set(x, y, M[3]); s.set(x, y + 1, M[1]); });
  // Sorting bins along the left: scrap, pipe, wire.
  const bin = (x0, y0, fill) => { box(s, x0, y0, x0 + 11, y0 + 9, (x, y) => y === y0 ? M[3] : x === x0 || x === x0 + 11 ? M[0] : M[1]); box(s, x0 + 1, y0 + 1, x0 + 10, y0 + 3, fill); };
  bin(6, 16, (x, y) => (x + y) % 2 ? M[3] : X[2]); bin(6, 30, (x, y) => y % 2 ? M[2] : M[3]); bin(6, 44, (x, y) => (x * y) % 3 ? X[3] : X[2]);
  // The sorting bench and a sledgehammer.
  box(s, 22, 38, 45, 41, (x, y) => y === 38 ? W[4] : y === 41 ? W[1] : W[3]); for (const x of [23, 44]) box(s, x, 42, x, 48, W[1]);
  box(s, 26, 35, 31, 37, M[2]); px(s, M[3], [[27, 35], [28, 35]]); box(s, 34, 36, 41, 37, X[3]); s.line(36, 34, 43, 37, (x, y) => s.set(x, y, W[4]));
  // The press: a steel frame over a plate, a crank wheel and a stack of crushed blocks.
  box(s, 54, 40, 70, 58, (x, y) => x === 54 || x === 70 ? M[0] : y === 40 ? M[3] : y > 52 ? M[1] : M[2]);
  box(s, 57, 44, 67, 47, M[3]); box(s, 61, 41, 63, 44, M[3]); box(s, 56, 52, 68, 54, X[2]);
  disc(s, 73, 46, 3.4, M[1]); disc(s, 73, 46, 1.2, M[3]); px(s, M[3], [[73, 42], [76, 46], [73, 50]]);
  for (let i = 0; i < 3; i++) box(s, 30 + i * 6, 54 - i * 0, 34 + i * 6, 58, (x, y) => y === 54 ? M[3] : (x + y) % 2 ? M[2] : X[2]);
  box(s, 33, 50, 37, 53, (x, y) => y === 50 ? M[3] : M[2]);
  // A wheelbarrow at the gate.
  box(s, 12, 58, 20, 61, (x, y) => y === 58 ? M[3] : M[2]); disc(s, 21, 62, 1.6, '#22221c'); s.line(8, 59, 12, 60, (x, y) => s.set(x, y, W[3]));
  return s;
}

// A corrugated-iron depot with a roll-up door, pallets and stacked crates.
function storageDepot() {
  const s = new Spr(80, 76);
  s.ellipseShadow(40, 72.5, 39, 3, 0.4);
  // The concrete apron.
  box(s, 2, 58, 77, 71, (x, y) => hh(x >> 2, y >> 1, 3) < .2 ? '#7c7c70' : y === 58 ? '#a7a798' : '#929284');
  // Walls: ribbed iron, darker at the corners.
  box(s, 4, 22, 75, 58, (x, y) => x <= 5 || x >= 74 ? M[0] : x % 3 === 0 ? M[1] : x % 3 === 1 ? M[2] : M[3]);
  box(s, 4, 22, 75, 23, M[3]);
  // The roof: a low gable in rust and grey panels.
  for (let y = 2; y <= 22; y++) {
    const inset = Math.round((22 - y) * 0.35);
    box(s, 2 + inset, y, 77 - inset, y, (x) => (x >> 3) % 4 === 1 ? ((x + y) % 2 ? X[3] : X[2]) : ((x + y) % 2 ? M[2] : M[3]));
    s.set(2 + inset, y, M[0]); s.set(77 - inset, y, M[0]);
  }
  box(s, 10, 2, 69, 2, M[3]); box(s, 1, 21, 78, 22, M[0]);
  // The roll-up door, half open over a dark interior with shelving.
  box(s, 26, 34, 53, 58, '#1c1d18'); for (let y = 44; y <= 56; y += 4) box(s, 28, y, 51, y, W[1]);
  for (let y = 46; y <= 55; y += 4) { box(s, 29, y, 33, y + 2, W[3]); box(s, 40, y, 45, y + 2, KHAKI[1]); }
  box(s, 26, 34, 53, 43, (x, y) => y % 2 ? M[3] : M[2]); box(s, 25, 33, 54, 33, M[0]); box(s, 25, 34, 25, 58, M[0]); box(s, 54, 34, 54, 58, M[0]);
  // A striped hazard plate and a lamp over the door.
  box(s, 34, 26, 45, 30, '#d8cc86'); for (const y of [27, 29]) box(s, 35, y, 44, y, M[0]); box(s, 38, 31, 41, 32, X[5]);
  // Pallets and crates on the apron, a forklift pallet jack.
  crate(s, 6, 52, 17, 64); crate(s, 9, 44, 18, 53); crate(s, 60, 52, 72, 64);
  box(s, 61, 48, 70, 51, (x, y) => y === 48 ? CANVAS[2] : CANVAS[1]);
  box(s, 20, 64, 31, 66, (x, y) => (x - 20) % 4 === 3 ? W[1] : y === 64 ? W[4] : W[3]);
  box(s, 46, 63, 56, 65, M[2]); box(s, 47, 59, 48, 63, M[3]); disc(s, 49, 66, 1.4, '#22221c'); disc(s, 55, 66, 1.4, '#22221c');
  return s;
}

// Six rows of crops in tilled earth inside a split-rail fence, with a water barrel and a scarecrow.
function fieldFarm() {
  const s = new Spr(96, 100);
  s.ellipseShadow(48, 96.5, 47, 3, 0.3);
  // Tilled earth: furrows across, a little darker every other row.
  box(s, 3, 10, 92, 95, (x, y) => (y - 10) % 14 < 3 ? SOIL[0] : hh(x >> 1, y >> 1, 31) < .2 ? SOIL[2] : SOIL[1]);
  // Rows of crops, each its own kind: lettuce, beans on canes, maize, squash, potatoes, carrots.
  const plant = (x, y, kind) => {
    if (kind === 0) { disc(s, x, y - 1, 2, LEAF[2]); px(s, LEAF[3], [[x - 1, y - 2], [x, y - 2]]); }
    if (kind === 1) { box(s, x, y - 8, x, y, W[3]); px(s, LEAF[2], [[x - 1, y - 6], [x + 1, y - 4], [x - 1, y - 2], [x + 1, y - 1]]); px(s, LEAF[3], [[x + 1, y - 7], [x - 1, y - 3]]); }
    if (kind === 2) { box(s, x, y - 7, x, y, LEAF[1]); px(s, LEAF[2], [[x - 1, y - 5], [x + 1, y - 3], [x - 1, y - 1]]); px(s, X[0], [[x + 1, y - 6], [x + 1, y - 5]]); }
    if (kind === 3) { disc(s, x, y - 1, 2.4, LEAF[1]); px(s, LEAF[2], [[x - 1, y - 2], [x + 1, y - 1]]); disc(s, x + 2, y, 1.4, '#c98a34'); }
    if (kind === 4) { px(s, LEAF[2], [[x - 1, y - 1], [x, y - 2], [x + 1, y - 1], [x, y - 1]]); px(s, LEAF[1], [[x, y]]); }
    if (kind === 5) { px(s, LEAF[3], [[x - 1, y - 2], [x, y - 3], [x + 1, y - 2], [x, y - 1]]); s.set(x, y, '#c4703a'); }
  };
  for (let row = 0; row < 6; row++) for (let i = 0; i < 13; i++) plant(9 + i * 6 + (row % 2) * 3, 22 + row * 14, row);
  // The fence: rails along the back and sides, a gap at the front for the path.
  const rail = (x0, y0, x1, y1) => s.line(x0, y0, x1, y1, (x, y) => { s.set(x, y, W[3]); s.set(x, y + 1, W[1]); });
  for (let x = 1; x <= 94; x += 12) box(s, x, 3, x + 1, 12, (xx) => xx === x ? W[3] : W[1]);
  rail(1, 5, 94, 5); rail(1, 9, 94, 9);
  for (const x of [1, 93]) { for (let y = 12; y <= 94; y += 12) box(s, x, y, x + 1, y + 4, W[2]); rail(x, 12, x, 94); }
  // A water barrel and a scarecrow.
  box(s, 82, 80, 90, 92, (x, y) => y === 80 ? W[4] : y % 5 === 0 ? M[2] : x <= 83 ? W[1] : W[3]); box(s, 83, 81, 89, 81, '#4f7f8f');
  box(s, 47, 30, 48, 52, W[2]); box(s, 40, 36, 55, 37, W[3]); box(s, 44, 37, 51, 46, KHAKI[1]); box(s, 44, 37, 51, 38, KHAKI[2]);
  disc(s, 47.5, 31, 3.2, X[5]); box(s, 43, 26, 52, 28, W[1]); box(s, 45, 24, 50, 26, W[1]); px(s, DARK, [[46, 31], [49, 31]]);
  return s;
}

// A long canvas ward with a red cross, its flap tied open on two cots, a supply chest and a stretcher.
function fieldClinic() {
  const s = new Spr(64, 72);
  s.ellipseShadow(32, 68.5, 31, 2.8, 0.4);
  // The floor boards.
  box(s, 3, 56, 60, 66, (x, y) => (x - 3) % 6 === 5 ? W[1] : y === 56 ? W[4] : W[3]);
  // The ward: canvas walls and the dark inside behind the open flap.
  box(s, 5, 28, 58, 56, (x, y) => x <= 6 || x >= 57 ? CANVAS[0] : y % 7 === 0 ? CANVAS[1] : KHAKI[1]);
  box(s, 18, 34, 45, 56, (x, y) => y < 38 ? '#2a2a20' : '#3a3828');
  // Two cots side by side, an IV stand between them.
  for (const x0 of [20, 34]) {
    box(s, x0, 47, x0 + 9, 49, (x, y) => y === 47 ? '#e6e6dc' : y === 48 ? '#c8c8bc' : CANVAS[1]); box(s, x0 + 1, 46, x0 + 3, 47, '#f2f2ea');
    box(s, x0, 50, x0 + 9, 50, W[1]); for (const x of [x0, x0 + 9]) box(s, x, 50, x, 53, W[1]);
  }
  box(s, 31, 40, 31, 53, M[3]); box(s, 30, 40, 32, 40, M[2]); box(s, 30, 41, 32, 43, '#9fc3d0'); px(s, '#d6eaf0', [[30, 41]]);
  // The tied-back flaps.
  for (const [x0, dir] of [[16, -1], [46, 1]]) for (let y = 34; y <= 55; y++) box(s, x0 + (dir < 0 ? -Math.floor((y - 34) / 6) : 0), y, x0 + (dir > 0 ? Math.floor((y - 34) / 6) : 0) + 1, y, y % 4 === 0 ? KHAKI[0] : KHAKI[2]);
  // The roof: a ridge with a sag between the poles, the cross on top.
  for (let y = 6; y <= 28; y++) {
    const inset = Math.round((28 - y) * 0.55);
    box(s, 3 + inset, y, 60 - inset, y, (x) => y === 28 ? KHAKI[0] : (x + y) % 9 === 0 ? KHAKI[1] : x < 32 ? KHAKI[2] : KHAKI[1]);
    s.set(3 + inset, y, KHAKI[0]); s.set(60 - inset, y, KHAKI[0]);
  }
  for (let x = 2; x <= 61; x++) { s.set(x, 29, x % 4 < 2 ? KHAKI[1] : KHAKI[0]); if (x % 4 < 2) s.set(x, 30, KHAKI[0]); }
  box(s, 29, 10, 34, 24, RED[1]); box(s, 24, 15, 39, 19, RED[1]); box(s, 30, 10, 33, 10, RED[2]); box(s, 24, 15, 28, 15, RED[2]);
  // A supply chest and a folded stretcher by the door.
  box(s, 6, 58, 15, 64, (x, y) => y === 58 ? '#eeeee6' : x === 6 || x === 15 ? '#b9b9ae' : '#dcdcd2'); box(s, 10, 59, 11, 63, RED[1]); box(s, 8, 61, 13, 61, RED[1]);
  box(s, 48, 60, 59, 62, (x, y) => y === 60 ? KHAKI[2] : KHAKI[0]); box(s, 47, 61, 60, 61, W[2]);
  return s;
}

// A tall braced timber tower with a ladder, a roofed platform with sandbags and a lamp.
function watchtower() {
  const s = new Spr(48, 92);
  s.ellipseShadow(24, 88.5, 22, 2.6, 0.45);
  // Legs splaying out to the ground, braced in Xs.
  const leg = (xt, xb) => s.line(xt, 30, xb, 86, (x, y) => { s.set(x, y, W[2]); s.set(x + 1, y, W[1]); });
  leg(9, 4); leg(37, 42); leg(15, 13); leg(31, 33);
  for (const [y0, y1] of [[34, 52], [52, 70], [70, 86]]) {
    const at = y => [Math.round(9 - (y - 30) * 5 / 56), Math.round(37 + (y - 30) * 5 / 56)];
    const [l0, r0] = at(y0), [l1, r1] = at(y1);
    s.line(l0, y0, r1, y1, (x, y) => s.set(x, y, W[1])); s.line(r0, y0, l1, y1, (x, y) => s.set(x, y, W[1]));
    box(s, l1, y1, r1 + 1, y1, W[3]);
  }
  // The ladder up the front.
  for (const x of [21, 26]) box(s, x, 32, x, 87, W[3]);
  for (let y = 35; y <= 86; y += 4) box(s, 22, y, 25, y, W[4]);
  // The platform: deck, sandbagged parapet, corner posts and a lamp.
  box(s, 2, 26, 45, 31, (x, y) => y === 26 ? W[4] : y === 31 ? W[1] : (x + y) % 6 === 0 ? W[2] : W[3]);
  for (let x = 3; x <= 39; x += 6) bag(s, x, 20, 6);
  for (let x = 6; x <= 36; x += 6) bag(s, x, 17, 6);
  for (const x of [2, 44]) box(s, x, 6, x + 1, 26, (xx) => xx === x ? W[3] : W[1]);
  box(s, 40, 12, 43, 15, (x, y) => y === 12 ? M[3] : X[5]); px(s, X[0], [[41, 14]]);
  // The roof: corrugated iron sloping to the front.
  for (let y = 1; y <= 8; y++) box(s, 0 + (8 - y) % 2, y, 47 - (8 - y) % 2, y, (x) => (x + y) % 3 === 0 ? M[3] : (x + y) % 3 === 1 ? M[2] : M[1]);
  box(s, 0, 9, 47, 9, M[0]);
  return s;
}

// A half-buried bunker: sandbagged concrete walls, a steel blast door and a vent stack.
function reinforcedShelter() {
  const s = new Spr(80, 84);
  s.ellipseShadow(40, 80.5, 39, 3, 0.45);
  // An earth berm round the base.
  box(s, 1, 62, 78, 78, (x, y) => hh(x >> 1, y >> 1, 41) < .25 ? SOIL[0] : y > 74 ? SOIL[1] : SOIL[2]);
  // Concrete walls, stained and cracked.
  const CON = ['#5d5f57', '#76786e', '#8e9085', '#a6a89b'];
  box(s, 5, 26, 74, 70, (x, y) => x <= 6 || x >= 73 ? CON[0] : y % 11 === 0 ? CON[1] : hh(x >> 2, y >> 2, 17) < .12 ? CON[1] : CON[2]);
  s.line(14, 34, 20, 48, (x, y) => s.set(x, y, CON[0])); s.line(60, 30, 56, 41, (x, y) => s.set(x, y, CON[0]));
  // A thick slab roof with sandbags along its edge.
  box(s, 2, 14, 77, 26, (x, y) => y === 14 ? CON[3] : y >= 24 ? CON[0] : CON[2]);
  for (let x = 3; x <= 71; x += 6) bag(s, x, 9, 6);
  for (let x = 6; x <= 68; x += 6) bag(s, x, 6, 6);
  // The vent stack and a hooded lamp.
  box(s, 62, 0, 66, 9, (x) => x === 62 ? M[1] : M[2]); box(s, 60, 0, 68, 1, M[3]);
  // The blast door: steel, riveted, with a wheel; sandbag wings either side.
  box(s, 28, 40, 51, 70, (x, y) => x === 28 || x === 51 || y === 40 ? M[0] : (x + y) % 9 === 0 ? M[1] : M[2]);
  for (let y = 43; y <= 67; y += 6) for (const x of [31, 48]) s.set(x, y, M[3]);
  disc(s, 39.5, 55, 5, M[3]); disc(s, 39.5, 55, 3.4, M[1]); box(s, 39, 50, 40, 60, M[3]); box(s, 35, 55, 44, 55, M[3]);
  box(s, 24, 30, 55, 35, (x, y) => y === 30 ? X[0] : (x >> 2) % 2 ? X[0] : DARK);
  for (const x0 of [8, 56]) { for (let y = 58; y <= 70; y += 3) bag(s, x0, y, 16); }
  box(s, 38, 37, 41, 38, X[5]);
  return s;
}

// A guyed lattice mast with dish and aerials over an equipment shed, its battery cabinet at the door.
function radioRelay() {
  const s = new Spr(48, 104);
  s.ellipseShadow(24, 100.5, 23, 2.6, 0.45);
  // Guy wires from the mast down to stakes.
  for (const [x, y] of [[2, 98], [46, 98]]) s.line(24, 20, x, y, (px2, py) => { if (py % 2 === 0) s.set(px2, py, M[2]); });
  // The lattice mast.
  for (let y = 8; y <= 78; y++) {
    const half = 1 + Math.round((y - 8) * 3 / 70);
    s.set(24 - half, y, M[1]); s.set(24 + half, y, M[1]);
    if ((y - 8) % 8 < 1) box(s, 24 - half, y, 24 + half, y, M[2]);
    if ((y - 8) % 8 === 4) { s.set(24, y, M[3]); s.set(24 - half + 1, y, M[2]); s.set(24 + half - 1, y, M[2]); }
  }
  box(s, 23, 0, 25, 8, M[3]); px(s, RED[2], [[24, 0], [24, 1]]);
  // A dish and two whip aerials.
  disc(s, 17, 24, 4.2, '#d8d8cc'); disc(s, 17.6, 24, 3, '#b9b9ae'); box(s, 20, 24, 23, 24, M[2]);
  box(s, 30, 30, 30, 42, M[3]); box(s, 33, 14, 33, 30, M[3]); box(s, 26, 30, 33, 30, M[2]);
  // The equipment shed: corrugated walls, a door and a cabinet with its battery lamp.
  box(s, 6, 78, 41, 96, (x, y) => x <= 7 || x >= 40 ? M[0] : x % 3 === 0 ? M[1] : M[2]);
  for (let y = 72; y <= 78; y++) box(s, 4 + (78 - y) % 2, y, 43 - (78 - y) % 2, y, (x) => (x + y) % 3 === 0 ? X[3] : (x + y) % 3 === 1 ? X[2] : M[2]);
  box(s, 15, 84, 23, 96, DARK); box(s, 16, 85, 22, 85, M[1]);
  box(s, 27, 84, 37, 95, (x, y) => y === 84 ? '#d8d4c4' : x === 27 || x === 37 ? '#9f9b8c' : '#c2bdab'); box(s, 29, 87, 35, 90, M[0]); px(s, '#7fdc6a', [[31, 88], [33, 88]]); px(s, X[0], [[32, 92]]);
  return s;
}

// Keyed like the atlas's camp_* art: camp_supply_stash, camp_garden_plot, ...
export const buildableSprites = {
  supply_stash: stash, garden_plot: garden, field_workbench: fieldWorkbench, aid_station: aidStation, lookout_post: lookoutPost,
  guard_post: guardPost, radio_kit: radioKit, makeshift_shelter: makeshiftShelter, salvage_pile: salvagePile,
  operations_board: operationsBoard, salvage_yard: salvageYard, storage_depot: storageDepot,
  field_farm: fieldFarm, field_clinic: fieldClinic, watchtower,
  reinforced_shelter: reinforcedShelter, radio_relay: radioRelay,
};
