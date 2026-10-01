// The walkable grid, pathfinding and movement. Installed onto Game.prototype by model.mjs.
import { ownsRect, gateSlots, gateway, touchesLand, parcelAt } from './land.mjs';
import { clamp, distance } from './data.mjs';
import { boundsOf, inside, rectDistance } from './rules.mjs';
import { findCells } from './pathing.mjs';
import { steerAroundTrees } from './trees.mjs';

export class Navigation {
  // A small navigation grid keeps survivors out of buildings and leaves corner
  // patrols navigable after construction. Zombies attack obstacles in their way.
  // Gates are not obstacles here: they open for survivors.
  nav() {
    const step = 16, area = this.territory;
    const width = Math.round((area.right - area.left) / step) + 1, height = Math.round((area.bottom - area.top) / step) + 1;
    const toPoint = c => ({ x: c.x * step + area.left, y: c.y * step + area.top });
    if (!this.navigation || this.navigation.version !== this.navVersion || this.navigation.width !== width || this.navigation.height !== height) {
      const blocked = new Uint8Array(width * height), obstacles = this.buildings.filter(b => b.type !== 'gate').map(b => boundsOf(b, 5));
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const p = toPoint({ x, y });
        blocked[y * width + x] = !ownsRect(this.land, { left: p.x - 5, right: p.x + 5, top: p.y - 5, bottom: p.y + 5 }) || obstacles.some(r => inside(p, r)) ? 1 : 0;
      }
      this.navigation = { version: this.navVersion, blocked, width, height };
    }
    return { step, area, width, height, toPoint, blocked: this.navigation.blocked };
  }
  // Grid points only: anything off the 16-unit grid rounds to its nearest cell.
  walkable(p) {
    const { area, width, height, blocked } = this.nav(), x = Math.round((p.x - area.left) / 16), y = Math.round((p.y - area.top) / 16);
    return x >= 0 && y >= 0 && x < width && y < height && !blocked[y * width + x];
  }
  // The nearest open grid point beside a building, where a worker can reach it. Never in a gate
  // opening, where they would hold the gate open.
  approachPoint(b, from) {
    if (this.outside(b)) return this.openApproach(b, from);
    const r = boundsOf(b), gates = this.buildings.filter(g => g.type === 'gate').map(g => boundsOf(g, 4));
    let best = null, bestDistance = Infinity;
    for (let x = Math.floor((r.left - 24) / 16) * 16; x <= r.right + 24; x += 16) for (let y = Math.floor((r.top - 24) / 16) * 16; y <= r.bottom + 24; y += 16) {
      const p = { x, y }, edge = rectDistance(p, r);
      if (edge < 6 || edge > 24 || !this.walkable(p) || gates.some(g => inside(p, g))) continue;
      const d = distance(p, from);
      if (d < bestDistance) { best = p; bestDistance = d; }
    }
    return best;
  }
  // Outside the wall there is no grid: the nearest point just off the building, clear of the
  // fence and of tree trunks, which walkers are pushed off.
  openApproach(b, from) {
    const r = boundsOf(b), trees = this.forest.trees.filter(t => rectDistance(t, r) < 24);
    let best = null, bestDistance = Infinity;
    for (let x = r.left - 12; x <= r.right + 12; x += 4) for (let y = r.top - 12; y <= r.bottom + 12; y += 4) {
      const p = { x, y }, edge = rectDistance(p, r);
      if (edge < 8 || edge > 12 || !this.clearOfLand(p, p, 4) || trees.some(t => distance(t, p) < t.radius + 6)) continue;
      const d = distance(p, from);
      if (d < bestDistance) { best = p; bestDistance = d; }
    }
    return best;
  }
  // Guards run to the open point nearest a zombie, or the closest fence corner.
  // Outside the wall there is no grid, so they run straight at it.
  huntPoint(z) {
    if (this.outside(z)) return { x: Math.round(z.x), y: Math.round(z.y) };
    const area = this.territory;
    const c = { x: Math.round(clamp(z.x, area.left + 32, area.right - 32) / 16) * 16, y: Math.round(clamp(z.y, area.top + 32, area.bottom - 32) / 16) * 16 };
    let best = null, bestDistance = Infinity;
    for (let dx = -80; dx <= 80; dx += 16) for (let dy = -80; dy <= 80; dy += 16) {
      const p = { x: c.x + dx, y: c.y + dy }, d = distance(p, z);
      if (d < bestDistance && this.walkable(p)) { best = p; bestDistance = d; }
    }
    return best || this.routes.any.reduce((a, p) => distance(p, z) < distance(a, z) ? p : a);
  }
  // The ways through the wall: the road openings, standing gate or not, and any gate standing on the fence.
  get gateways() {
    const revision = this.landRevision + ':' + this.navVersion;
    if (this._gateways?.revision !== revision) {
      const roads = gateSlots(this.land), onRoad = b => roads.some(g => g.x === b.x && g.y === b.y);
      const fence = this.buildings.filter(b => b.type === 'gate' && !onRoad(b)).map(b => {
        const side = b.rotation ? (this.outside({ x: b.x - 16, y: b.y }) ? 'west' : 'east') : (this.outside({ x: b.x, y: b.y - 16 }) ? 'north' : 'south');
        const out = { north: [0, -8], south: [0, 8], west: [-8, 0], east: [8, 0] }[side];
        return gateway({ x: b.x + out[0], y: b.y + out[1] }, side);
      });
      this._gateways = { revision, slots: [...roads, ...fence] };
    }
    return this._gateways.slots;
  }
  outside(p) {
    if (this._owned?.revision !== this.landRevision) this._owned = { revision: this.landRevision, keys: new Set(this.land.map(q => q.col + ',' + q.row)) };
    const c = parcelAt(p);
    return !this._owned.keys.has(c.col + ',' + c.row);
  }
  // Waypoints ending exactly at `end`, or [] with no route. Inside the fence this is A* over the
  // grid; a trip to or from the wilds goes through the nearest gateway and around the outer lane.
  findPath(start, end) {
    const out = this.outside(start), bound = this.outside(end);
    if (!out && !bound) return this.gridPath(start, end);
    if (out && bound) return this.lanePath(start, end);
    const far = out ? start : end, gate = this.gateways.reduce((a, g) => !a || distance(g.outer, far) < distance(a.outer, far) ? g : a, null);
    if (!gate) return [];
    if (out) { const rest = this.gridPath(gate.inner, end); return rest.length ? [...this.lanePath(start, gate.outer), gate.inner, ...rest] : []; }
    const lead = this.gridPath(start, gate.inner);
    return lead.length ? [...lead, gate.outer, ...this.lanePath(gate.outer, end)] : [];
  }
  // A straight walk that never comes within `pad` of claimed land, so it can't clip the wall.
  clearOfLand(a, b, pad = 3) {
    const length = distance(a, b), steps = Math.max(1, Math.ceil(length / 8));
    for (let i = 0; i <= steps; i++) {
      const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
      if (touchesLand(this.land, { left: x - pad, right: x + pad, top: y - pad, bottom: y + pad })) return false;
    }
    return true;
  }
  // Outside the wall: straight when the way is clear, otherwise round the outer lane the
  // shorter way, joining and leaving it as late and as early as the wall allows.
  lanePath(start, end) {
    const lane = this.routes.any;
    if (!lane.length || this.clearOfLand(start, end)) return [end];
    const n = lane.length, nearest = p => lane.reduce((best, q, i) => distance(q, p) < distance(lane[best], p) ? i : best, 0);
    const i = nearest(start), j = nearest(end), walk = dir => { const points = []; for (let k = i; ; k = (k + dir + n) % n) { points.push(lane[k]); if (k === j) return points; } };
    const length = points => points.reduce((sum, p, k) => k ? sum + distance(points[k - 1], p) : 0, 0);
    const forward = walk(1), backward = walk(-1), points = length(forward) <= length(backward) ? forward : backward;
    while (points.length > 1 && this.clearOfLand(start, points[1])) points.shift();
    while (points.length > 1 && this.clearOfLand(points.at(-2), end)) points.pop();
    return [...points.map(p => ({ x: p.x, y: p.y })), end];
  }
  // A* over the navigation grid, 8-directional.
  gridPath(start, end) {
    const { width, height, area, step, toPoint, blocked } = this.nav();
    const toCell = p => ({ x: clamp(Math.round((p.x - area.left) / step), 0, width - 1), y: clamp(Math.round((p.y - area.top) / step), 0, height - 1) });
    const cells = findCells(blocked, width, height, toCell(start), toCell(end));
    return cells ? [...cells.map(toPoint), end] : [];
  }
  // Walks toward a goal, re-planning when the map or a moving goal changes.
  // Returns true once the survivor is standing on the goal.
  travel(s, goal, speed, dt) {
    if (distance(s, goal) < 3) { s.path = []; return true; }
    const stale = !s.path.length || s.pathVersion !== this.navVersion || !s.pathGoal || distance(s.pathGoal, goal) > 12;
    if (stale && !s.pathRetry) {
      s.path = this.findPath(s, goal); s.pathVersion = this.navVersion; s.pathGoal = { x: goal.x, y: goal.y };
      if (!s.path.length) s.pathRetry = 1;
    }
    if (s.path.length) {
      const p = s.path[0], d = distance(s, p), movement = Math.min(d, speed * dt);
      if (d <= movement + .1) { s.x = p.x; s.y = p.y; s.path.shift(); }
      else if (this.outside(s)) {
        // Out in the wilds, step around tree trunks like the dead do.
        const next = steerAroundTrees(this.forest, s, { x: (p.x - s.x) / d, y: (p.y - s.y) / d }, movement, 4, s.id % 2 ? 1 : -1);
        s.x = next.x; s.y = next.y;
      } else { s.x += (p.x - s.x) / d * movement; s.y += (p.y - s.y) / d * movement; }
      if (Math.abs(p.x - s.x) > 1) s.facing = p.x < s.x ? -1 : 1;
    }
    return false;
  }
  // The whole lane is a loop; a side's stretch of it is walked end to end and back.
  patrol(s, speed, dt) {
    const route = this.route(s), loop = route === this.routes.any;
    if (this.travel(s, route[s.patrolIndex % route.length], speed, dt)) {
      if (loop) s.patrolIndex = (s.patrolIndex + 1) % route.length;
      else {
        if (s.patrolIndex + (s.patrolDir || 1) < 0 || s.patrolIndex + (s.patrolDir || 1) >= route.length) s.patrolDir = -(s.patrolDir || 1);
        s.patrolIndex = Math.max(0, Math.min(route.length - 1, s.patrolIndex + (s.patrolDir || 1)));
      }
    }
    s.task = 'patrol';
  }
  // Approach points are cached per building until the navigation grid changes.
  goalFor(s, b) {
    const key = b.id + ':' + this.navVersion;
    if (s.goalKey !== key) { s.goal = this.approachPoint(b, s); s.goalKey = key; }
    return s.goal;
  }
  standBy(s, post, speed, dt) {
    const spot = this.goalFor(s, post);
    s.task = spot && !this.travel(s, spot, speed, dt) ? 'to-post' : 'standby';
  }
}
