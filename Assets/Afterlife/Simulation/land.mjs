// Territory is a connected union of rectangular parcels. Shared edges are open;
// only the exposed outline reserves room for fences and patrols.
export const PARCEL_W = 256;
export const PARCEL_H = 192;
export const LAND_RADIUS = 3;
export const parcelKey = (col, row) => col + ',' + row;
export const initialLand = () => Array.from({ length: 9 }, (_, i) => ({ col: i % 3 - 1, row: Math.floor(i / 3) - 1 }));
export const parcelRect = ({ col, row }) => ({ left: col * PARCEL_W - PARCEL_W / 2, right: col * PARCEL_W + PARCEL_W / 2, top: row * PARCEL_H - PARCEL_H / 2, bottom: row * PARCEL_H + PARCEL_H / 2 });
export const parcelAt = p => ({ col: Math.floor((p.x + PARCEL_W / 2) / PARCEL_W), row: Math.floor((p.y + PARCEL_H / 2) / PARCEL_H) });
export function landBounds(land) {
  const rects = land.map(parcelRect);
  return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)) };
}
export function ownsRect(land, rect) {
  const keys = new Set(land.map(p => parcelKey(p.col, p.row)));
  const start = parcelAt({ x: rect.left, y: rect.top }), end = parcelAt({ x: rect.right - .001, y: rect.bottom - .001 });
  for (let col = start.col; col <= end.col; col++) for (let row = start.row; row <= end.row; row++) if (!keys.has(parcelKey(col, row))) return false;
  return true;
}
export function frontier(land) {
  const owned = new Set(land.map(p => parcelKey(p.col, p.row))), result = new Map();
  for (const p of land) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const col = p.col + dc, row = p.row + dr, key = parcelKey(col, row);
    if (Math.abs(col) <= LAND_RADIUS && Math.abs(row) <= LAND_RADIUS && !owned.has(key)) result.set(key, { col, row });
  }
  return [...result.values()];
}
export function borderEdges(land) {
  const keys = new Set(land.map(p => parcelKey(p.col, p.row))), edges = [];
  for (const p of land) {
    const r = parcelRect(p);
    if (!keys.has(parcelKey(p.col, p.row - 1))) edges.push({ side: 'north', x1: r.left, y1: r.top, x2: r.right, y2: r.top });
    if (!keys.has(parcelKey(p.col + 1, p.row))) edges.push({ side: 'east', x1: r.right, y1: r.top, x2: r.right, y2: r.bottom });
    if (!keys.has(parcelKey(p.col, p.row + 1))) edges.push({ side: 'south', x1: r.left, y1: r.bottom, x2: r.right, y2: r.bottom });
    if (!keys.has(parcelKey(p.col - 1, p.row))) edges.push({ side: 'west', x1: r.left, y1: r.top, x2: r.left, y2: r.bottom });
  }
  return edges;
}
const AROUND = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
// A corner of the outline where only one of the four parcels around it is owned.
function convexCorner(land, x, y) {
  const keys = new Set(land.map(p => parcelKey(p.col, p.row)));
  return AROUND.filter(([dx, dy]) => { const p = parcelAt({ x: x + dx, y: y + dy }); return keys.has(parcelKey(p.col, p.row)); }).length === 1;
}
// Fence panels all the way round, except the road gaps the gates fill. `legacy` gives the old
// layout, which left wider road gaps and kept the panels beside each gate and at every outer
// corner for wall towers; saves use it to find the slots that are new.
export function perimeterSlots(land, legacy = false) {
  const slots = [];
  for (const e of borderEdges(land)) {
    const horizontal = e.y1 === e.y2, length = horizontal ? e.x2 - e.x1 : e.y2 - e.y1;
    const startTower = legacy && convexCorner(land, e.x1, e.y1), endTower = legacy && convexCorner(land, e.x2, e.y2);
    const road = legacy ? 64 : 32;
    for (let d = 16; d < length; d += 32) {
      const along = (horizontal ? e.x1 : e.y1) + d;
      if (Math.abs(along) < road) continue;
      if ((d === 16 && startTower) || (d === length - 16 && endTower)) continue;
      slots.push({ x: horizontal ? along : e.x1 + (e.side === 'west' ? 8 : -8), y: horizontal ? e.y1 + (e.side === 'north' ? 8 : -8) : along, rotation: horizontal ? 0 : 1 });
    }
  }
  return slots;
}
// A gate on every road: one wherever an edge of the outline crosses x = 0 (north and south,
// hung across) or y = 0 (east and west, hung upright), filling the gap perimeterSlots leaves
// there.
const OUTWARD = { north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 } };
export function gateSlots(land) {
  const slots = [];
  for (const e of borderEdges(land)) {
    const horizontal = e.y1 === e.y2;
    if (horizontal ? !(e.x1 < 0 && e.x2 > 0) : !(e.y1 < 0 && e.y2 > 0)) continue;
    slots.push({ ...gateway(horizontal ? { x: 0, y: e.y1 } : { x: e.x1, y: 0 }, e.side), road: true });
  }
  return slots;
}
// A way through the wall where it crosses `edge`, facing `side`. `outer` and `inner` are the
// points just outside and just inside it, the inner one on the navigation grid.
export function gateway(edge, side) {
  const n = OUTWARD[side];
  return { x: edge.x - n.x * 8, y: edge.y - n.y * 8, rotation: n.x ? 1 : 0, side, outward: n, outer: { x: edge.x + n.x * 24, y: edge.y + n.y * 24 }, inner: { x: edge.x - n.x * 32, y: edge.y - n.y * 32 } };
}
// A gate can also stand on the fence itself, across two neighbouring panel slots in a straight run.
export function fenceGateSlots(land) {
  const slots = perimeterSlots(land), keys = new Set(slots.map(s => [s.x, s.y, s.rotation].join(',')));
  return slots.filter(s => keys.has(s.rotation ? [s.x, s.y + 32, 1].join(',') : [s.x + 32, s.y, 0].join(','))).map(s => ({ x: s.x + (s.rotation ? 0 : 16), y: s.y + (s.rotation ? 16 : 0), rotation: s.rotation }));
}
// Whether a fence slot lies under a gate (a gate on the fence covers two; one in a road gap none).
export const underGate = (slot, gate) => (slot.rotation || 0) === (gate.rotation || 0) && (gate.rotation ? slot.x === gate.x && Math.abs(slot.y - gate.y) < 32 : slot.y === gate.y && Math.abs(slot.x - gate.x) < 32);
// Guards patrol a lane this far outside the fence.
export const OUTER_LANE = 30;
// The outline of the claimed land as one clockwise loop of parcel-edge vertices, each moved
// OUTER_LANE outward (diagonally at corners), so the straight run between neighbours stays clear
// of the wall. Returns [{ x, y, side }] where side is the fence the point faces.
export function outerLane(land, offset = OUTER_LANE) {
  // Clockwise on screen: north edges run east, east edges south, south edges west, west edges north.
  const edges = borderEdges(land).map(e => e.side === 'south' || e.side === 'west' ? { side: e.side, ax: e.x2, ay: e.y2, bx: e.x1, by: e.y1 } : { side: e.side, ax: e.x1, ay: e.y1, bx: e.x2, by: e.y2 });
  if (!edges.length) return [];
  const from = new Map();
  for (const e of edges) { const k = e.ax + ',' + e.ay; if (!from.has(k)) from.set(k, []); from.get(k).push(e); }
  // The top-left-most edge is on the outer boundary; holes in the land are left to the fence.
  let e = edges.reduce((a, b) => b.ax < a.ax || (b.ax === a.ax && b.ay < a.ay) ? b : a);
  const loop = [], used = new Set();
  while (e && !used.has(e)) { used.add(e); loop.push(e); e = (from.get(e.bx + ',' + e.by) || []).find(n => !used.has(n)) || null; }
  const normal = e => { const dx = Math.sign(e.bx - e.ax), dy = Math.sign(e.by - e.ay); return { x: dy, y: -dx }; };
  return loop.map((e, i) => {
    const before = loop[(i - 1 + loop.length) % loop.length], n1 = normal(before), n2 = normal(e);
    const same = n1.x === n2.x && n1.y === n2.y;
    return { x: e.ax + offset * (same ? n2.x : n1.x + n2.x), y: e.ay + offset * (same ? n2.y : n1.y + n2.y), side: e.side };
  });
}
// Patrol routes run outside the wall. `any` is the whole lane, a closed loop; each side's route
// is the stretch of lane facing that side's fence, walked end to end and back.
export function patrolRoutes(land) {
  const any = outerLane(land), routes = { any, north: [], east: [], south: [], west: [] };
  any.forEach((p, i) => {
    const next = any[(i + 1) % any.length];
    for (const q of [p, next]) if (!routes[p.side].includes(q)) routes[p.side].push(q);
  });
  // Start each side's walk at the end of its longest unbroken run so the order follows the lane.
  for (const side of ['north', 'east', 'south', 'west']) {
    const r = routes[side], at = any.indexOf(r[0]);
    if (at < 0) continue;
    const idx = q => (any.indexOf(q) - at + any.length) % any.length;
    r.sort((a, b) => idx(a) - idx(b));
  }
  return routes;
}
// Whether any claimed parcel overlaps the rectangle.
export function touchesLand(land, rect) {
  const keys = new Set(land.map(p => parcelKey(p.col, p.row)));
  const start = parcelAt({ x: rect.left, y: rect.top }), end = parcelAt({ x: rect.right - .001, y: rect.bottom - .001 });
  for (let col = start.col; col <= end.col; col++) for (let row = start.row; row <= end.row; row++) if (keys.has(parcelKey(col, row))) return true;
  return false;
}
export function validLand(land) {
  if (!Array.isArray(land) || land.length < 9 || land.length > (LAND_RADIUS * 2 + 1) ** 2) return false;
  if (!land.every(p => Number.isInteger(p?.col) && Number.isInteger(p?.row) && Math.abs(p.col) <= LAND_RADIUS && Math.abs(p.row) <= LAND_RADIUS)) return false;
  const keys = new Set(land.map(p => parcelKey(p.col, p.row)));
  if (keys.size !== land.length || initialLand().some(p => !keys.has(parcelKey(p.col, p.row)))) return false;
  const visited = new Set(['0,0']), queue = [{ col: 0, row: 0 }];
  for (let i = 0; i < queue.length; i++) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const col = queue[i].col + dc, row = queue[i].row + dr, key = parcelKey(col, row);
    if (keys.has(key) && !visited.has(key)) { visited.add(key); queue.push({ col, row }); }
  }
  return visited.size === land.length;
}
