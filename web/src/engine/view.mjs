import { BUILDINGS, boundsOf, buildingMaxHP, survivorStats, clamp, has, jobOf } from './model.mjs';
import { parcelRect, parcelAt, landBounds, ownsRect, borderEdges } from './land.mjs';
import { kitArt, row, compose, rotate, spriteCanvas, outfitOf, TILE, GUNFIRE_DIRS, SURVIVOR_TYPES, ZOMBIE_TYPES } from './art.mjs';

// All world art comes from the Claude Design project via art.mjs: tileset, buildings,
// survivor and zombie walk sheets, and gunfire/molotov FX. Sprites use nearest-neighbor scaling.
const P = globalThis.PIXI;
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function texture(c) { const t = P.Texture.from(c); t.baseTexture.scaleMode = P.SCALE_MODES.NEAREST; return t; }
// One Pixi texture per kit sprite, created on first use.
const textures = new WeakMap();
const tex = sprite => { let t = textures.get(sprite); if (!t) textures.set(sprite, t = texture(spriteCanvas(sprite))); return t; };
const hash = (x, y) => { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
// Overhead bars follow the Survival HUD Kit's unit bar (ui-kit ubar_*): dark outline,
// a light top row over a dark bottom row, and the ramp picked by what is being measured.
const BAR_RAMPS = { lime: [0xcfe08e, 0x6f7d45], amber: [0xe6c874, 0x8a6a2a], red: [0xcf6a55, 0x7a2e24] };
function drawUnitBar(g, x, y, w, pct, kind) {
  const ramp = BAR_RAMPS[kind === 'zombie' || pct < .35 ? 'red' : kind === 'building' || pct < .6 ? 'amber' : 'lime'], fill = Math.round(w * pct);
  g.beginFill(0x1a1e16).drawRect(x - 1, y - 1, w + 2, 4).endFill();
  g.beginFill(0x2a2f24).drawRect(x, y, w, 1).endFill();
  if (fill > 0) { g.beginFill(ramp[0]).drawRect(x, y, fill, 1).endFill(); g.beginFill(ramp[1]).drawRect(x, y + 1, fill, 1).endFill(); }
}
// Corner brackets around a footprint, as in the HUD kit's select_* markers:
// a bright arm with a darker inner arm tucked inside it.
const darker = c => ((c >> 17 & 0x7f) << 16) | ((c >> 9 & 0x7f) << 8) | (c >> 1 & 0x7f);
function drawBrackets(g, r, color, arm = 8) {
  const corners = [[r.left, r.top, 1, 1], [r.right, r.top, -1, 1], [r.left, r.bottom, 1, -1], [r.right, r.bottom, -1, -1]];
  g.lineStyle(2, color, .95);
  for (const [x, y, dx, dy] of corners) g.moveTo(x + dx * arm, y).lineTo(x, y).lineTo(x, y + dy * arm);
  g.lineStyle(1, darker(color), .9);
  for (const [x, y, dx, dy] of corners) g.moveTo(x + dx * (arm - 1), y + dy * 2).lineTo(x + dx * 2, y + dy * 2).lineTo(x + dx * 2, y + dy * (arm - 1));
  g.lineStyle(0);
}
const around = (x, y, w, h) => ({ left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 });

// Plots are 80 units wide; each building fills its plot with kit buildings, and its
// second upgrade swaps in the larger variant.
const PLOTS = {
  core: [['town_hall'], ['town_hall']], farm: [['farm'], ['farm']], barracks: [['barracks'], ['barracks']],
  dorm: [['bunkhouse'], ['bunkhouse', 'shelter']], workshop: [['workshop', 'armory'], ['lumber_mill', 'armory']], clinic: [['clinic', 'shelter'], ['lab', 'shelter']]
};
// Buildings stand with their base 16 units below the footprint's centre.
const BASE_DROP = 16;
// Whoever is on watch stands on the tower's deck (kit row 26), 34 units above the footprint's centre.
const PERCH_RISE = 34;
const TOWER_DECK = 26;
// Wall faces (kit rows 4–27) meet the ground 8 units below the wall's centre line.
const WALL_DROP = 8;
// Fence and gate materials follow their upgrades: palisade, planks (reinforced), scrap metal (plated).
const wallMaterial = e => has(e, 'plate') ? 'scrap' : has(e, 'reinforce') ? 'planks' : 'palisade';
const artCache = new Map();
// The sprite for a building in its current state, with the anchor that puts it on its footprint.
function buildingArt(e, open = false) {
  const vertical = !!e.rotation, level = (e.upgrades?.length || 0) >= 2 ? 1 : 0;
  const key = e.type === 'barricade' ? 'wall:' + wallMaterial(e) + vertical : e.type === 'gate' ? 'gate:' + has(e, 'plate') + open + vertical : e.type + level;
  let art = artCache.get(key);
  if (art) return art;
  const T = kitArt().tiles, B = kitArt().buildings;
  if (e.type === 'barricade') {
    const m = wallMaterial(e);
    const s = vertical ? compose(16, 44, [[T['wall_' + m + '_v'], 0, 0], [T['wall_' + m + '_v'], 0, 16]]) : row([T['wall_' + m + '_h'], T['wall_' + m + '_h']]);
    art = { s, ay: vertical ? 16 / 44 : (s.h - WALL_DROP) / s.h };
  } else if (e.type === 'gate') {
    const gate = T['gate_' + (has(e, 'plate') ? 'metal' : 'wood') + '_' + (open ? 'open' : 'closed')], wall = T['wall_' + wallMaterial(e) + '_' + (vertical ? 'v' : 'h')];
    const s = vertical ? compose(28, 76, [[wall, 6, 0], [rotate(gate), 0, 16], [wall, 6, 48]]) : row([wall, gate, wall]);
    art = { s, ay: vertical ? 32 / 76 : (s.h - WALL_DROP) / s.h };
  } else if (e.type === 'tower') {
    const s = T[level ? 'tower_roofed' : 'tower_open'];
    art = { s, ay: (TOWER_DECK + PERCH_RISE) / s.h };
  } else {
    // A sprite missing from an older kit falls back to the town hall rather than breaking the map.
    const parts = PLOTS[e.type][level].map(k => B['bld_' + k]).filter(Boolean);
    const s = row(parts.length ? parts : [B.bld_town_hall], BUILDINGS[e.type].w);
    art = { s, ay: (s.h - BASE_DROP) / s.h };
  }
  art.texture = tex(art.s);
  artCache.set(key, art);
  return art;
}
// 8-way facing from a movement vector (screen y down).
const DIR8 = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
const dirOf = (dx, dy) => DIR8[((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8];
const gunDir = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / (2 * Math.PI / GUNFIRE_DIRS)) % GUNFIRE_DIRS) + GUNFIRE_DIRS) % GUNFIRE_DIRS;
// Units stand on kit row 26 of their 24×28 frames and advance a walk frame every few units travelled.
const FEET = 26 / 28, STRIDE = 5;
// Walkers include the odd soldier from the zombie sheet; the look is fixed per zombie.
const zombieSkin = z => z.kind === 'walker' && z.id % 7 === 0 ? 'soldier' : z.kind;
const TREES = [['tree_oak', 36], ['tree_oak', 36], ['tree_pine', 41]];

// Ambient grade across the day: [hour, colour, alpha, darkness]. Darkness drives lamp glow.
const SKY = [[0, 0x08101d, .5, 1], [1, 0x04070d, .56, 1], [4.5, 0x04070d, .52, 1], [6, 0xffc482, .16, .25], [8, 0xffffff, 0, 0], [17, 0xffffff, 0, 0], [18.5, 0x8c3866, .24, .35], [20, 0x08101d, .44, .9], [23, 0x08101d, .5, 1], [24, 0x08101d, .5, 1]];
function skyAt(hour) {
  const i = SKY.findIndex(k => k[0] > hour), a = SKY[i - 1], b = SKY[i], t = (hour - a[0]) / (b[0] - a[0]);
  const mix = (x, y) => Math.round(x + (y - x) * t), channel = (c, shift) => c >> shift & 255;
  // Fade toward the next colour through transparent white so dawn and dusk blend cleanly.
  const from = a[2] ? a[1] : b[1], to = b[2] ? b[1] : a[1];
  const color = mix(channel(from, 16), channel(to, 16)) << 16 | mix(channel(from, 8), channel(to, 8)) << 8 | mix(channel(from, 0), channel(to, 0));
  return { color, alpha: a[2] + (b[2] - a[2]) * t, darkness: (a[3] + (b[3] - a[3]) * t) * .43 };
}
export class View {
  constructor(game, element) {
    this.game = game;
    P.settings.SCALE_MODE = P.SCALE_MODES.NEAREST;
    this.app = new P.Application({ antialias: false, resolution: Math.min(devicePixelRatio || 1, 2), autoDensity: true, backgroundColor: 0x3a4a2f, resizeTo: window });
    element.appendChild(this.app.view);
    this.app.view.setAttribute('aria-label', 'Settlement map. Click a survivor or building to inspect it.');
    this.world = new P.Container();
    this.terrain = new P.Container();
    this.groundDetails = new P.Graphics();
    this.actors = new P.Container();
    this.actors.sortableChildren = true;
    this.selection = new P.Graphics();
    this.shots = new P.Graphics();
    this.labels = new P.Container();
    // Placement preview: the building's own sprite, tinted like the HUD kit's ghosts.
    this.ghost = new P.Sprite(P.Texture.EMPTY); this.ghost.alpha = .65; this.ghost.visible = false;
    this.fx = new P.Container();
    this.world.addChild(this.terrain, this.groundDetails, this.selection, this.actors, this.ghost, this.shots, this.fx, this.labels);
    this.app.stage.addChild(this.world);
    this.nightShade = new P.Graphics();
    this.lights = new P.Container();
    this.app.stage.addChild(this.nightShade, this.lights);
    this.sprites = new Map();
    this.art = kitArt();
    // Gunfire sprites (flash, tracer, impacts, casings) are pooled per frame.
    this.fxPool = []; this.impacts = []; this.seenShots = new WeakSet();
    this.selected = null;
    this.hovered = null;
    this.placement = null;
    this.expanding = false;
    this.pointer = { x: 0, y: 0 };
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.baseScale = 1.0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.app.renderer.resize(this.width, this.height);
    const area = landBounds(this.expanding ? [...this.game.land, ...this.game.availableLand()] : this.game.land);
    const worldWidth = 2 * Math.max(Math.abs(area.left), area.right) + (this.width < 700 ? 120 : 330);
    const worldHeight = 2 * Math.max(Math.abs(area.top), area.bottom) + 340;
    this.baseScale = Math.min(this.width / worldWidth, this.height / worldHeight, 1.5);
    this.updateTransform();
    this.landRevision = this.game.landRevision;
    this.makeTerrain();
  }
  updateTransform() {
    this.scale = this.baseScale * this.zoom;
    this.world.scale.set(this.scale);
    this.world.position.set(this.width / 2 + this.panX, this.height / 2 + (this.width < 700 ? 12 : 0) + this.panY);
    this.game.bounds = { x: this.width / 2 / this.scale, y: this.height / 2 / this.scale };
  }
  zoomBy(factor, cx, cy) {
    const oldZoom = this.zoom;
    const newZoom = clamp(oldZoom * factor, 0.6, 2.8);
    if (newZoom === oldZoom) return;
    if (cx != null && cy != null) {
      const wx = (cx - this.world.x) / (this.baseScale * oldZoom);
      const wy = (cy - this.world.y) / (this.baseScale * oldZoom);
      this.zoom = newZoom;
      this.scale = this.baseScale * newZoom;
      this.world.scale.set(this.scale);
      this.world.position.set(cx - wx * this.scale, cy - wy * this.scale);
      this.panX = this.world.x - this.width / 2;
      this.panY = this.world.y - this.height / 2;
    } else {
      this.zoom = newZoom;
      this.updateTransform();
    }
  }
  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.updateTransform();
  }
  resetCamera() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1.0;
    this.updateTransform();
  }
  focusOn(entity) {
    if (!entity) return;
    this.panX = -entity.x * this.scale;
    this.panY = -entity.y * this.scale;
    this.updateTransform();
  }
  setExpansion(enabled) { if (this.expanding !== enabled) { this.expanding = enabled; this.resize(); } }
  toWorld(x, y) { return { x: (x - this.world.x) / this.scale, y: (y - this.world.y) / this.scale }; }
  toScreen(p) { return { x: p.x * this.scale + this.world.x, y: p.y * this.scale + this.world.y }; }
  // Kit characters are about 22 units tall; aim at the middle of the body.
  hit(p) {
    for (const s of this.game.patrols) { if (s.sheltered) continue; const at = s.perch || s; if (Math.hypot(at.x - p.x, at.y - 11 - p.y) < 15) return { kind: 'survivor', id: s.id }; }
    for (const z of this.game.zombies) if (z.hp > 0 && Math.hypot(z.x - p.x, z.y - 11 - p.y) < 13) return { kind: 'zombie', id: z.id };
    for (const b of [...this.game.buildings].reverse()) { const r = boundsOf(b, 6); if (p.x >= r.left && p.x <= r.right && p.y >= r.top - 18 && p.y <= r.bottom) return { kind: 'building', id: b.id }; }
    return null;
  }
  makeTerrain() {
    this.terrain.removeChildren().forEach(child => child.destroy({ children: true }));
    this.labels.removeChildren().forEach(child => child.destroy());
    if (this.terrainTexture) this.terrainTexture.destroy(true);
    const T = this.art.tiles, tile = k => (this.tileCanvases ||= {})[k] ||= spriteCanvas(T[k]);
    // The ground is laid on the kit's 16-unit grid, which parcels and the placement grid share.
    const bx = Math.ceil((this.game.bounds.x + 60) / TILE) * TILE, by = Math.ceil((this.game.bounds.y + 60) / TILE) * TILE;
    const c = canvas(bx * 2, by * 2), ctx = c.getContext('2d');
    const rects = this.game.land.map(parcelRect);
    const owned = (x, y) => rects.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom);
    // Two roads cross at the HQ, each four tiles (64 units) wide: two 32-unit fence panels, so
    // the road edges meet panel seams and a gate spans the road exactly.
    const road = v => v >= -2 * TILE && v < 2 * TILE, roadEdge = v => v === -2 * TILE || v === TILE;
    const pick = (x, y, keys, weights) => { const h = hash(x, y); let acc = 0; for (let i = 0; i < keys.length; i++) if (h < (acc += weights[i])) return keys[i]; return keys[0]; };
    for (let y = -by; y < by; y += TILE) for (let x = -bx; x < bx; x += TILE) {
      const cx = x + TILE / 2, cy = y + TILE / 2, inside = owned(cx, cy), v = road(x), h = road(y);
      let k;
      if (v && h) k = 'road_x';
      else if (v) k = hash(x, y) < .06 ? 'road_p' : inside || !roadEdge(x) ? 'road_v' : x < 0 ? 'road_edge_w' : 'road_edge_e';
      else if (h) k = hash(x, y) < .06 ? 'road_p' : inside || !roadEdge(y) ? 'road_h' : y < 0 ? 'road_edge_n' : 'road_edge_s';
      else if (inside) k = !owned(cx, cy - TILE) ? 'edge_n' : !owned(cx, cy + TILE) ? 'edge_s' : !owned(cx - TILE, cy) ? 'edge_w' : !owned(cx + TILE, cy) ? 'edge_e' : pick(x, y, ['dirt_a', 'dirt_b', 'dirt_c'], [.6, .25, .15]);
      else k = pick(x, y, ['grass_a', 'grass_b', 'grass_c'], [.6, .25, .15]);
      ctx.drawImage(tile(k), x + bx, y + by);
    }
    // Bushes and stumps dot the open ground outside the fence, clear of the roads.
    const rand = seeded(42390);
    for (let i = 0; i < 90; i++) {
      const x = Math.round((rand() - .5) * bx * 2), y = Math.round((rand() - .5) * by * 2), k = rand() < .7 ? 'bush' : 'stump';
      if (Math.abs(x) < 44 || Math.abs(y) < 44 || ownsRect(this.game.land, { left: x - 24, right: x + 24, top: y - 24, bottom: y + 24 })) continue;
      ctx.drawImage(tile(k), x + bx - 8, y + by - 12);
    }
    this.terrainTexture = texture(c);
    const bg = new P.Sprite(this.terrainTexture); bg.position.set(-bx, -by); this.terrain.addChild(bg);
    // Trees stand among the actors, depth-sorted by their base, so the dead pass behind them too.
    for (const item of this.treeSprites || []) item.sprite.destroy();
    this.treeSprites = this.game.forest.trees.map(t => {
      // Some oaks are dead; the second oak kind is mirrored for variety.
      const [key, base] = t.kind === 0 && hash(t.x, t.y) < .12 ? ['tree_dead', 34] : TREES[t.kind], s = this.art.tiles[key];
      const sprite = new P.Sprite(tex(s)); sprite.anchor.set(.5, base / s.h); sprite.position.set(t.x, t.y); sprite.scale.set(t.scale * (t.kind === 1 ? -1 : 1), t.scale); sprite.alpha = t.alpha;
      sprite.zIndex = t.y + 15; this.actors.addChild(sprite);
      return { sprite, tree: t, height: base * t.scale, halfWidth: s.w * .4 * t.scale };
    });
    // The camp's fire burns just south of the HQ, animated from the molotov fire loop.
    if (!this.campfire) {
      const f = this.art.molotov.fire[0]; this.campfire = new P.Sprite(tex(f)); this.campfire.anchor.set(this.art.fireAnchor[0] / f.w, this.art.fireAnchor[1] / f.h);
      this.campfire.position.set(34, 77); this.campfire.scale.set(.5); this.campfire.zIndex = 77; this.actors.addChild(this.campfire);
    }
    const styles = { fontFamily: 'Silkscreen, Courier New', fontSize: 8, fill: 0xd6d8c6, letterSpacing: 2, dropShadow: true, dropShadowColor: 0x1a1e16, dropShadowDistance: 1 };
    const area = this.game.territory;
    for (const [text, x, y] of [['NORTH', 0, area.top - 24], ['SOUTH', 0, area.bottom + 24], ['WEST', area.left - 32, 0], ['EAST', area.right + 32, 0]]) {
      const label = new P.Text(text, styles); label.anchor.set(.5); label.position.set(x, y); label.alpha = .65; this.labels.addChild(label);
    }
    const refuge = new P.Text('REFUGE 01', { ...styles, fontSize: 8, letterSpacing: 4, fill: 0xc4c69e }); refuge.anchor.set(.5); refuge.position.set(0, 91); refuge.alpha = .7; this.labels.addChild(refuge);
    const location = new P.Text('THE OUTSKIRTS  /  SECTOR 04', { ...styles, fontSize: 8, letterSpacing: 2, fill: 0xb2bd9a }); location.anchor.set(.5); location.position.set(0, -this.game.bounds.y + 30); this.labels.addChild(location);
    if (this.expanding) for (const p of this.game.availableLand()) {
      const r = parcelRect(p), label = new P.Text('+ CLAIM LAND', { ...styles, fontSize: 12, fill: 0xe1e8bf, letterSpacing: 1 });
      label.anchor.set(.5); label.position.set((r.left + r.right) / 2, (r.top + r.bottom) / 2); this.labels.addChild(label);
    }
  }
  spriteFor(entity, kind) {
    let item = this.sprites.get(entity.id);
    // A new run reuses ids, so a cached sprite may belong to something else (e.g. a labelled building).
    if (item && (item.kind !== kind || item.type !== entity.type)) { item.container.destroy({ children: true }); this.sprites.delete(entity.id); item = null; }
    if (!item) {
      const container = new P.Container();
      const shadow = new P.Graphics();
      const sprite = new P.Sprite(P.Texture.WHITE);
      const health = new P.Graphics();
      container.addChild(shadow, sprite, health);
      this.actors.addChild(container);
      item = { container, sprite, shadow, health, kind, type: entity.type };
      this.sprites.set(entity.id, item);
      if (kind === 'building' && !['barricade', 'gate', 'tower'].includes(entity.type)) {
        const name = new P.Text(BUILDINGS[entity.type].name.toUpperCase(), { fontFamily: 'Silkscreen, Courier New', fontSize: 8, fill: 0xd6d8c6, letterSpacing: 1, dropShadow: true, dropShadowColor: 0x1a1e16, dropShadowDistance: 1 });
        name.anchor.set(.5); name.y = BASE_DROP + 8; container.addChild(name); item.name = name;
      }
    }
    return item;
  }
  drawEntity(entity, kind, time) {
    const item = this.spriteFor(entity, kind), { container, sprite, shadow, health } = item;
    // Whoever is up on a watchtower stands on its platform, drawn just in front of it.
    const at = entity.perch || entity;
    container.position.set(Math.round(at.x), Math.round(at.y)); container.zIndex = entity.perch ? entity.perch.y + 45 : entity.y + (kind === 'building' ? 5 : 15);
    shadow.clear(); health.clear();
    sprite.tint = 0xffffff; sprite.rotation = 0; sprite.scale.set(1);
    let maxHP, barWidth, barY;
    if (kind === 'building') {
      maxHP = buildingMaxHP(entity); barWidth = entity.type === 'barricade' ? 24 : 48;
      if (entity.type === 'gate') {
        // Swings open while one of your people is passing through, then shuts behind them.
        const g = this.game, bound = s => s.arriving || g.outside(s) || s.path.some(p => g.outside(p));
        const passing = g.patrols.some(s => { const d = Math.hypot(s.x - entity.x, s.y - entity.y); return !s.sheltered && (d < 24 || (d < 44 && bound(s))); });
        item.open = clamp((item.open || 0) + (passing ? .12 : -.05), 0, 1);
      }
      const art = buildingArt(entity, item.open > .5);
      sprite.texture = art.texture; sprite.anchor.set(.5, art.ay);
      barY = -Math.round(art.ay * art.s.h) - 6;
    } else {
      const isZombie = kind === 'zombie';
      maxHP = isZombie ? entity.maxHP : survivorStats(entity).hp; barWidth = 19; barY = -38;
      const skin = isZombie ? zombieSkin(entity) : outfitOf(jobOf(entity), entity.look);
      const frames = isZombie ? this.art.zombies[skin] : this.art.survivors[skin], pace = (isZombie ? ZOMBIE_TYPES : SURVIVOR_TYPES)[skin].fps;
      // Facing and the walk cycle come from how far the unit moved since the last frame.
      const dx = at.x - (item.px ?? at.x), dy = at.y - (item.py ?? at.y), moved = Math.hypot(dx, dy);
      item.px = at.x; item.py = at.y;
      if (moved > .05 && moved < 20) { item.dir = dirOf(dx, dy); item.walk = (item.walk || 0) + moved * pace / STRIDE; }
      else if (entity.fighting && entity.facing) item.dir = entity.facing < 0 ? 'w' : 'e';
      const frame = moved > .05 ? Math.floor(item.walk || 0) % 4 : 0;
      sprite.texture = tex(frames[item.dir || 's'][frame]); sprite.anchor.set(.5, FEET);
      // Downed survivors lie on their side, greyed out, until someone stabilizes them.
      if (!isZombie && entity.condition === 'downed') { sprite.rotation = Math.PI / 2; sprite.tint = 0x9a8f86; }
      if (!isZombie) { shadow.y = -6; this.drawRoleMark(shadow, entity); }
    }
    const selected = this.selected?.id === entity.id || this.hovered?.id === entity.id;
    if (kind === 'survivor' && entity.condition === 'downed') {
      const blink = Math.floor(time * 3) % 2 ? .95 : .45;
      health.beginFill(0xd98568, blink).drawRect(-1, -22, 3, 7).drawRect(-3, -20, 7, 3).endFill();
    } else if (entity.hp < maxHP * .99 || selected) {
      drawUnitBar(health, -barWidth / 2, barY, barWidth, clamp(entity.hp / maxHP, 0, 1), kind);
    }
  }
  // A tiny pixel badge over each survivor shows their job at a glance.
  drawRoleMark(g, s) {
    const color = { medic: 0xe08a84, engineer: 0xe0a860, guard: 0x9fb7c9, sentry: 0xe6d98f, farmer: 0xafc879, scavenger: 0xc9a9e0 }[s.role];
    if (s.condition === 'downed') return;
    if (s.perch) g.clear(); // No ground shadow while up on the tower.
    if (!color) { g.beginFill(s.fighting ? 0xd6ae68 : 0xc0cf86, .9).drawRect(-2, -24, 4, 2).endFill(); return; }
    g.beginFill(0x1a241a, .8).drawRect(-3, -28, 7, 7).endFill();
    g.beginFill(s.fighting ? 0xd6ae68 : color);
    if (s.role === 'medic') g.drawRect(-1, -27, 3, 5).drawRect(-2, -26, 5, 3);
    else if (s.role === 'engineer') g.drawRect(-2, -27, 2, 5).drawRect(0, -25, 3, 2);
    else if (s.role === 'guard') g.drawRect(-2, -27, 5, 2).drawRect(-2, -24, 5, 2);
    else if (s.role === 'farmer') g.drawRect(0, -27, 1, 5).drawRect(-2, -26, 2, 2).drawRect(1, -25, 2, 2);
    else if (s.role === 'scavenger') g.drawRect(-2, -24, 5, 2).drawRect(1, -27, 2, 3);
    else g.drawRect(0, -27, 1, 1).drawRect(-1, -26, 3, 1).drawRect(-2, -25, 5, 2);
    g.endFill();
  }
  // Kit gunfire for each shot: muzzle flash and tracer while the model's shot lives, then a
  // blood impact and an ejected casing that play out on their own for a moment.
  drawGunfire(time) {
    const G = this.art.gunfire;
    let used = 0;
    const put = (sprite, x, y, alpha = 1, rotation = 0) => {
      let s = this.fxPool[used++];
      if (!s) { s = new P.Sprite(); s.anchor.set(.5); this.fx.addChild(s); this.fxPool.push(s); }
      s.visible = true; s.texture = tex(sprite); s.position.set(x, y); s.alpha = alpha; s.rotation = rotation;
    };
    for (const e of this.game.effects) {
      if (e.type !== 'shot') continue;
      const t = 1 - e.life / e.maxLife, dx = e.tx - e.x, dy = e.ty - e.y, len = Math.hypot(dx, dy) || 1, d = gunDir(dx, dy);
      put(G.flash[d][Math.min(2, Math.floor(t * 3))], e.x + dx / len * 6, e.y + dy / len * 6);
      put(G.tracer[d][Math.floor(t * 4) % 2], e.x + dx * t, e.y + dy * t);
      if (!this.seenShots.has(e)) {
        this.seenShots.add(e);
        this.impacts.push({ kind: 'blood', d, x: e.tx, y: e.ty, age: 0 }, { kind: 'casing', x: e.x, y: e.y, vx: -dy / len * 14 - dx / len * 4, age: 0 });
      }
    }
    const dt = Math.min(.1, time - (this.fxTime ?? time)); this.fxTime = time;
    this.impacts = this.impacts.filter(fx => (fx.age += dt) < (fx.kind === 'blood' ? .32 : .5));
    for (const fx of this.impacts) {
      if (fx.kind === 'blood') put(G.blood[fx.d][Math.min(3, Math.floor(fx.age / .08))], fx.x, fx.y);
      else put(G.casing[Math.floor(fx.age * 16) % 4], fx.x + fx.vx * fx.age, fx.y - 30 * fx.age + 60 * fx.age * fx.age, 1 - fx.age * 1.6);
    }
    for (let i = used; i < this.fxPool.length; i++) this.fxPool[i].visible = false;
  }
  drawSelection() {
    const g = this.selection; g.clear(); this.ghost.visible = false;
    const selected = this.selected || this.hovered;
    if (selected) {
      const e = (selected.kind === 'building' ? this.game.buildings : selected.kind === 'zombie' ? this.game.zombies : this.game.survivors).find(e => e.id === selected.id);
      if (e && selected.kind === 'zombie') {
        drawBrackets(g, around(e.x, e.y, 28, 18), 0xe0674f, 6);
        for (const s of this.game.survivors) if (s.order?.zombieId === e.id && !s.expedition) g.lineStyle(1, 0xd98568, .35).moveTo(s.x, s.y).lineTo(e.x, e.y);
      } else if (e && !e.expedition && !e.sheltered) {
        if (selected.kind === 'building') {
          const r = boundsOf(e, 4); g.lineStyle(0).beginFill(0xc5d48a, .08).drawRect(r.left, r.top, r.right - r.left, r.bottom - r.top).endFill(); drawBrackets(g, r, 0xc5d48a);
          if (e.type === 'tower') g.lineStyle(1, 0xc7d68b, .18).drawCircle(e.x, e.y, 155 + (has(e, 'scope') ? 45 : 0) + (has(e, 'spotlight') ? 55 : 0));
        } else {
          const at = e.perch || e;
          drawBrackets(g, around(at.x, at.y, 28, 18), 0xc5d48a, 6);
          if (this.selected) {
            g.lineStyle(1, 0xc7d68b, .13).drawCircle(at.x, at.y, this.game.statsOf(e).range);
            const route = e.role === 'patrol' || e.role === 'guard' || !e.role ? this.game.route(e) : [];
            // The whole lane is a loop; a side's stretch is walked there and back.
            for (let i = 0; i < route.length - (route === this.game.routes.any ? 0 : 1); i++) {
              const p = route[i], q = route[(i + 1) % route.length], length = Math.hypot(q.x - p.x, q.y - p.y);
              for (let d = 0; d < length; d += 10) { const t = d / length; g.lineStyle(0).beginFill(0xd5dba0, .45).drawRect(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t, 3, 2).endFill(); }
            }
          }
        }
      }
    }
    if (this.placement) {
      const { type } = this.placement, { x, y, rotation } = this.game.snapPlacement(type, Math.round(this.pointer.x / 16) * 16, Math.round(this.pointer.y / 16) * 16, this.placement.rotation);
      const valid = this.game.canPlace(type, x, y, rotation).ok;
      g.lineStyle(1, 0xc1cf88, .12);
      for (const parcel of this.game.land) {
        const r = parcelRect(parcel);
        for (let gx = r.left; gx <= r.right; gx += 16) { g.moveTo(gx, r.top); g.lineTo(gx, r.bottom); }
        for (let gy = r.top; gy <= r.bottom; gy += 16) { g.moveTo(r.left, gy); g.lineTo(r.right, gy); }
      }
      for (const e of borderEdges(this.game.land)) g.lineStyle(2, 0xc1cf88, .8).moveTo(e.x1, e.y1).lineTo(e.x2, e.y2);
      const r = boundsOf({ type, x, y, rotation });
      const color = valid ? 0xb7e07a : 0xe0674f, art = buildingArt({ type, rotation, upgrades: [] });
      g.lineStyle(0).beginFill(color, .12).drawRect(r.left, r.top, r.right - r.left, r.bottom - r.top).endFill();
      drawBrackets(g, r, color);
      Object.assign(this.ghost, { texture: art.texture, visible: true, tint: color });
      this.ghost.anchor.set(.5, art.ay); this.ghost.position.set(x, y);
    }
    if (this.expanding) {
      const hovered = parcelAt(this.pointer);
      for (const p of this.game.land) { const r = parcelRect(p); g.lineStyle(1, 0xc7d691, .5).beginFill(0xc7d691, .05).drawRect(r.left + 2, r.top + 2, r.right - r.left - 4, r.bottom - r.top - 4).endFill(); }
      for (const p of this.game.availableLand()) {
        const r = parcelRect(p), color = this.game.afford(this.game.landCost) ? 0xcfe1a1 : 0xd3aa73, hover = p.col === hovered.col && p.row === hovered.row;
        g.lineStyle(hover ? 3 : 1, color, .85).beginFill(color, hover ? .25 : .1).drawRect(r.left + 4, r.top + 4, r.right - r.left - 8, r.bottom - r.top - 8).endFill();
      }
    }
  }
  draw(time) {
    if (this.landRevision !== this.game.landRevision) this.resize();
    const alive = new Set();
    for (const [kind, entities] of [['building', this.game.buildings], ['survivor', this.game.patrols.filter(s => !s.sheltered)], ['zombie', this.game.zombies]]) {
      for (const e of entities) { alive.add(e.id); this.drawEntity(e, kind, time); }
    }
    for (const [id, item] of this.sprites) if (!alive.has(id)) { item.container.destroy({ children: true }); this.sprites.delete(id); }
    // A canopy thins out while someone is behind it, so nobody is lost from view.
    const hidden = new Set();
    for (const e of [...this.game.zombies, ...this.game.patrols]) {
      if (e.sheltered || e.perch) continue;
      for (const { tree: t, height, halfWidth } of this.treeSprites) if (e.y < t.y && e.y > t.y - height && Math.abs(e.x - t.x) < halfWidth) hidden.add(t);
    }
    for (const { sprite, tree } of this.treeSprites) sprite.alpha += ((hidden.has(tree) ? .45 : tree.alpha) - sprite.alpha) * .2;
    this.drawSelection();
    this.shots.clear();
    this.drawGunfire(time);
    for (const e of this.game.effects) {
      if (e.type === 'heal') { const a = e.life / e.maxLife, y = e.y - (1 - a) * 10; this.shots.lineStyle(0).beginFill(0x8fe08a, a).drawRect(e.x - 1, y - 3, 3, 7).drawRect(e.x - 3, y - 1, 7, 3).endFill(); }
      else if (e.type === 'repair') { const a = e.life / e.maxLife, spread = (1 - a) * 6; this.shots.lineStyle(0).beginFill(0xffd27a, a).drawRect(e.x - spread, e.y - spread, 2, 2).drawRect(e.x + spread, e.y - spread * .6, 2, 2).drawRect(e.x, e.y - spread * 1.3, 1, 1).endFill(); }
      else if (e.type === 'death') this.shots.lineStyle(0).beginFill(0x5e2218, Math.min(.6, e.life)).drawRect(e.x - 7, e.y - 2, 14, 5).endFill().beginFill(0x3e1410, Math.min(.6, e.life)).drawRect(e.x - 4, e.y - 1, 8, 3).endFill();
    }
    if (this.campfire) this.campfire.texture = tex(this.art.molotov.fire[Math.floor(time * 10) % this.art.molotov.fire.length]);
    const { color, alpha, darkness } = skyAt(this.game.hour);
    this.nightShade.clear().beginFill(color, alpha).drawRect(0, 0, this.width, this.height).endFill();
    if (!this.lampGraphic) { this.lampGraphic = new P.Graphics(); this.lights.addChild(this.lampGraphic); }
    const lamps = this.lampGraphic; lamps.clear();
    for (const b of this.game.buildings) {
      if (!['core', 'dorm', 'barracks'].includes(b.type) && !(b.type === 'tower' && b.staffed)) continue;
      const p = this.toScreen({ x: b.x, y: b.y + 20 });
      if (darkness > .03) for (let r = 55; r >= 12; r -= 7) lamps.beginFill(0xe1b966, darkness * .021).drawCircle(p.x, p.y, r * this.scale).endFill();
    }
    // The campfire glows after dark.
    const fire = this.toScreen({ x: 34, y: 72 });
    if (darkness > .03) for (let r = 30; r >= 8; r -= 6) lamps.beginFill(0xf0b363, darkness * .03).drawCircle(fire.x, fire.y, r * this.scale).endFill();
  }
}
