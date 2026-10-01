// Barricades are drawn as a run of 16-unit wall cells, the way the kit's wall tiles are laid.
// A panel covers two cells: side by side when it lies across (rotation 0), stacked when upright.
// Each cell takes the kit tile its linked neighbours call for: h, v, or a corner (tl, tr, bl, br).
export const WALL_CELL = 16;

// The centres of the cells a panel (two) or a gate (four) covers.
export function panelCells(b, count = 2) {
  return Array.from({ length: count }, (_, i) => {
    const along = (i - (count - 1) / 2) * WALL_CELL;
    return b.rotation ? { x: b.x, y: b.y + along } : { x: b.x + along, y: b.y };
  });
}

// Where a panel near (x, y) sits on the cell grid: its ends on grid lines and its thin side
// filling the cell (x, y) is in. The fence panels all sit on this grid already.
export function onWallGrid(x, y, rotation) {
  const end = v => Math.round(v / WALL_CELL) * WALL_CELL, cell = v => Math.floor(v / WALL_CELL) * WALL_CELL + WALL_CELL / 2;
  return rotation ? { x: cell(x), y: end(y) } : { x: end(x), y: cell(y) };
}

const cellKey = (x, y) => Math.floor(x / WALL_CELL) + ',' + Math.floor(y / WALL_CELL);

// Every panel's cells with their tile: [[{ x, y, shape }, { x, y, shape }], ...] in panel order.
// Two cells link across only if a panel lying across covers one of them, and up and down only
// if an upright panel does, so walls built side by side stay straight instead of turning.
// Gates are not tiled, but a wall turns onto the end of one as onto another panel.
export function wallTiles(panels, gates = []) {
  const cells = new Map();
  for (const [b, count] of [...panels.map(b => [b, 2]), ...gates.map(g => [g, 4])]) for (const c of panelCells(b, count)) {
    const k = cellKey(c.x, c.y), cell = cells.get(k) || { across: false, upright: false };
    if (b.rotation) cell.upright = true; else cell.across = true;
    cells.set(k, cell);
  }
  const at = (x, y) => cells.get(cellKey(x, y));
  const linked = (a, b, axis) => !!b && (a[axis] || b[axis]);
  return panels.map(b => panelCells(b).map(({ x, y }) => {
    const self = at(x, y);
    const w = linked(self, at(x - WALL_CELL, y), 'across'), e = linked(self, at(x + WALL_CELL, y), 'across');
    const n = linked(self, at(x, y - WALL_CELL), 'upright'), s = linked(self, at(x, y + WALL_CELL), 'upright');
    let shape = b.rotation ? 'v' : 'h';
    if (w && e) shape = 'h';
    else if (n && s) shape = 'v';
    else if ((w || e) && (n || s)) shape = (n ? 'b' : 't') + (e ? 'l' : 'r');
    return { x, y, shape };
  }));
}
