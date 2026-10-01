// Port of Assets/Afterlife/Scripts/WorldView.cs to Pixi. It draws the Unity build's baked atlas
// (web/public/unity/AfterlifeAtlas.*) at one world unit per pixel. Unity's y-up world is replaced by
// simulation coordinates (y down) throughout, and Unity sorting orders become zIndex values.
import { SurvivalLighting } from './lighting.js';
import { buildCampArt } from './campArt.js';
import { CAMP_ART } from '../engine/camp.mjs';
import { BUILDINGS } from '../engine/data.mjs';
import { wallTiles } from '../engine/walls.mjs';

const P = globalThis.PIXI;
const ASSETS = 'unity/';
// A new run opens on the camp with the woods and roads round it in view: about 70% of the 3 × 3
// parcels (and margin) that fit() frames. Lower is closer.
export const DEFAULT_TACTICAL_ZOOM = 0.7;
export const MIN_ZOOM = 0.18;
export const MAX_ZOOM = 4.0;
const DIRS = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
// Flashlight rotation per facing, in Unity degrees (counter-clockwise, y up).
const FLASH_ANGLE = { e: 0, se: -45, s: -90, sw: -135, w: 180, nw: 135, n: 90, ne: 45 };
const GHOST_KEYS = ['armory', 'barracks', 'bunkhouse', 'clinic', 'farm', 'lab', 'lumber_mill', 'shelter', 'storage', 'tower', 'town_hall', 'wall', 'workshop',
  'tent', 'campfire', 'supply_stash', 'garden_plot', 'field_workbench', 'aid_station', 'lookout_post', 'guard_post', 'radio_kit', 'makeshift_shelter', 'salvage_pile', 'operations_board', 'salvage_yard', 'storage_depot', 'field_farm', 'field_clinic', 'watchtower', 'reinforced_shelter', 'radio_relay'];
const CAMP_DEPTH = { 'camp/operations_board': 32, 'camp/salvage_yard': 64, 'camp/storage_depot': 64, 'camp/field_farm': 96, 'camp/field_clinic': 64, 'camp/watchtower': 48, 'camp/reinforced_shelter': 80, 'camp/radio_relay': 48 };
const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
const clamp01 = t => Math.min(1, Math.max(0, t));
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const rgb = (r, g, b) => (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);

function hash(x, y) {
  let n = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
  return (n ^ (n >>> 16)) >>> 0;
}
const noise = (x, y) => hash(x, y) / 4294967296;
const seasonSuffix = season => (!season || season === 'summer' ? '' : '_' + season);
const hex = c => parseInt(c.slice(1), 16);
const loadImage = src => new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Could not load ' + src)); img.src = src; });

// Wall tiles are 16 x 28: a 16-unit cell with the wall rising 12 above it.
const WALL_HALF = 8, WALL_RISE = 12;
const wallPanel = e => ({ id: e.id, x: e.x, y: e.y, rotation: e.height > e.width ? 1 : 0 });

export function buildingFootprint(type, rotation) {
  switch (type) {
    case 'core': case 'town_hall': case 'farm': case 'dorm': case 'bunkhouse': case 'workshop': case 'clinic': case 'barracks': return [80, 64];
    case 'tower': case 'shelter': case 'armory': return [32, 32];
    case 'lumber_mill': return [48, 32];
    case 'storage': case 'lab': return [48, 48];
    case 'barricade': return rotation ? [16, 32] : [32, 16];
    case 'gate': return rotation ? [16, 64] : [64, 16];
    default: return BUILDINGS[type] ? [BUILDINGS[type].w, BUILDINGS[type].h] : [32, 32];
  }
}

export class WorldView {
  constructor(element, audio) {
    this.audio = audio;
    P.settings.SCALE_MODE = P.SCALE_MODES.NEAREST;
    P.settings.ROUND_PIXELS = true;
    this.app = new P.Application({ antialias: false, resolution: Math.min(globalThis.devicePixelRatio || 1, 2), autoDensity: true, backgroundColor: rgb(.2, .27, .17), resizeTo: window });
    // Pixi's accessibility overlay switches on with Tab and scrolls the page; Tab is the tablet's key.
    this.app.renderer.plugins.accessibility?.destroy();
    this.canvas = this.app.view;
    this.canvas.setAttribute('aria-label', 'Settlement map. Click a survivor or building to inspect it.');
    element.appendChild(this.canvas);

    this.baseOrthographicSize = 458;
    this.currentZoom = this.targetZoom = DEFAULT_TACTICAL_ZOOM;
    this.cam = { x: 0, y: 0 };
    this.targetCam = { x: 0, y: 0 };
    this.followTargetId = -1;
    this.selected = -1;
    this.terrain = null;
    this.frame = null;
    this.frameAt = 0;
    this.width = this.height = 0;
    this.revision = -1;
    this.expanding = false;
    this.currentSeason = 'summer';
    this.lastPhase = '';
    this.lastShotSfx = this.lastHitSfx = this.lastBashSfx = -1;
    this.dt = 1 / 60;
    this.now = 0;

    this.actors = new Map();
    this.trees = [];
    this.decor = [];
    this.treeSprites = new Map();
    this.campPile = null;
    this.hoverTree = null;
    this.floatTexts = [];
    this.worldBuildings = [];
    this.poiBadges = [];
    this.effects = [];
    this.impacts = [];
    this.seenShots = new Set();
    this.characterPositions = [];

    this.lighting = new SurvivalLighting();
    this.root = new P.Container();
    this.lit = new P.Container();
    this.lit.sortableChildren = true;
    this.lit.filters = [this.lighting.filter];
    this.lit.filterArea = this.app.screen;
    this.unlit = new P.Container();
    this.unlit.sortableChildren = true;
    this.root.addChild(this.lit, this.unlit);
    this.app.stage.addChild(this.root);
  }

  async load() {
    // The Unity build's atlas, and beside it the web's own sheet of the World Generator v3 art the Unity
    // atlas lacks (water, shores, bridges, new ground and buildings: tools/bakeWorldArt.mjs).
    const [manifest, atlas, worldManifest, worldAtlas] = await Promise.all([fetch(ASSETS + 'AfterlifeAtlas.json').then(r => r.json()), loadImage(ASSETS + 'AfterlifeAtlas.png'),
      fetch('world/WorldAtlas.json').then(r => r.json()), loadImage('world/WorldAtlas.png')]);
    this.atlasImage = atlas;
    this.atlas = P.BaseTexture.from(atlas, { scaleMode: P.SCALE_MODES.NEAREST });
    this.sheets = [{ image: atlas, base: this.atlas }, { image: worldAtlas, base: P.BaseTexture.from(worldAtlas, { scaleMode: P.SCALE_MODES.NEAREST }) }];
    this.fireAnchor = manifest.fireAnchor;
    this.entries = new Map([...worldManifest.entries.map(e => [e.key, { ...e, sheet: 1 }]), ...manifest.entries.map(e => [e.key, { ...e, sheet: 0 }])]);
    this.textures = new Map();
    this.uiTextures = new Map();
    await Promise.all([...GHOST_KEYS.flatMap(k => [`ghost_${k}_ok`, `ghost_${k}_bad`]), 'badge_star', 'badge_check'].map(name => this.loadUiTexture(name)));
    this.ground = this.make(-30000);
    this.fire = this.make(92);
    this.ghost = this.make(29000, false);
    this.ghost.visible = false;
    // A barricade's preview is its two wall cells, tiled as they would join the walls around them.
    this.ghostCells = [this.make(29000, false), this.make(29000, false)];
    for (const c of this.ghostCells) c.visible = false;
    // The starter camp: the supply cache art, the campfire's night glow and the felling overlay.
    this.campCanvases = buildCampArt();
    this.campGlow = this.make(29001, false);
    this.campGlow.visible = false;
    this.harvestMarks = new P.Graphics();
    this.harvestMarks.zIndex = 29400;
    this.unlit.addChild(this.harvestMarks);
    this.brackets = new P.Graphics();
    this.brackets.zIndex = 30000;
    this.targetLines = new P.Graphics();
    this.targetLines.zIndex = 29500;
    this.unlit.addChild(this.brackets, this.targetLines);
  }

  async loadUiTexture(name) {
    try {
      const image = await loadImage(`${ASSETS}UI/${name}.png`);
      this.uiTextures.set(name, P.Texture.from(image, { scaleMode: P.SCALE_MODES.NEAREST }));
    } catch { /* Missing UI art falls back to the atlas sprite. */ }
  }

  make(order, lit = true, parent = null) {
    const sprite = new P.Sprite(P.Texture.EMPTY);
    sprite.zIndex = order;
    (parent || (lit ? this.lit : this.unlit)).addChild(sprite);
    return sprite;
  }

  // Unity pivots are bottom-up; Pixi anchors are top-down.
  getTexture(key) {
    let cached = this.textures.get(key);
    if (cached !== undefined) return cached;
    const e = this.entries.get(key);
    if (!e) { this.textures.set(key, null); return null; }
    let anchor = [e.ax, e.ay];
    if (key.startsWith('plots/tower')) anchor = [0.5, 1 - 16 / e.h];
    // An upright gate stands on the bottom of its 64-deep footprint, as the wall tiles beside it do.
    if (/^plots\/gate\/[^/]+\/1\//.test(key)) anchor = [0.5, 1 - 32 / e.h];
    if (key.startsWith('survivors/') || key.startsWith('zombies/') || key.startsWith('burning/')) anchor = [0.5, 1 - 2 / 28];
    if (key.startsWith('gunfire/')) anchor = [0.5, 0.5];
    if (key.startsWith('molotov/fire/')) anchor = [this.fireAnchor?.length > 0 ? this.fireAnchor[0] / e.w : 0.5, this.fireAnchor?.length > 1 ? this.fireAnchor[1] / e.h : 0.5];
    if (key.startsWith('decor/')) anchor = [0.5, 1];
    if (key.startsWith('world/')) anchor = [0, 1];
    if (key === 'lights/light_flashlight_e') anchor = [12 / e.w, 28.5 / e.h];
    if (key === 'lights/light_torch') anchor = [0.5, 0.5];
    cached = { texture: new P.Texture(this.sheets[e.sheet].base, new P.Rectangle(e.x, e.y, e.w, e.h)), anchor, w: e.w, h: e.h };
    this.textures.set(key, cached);
    return cached;
  }

  setSprite(sprite, key) {
    const t = typeof key === 'string' ? this.getTexture(key) : key;
    sprite.texture = t ? t.texture : P.Texture.EMPTY;
    if (t) sprite.anchor.set(t.anchor[0], t.anchor[1]);
    sprite.art = t;
    return !!t;
  }

  // camp/* keys: the camp fixtures, standing on the bottom of their 16-unit-deep footprint.
  getCampTexture(key, season) {
    const sf = seasonSuffix(season), cacheKey = key + '|' + (sf || 'summer');
    let cached = this.textures.get(cacheKey);
    if (cached !== undefined) return cached;
    const art = CAMP_ART[key], canvas = art && (this.campCanvases[art + sf] || this.campCanvases[art]);
    const e = !canvas && art && (this.entries.get(art + sf) || this.entries.get(art));
    const texture = canvas ? P.Texture.from(canvas, { scaleMode: P.SCALE_MODES.NEAREST }) : e ? new P.Texture(this.sheets[e.sheet].base, new P.Rectangle(e.x, e.y, e.w, e.h)) : null;
    const h = canvas ? canvas.height : e?.h, w = canvas ? canvas.width : e?.w;
    // Phase 1 footprints are 16 deep; the Phase 2 ones stand on the bottom of their own.
    cached = texture ? { texture, anchor: [0.5, 1 - (CAMP_DEPTH[key] || 16) / 2 / h], w, h } : null;
    this.textures.set(cacheKey, cached);
    return cached;
  }

  getSeasonal(key, season) {
    if (key?.startsWith('camp/')) return this.getCampTexture(key, season);
    const sf = seasonSuffix(season);
    if (sf && this.entries.has(key + sf)) return this.getTexture(key + sf);
    return this.getTexture(key);
  }

  getWalk(base, dir, walkFrame) {
    return this.getTexture(`${base}/${dir}/${walkFrame}`) || this.getTexture(base + '/s/0');
  }

  // ---- Camera ---------------------------------------------------------------------------------
  get aspect() { return this.app.screen.width / Math.max(1, this.app.screen.height); }
  get bounds() { return { x: this.baseOrthographicSize * this.aspect, y: this.baseOrthographicSize }; }
  get orthographicSize() { return this.baseOrthographicSize * this.currentZoom; }
  get scale() { return this.app.screen.height / (2 * this.orthographicSize); }

  fit(state, expand) {
    const w = this.app.screen.width, h = this.app.screen.height;
    if (this.revision === state.landRevision && this.width === w && this.height === h && this.expanding === expand) return false;
    this.revision = state.landRevision; this.width = w; this.height = h; this.expanding = expand;
    // Frame the claimed land, and never less than the 3 × 3 parcels round the camp: a new camp owns only
    // the parcel under its fire, which alone would fill the screen.
    const t = state.territory, halfW = Math.max(384, Math.abs(t.left), t.right), halfH = Math.max(288, Math.abs(t.top), t.bottom);
    const worldW = 2 * halfW + (expand ? 520 : 330);
    const worldH = 2 * halfH + (expand ? 500 : 340);
    this.baseOrthographicSize = Math.max(worldH / 2, worldW / this.aspect / 2);
    return true;
  }

  // Deltas are in world units, y down, scaled by the current zoom like Unity's PanCamera.
  panCamera(dx, dy) {
    this.followTargetId = -1;
    const panScale = this.orthographicSize / this.baseOrthographicSize;
    this.targetCam.x += dx * panScale;
    this.targetCam.y += dy * panScale;
    this.clampCamera();
  }

  // Pans by a screen-pixel drag so the ground stays under the cursor.
  dragCamera(dxPixels, dyPixels) {
    this.followTargetId = -1;
    this.targetCam.x -= dxPixels / this.scale;
    this.targetCam.y -= dyPixels / this.scale;
    this.cam.x = this.targetCam.x; this.cam.y = this.targetCam.y;
    this.clampCamera();
  }

  zoomCamera(zoomDelta, screenPos = null) {
    const prev = this.targetZoom;
    this.targetZoom = clamp(this.targetZoom - zoomDelta, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(prev - this.targetZoom) < 1e-6) return;
    if (screenPos && this.followTargetId < 0) {
      const vx = (screenPos.x / this.app.screen.width - 0.5) * 2 * this.aspect;
      const vy = (screenPos.y / this.app.screen.height - 0.5) * 2;
      const deltaSize = (prev - this.targetZoom) * this.baseOrthographicSize;
      this.targetCam.x += vx * deltaSize;
      this.targetCam.y += vy * deltaSize;
    }
    this.clampCamera();
  }

  focusOn(pos) {
    this.followTargetId = -1;
    this.targetCam = { x: pos.x, y: pos.y };
    this.targetZoom = DEFAULT_TACTICAL_ZOOM;
    this.clampCamera();
  }

  follow(id) {
    this.followTargetId = id;
    const actor = this.actors.get(id);
    const ent = actor ? null : this.frame?.entities?.find(e => e.id === id);
    const pos = actor ? actor.target : ent ? { x: ent.x, y: ent.y } : null;
    if (pos) {
      this.targetCam = { x: pos.x, y: pos.y };
      this.targetZoom = DEFAULT_TACTICAL_ZOOM;
      this.clampCamera();
    }
  }

  clearFollow() { this.followTargetId = -1; }

  resetCamera() {
    this.followTargetId = -1;
    this.targetZoom = DEFAULT_TACTICAL_ZOOM;
    this.targetCam = { x: 0, y: 0 };
    this.clampCamera();
  }

  clampCamera() {
    if (!this.frame) return;
    let minX, maxX, minY, maxY;
    if (this.terrain && this.terrain.mapWidth > 0 && this.terrain.mapHeight > 0) {
      const mapW = this.terrain.mapWidth * 16, mapH = this.terrain.mapHeight * 16;
      const left = -this.terrain.originX, right = left + mapW;
      const top = -this.terrain.originY, bottom = top + mapH;
      const margin = 120;
      minX = left - margin;
      maxX = right + margin;
      minY = top - margin;
      maxY = bottom + margin;
    } else {
      const t = this.frame.territory;
      maxX = Math.max(Math.abs(t.left), t.right) + 350;
      maxY = Math.max(Math.abs(t.top), t.bottom) + 350;
      minX = -maxX;
      minY = -maxY;
    }
    this.targetCam.x = clamp(this.targetCam.x, minX, maxX);
    this.targetCam.y = clamp(this.targetCam.y, minY, maxY);
  }

  pointerWorld(screen) {
    return { x: this.cam.x + (screen.x - this.app.screen.width / 2) / this.scale, y: this.cam.y + (screen.y - this.app.screen.height / 2) / this.scale };
  }

  // ---- Terrain --------------------------------------------------------------------------------
  destroyAll(list) { for (const s of list) s.destroy(); list.length = 0; }

  // Land mode: each parcel that can be claimed gets a faint wash, a dashed edge and corner brackets,
  // drawn under the trees and props so it reads as a marked plot rather than discoloured ground. The
  // parcel under the pointer is brighter (hoverClaim).
  drawClaims(data) {
    this.claimFrontier = this.expanding ? data.frontier || [] : [];
    if (!this.claimMarks) { this.claimMarks = new P.Graphics(); this.claimMarks.zIndex = -29000; this.lit.addChild(this.claimMarks); }
    this.renderClaims();
  }
  hoverClaim(point) {
    const hit = point && this.claimFrontier?.find(p => Math.abs(point.x - p.col * 256) < 128 && Math.abs(point.y - p.row * 192) < 96);
    const key = hit ? hit.col + ',' + hit.row : '';
    if (key !== this.claimHover) { this.claimHover = key; this.renderClaims(); }
  }
  renderClaims() {
    const g = this.claimMarks; if (!g) return;
    g.clear();
    const lime = rgb(.78, .86, .54);
    for (const p of this.claimFrontier || []) {
      const hot = this.claimHover === p.col + ',' + p.row, x0 = p.col * 256 - 124, y0 = p.row * 192 - 92, x1 = x0 + 248, y1 = y0 + 184;
      g.beginFill(lime, hot ? .14 : .04); g.drawRect(x0, y0, x1 - x0, y1 - y0); g.endFill();
      g.beginFill(lime, hot ? .9 : .45);
      // Dashed edges: 8 on, 8 off.
      for (let x = x0 + 16; x < x1 - 16; x += 16) { g.drawRect(x, y0, 8, 1); g.drawRect(x, y1 - 1, 8, 1); }
      for (let y = y0 + 16; y < y1 - 16; y += 16) { g.drawRect(x0, y, 1, 8); g.drawRect(x1 - 1, y, 1, 8); }
      g.endFill();
      g.beginFill(lime, hot ? 1 : .8);
      for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        g.drawRect(sx > 0 ? cx : cx - 12, sy > 0 ? cy : cy - 2, 12, 2);
        g.drawRect(sx > 0 ? cx : cx - 2, sy > 0 ? cy : cy - 12, 2, 12);
      }
      g.endFill();
    }
  }

  rebuildTerrain(data) {
    this.terrain = data;
    const season = data.season || this.currentSeason || 'summer';
    this.currentSeason = season;
    const sf = seasonSuffix(season);
    const hasMapGround = data.mapWidth > 0 && data.mapHeight > 0 && data.ground?.length === data.mapWidth * data.mapHeight;
    // Claimed land clears trees and props and turns the ground to dirt, so it counts as a map change.
    const landKey = (data.land || []).map(p => p.col + ',' + p.row).join(';');
    let mapChanged = data.mapWidth !== this.cachedMapW || data.mapHeight !== this.cachedMapH || data.originX !== this.cachedOriginX || data.originY !== this.cachedOriginY || season !== this.cachedSeason || (hasMapGround && landKey !== this.cachedLandKey) || data.treeKey !== this.cachedTreeKey;
    if (!hasMapGround) {
      // Fallback terrain also changes with the camera bounds.
      const bx = Math.ceil((this.bounds.x + 60) / 16) * 16, by = Math.ceil((this.bounds.y + 60) / 16) * 16;
      if (bx !== this.cachedBoundsX || by !== this.cachedBoundsY) mapChanged = true;
      this.cachedBoundsX = bx; this.cachedBoundsY = by;
    }
    if (!mapChanged && this.groundTexture) { this.drawClaims(data); return; }
    this.cachedMapW = data.mapWidth; this.cachedMapH = data.mapHeight;
    this.cachedOriginX = data.originX; this.cachedOriginY = data.originY;
    this.cachedSeason = season;
    this.cachedLandKey = landKey;
    this.cachedTreeKey = data.treeKey;

    this.destroyAll(this.trees); this.destroyAll(this.decor); this.destroyAll(this.worldBuildings);
    this.treeSprites.clear(); this.campPile = null;
    for (const b of this.poiBadges) b.container.destroy({ children: true });
    this.poiBadges = [];

    const tileEntry = (key, base) => this.entries.get(key) || this.entries.get(base) || this.entries.get('tiles/grass_a');
    const withSeason = key => (sf && this.entries.has(key + sf) ? key + sf : key);
    let canvas, left, top;
    if (hasMapGround) {
      canvas = document.createElement('canvas');
      canvas.width = data.mapWidth * 16; canvas.height = data.mapHeight * 16;
      const ctx = canvas.getContext('2d');
      // Each cell's tile, then the grass that blends over forest floor, rocks, swamp, fields and rubble.
      const tile = (key, tx, ty) => { const e = tileEntry(withSeason(key), key); ctx.drawImage(this.sheets[e.sheet].image, e.x, e.y, 16, 16, tx * 16, ty * 16, 16, 16); };
      for (let ty = 0; ty < data.mapHeight; ty++) for (let tx = 0; tx < data.mapWidth; tx++) {
        const i = ty * data.mapWidth + tx;
        tile('tiles/' + data.ground[i], tx, ty);
        for (const k of data.over?.[i] || []) tile('tiles/' + k, tx, ty);
      }
      left = -data.originX; top = -data.originY;
    } else {
      const bx = Math.ceil((this.bounds.x + 60) / 16) * 16, by = Math.ceil((this.bounds.y + 60) / 16) * 16;
      canvas = document.createElement('canvas');
      canvas.width = bx * 2; canvas.height = by * 2;
      const ctx = canvas.getContext('2d');
      const keys = new Set(data.land.map(p => p.col + ',' + p.row));
      const owned = (x, y) => keys.has(Math.floor((x + 128) / 256) + ',' + Math.floor((y + 96) / 192));
      for (let y = -by; y < by; y += 16) for (let x = -bx; x < bx; x += 16) {
        const inside = owned(x + 8, y + 8), v = x >= -32 && x < 32, h = y >= -32 && y < 32;
        let k;
        if (v && h) k = 'road_x';
        else if (v) k = noise(x, y) < .06 ? 'road_p' : inside || (x !== -32 && x !== 16) ? 'road_v' : x < 0 ? 'road_edge_w' : 'road_edge_e';
        else if (h) k = noise(x, y) < .06 ? 'road_p' : inside || (y !== -32 && y !== 16) ? 'road_h' : y < 0 ? 'road_edge_n' : 'road_edge_s';
        else if (inside) k = !owned(x + 8, y - 8) ? 'edge_n' : !owned(x + 8, y + 24) ? 'edge_s' : !owned(x - 8, y + 8) ? 'edge_w' : !owned(x + 24, y + 8) ? 'edge_e' : 'dirt_' + (noise(x, y) < .6 ? 'a' : noise(x, y) < .85 ? 'b' : 'c');
        else k = 'grass_' + (noise(x, y) < .6 ? 'a' : noise(x, y) < .85 ? 'b' : 'c');
        const e = tileEntry(withSeason('tiles/' + k), 'tiles/' + k);
        ctx.drawImage(this.sheets[e.sheet].image, e.x, e.y, 16, 16, x + bx, y + by, 16, 16);
      }
      left = -bx; top = -by;
    }
    if (this.groundTexture) this.groundTexture.destroy(true);
    this.groundTexture = P.Texture.from(canvas, { scaleMode: P.SCALE_MODES.NEAREST });
    this.ground.texture = this.groundTexture;
    this.ground.anchor.set(0, 0);
    this.ground.position.set(left, top);

    for (const t of data.trees || []) {
      // Generated worlds name each tree; the scattered wilds pick by kind, with the odd dead oak.
      const key = t.k || (t.kind === 2 ? 'tree_pine' : t.kind === 0 && noise(Math.trunc(t.x), Math.trunc(t.y)) < .12 ? 'tree_dead' : 'tree_oak');
      const anchor = key === 'tree_pine' ? 41 : key === 'tree_dead' ? 34 : 36;
      const r = this.make(Math.round(t.y + 15));
      if (!this.setSprite(r, withSeason('tiles/' + key))) this.setSprite(r, 'tiles/' + key);
      // A generated tree says how far below its trunk the sprite ends; the scattered wilds use the art's rows.
      r.position.set(t.x, t.y + (t.trunk ?? (r.art?.h ?? anchor) - anchor) * t.scale);
      r.scale.set(!t.k && t.kind === 1 ? -t.scale : t.scale, t.scale);
      r.tree = t;
      this.trees.push(r);
      if (t.id) this.treeSprites.set(t.id, r);
    }
    for (const b of data.worldBuildings || []) {
      const r = this.make(Math.round(b.order));
      if (!this.setSprite(r, withSeason(b.key))) this.setSprite(r, b.key);
      r.position.set(b.x, b.y + b.fh * 16);
      this.worldBuildings.push(r);
    }
    for (const d of data.decor || []) {
      const r = this.make(Math.round(d.order));
      if (!this.setSprite(r, withSeason(d.key))) this.setSprite(r, d.key);
      // (x, y) is where the engine stands the prop: its bottom centre, or the top-left of a bridge deck or dock.
      if (d.anchor === 'top') r.anchor.set(0, 0);
      r.position.set(d.x, d.y);
      this.decor.push(r);
    }
    // Camp props stand at their centre; the wood pile grows two more logs as the stock builds up.
    for (const d of data.camp || []) {
      const layers = d.pile ? [[0, 0], [6, -5], [-4, -9]] : [[0, 0]], pile = [];
      for (const [dx, dy] of layers) {
        const r = this.make(Math.round(d.y + 8 + (dy ? 1 : 0)));
        if (!this.setSprite(r, withSeason(d.key))) this.setSprite(r, d.key);
        r.position.set(d.x + dx, d.y + 8 + dy);
        this.decor.push(r); pile.push(r);
      }
      if (d.pile) this.campPile = pile;
    }
    for (const p of data.pois || []) {
      const container = new P.Container();
      container.position.set(p.x, p.y);
      container.zIndex = 28990;
      // High-contrast backing plate so the badge is legible against any terrain.
      const bg = new P.Sprite(P.Texture.WHITE);
      bg.anchor.set(0.5); bg.width = bg.height = 16;
      bg.tint = p.scavenged ? rgb(.12, .16, .12) : rgb(.15, .18, .12); bg.alpha = p.scavenged ? .85 : .92;
      const icon = new P.Sprite(P.Texture.EMPTY);
      icon.anchor.set(0.5);
      container.addChild(bg, icon);
      this.unlit.addChild(container);
      const badge = { container, icon, scavenged: null };
      this.setPoiBadge(badge, p.scavenged);
      this.poiBadges.push(badge);
    }
    this.drawClaims(data);
  }

  setPoiBadge(badge, scavenged) {
    if (badge.scavenged === scavenged) return;
    badge.scavenged = scavenged;
    const tex = this.uiTextures.get(scavenged ? 'badge_check' : 'badge_star');
    if (!tex) return;
    badge.icon.texture = tex;
    badge.icon.scale.set(12 / Math.max(1, tex.width));
    badge.icon.tint = scavenged ? rgb(.65, .85, .65) : rgb(1, .88, .32);
    badge.icon.alpha = scavenged ? .95 : 1;
  }

  // ---- Entities -------------------------------------------------------------------------------
  present(state, now, dt) {
    this.frame = state; this.frameAt = now; this.now = now; this.dt = dt;
    this.harvest = state.harvest || null;
    if (state.season && state.season !== this.currentSeason) {
      this.currentSeason = state.season;
      if (this.terrain) { this.terrain.season = state.season; this.rebuildTerrain(this.terrain); }
    }
    for (const id of state.scavengedPois || []) if (this.poiBadges[id]) this.setPoiBadge(this.poiBadges[id], true);

    const alive = new Set();
    let anyZombieFighting = false;
    this.wallPanels = state.entities.filter(e => e.kind === 'building' && e.type === 'barricade' && !e.hidden).map(wallPanel);
    this.wallGates = state.entities.filter(e => e.kind === 'building' && e.type === 'gate' && !e.hidden).map(wallPanel);
    const wallCells = new Map(wallTiles(this.wallPanels, this.wallGates).map((cells, i) => [this.wallPanels[i].id, cells]));
    for (const e of state.entities) {
      if (e.hidden) continue;
      alive.add(e.id);
      let a = this.actors.get(e.id);
      if (!a) {
        const sprite = this.make(0);
        sprite.position.set(e.x, e.y);
        const bar = new P.Graphics();
        this.lit.addChild(bar);
        a = { sprite, bar, last: { x: e.x, y: e.y }, target: { x: e.x, y: e.y }, walk: 0, direction: 's' };
        this.actors.set(e.id, a);
      }
      a.entity = e;
      const dx = e.x - a.target.x, dy = e.y - a.target.y, dist = Math.hypot(dx, dy);
      if (dist > .05 && dist < 40) {
        a.direction = DIRS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
        a.walk += dist / 5;
      } else if (e.fighting) {
        a.direction = e.facing < 0 ? 'w' : 'e';
        a.walk += dt * 6;
      }
      if (!a.direction) a.direction = e.facing < 0 ? 'w' : 'e';
      a.last = a.target; a.target = { x: e.x, y: e.y };
      const base = e.burning ? 'burning/' + (e.type || 'walker') : e.sprite;
      if (wallCells.has(e.id)) this.drawWall(a, e, wallCells.get(e.id));
      else this.setSprite(a.sprite, e.kind === 'building' ? this.getSeasonal(e.sprite, this.currentSeason) : this.getWalk(base, a.direction, Math.floor(a.walk) % 4));
      const gy = e.kind === 'building' ? e.groundY : (e.groundY ?? e.y);
      a.sprite.zIndex = Math.round(e.stationed ? e.y + 45 : gy + (e.kind === 'building' ? 5 : 15));
      a.sprite.rotation = e.downed ? -Math.PI / 2 : 0;
      // A blueprint stands translucent until it is built.
      if (e.kind === 'building') a.sprite.alpha = e.blueprint ? .45 : 1;
      a.bar.zIndex = a.sprite.zIndex + 1;

      // Watchtower front railing and roof overlay while a sentry is on the platform.
      if (e.kind === 'building' && e.type === 'tower') {
        if (!a.towerOverlay) a.towerOverlay = this.make(0);
        const level = e.sprite && (e.sprite.endsWith('/1') || e.sprite.includes('/1/')) ? 1 : 0;
        this.setSprite(a.towerOverlay, this.getSeasonal(`plots/tower/overlay/${level}`, this.currentSeason));
        a.towerOverlay.visible = state.entities.some(s => s.kind === 'survivor' && s.stationed && Math.abs(s.x - e.x) < 24 && (Math.abs(s.y - (e.y - 34)) < 16 || Math.abs(s.y - e.y) < 48));
        a.towerOverlay.zIndex = Math.round(e.groundY + 60);
      } else if (a.towerOverlay) a.towerOverlay.visible = false;
      if (e.kind === 'zombie' && e.fighting) anyZombieFighting = true;
    }
    for (const [id, a] of this.actors) {
      if (alive.has(id)) continue;
      a.sprite.destroy({ children: true }); a.bar.destroy();
      a.light?.destroy(); a.towerOverlay?.destroy(); a.logs?.destroy();
      this.actors.delete(id);
    }
    this.drawEffects();

    if (anyZombieFighting && now - this.lastBashSfx > 0.35) { this.lastBashSfx = now; this.audio.playZombieBash(); }
    if (state.phase !== this.lastPhase) {
      if (this.lastPhase) {
        if (state.phase === 'dawn') this.audio.playDawn();
        else if (state.phase === 'night' || state.phase === 'dusk') this.audio.playDusk();
      }
      this.lastPhase = state.phase;
    }
  }

  // A barricade is drawn as the kit wall tiles for its two cells, children of its (empty) sprite so
  // they move and sort with it. Each tile stands on the bottom of its cell.
  drawWall(a, e, cells) {
    a.sprite.texture = P.Texture.EMPTY;
    const material = e.sprite?.split('/')[2] || 'palisade';
    if (!a.wallCells) a.wallCells = cells.map(() => a.sprite.addChild(new P.Sprite(P.Texture.EMPTY)));
    cells.forEach((c, i) => {
      const r = a.wallCells[i];
      this.setSprite(r, this.getSeasonal(`tiles/wall_${material}_${c.shape}`, this.currentSeason));
      r.position.set(c.x - e.x, c.y + WALL_HALF - e.y);
    });
    // The health bar sits over the tallest tile.
    a.sprite.art = { anchor: [0.5, 1], w: e.width, h: e.y + WALL_HALF - Math.min(...cells.map(c => c.y)) + WALL_RISE };
  }

  effectSprite(used, order) {
    let r = this.effects[used];
    if (!r) { r = this.make(order); this.effects.push(r); }
    r.visible = true; r.zIndex = order; r.rotation = 0; r.scale.set(1); r.alpha = 1; r.tint = 0xffffff;
    return r;
  }

  floatText(i) {
    let text = this.floatTexts[i];
    if (!text) {
      text = new P.Text('', { fontFamily: 'Silkscreen, monospace', fontSize: 10, fill: 0xe4d08a, stroke: 0x1a1e16, strokeThickness: 2 });
      text.resolution = 4; text.anchor.set(0.5, 1); text.zIndex = 29600;
      this.unlit.addChild(text); this.floatTexts.push(text);
    }
    text.visible = true;
    return text;
  }

  drawEffects() {
    let used = 0, shotSfx = false, hitSfx = false, floats = 0;
    const live = new Set();
    for (const e of this.frame.effects || []) {
      const t = clamp01(1 - e.life / Math.max(.001, e.maxLife));
      if (e.type === 'shot') {
        // Shots are identified by their path so each one spawns its impact once.
        const id = `${e.x},${e.y},${e.tx},${e.ty},${e.maxLife}`;
        live.add(id);
        const dir = (Math.round(Math.atan2(e.ty - e.y, e.tx - e.x) / (Math.PI * 2 / 16)) + 16) % 16;
        let r = this.effectSprite(used++, 28000);
        this.setSprite(r, `gunfire/flash/${dir}/${Math.min(2, Math.floor(t * 3))}`);
        r.position.set(e.x, e.y);
        r = this.effectSprite(used++, 28001);
        this.setSprite(r, `gunfire/tracer/${dir}/${Math.floor(t * 4) % 2}`);
        r.position.set(lerp(e.x, e.tx, t), lerp(e.y, e.ty, t));
        if (!this.seenShots.has(id)) {
          this.seenShots.add(id);
          this.impacts.push({ kind: 'blood', dir, x: e.tx, y: e.ty, age: 0, maxAge: 0.32 });
          const cdx = e.tx - e.x, cdy = e.ty - e.y, len = Math.max(1, Math.hypot(cdx, cdy));
          this.impacts.push({ kind: 'casing', x: e.x, y: e.y, vx: -cdy / len * 18 - cdx / len * 5, vy: (cdx / len * 18 - cdy / len * 5) * 0.4, age: 0, maxAge: 0.45 });
          if (!hitSfx && this.now - this.lastHitSfx > 0.08) { hitSfx = true; this.lastHitSfx = this.now; this.audio.playHit(); }
        }
        if (!shotSfx && this.now - this.lastShotSfx > 0.08) { shotSfx = true; this.lastShotSfx = this.now; this.audio.playShoot(); }
      } else if (e.type === 'chip') {
        // Wood chips fly off the trunk with each swing.
        for (let i = 0; i < 4; i++) {
          const r = this.effectSprite(used++, 28000);
          r.texture = P.Texture.WHITE; r.anchor.set(0.5); r.art = null; r.width = r.height = 1;
          const vx = (noise(Math.round(e.x) + i, Math.round(e.y)) - .5) * 40, vy = -20 - noise(i, Math.round(e.x)) * 30;
          r.position.set(e.x + vx * t * .5, e.y + vy * t * .5 + 70 * t * t * .25);
          r.tint = i % 2 ? hex('#b89d6e') : hex('#9a8157');
        }
      } else if (e.type === 'wood') {
        const text = this.floatText(floats++);
        text.text = '+' + e.amount; text.position.set(e.x, e.y - t * 20); text.alpha = Math.min(1, e.life);
      } else if (e.type === 'death') {
        // Blood pool rests on the ground.
        const r = this.effectSprite(used++, -28000);
        r.texture = P.Texture.WHITE; r.anchor.set(0.5); r.art = null;
        r.position.set(e.x, e.y); r.width = 18; r.height = 7;
        r.tint = rgb(.38, .07, .05); r.alpha = Math.min(.65, e.life);
      } else {
        const r = this.effectSprite(used++, 28000);
        r.texture = P.Texture.WHITE; r.anchor.set(0.5); r.art = null;
        r.position.set(e.x, e.y - t * 8); r.width = r.height = 3;
        if (e.type === 'heal') { r.tint = rgb(.5, 1, .5); r.alpha = 1 - t; }
        else if (e.type === 'repair') { r.tint = rgb(1, .8, .4); r.alpha = 1 - t; }
        else { r.tint = rgb(.35, .08, .05); r.alpha = Math.min(.7, e.life); }
        if (e.type === 'heal' && t < 0.1) this.audio.playHeal();
        else if (e.type === 'repair' && t < 0.1) this.audio.playRepair();
      }
    }
    for (const id of this.seenShots) if (!live.has(id)) this.seenShots.delete(id);

    // Secondary impacts: blood splatter at the target and a brass casing ejected by the shooter.
    const dt = this.dt;
    this.impacts = this.impacts.filter(fx => (fx.age += dt) < fx.maxAge);
    for (const fx of this.impacts) {
      if (fx.kind === 'blood') {
        const r = this.effectSprite(used++, 28002);
        this.setSprite(r, `gunfire/blood/${fx.dir}/${Math.min(3, Math.floor(fx.age / 0.08))}`);
        r.position.set(fx.x, fx.y);
      } else {
        const r = this.effectSprite(used++, 28001);
        this.setSprite(r, `gunfire/casing/${Math.floor(fx.age * 16) % 4}`);
        r.position.set(fx.x + fx.vx * fx.age, fx.y + fx.vy * fx.age + 50 * fx.age * fx.age);
        r.alpha = clamp01(1 - fx.age * 1.8);
      }
    }
    for (let i = used; i < this.effects.length; i++) this.effects[i].visible = false;
    for (let i = floats; i < this.floatTexts.length; i++) this.floatTexts[i].visible = false;
  }

  // ---- Per-frame presentation -----------------------------------------------------------------
  update(dt, now) {
    if (!this.frame) return;
    if (this.followTargetId >= 0) {
      const actor = this.actors.get(this.followTargetId);
      if (actor?.entity && actor.entity.hp > 0) {
        const t = clamp01((now - this.frameAt) / .05);
        this.targetCam.x = lerp(actor.last.x, actor.target.x, t);
        this.targetCam.y = lerp(actor.last.y, actor.target.y, t);
        this.clampCamera();
      } else {
        const ent = this.frame.entities?.find(e => e.id === this.followTargetId);
        if (ent && ent.hp > 0) { this.targetCam.x = ent.x; this.targetCam.y = ent.y; this.clampCamera(); }
        else this.followTargetId = -1;
      }
    }
    // Smooth zoom and pan toward the targets.
    if (Math.abs(this.currentZoom - this.targetZoom) > 0.0005) this.currentZoom = lerp(this.currentZoom, this.targetZoom, dt * 12);
    else this.currentZoom = this.targetZoom;
    this.cam.x = lerp(this.cam.x, this.targetCam.x, dt * 14);
    this.cam.y = lerp(this.cam.y, this.targetCam.y, dt * 14);

    this.lighting.hour = this.frame.hour;
    this.lighting.update();
    // Survivors carry lights only through the simulation's night window (18:00-06:00).
    const isNight = this.frame.hour >= 18 || this.frame.hour < 6;
    const dark = isNight ? this.lighting.darkness : 0;
    const t = clamp01((now - this.frameAt) / .05);
    for (const a of this.actors.values()) {
      const p = { x: lerp(a.last.x, a.target.x, t), y: lerp(a.last.y, a.target.y, t) };
      a.sprite.position.set(p.x, p.y);
      if (a.towerOverlay) a.towerOverlay.position.set(p.x, p.y);
      const e = a.entity;
      if (e.kind === 'survivor' && !e.downed && dark > 0.15) {
        if (!a.light) { a.light = this.make(29000, false); this.setSprite(a.light, 'lights/light_flashlight_e'); }
        a.light.visible = true;
        a.light.position.set(p.x, p.y);
        a.light.rotation = -FLASH_ANGLE[a.direction] * Math.PI / 180;
        a.light.tint = rgb(1, .95, .75); a.light.alpha = dark * 0.7;
      } else if (a.light) a.light.visible = false;

      const g = a.bar;
      g.clear();
      if (e.hp < e.maxHP - .1 || e.id === this.selected) {
        const isZombie = e.kind === 'zombie';
        const w = e.kind === 'building' ? 38 : isZombie ? 22 : 20;
        const pct = clamp01(e.hp / Math.max(1, e.maxHP));
        const art = a.sprite.art;
        const y = p.y - (art ? art.anchor[1] * art.h : 30) - 5;
        g.beginFill(rgb(.08, .1, .08)).drawRect(p.x - (w + 2) / 2, y - 2, w + 2, 4).endFill();
        const fill = isZombie ? rgb(.88, .22, .18) : pct < .35 ? rgb(.8, .3, .25) : rgb(.75, .85, .5);
        if (pct > 0) g.beginFill(fill).drawRect(p.x - w / 2, y - 1, w * pct, 2).endFill();
      }
    }
    // A canopy thins out while someone stands behind it.
    const positions = this.characterPositions;
    positions.length = 0;
    for (const ent of this.frame.entities) if (ent.kind !== 'building' && !ent.hidden) positions.push(ent);
    const h = this.harvest, regrow = new Map((h?.regrow || []).map(r => [r.id, r])), chopping = new Map((h?.chopping || []).map(c => [c.tree, c]));
    for (const tree of this.trees) {
      const { x: tx, y: ty, alpha, id } = tree.tree;
      tree.alpha = regrow.has(id) ? .5 : positions.some(cp => cp.y < ty && cp.y > ty - 40 && Math.abs(cp.x - tx) < 16) ? .45 : alpha;
      // A tree shakes as each swing lands.
      const chop = chopping.get(id);
      tree.position.x = tx + (chop && chop.swing < .15 ? (Math.floor(now * 60) % 2 ? 1 : -1) : 0);
    }
    this.drawHarvest(h, now);
    for (const a of this.actors.values()) {
      const carrying = h?.carrying?.includes(a.entity.id) && !a.entity.hidden;
      if (carrying && !a.logs) { a.logs = new P.Graphics(); this.lit.addChild(a.logs); }
      if (!a.logs) continue;
      a.logs.visible = !!carrying;
      if (!carrying) continue;
      const x = Math.round(a.sprite.position.x) - 5, y = Math.round(a.sprite.position.y) - 20;
      a.logs.zIndex = a.sprite.zIndex + 1;
      a.logs.clear()
        .beginFill(hex('#1a1e16')).drawRect(x - 1, y - 1, 12, 6).endFill()
        .beginFill(hex('#7a6444')).drawRect(x, y, 10, 2).endFill()
        .beginFill(hex('#9a8157')).drawRect(x, y + 2, 10, 2).endFill()
        .beginFill(hex('#b89d6e')).drawRect(x, y, 1, 4).endFill();
    }
    if (this.campPile) { this.campPile[1].visible = this.frame.wood >= 20; this.campPile[2].visible = this.frame.wood >= 60; }
    // Flames: on the campfire in a camp, over the HQ's brazier in a refuge.
    const campfire = this.frame.entities.find(e => e.kind === 'building' && e.type === 'campfire');
    if (!this.setSprite(this.fire, `molotov/fire/${Math.floor(this.frame.elapsed * 10) % 8}`)) this.setSprite(this.fire, 'molotov/fire/0');
    if (campfire) { this.fire.position.set(campfire.x, campfire.y + 1); this.fire.scale.set(.3); this.fire.zIndex = Math.round(campfire.groundY + 7); }
    else { this.fire.position.set(34, 77); this.fire.scale.set(.5); this.fire.zIndex = 92; }
    this.fire.visible = !!campfire || this.frame.entities.some(e => e.kind === 'building' && e.type === 'core');
    this.campGlow.visible = !!campfire && dark > .05;
    if (this.campGlow.visible) {
      this.setSprite(this.campGlow, 'lights/light_torch');
      this.campGlow.position.set(campfire.x, campfire.y);
      this.campGlow.scale.set(3.2 + Math.sin(now * 9) * .08);
      this.campGlow.tint = rgb(1, .72, .4); this.campGlow.alpha = dark * .85;
    }

    const selectedEntity = this.actors.get(this.selected)?.entity ?? null;
    if (!this.ghost.visible) {
      this.brackets.clear();
      this.drawBrackets(selectedEntity, selectedEntity?.kind === 'zombie' ? rgb(.92, .32, .22) : rgb(.8, .95, .6), 1);
    }
    this.drawTargetLines(selectedEntity);
    this.applyCamera();
  }

  // Rings under marked trees (bright when a survivor is on it), a bobbing marker over them,
  // a growth dial over felled ones, and a ring under the tree the pointer is on.
  drawHarvest(h, now) {
    const g = this.harvestMarks;
    g.clear();
    if (!h) return;
    const ring = (x, y, color) => g.lineStyle(1, color, 1).drawEllipse(x, y + 1, 8, 3.5).lineStyle(0);
    for (const j of h.jobs) {
      ring(j.x, j.y, hex('#c5d48a'));
      const y = Math.round(j.y - 46 + Math.sin(now * 5) * 1.5), x = Math.round(j.x);
      g.beginFill(hex('#1a1e16')).drawRect(x - 4, y - 1, 9, 6).endFill()
        .beginFill(j.assigned ? hex('#c5d48a') : hex('#e4e6d2')).drawRect(x - 3, y, 7, 2).drawRect(x - 2, y + 2, 5, 1).drawRect(x - 1, y + 3, 3, 1).endFill();
    }
    for (const r of h.regrow) {
      const x = r.x, y = r.y - 44;
      g.lineStyle(2, hex('#12150f'), .8).drawCircle(x, y, 4);
      g.lineStyle(2, hex('#c5d48a'), 1).moveTo(x, y - 4).arc(x, y, 4, -Math.PI / 2, -Math.PI / 2 + Math.max(.01, r.f) * Math.PI * 2).lineStyle(0);
    }
    const hover = this.hoverTree && this.treeSprites.get(this.hoverTree)?.tree;
    if (hover) ring(hover.x, hover.y, hex('#e4e6d2'));
    // Marked debris: a ring and a bobbing marker, bright once someone is working it.
    for (const d of h.debris || []) {
      ring(d.x, d.y - 2, hex('#c5d48a'));
      const y = Math.round(d.y - 30 + Math.sin(now * 5) * 1.5), x = Math.round(d.x);
      g.beginFill(hex('#1a1e16')).drawRect(x - 4, y - 1, 9, 6).endFill()
        .beginFill(d.assigned ? hex('#c5d48a') : hex('#e4e6d2')).drawRect(x - 3, y, 7, 2).drawRect(x - 2, y + 2, 5, 1).drawRect(x - 1, y + 3, 3, 1).endFill();
    }
    const hoverPile = this.hoverDebris && (this.terrain?.decor || []).find(d => d.debris === this.hoverDebris);
    if (hoverPile) ring(hoverPile.x, hoverPile.y - 2, hex('#e4e6d2'));
  }

  // The debris pile under the pointer (a campaign's salvage), nearest first.
  hitDebris(p) {
    let best = null, bestDistance = Infinity;
    for (const d of this.terrain?.decor || []) {
      if (!d.debris || Math.abs(p.x - d.x) > 16 || p.y > d.y + 4 || p.y < d.y - 24) continue;
      const dist = Math.hypot(p.x - d.x, p.y - (d.y - 8));
      if (dist < bestDistance) { best = d.debris; bestDistance = dist; }
    }
    return best;
  }

  // The tree under the pointer: its canopy and trunk, nearest trunk first.
  hitTree(p) {
    let best = null, bestDistance = Infinity;
    for (const [id, r] of this.treeSprites) {
      const t = r.tree, s = t.scale || 1;
      if (Math.abs(p.x - t.x) > 11 * s || p.y > t.y + 4 || p.y < t.y - 40 * s) continue;
      const d = Math.hypot(p.x - t.x, p.y - (t.y - 14 * s));
      if (d < bestDistance) { best = id; bestDistance = d; }
    }
    return best;
  }

  applyCamera() {
    const s = this.scale;
    this.root.scale.set(s);
    this.root.position.set(this.app.screen.width / 2 - this.cam.x * s, this.app.screen.height / 2 - this.cam.y * s);
  }

  drawTargetLines(target) {
    const g = this.targetLines;
    g.clear();
    if (target?.kind !== 'zombie') return;
    for (const s of this.frame.entities) {
      if (s.kind !== 'survivor' || s.targetId !== target.id || s.hidden) continue;
      if (Math.hypot(target.x - s.x, target.y - s.y) > 1) g.lineStyle(1.5, rgb(.95, .42, .28), .55).moveTo(s.x, s.y).lineTo(target.x, target.y);
    }
  }

  // Corner brackets: an 8-unit horizontal and vertical arm at each corner of the footprint.
  drawBrackets(e, color, alpha) {
    if (!e) return;
    const w = e.kind === 'building' ? e.width + 6 : 28, h = e.kind === 'building' ? e.height + 6 : 18;
    const g = this.brackets;
    g.beginFill(color, alpha);
    for (let i = 0; i < 4; i++) {
      const sx = i % 2 === 0 ? -1 : 1, sy = i < 2 ? 1 : -1;
      const x = e.x + sx * w / 2, y = e.y + sy * h / 2;
      g.drawRect(x - sx * 4 - 4, y - .75, 8, 1.5);
      g.drawRect(x - .75, y - sy * 4 - 4, 1.5, 8);
    }
    g.endFill();
  }

  showPlacement(p) {
    this.ghost.visible = !!p;
    for (const c of this.ghostCells) c.visible = false;
    this.brackets.clear();
    if (!p) return;
    if (p.type === 'barricade') {
      this.ghost.visible = false;
      const panels = [...(this.wallPanels || []), { x: p.x, y: p.y, rotation: p.rotation ? 1 : 0 }];
      wallTiles(panels, this.wallGates || []).at(-1).forEach((c, i) => {
        const r = this.ghostCells[i];
        this.setSprite(r, `tiles/wall_palisade_${c.shape}`);
        r.position.set(c.x, c.y + WALL_HALF);
        r.tint = p.ok ? rgb(.4, 1, .4) : rgb(1, .3, .3); r.alpha = .75; r.visible = true;
      });
      const [w, h] = buildingFootprint(p.type, p.rotation);
      this.drawBrackets({ x: p.x, y: p.y, kind: 'building', width: w, height: h }, p.ok ? rgb(.7, 1, .5) : rgb(1, .35, .3), .75);
      return;
    }
    let key = p.type || (p.sprite?.includes('/') ? p.sprite.split('/')[1] : '');
    if (key === 'core') key = 'town_hall';
    else if (key === 'dorm') key = 'bunkhouse';
    else if (key === 'barricade') key = 'wall';
    const [fpW, fpH] = buildingFootprint(p.type, p.rotation);
    const ghostTexture = this.uiTextures.get(`ghost_${key}_${p.ok ? 'ok' : 'bad'}`);
    if (ghostTexture) {
      this.ghost.texture = ghostTexture;
      this.ghost.anchor.set(0.5);
      this.ghost.tint = 0xffffff; this.ghost.alpha = 1;
      if (p.type === 'barricade' && p.rotation) {
        this.ghost.rotation = -Math.PI / 2;
        this.ghost.position.set(p.x, p.y);
      } else {
        this.ghost.rotation = 0;
        this.ghost.position.set(p.x, p.y - (ghostTexture.height - fpH) / 2);
      }
    } else {
      // Buildings without a dedicated ghost (the gate) use their own sprite, tinted.
      this.setSprite(this.ghost, p.sprite);
      this.ghost.tint = p.ok ? rgb(.4, 1, .4) : rgb(1, .3, .3); this.ghost.alpha = .75;
      this.ghost.rotation = 0;
      this.ghost.position.set(p.x, p.y);
    }
    this.drawBrackets({ x: p.x, y: p.y, kind: 'building', width: fpW, height: fpH }, p.ok ? rgb(.7, 1, .5) : rgb(1, .35, .3), .75);
  }

  // Characters first (aimed at the body), then buildings.
  hit(p) {
    const entities = this.frame?.entities;
    if (!entities) return -1;
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.kind !== 'building' && !e.hidden && Math.hypot(p.x - e.x, p.y - (e.y - 11)) < 15) return e.id;
    }
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.kind === 'building' && Math.abs(p.x - e.x) < e.width / 2 + 6 && p.y > e.y - (e.type === 'tower' ? 44 : e.height / 2 + 18) && p.y < e.y + e.height / 2 + 4) return e.id;
    }
    return -1;
  }

  hitPoi(p) {
    for (const poi of this.terrain?.pois || []) if (Math.hypot(p.x - poi.x, p.y - poi.y) < 24) return poi.id;
    return -1;
  }
}
