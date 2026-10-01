// Trees in the wilds around the refuge. They are part of the world, not the ground:
// the dead steer around their trunks, and the view depth-sorts them with the actors
// so a zombie can pass behind a tree as well as in front of it.
import { parcelRect } from './land.mjs';
import { buildIndex, near } from './spatial.mjs';

function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

// Trunks this far apart (centre to centre) always leave a gap even a brute fits through.
const SPACING = 30;
export const TRUNK_REACH = 8; // Largest trunk radius, for proximity queries.

// Deterministic for a given territory and viewport, so the view and simulation agree.
export function scatterTrees(land, bounds) {
  const rand = seeded(42390), bx = Math.ceil(bounds.x) + 60, by = Math.ceil(bounds.y) + 60, trees = [];
  const rects = land.map(parcelRect);
  for (let i = 0; i < 250; i++) {
    const x = Math.round((rand() - .5) * bx * 2), y = Math.round((rand() - .5) * by * 2);
    const kind = Math.floor(rand() * 3), scale = .72 + rand() * .7, alpha = .8 + rand() * .2;
    if (rects.some(r => x > r.left - 42 && x < r.right + 42 && y > r.top - 20 && y < r.bottom + 75) || Math.abs(x) < 50 || Math.abs(y) < 38) continue;
    if (trees.some(t => Math.hypot(t.x - x, t.y - y) < SPACING)) continue;
    trees.push({ x, y, kind, scale, alpha, radius: 3.5 * scale + 1 });
  }
  return { trees, index: buildIndex(trees) };
}

// Bends a unit heading away from the nearest trunk in the way, then takes the step and
// slides along any trunk it would still clip. `body` is the walker's own radius.
export function steerAroundTrees(forest, from, dir, length, body, bias = 1) {
  const look = 16 + body * 2;
  let blocker = null, blockerAlong = Infinity, blockerSide = 0;
  for (const t of near(forest.index, from, look + TRUNK_REACH + body)) {
    const rx = t.x - from.x, ry = t.y - from.y, along = rx * dir.x + ry * dir.y, side = dir.x * ry - dir.y * rx;
    if (along <= 0 || along > look + t.radius || Math.abs(side) >= t.radius + body || along >= blockerAlong) continue;
    blocker = t; blockerAlong = along; blockerSide = side;
  }
  let hx = dir.x, hy = dir.y;
  if (blocker) {
    // Turn away from the side the trunk is on; dead-centre hits pick the walker's habitual side.
    const clearance = blocker.radius + body, away = Math.abs(blockerSide) < .5 ? bias : -Math.sign(blockerSide);
    const push = (1.2 - Math.abs(blockerSide) / clearance) * (1.4 - blockerAlong / (look + blocker.radius));
    hx += -dir.y * away * push; hy += dir.x * away * push;
    const n = Math.hypot(hx, hy); hx /= n; hy /= n;
  }
  let x = from.x + hx * length, y = from.y + hy * length;
  for (const t of near(forest.index, { x, y }, TRUNK_REACH + body)) {
    const dx = x - t.x, dy = y - t.y, d = Math.hypot(dx, dy), clearance = t.radius + body;
    if (d >= clearance) continue;
    if (d < 1e-6) { x = t.x + -hy * bias * clearance; y = t.y + hx * bias * clearance; }
    else { x = t.x + dx / d * clearance; y = t.y + dy / d * clearance; }
  }
  return { x, y, dx: hx, dy: hy };
}
