// Static point indexes for proximity queries during one simulation step.
// Only vendor/kdbush.mjs is imported here, so swapping the library touches this file alone.
import KDBush from './vendor/kdbush.mjs';
import { BUILDINGS } from './data.mjs';

// kdbush compares squared distances; the margin keeps anything Math.hypot would still call in range.
const margin = r => r * (1 + 1e-9) + 1e-9;

// Snapshot of entity positions. Rebuild it whenever any of them move.
export function buildIndex(entities) {
  const index = new KDBush(entities.length);
  for (const e of entities) index.add(e.x, e.y);
  index.finish();
  return { index, entities };
}
// Every indexed entity within r of p, in original array order, so callers keep
// the tie-breaking of a plain loop. A superset: callers still apply their exact checks.
export function near({ index, entities }, p, r) {
  return index.within(p.x, p.y, margin(r)).sort((a, b) => a - b).map(i => entities[i]);
}
// A point inside a building padded by `padding` is at most this far from the building's centre.
export const buildingReach = padding => Math.max(...Object.values(BUILDINGS).map(d => Math.hypot(d.w / 2 + padding, d.h / 2 + padding)));
