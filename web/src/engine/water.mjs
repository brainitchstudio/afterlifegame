// Lakes, rivers and swamp pools in a generated world (game.water, built by applyWorldToGame). Nobody
// walks on water: a step that would land in it slides along the bank, the dead follow a flow field to the
// camp that crosses at the bridges, and survivors route round it on the tile grid. Installed onto
// Game.prototype by model.mjs.
import Heap from './vendor/heap.mjs';
import { distance } from './data.mjs';
import { parcelRect } from './land.mjs';

const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];

export class Water {
  // Tile (column, row) under a world point; off the map when outside 0..w-1, 0..h-1.
  waterTile(p) { const W = this.water; return { tx: Math.floor(p.x / 16 + W.ox), ty: Math.floor(p.y / 16 + W.oy) }; }
  // Whether the tile is open water. Off the map there is none.
  wetTile(tx, ty) { const W = this.water; return !!W && tx >= 0 && ty >= 0 && tx < W.w && ty < W.h && W.wet[ty * W.w + tx] === 1; }
  wetAt(p) { if (!this.water) return false; const { tx, ty } = this.waterTile(p); return this.wetTile(tx, ty); }
  tileCentre(tx, ty) { const W = this.water; return { x: (tx - W.ox + 0.5) * 16, y: (ty - W.oy + 0.5) * 16 }; }
  // Whether a straight walk from a to b stays out of the water.
  dryLine(a, b) {
    if (!this.water) return true;
    const steps = Math.max(1, Math.ceil(distance(a, b) / 6));
    for (let i = 0; i <= steps; i++) if (this.wetAt({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })) return false;
    return true;
  }
  // The step from `from` to `next`, or as much of it as stays dry: the whole step, then either axis alone.
  // Anyone already in the water (dropped there by a spawn or a load) may wade out.
  dryStep(from, next) {
    if (!this.water || !this.wetAt(next) || this.wetAt(from)) return next;
    if (!this.wetAt({ x: next.x, y: from.y })) return { ...next, y: from.y };
    if (!this.wetAt({ x: from.x, y: next.y })) return { ...next, x: from.x };
    return { ...next, x: from.x, y: from.y };
  }
  // Tile distance from every dry tile to the claimed land over dry ground and bridges, rebuilt when the
  // land changes. The dead walk it downhill.
  get waterFlow() {
    const W = this.water;
    if (this._waterFlow?.water === W && this._waterFlow.revision === this.landRevision) return this._waterFlow.dist;
    const dist = new Float64Array(W.w * W.h).fill(Infinity), heap = new Heap((a, b) => a[0] - b[0]);
    for (const p of this.land) {
      const r = parcelRect(p);
      for (let ty = Math.floor(r.top / 16 + W.oy); ty < Math.ceil(r.bottom / 16 + W.oy); ty++) for (let tx = Math.floor(r.left / 16 + W.ox); tx < Math.ceil(r.right / 16 + W.ox); tx++) {
        if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h || W.wet[ty * W.w + tx]) continue;
        dist[ty * W.w + tx] = 0; heap.push([0, tx, ty]);
      }
    }
    while (!heap.empty()) {
      const [d, x, y] = heap.pop();
      if (d > dist[y * W.w + x]) continue;
      for (const [dx, dy, c] of N8) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W.w || ny >= W.h || W.wet[ny * W.w + nx] || (dx && dy && (W.wet[y * W.w + nx] || W.wet[ny * W.w + x]))) continue;
        if (d + c < dist[ny * W.w + nx]) { dist[ny * W.w + nx] = d + c; heap.push([d + c, nx, ny]); }
      }
    }
    this._waterFlow = { water: W, revision: this.landRevision, dist };
    return dist;
  }
  // Which way the flow field leads from p, as a unit vector, or null where it can't help. Off the map it
  // leads to the nearest dry tile on the edge that the field reaches.
  flowDirection(p) {
    const W = this.water; if (!W) return null;
    const dist = this.waterFlow, { tx, ty } = this.waterTile(p), at = (x, y) => x >= 0 && y >= 0 && x < W.w && y < W.h ? dist[y * W.w + x] : Infinity;
    let best = null, bestValue = at(tx, ty);
    if (tx < 0 || ty < 0 || tx >= W.w || ty >= W.h) {
      const cx = Math.max(0, Math.min(W.w - 1, tx)), cy = Math.max(0, Math.min(W.h - 1, ty)), along = cx === tx;
      bestValue = Infinity;
      for (let k = -16; k <= 16; k++) { const x = along ? cx + k : cx, y = along ? cy : cy + k, v = at(x, y) + Math.abs(k) * 1.5; if (v < bestValue) { bestValue = v; best = [x, y]; } }
    } else for (const [dx, dy] of N8) {
      const nx = tx + dx, ny = ty + dy, v = at(nx, ny);
      if (dx && dy && (this.wetTile(nx, ty) || this.wetTile(tx, ny))) continue;
      if (v < bestValue) { bestValue = v; best = [nx, ny]; }
    }
    if (!best) return null;
    const c = this.tileCentre(best[0], best[1]), d = distance(p, c) || 1;
    return { x: (c.x - p.x) / d, y: (c.y - p.y) / d };
  }
  // Waypoints from start to end round the water: A* over the tiles (8 directions, never cutting a wet
  // corner), then shortened to straight dry runs. [end] when the straight line is dry; null when no dry
  // way exists.
  waterPath(start, end) {
    if (this.dryLine(start, end)) return [end];
    const W = this.water, s = this.waterTile(start), e = this.waterTile(end), clampT = (v, n) => Math.max(0, Math.min(n - 1, v));
    const sx = clampT(s.tx, W.w), sy = clampT(s.ty, W.h), ex = clampT(e.tx, W.w), ey = clampT(e.ty, W.h);
    if (W.wet[ey * W.w + ex]) return null;
    const g = new Float64Array(W.w * W.h).fill(Infinity), from = new Int32Array(W.w * W.h).fill(-1), heap = new Heap((a, b) => a[0] - b[0]);
    const guess = (x, y) => { const dx = Math.abs(x - ex), dy = Math.abs(y - ey); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); };
    g[sy * W.w + sx] = 0; heap.push([guess(sx, sy), sx, sy]);
    let found = false;
    while (!heap.empty()) {
      const [, x, y] = heap.pop(), k = y * W.w + x;
      if (x === ex && y === ey) { found = true; break; }
      for (const [dx, dy, c] of N8) {
        const nx = x + dx, ny = y + dy, nk = ny * W.w + nx;
        if (nx < 0 || ny < 0 || nx >= W.w || ny >= W.h || W.wet[nk] || (dx && dy && (W.wet[y * W.w + nx] || W.wet[ny * W.w + x]))) continue;
        if (g[k] + c < g[nk]) { g[nk] = g[k] + c; from[nk] = k; heap.push([g[nk] + guess(nx, ny), nx, ny]); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = ey * W.w + ex; k >= 0; k = from[k]) cells.push(this.tileCentre(k % W.w, Math.floor(k / W.w)));
    cells.reverse();
    const points = [...cells.slice(1), end], out = [];
    for (let at = start, i = 0; i < points.length;) {
      let j = i; while (j + 1 < points.length && this.dryLine(at, points[j + 1])) j++;
      out.push(points[j]); at = points[j]; i = j + 1;
    }
    return out;
  }
  // A walk through the waypoints from `from`, with each wet stretch replaced by a way round.
  dryWay(from, points) {
    if (!this.water) return points;
    const out = [];
    for (let at = from, i = 0; i < points.length; at = points[i++]) {
      const leg = this.dryLine(at, points[i]) ? null : this.waterPath(at, points[i]);
      if (leg) out.push(...leg); else out.push(points[i]);
    }
    return out;
  }
  // A parcel with water in it, or within reach of the patrol lane round it, can't be claimed: walls, the
  // navigation grid and the lane can't stand in water.
  wetParcel(p) {
    if (!this.water) return false;
    const r = parcelRect(p), W = this.water, m = 3;
    for (let ty = Math.floor(r.top / 16 + W.oy) - m; ty < Math.ceil(r.bottom / 16 + W.oy) + m; ty++) for (let tx = Math.floor(r.left / 16 + W.ox) - m; tx < Math.ceil(r.right / 16 + W.ox) + m; tx++) if (this.wetTile(tx, ty)) return true;
    return false;
  }
}
