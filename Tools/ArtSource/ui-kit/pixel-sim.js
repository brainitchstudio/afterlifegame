// Survivor behaviour for the in-context scene: tile pathfinding, crowd avoidance, gates, building doors,
// watchtower ladders, depth sorting, and state that survives season swaps, rerolls and reloads.
//
// Rules
// 1. Walk grid = 16px tiles. Blocked: wall pieces, tower and building footprints, tree/bush/stump trunk tiles.
//    Gate tiles and everything else are walkable. Roads cost 0.7, other ground 1. 8-way A*, no corner cutting.
// 2. Crowds: each survivor has a 5px radius. Survivors push apart when closer than 10px. Anyone meeting
//    someone head-on steps to their own right. Anyone making no progress for 1.5s re-paths, counting the tiles
//    of standing survivors as blocked. Idle goals skip tiles already taken by someone else's goal.
// 3. Depth: every object sorts by its footprint's bottom edge; a survivor sorts by feet y.
//    Survivors in an open gate draw over the gate.
// 4. Gates open when a survivor comes within ~1.3 tiles of the opening, and close 0.6s after the last one leaves.
// 5. Doors: walk to the tile in front, wait for frames 0→3, step in and hide 4–9s, door opens, step out, door closes.
// 6. Towers (one survivor per tower): walk to the ladder foot, climb at 45% speed facing north, step to one side
//    of the deck, watch 6–12s turning to look around, step back to the hatch, climb down. On the deck the front
//    rail (and the tin roof on the roofed tower) is redrawn over them, and their legs are clipped at the platform edge.
// 7. Goals after a 1–3s idle: building 40%, inside the walls 22%, outside 18%, tower 10%, leave by road 10%.
// 8. Persistence: season changes re-skin the running sim. Rerolls keep every survivor and their current task,
//    move anyone now standing on a blocked tile to the nearest free one, and re-path. State is saved to localStorage.
import { Spr, gate, gateV } from './pixel-assets-v2.js';
import { DOORS } from './pixel-buildings.js';

export const BUILDINGS = [
  { k: 'bld_bunkhouse', tx: 9, ty: 4, fw: 3, fh: 2 },
  { k: 'bld_armory', tx: 14, ty: 4, fw: 2, fh: 2 },
  { k: 'bld_workshop', tx: 8, ty: 7, fw: 3, fh: 3 },
  { k: 'bld_clinic', tx: 15, ty: 7, fw: 3, fh: 3 }
];
const SPEED = 22, DOOR_FPS = 11, RAD = 5, SEP = 10, STORE = 'survival-tileset-sim-v1';
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const VEC = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1], se: [1, 1], sw: [-1, 1], ne: [1, -1], nw: [-1, -1] };
const face = (dx, dy) => { const o = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)); return ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][(o + 8) % 8]; };
const cx = tx => tx * 16 + 8, cy = ty => ty * 16 + 11;

function slice(st, k, fw) {
  const s = new Spr(fw, st.h);
  for (let y = 0; y < st.h; y++) for (let x = 0; x < fw; x++) { const i = y * st.w + k * fw + x, j = y * fw + x; s.p[j] = st.p[i]; s.sh[j] = st.sh[i]; }
  return s;
}
// Front rail (rows 18–28 minus the ladder hatch) and, on the roofed tower, the roof (rows 0–13).
function towerOverlay(src, roof) {
  const s = new Spr(src.w, src.h);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const rail = y >= 18 && y <= 28 && !(x >= 13 && x <= 18 && y <= 25);
    if (rail || (roof && y <= 13)) s.p[y * src.w + x] = src.p[y * src.w + x];
  }
  return s;
}
function blitClip(dst, src, dx, dy, maxY) {
  for (let j = 0; j < src.h; j++) {
    const y = dy + j; if (y > maxY) break;
    for (let i = 0; i < src.w; i++) {
      const x = dx + i; if (!dst.in(x, y)) continue;
      const si = j * src.w + i, di = y * dst.w + x;
      if (src.p[si]) dst.p[di] = src.p[si];
    }
  }
}

export class Sim {
  constructor(base, A, sf, SV, seed = 1) {
    this.SV = SV; this.seed = seed;
    let a = (seed * 2654435761) >>> 0 || 1; this.rnd = () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return (a >>> 0) / 4294967296; };
    this.load(base, A, sf);
    const names = Object.keys(SV);
    this.people = names.slice(0, 8).map((k, i) => {
      const [tx, ty] = this.pick(i % 2 ? this.inside : this.outside);
      return this.person({ k, i, x: cx(tx), y: cy(ty), st: 'idle', t: 0.5 + this.rnd() * 2 });
    });
  }
  person(o) { return { dir: 's', dist: 0, path: [], visible: true, b: null, tw: null, deck: false, goal: null, then: null, stuck: 0, lastD: 0, ...o }; }

  // (Re)build world from a scene. Safe to call on a running sim: people, gate and door states carry over.
  load(base, A, sf) {
    const M = this.M = base.meta, oldG = this.gates, oldB = this.blds, oldT = this.towers;
    this.W = M.TW; this.H = M.TH; this.ground = base.ground;
    this.block = new Uint8Array(this.W * this.H); this.statics = []; this.gates = []; this.towers = [];
    const B = (x, y) => { if (x >= 0 && y >= 0 && x < this.W && y < this.H) this.block[y * this.W + x] = 1; };
    for (const o of base.objs) {
      if (o.t === 'gate') { this.addGate(o); continue; }
      if (o.t === 'tower') {
        for (let j = 0; j < o.fh; j++) for (let i = 0; i < o.fw; i++) B(o.tx + i, o.ty + j);
        this.towers.push({ ...o, over: towerOverlay(o.spr, o.roof), foot: { x: o.x + 16, y: o.y + 56 }, deckY: o.y + 23, front: [o.tx, o.ty + o.fh], busy: null });
        continue;
      }
      this.statics.push(o);
      if (o.t === 'wall' || o.t === 'tree') B(o.tx, o.ty);
    }
    this.blds = BUILDINGS.map(b => {
      const spr = A[b.k + sf], st = A[b.k + '_door' + sf], d = DOORS[b.k]; if (!spr) return null;
      for (let j = 0; j < b.fh; j++) for (let i = 0; i < b.fw; i++) B(b.tx + i, b.ty + j);
      const x = b.tx * 16 + ((b.fw * 16 - spr.w) >> 1), bottom = (b.ty + b.fh) * 16, y = bottom - spr.h;
      const dx = x + d.x + (d.w >> 1), front = [Math.min(b.tx + b.fw - 1, Math.max(b.tx, dx >> 4)), b.ty + b.fh];
      const frames = st ? [0, 1, 2, 3].map(k => slice(st, k, spr.w)) : [spr];
      return { ...b, spr, frames, x, y, key: bottom, door: { x: dx, y: bottom + 1 }, front, f: 0, users: 0 };
    }).filter(Boolean);
    if (oldG) this.gates.forEach((g, i) => { if (oldG[i]) { g.open = oldG[i].open; g.hold = oldG[i].hold; } });
    if (oldB) this.blds.forEach((b, i) => { if (oldB[i]) { b.f = oldB[i].f; b.users = oldB[i].users; } });
    if (oldT) this.towers.forEach((t, i) => { if (oldT[i]) t.busy = oldT[i].busy; });
    this.ends = [];
    for (let y = 0; y < this.H; y++) for (const x of [0, this.W - 1]) if (M.isRoad(x, y) && !this.blocked(x, y)) this.ends.push([x, y, x === 0 ? -20 : 20, 0]);
    for (let x = 0; x < this.W; x++) for (const y of [0, this.H - 1]) if (M.isRoad(x, y) && !this.blocked(x, y)) this.ends.push([x, y, 0, y === 0 ? -30 : 20]);
    this.inside = []; this.outside = [];
    const fronts = new Set([...this.blds, ...this.towers].map(b => b.front + ''));
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) {
      if (this.blocked(x, y) || this.gateAt(x, y) || fronts.has(x + ',' + y)) continue;
      (x > M.X0 && x < M.X1 && y > M.Y0 && y < M.Y1 ? this.inside : this.outside).push([x, y]);
    }
    if (this.people) this.people.forEach(p => {
      if (p.b) p.b = this.blds[p.b.i ?? this.blds.findIndex(b => b.k === p.b.k)] || null;
      if (p.tw) p.tw = this.towers.find(t => t.tx === p.tw.tx && t.ty === p.tw.ty) || null;
      if (p.then && p.then.b) p.then.b = this.blds.find(b => b.k === p.then.b.k);
      if (p.then && p.then.tw) p.then.tw = this.towers.find(t => t.tx === p.then.tw.tx);
    });
    this.towers.forEach(t => { if (t.busy) t.busy = this.people.find(p => p.k === t.busy.k) || null; });
    this.blds.forEach((b, i) => { b.i = i; });
  }
  // Layout changed under running survivors: snap off blocked tiles and re-path walkers.
  settle() {
    for (const p of this.people) {
      if (!p.visible || p.tw || p.st === 'step' || p.st === 'climb') continue;
      const [tx, ty] = this.tileOf(p);
      if (this.blocked(tx, ty)) { const f = this.nearestFree(tx, ty); p.x = cx(f[0]); p.y = cy(f[1]); }
      if (p.st === 'walk' && p.goal) this.goTo(p, p.goal, p.then);
    }
  }
  nearestFree(tx, ty) {
    const seen = new Set([tx + ',' + ty]), q = [[tx, ty]];
    while (q.length) { const [x, y] = q.shift(); if (!this.blocked(x, y)) return [x, y]; for (const [dx, dy] of DIRS8.slice(0, 4)) { const k = (x + dx) + ',' + (y + dy); if (!seen.has(k) && x + dx >= 0 && y + dy >= 0 && x + dx < this.W && y + dy < this.H) { seen.add(k); q.push([x + dx, y + dy]); } } }
    return [tx, ty];
  }
  addGate(o) {
    const g = { ...o, open: false, hold: 0 };
    if (o.o === 'h') { g.closed = gate(o.kind, false); g.opened = gate(o.kind, true); g.cx = o.tx * 16 + 16; g.cy = o.ty * 16 + 8; g.tiles = [[o.tx, o.ty], [o.tx + 1, o.ty]]; g.ox = o.x; }
    else {
      g.closed = gateV(o.kind, false); g.opened = gateV(o.kind, true, o.side); g.cx = o.tx * 16 + 8; g.cy = o.ty * 16 + 16;
      g.tiles = [[o.tx, o.ty], [o.tx, o.ty + 1]]; g.ox = o.side === 'w' ? o.x - 16 : o.x;
      const sx = o.side === 'w' ? o.tx - 1 : o.tx + 1; g.swing = [[sx, o.ty], [sx, o.ty + 1]];
    }
    this.gates.push(g);
  }
  pick(list) { return list[(this.rnd() * list.length) | 0]; }
  blocked(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H || this.block[y * this.W + x] === 1; }
  gateAt(x, y) { return this.gates.find(g => g.tiles.some(t => t[0] === x && t[1] === y) || (g.swing && g.swing.some(t => t[0] === x && t[1] === y))); }
  tileOf(p) { return [Math.max(0, Math.min(this.W - 1, p.x >> 4)), Math.max(0, Math.min(this.H - 1, (p.y - 3) >> 4))]; }
  onGround(p) { return p.visible && !p.tw; }

  path(from, to, extra) {
    const W = this.W, N = W * this.H, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), open = [], closed = new Uint8Array(N);
    const s = from[1] * W + from[0], e = to[1] * W + to[0], hx = to[0], hy = to[1];
    const bl = (x, y) => this.blocked(x, y) || (extra && extra.has(y * W + x) && y * W + x !== e);
    const h = i => { const dx = Math.abs(i % W - hx), dy = Math.abs(((i / W) | 0) - hy); return 0.7 * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy)); };
    g[s] = 0; open.push([h(s), s]);
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, c] = open.splice(bi, 1)[0]; if (c === e) break; if (closed[c]) continue; closed[c] = 1;
      const x = c % W, y = (c / W) | 0;
      for (const [dx, dy] of DIRS8) {
        const nx = x + dx, ny = y + dy; if (bl(nx, ny)) continue;
        if (dx && dy && (bl(x + dx, y) || bl(x, y + dy))) continue;
        const n = ny * W + nx, ng = g[c] + (dx && dy ? 1.414 : 1) * (this.M.isRoad(nx, ny) ? 0.7 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = c; open.push([ng + h(n), n]); }
      }
    }
    if (came[e] < 0 && s !== e) return null;
    const out = []; for (let c = e; c !== s; c = came[c]) out.push({ x: cx(c % W), y: cy((c / W) | 0) });
    return out.reverse();
  }
  goTo(p, tile, then, extra) {
    const pth = this.path(this.tileOf(p), tile, extra) || (extra && this.path(this.tileOf(p), tile));
    if (!pth) { p.st = 'idle'; p.t = 1; p.goal = null; return; }
    p.path = pth; p.st = 'walk'; p.then = then; p.goal = tile; p.stuck = 0; p.lastD = Infinity;
  }
  freeSpot(list) {
    const taken = new Set(this.people.filter(q => q.goal).map(q => q.goal + ''));
    for (let n = 0; n < 12; n++) { const t = this.pick(list); if (!taken.has(t + '')) return t; }
    return this.pick(list);
  }
  choose(p) {
    const r = this.rnd();
    if (r < 0.4) { const b = this.pick(this.blds); this.goTo(p, b.front, { type: 'door', b }); }
    else if (r < 0.5 && this.towers.some(t => !t.busy)) { const tw = this.pick(this.towers.filter(t => !t.busy)); tw.busy = p; this.goTo(p, tw.front, { type: 'tower', tw }); }
    else if (r < 0.72) this.goTo(p, this.freeSpot(this.inside), { type: 'idle' });
    else if (r < 0.9) this.goTo(p, this.freeSpot(this.outside), { type: 'idle' });
    else { const e = this.pick(this.ends); this.goTo(p, [e[0], e[1]], { type: 'leave', e }); }
  }
  step(dt) {
    const G = this.people.filter(q => this.onGround(q));
    for (const p of this.people) {
      p.t -= dt;
      if (p.st === 'idle' && p.t <= 0) this.choose(p);
      else if (p.st === 'walk' || p.st === 'step' || p.st === 'climb') {
        const w = p.path[0]; if (!w) { this.arrive(p); continue; }
        const dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy), mv = SPEED * dt * (p.st === 'climb' ? 0.45 : p.st === 'step' ? 0.6 : 1);
        if (p.st !== 'climb' && d > 0.01) p.dir = face(dx, dy);
        if (d <= mv) { p.x = w.x; p.y = w.y; p.path.shift(); p.dist += d; }
        else { p.x += dx / d * mv; p.y += dy / d * mv; p.dist += mv; }
        if (p.st === 'walk') {
          const rem = Math.hypot(w.x - p.x, w.y - p.y) + p.path.length * 16;
          if (rem > p.lastD - 0.2 * SPEED * dt) p.stuck += dt; else p.stuck = Math.max(0, p.stuck - dt);
          p.lastD = rem;
          if (p.stuck > 1.5) {
            const W = this.W, ex = new Set(G.filter(q => q !== p && q.st !== 'walk').map(q => { const t = this.tileOf(q); return t[1] * W + t[0]; }));
            this.goTo(p, p.goal, p.then, ex);
          }
        }
      } else if (p.st === 'door_in' && p.b.f >= 3) { p.st = 'step'; p.path = [{ ...p.b.door }]; p.then = { type: 'enter' }; p.dir = 'n'; }
      else if (p.st === 'inside' && p.t <= 0) { p.st = 'door_out'; p.b.users++; }
      else if (p.st === 'door_out' && p.b.f >= 3) { p.visible = true; p.x = p.b.door.x; p.y = p.b.door.y; p.dir = 's'; p.st = 'step'; p.path = [{ x: cx(p.b.front[0]), y: cy(p.b.front[1]) }]; p.then = { type: 'exited' }; }
      else if (p.st === 'away' && p.t <= 0) { const e = this.pick(this.ends); p.x = cx(e[0]) + e[2]; p.y = cy(e[1]) + e[3]; p.visible = true; p.st = 'step'; p.path = [{ x: cx(e[0]), y: cy(e[1]) }]; p.then = { type: 'idle', t: 0.1 }; }
      else if (p.st === 'watch') {
        if (p.t <= 0) { p.st = 'step'; p.path = [{ x: p.tw.foot.x, y: p.tw.deckY }]; p.then = { type: 'climb_down' }; }
        else if ((p.look -= dt) <= 0) { p.dir = ['s', 's', 'sw', 'se', p.side < 0 ? 'w' : 'e'][(this.rnd() * 5) | 0]; p.look = 1.5 + this.rnd() * 2; }
      }
    }
    this.separate(G, dt);
    for (const b of this.blds) { const tgt = b.users > 0 ? 3 : 0; b.f += Math.sign(tgt - b.f) * Math.min(Math.abs(tgt - b.f), DOOR_FPS * dt); }
    for (const g of this.gates) {
      const near = G.some(p => Math.abs(p.x - g.cx) < (g.o === 'h' ? 22 : 24) && Math.abs(p.y - g.cy) < 22);
      if (near) { g.open = true; g.hold = 0.6; } else if ((g.hold -= dt) <= 0) g.open = false;
    }
  }
  // Soft separation + keep-right on head-on meetings. Survivors in doorways/steps are anchors: they push, never get pushed.
  separate(G, dt) {
    for (const p of G) {
      if (p.st === 'step' || p.st === 'door_in' || p.st === 'door_out') continue;
      let fx = 0, fy = 0;
      const v = p.st === 'walk' && p.path[0] ? [p.path[0].x - p.x, p.path[0].y - p.y] : [0, 0], vl = Math.hypot(v[0], v[1]) || 1;
      for (const q of G) {
        if (q === p) continue;
        const dx = p.x - q.x, dy = (p.y - q.y) * 1.4, d = Math.hypot(dx, dy); if (d >= SEP || d === 0) continue;
        const k = (SEP - d) / SEP; fx += dx / d * k; fy += dy / d * k;
        if (p.st === 'walk' && (-dx * v[0] - dy * v[1]) / (d * vl) > 0.5) { fx += -v[1] / vl * k * 1.2; fy += v[0] / vl * k * 1.2; }
      }
      if (!fx && !fy) continue;
      const push = (p.st === 'walk' ? 18 : 10) * dt, nx = p.x + fx * push, ny = p.y + fy * push;
      const ok = (x, y) => { const tx = x >> 4, ty = (y - 3) >> 4; return !this.blocked(tx, ty); };
      if (ok(nx, p.y)) p.x = nx; if (ok(p.x, ny)) p.y = ny;
    }
  }
  arrive(p) {
    const T = p.then || { type: 'idle' }; p.then = null; if (p.st === 'walk') p.goal = null;
    if (T.type === 'door') { p.b = T.b; p.st = 'door_in'; p.b.users++; p.dir = 'n'; }
    else if (T.type === 'enter') { p.visible = false; p.st = 'inside'; p.t = 4 + this.rnd() * 5; p.b.users--; }
    else if (T.type === 'exited') { p.b.users--; p.b = null; p.st = 'idle'; p.t = 0.8 + this.rnd() * 1.5; }
    else if (T.type === 'leave') { p.st = 'step'; p.path = [{ x: p.x + T.e[2], y: p.y + T.e[3] }]; p.then = { type: 'gone' }; }
    else if (T.type === 'gone') { p.visible = false; p.st = 'away'; p.t = 3 + this.rnd() * 3; }
    else if (T.type === 'tower') { p.tw = T.tw; p.st = 'step'; p.path = [{ ...p.tw.foot }]; p.then = { type: 'climb_up' }; }
    else if (T.type === 'climb_up') { p.st = 'climb'; p.dir = 'n'; p.path = [{ x: p.tw.foot.x, y: p.tw.deckY }]; p.then = { type: 'deck' }; }
    else if (T.type === 'deck') { p.deck = true; p.side = this.rnd() < 0.5 ? -1 : 1; p.st = 'step'; p.path = [{ x: p.tw.foot.x + p.side * 7, y: p.tw.deckY }]; p.then = { type: 'watch' }; }
    else if (T.type === 'watch') { p.st = 'watch'; p.dir = 's'; p.t = 6 + this.rnd() * 6; p.look = 1.5; }
    else if (T.type === 'climb_down') { p.deck = false; p.st = 'climb'; p.dir = 'n'; p.path = [{ ...p.tw.foot }]; p.then = { type: 'descended' }; }
    else if (T.type === 'descended') { p.st = 'step'; p.path = [{ x: cx(p.tw.front[0]), y: cy(p.tw.front[1]) }]; p.then = { type: 'off_tower' }; }
    else if (T.type === 'off_tower') { if (p.tw) p.tw.busy = null; p.tw = null; p.st = 'idle'; p.t = 1 + this.rnd() * 2; }
    else { p.st = 'idle'; p.t = T.t ?? 1 + this.rnd() * 2; }
  }
  render() {
    const fr = new Spr(this.ground.w, this.ground.h); fr.p = this.ground.p.slice(); fr.sh = this.ground.sh.slice();
    const L = this.statics.slice();
    for (const g of this.gates) L.push({ spr: g.open ? g.opened : g.closed, x: g.open ? g.ox : g.x, y: g.y, key: g.key });
    for (const b of this.blds) L.push({ spr: b.frames[Math.min(b.frames.length - 1, Math.round(b.f))], x: b.x, y: b.y, key: b.key });
    const frameOf = p => { const F = this.SV[p.k]; if (!F) return null; const mv = p.st === 'walk' || p.st === 'step' || p.st === 'climb'; return F[p.dir][mv ? Math.floor(p.dist / (p.st === 'climb' ? 3 : 5)) % 4 : 0]; };
    for (const t of this.towers) {
      const on = this.people.filter(p => p.visible && p.tw === t && (p.st === 'climb' || p.deck));
      L.push({ key: t.key, x: t.x, draw: () => {
        fr.blit(t.spr, t.x, t.y);
        for (const p of on) { const s = frameOf(p); if (!s) continue; const X = Math.round(p.x) - 12, Y = Math.round(p.y) - 27; if (p.deck) blitClip(fr, s, X, Y, t.y + 28); else fr.blit(s, X, Y); }
        if (on.some(p => p.deck || p.y < t.y + 34)) fr.blit(t.over, t.x, t.y);
      } });
    }
    for (const p of this.people) {
      if (!p.visible || (p.tw && (p.st === 'climb' || p.deck))) continue;
      const s = frameOf(p); if (!s) continue;
      const [tx, ty] = this.tileOf(p), g = this.gateAt(tx, ty);
      L.push({ spr: s, x: Math.round(p.x) - 12, y: Math.round(p.y) - 27, key: g && g.open ? g.key + 0.5 : p.y + 0.1 });
    }
    L.sort((a, b) => a.key - b.key || a.x - b.x).forEach(o => o.draw ? o.draw() : fr.blit(o.spr, o.x, o.y));
    return fr;
  }
  lamps(carry) {
    const out = [];
    for (const p of this.people) {
      if (!p.visible || carry === 'none') continue;
      const type = carry === 'torch' ? 'torch' : carry === 'flash' ? 'flash' : (p.i % 2 ? 'flash' : 'torch');
      const v = VEC[p.dir], side = v[0] < 0 || (v[0] === 0 && v[1] < 0) ? -1 : 1;
      out.push({ type, seed: p.i * 1.7, x: Math.round(p.x + side * 6 + v[0]), y: Math.round(p.y - 11 + (v[1] < 0 ? -1 : 0)), dx: v[0], dy: v[1] });
    }
    return out;
  }

  // Persistence: plain JSON of people + door/gate/tower state.
  snapshot() {
    const ref = o => o ? (o.k ? { k: o.k } : { tx: o.tx, ty: o.ty }) : null;
    return { seed: this.seed, people: this.people.map(p => ({ ...p, b: ref(p.b), tw: ref(p.tw), then: p.then ? { ...p.then, b: ref(p.then.b), tw: ref(p.then.tw) } : null })),
      blds: this.blds.map(b => ({ f: b.f, users: b.users })), gates: this.gates.map(g => ({ open: g.open, hold: g.hold })), towers: this.towers.map(t => t.busy ? t.busy.k : null) };
  }
  restore(S) {
    if (!S || !S.people) return false;
    const byK = Object.fromEntries(S.people.map(p => [p.k, p]));
    this.people = this.people.map(p => byK[p.k] ? this.person({ ...byK[p.k] }) : p);
    this.people.forEach(p => {
      if (p.b) p.b = this.blds.find(b => b.k === p.b.k) || null;
      if (p.tw) p.tw = this.towers.find(t => t.tx === p.tw.tx && t.ty === p.tw.ty) || null;
      if (p.then) { if (p.then.b) p.then.b = this.blds.find(b => b.k === p.then.b.k); if (p.then.tw) p.then.tw = this.towers.find(t => t.tx === p.then.tw.tx && t.ty === p.then.tw.ty); }
      if ((p.st === 'inside' || p.st === 'door_in' || p.st === 'door_out' || (p.then && (p.then.type === 'enter' || p.then.type === 'exited'))) && !p.b) { p.st = 'idle'; p.visible = true; p.t = 0.5; }
    });
    (S.blds || []).forEach((b, i) => { if (this.blds[i]) Object.assign(this.blds[i], b); });
    (S.gates || []).forEach((g, i) => { if (this.gates[i]) Object.assign(this.gates[i], g); });
    this.towers.forEach((t, i) => { const k = (S.towers || [])[i]; t.busy = k ? this.people.find(p => p.k === k) || null : null; });
    this.settle(); return true;
  }
  save() { try { localStorage.setItem(STORE, JSON.stringify(this.snapshot())); } catch (e) {} }
  static saved() { try { return JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { return null; } }

  debug(ctx) {
    ctx.fillStyle = 'rgba(200,60,50,0.28)';
    for (let y = 0; y < this.H; y++) for (let x = 0; x < this.W; x++) if (this.block[y * this.W + x]) ctx.fillRect(x * 16, y * 16, 16, 16);
    ctx.fillStyle = 'rgba(197,212,138,0.35)'; for (const g of this.gates) for (const t of g.tiles) ctx.fillRect(t[0] * 16, t[1] * 16, 16, 16);
    ctx.fillStyle = 'rgba(120,170,220,0.45)'; for (const b of [...this.blds, ...this.towers]) ctx.fillRect(b.front[0] * 16 + 4, b.front[1] * 16 + 4, 8, 8);
    ctx.fillStyle = 'rgba(230,150,60,0.8)'; for (const t of this.towers) ctx.fillRect(t.foot.x - 1, t.deckY, 2, t.foot.y - t.deckY);
    ctx.strokeStyle = 'rgba(240,230,170,0.8)'; ctx.lineWidth = 1;
    for (const p of this.people) {
      if (!p.visible) continue;
      ctx.strokeRect(Math.round(p.x) - RAD + 0.5, Math.round(p.y) - 3 + 0.5, RAD * 2 - 1, 5);
      if (!p.path.length) continue;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); p.path.forEach(w => ctx.lineTo(w.x, w.y)); ctx.stroke();
    }
  }
}
