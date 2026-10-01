// Grid pathfinding with A*. Only vendor/pathfinding.mjs is imported here, so swapping the library touches this file alone.
import { Grid, AStarFinder, DiagonalMovement, Heuristic } from './vendor/pathfinding.mjs';

// Diagonal steps only where both side cells are open, so routes never cut a building's corner.
// No path smoothing: straight shortcuts between cells could clip obstacles.
const finder = new AStarFinder({ diagonalMovement: DiagonalMovement.OnlyWhenNoObstacles, heuristic: Heuristic.octile });
// One library grid per navigation grid; a new blocked array (map change) builds a new one.
const grids = new WeakMap();

// Cells from begin to finish, excluding begin, or null when finish can't be reached.
export function findCells(blocked, width, height, begin, finish) {
  let grid = grids.get(blocked);
  if (!grid) {
    grid = new Grid(width, height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (blocked[y * width + x]) grid.setWalkableAt(x, y, false);
    grids.set(blocked, grid);
  }
  // A* writes its bookkeeping into the nodes, so every search runs on a fresh copy.
  const path = finder.findPath(begin.x, begin.y, finish.x, finish.y, grid.clone());
  return path.length ? path.slice(1).map(([x, y]) => ({ x, y })) : null;
}
