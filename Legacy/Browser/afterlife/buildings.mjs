// Construction, upgrades, repairs, land, housing and shelter. Installed onto Game.prototype by model.mjs.
import { frontier, ownsRect, touchesLand, perimeterSlots, gateSlots, fenceGateSlots, underGate, patrolRoutes } from './land.mjs';
import { TUNING as T } from './survivors.mjs';
import { BUILDINGS, BUILDING_TREES, jobOf, distance, has } from './data.mjs';
import { buildingMaxHP, boundsOf, inside } from './rules.mjs';

export class Buildings {
  get landCost() { const bought = this.land.length - 9; return { wood: 80 + bought * 35, metal: 25 + bought * 12 }; }
  availableLand() { return frontier(this.land); }
  buyLand(col, row) {
    if (this.status !== 'playing' || !this.availableLand().some(p => p.col === col && p.row === row) || !this.afford(this.landCost)) return false;
    const oldLand = [...this.land];
    this.spend(this.landCost);
    this.land.push({ col, row });
    this.extendPerimeter(oldLand);
    this.landRevision++;
    this.routes = patrolRoutes(this.land);
    for (const s of this.survivors) { this.dismount(s); this.resetPatrol(s); s.goalKey = ''; }
    this.notify('Territory secured', 'A new parcel is ready to build on. The wall, its gates and the patrol lane have moved out.', 'good');
    return true;
  }
  // `legacy` measures what is new against the old wall layout rather than the old land.
  extendPerimeter(oldLand = [], legacy = false) {
    const key = b => [b.x, b.y, b.rotation || 0].join(',');
    // Gates on the fence stay where the fence still runs; the slots under them need no panels.
    const gates = gateSlots(this.land), gateKeys = new Set(gates.map(key)), oldGates = new Set(gateSlots(oldLand).map(key)), onFence = new Set(fenceGateSlots(this.land).map(key));
    const fenceGates = this.buildings.filter(b => b.type === 'gate' && !gateKeys.has(key(b)) && onFence.has(key(b)));
    const movable = this.buildings.filter(b => b.type === 'gate' && !gateKeys.has(key(b)) && !fenceGates.includes(b));
    // A slot a departing gate covered gets a fresh panel rather than counting as a broken one.
    const wanted = perimeterSlots(this.land).filter(slot => !fenceGates.some(g => underGate(slot, g))), keys = new Set(wanted.map(key));
    const previous = new Set(perimeterSlots(oldLand, legacy).filter(slot => !movable.some(g => underGate(slot, g))).map(key));
    const reusable = this.buildings.filter(b => b.perimeter && b.type === 'barricade' && !keys.has(key(b)));
    this.buildings = this.buildings.filter(b => !reusable.includes(b));
    const present = new Set(this.buildings.filter(b => b.type === 'barricade').map(key));
    for (const slot of wanted) {
      // Previously destroyed outer walls stay destroyed when buying land.
      if (present.has(key(slot)) || previous.has(key(slot))) continue;
      const moved = reusable.shift();
      if (moved) { Object.assign(moved, slot); this.buildings.push(moved); }
      else this.addBuilding('barricade', slot.x, slot.y, slot.rotation).perimeter = true;
    }
    for (const b of reusable) this.refundPanel(b);
    // Gates move out with the road when land is bought, keeping their upgrades, and so does a gate
    // the fence no longer runs through. A gate the dead broke stays broken until rebuilt; a
    // brand-new road opening comes with a gate.
    this.buildings = this.buildings.filter(b => !movable.includes(b));
    const standing = new Set(this.buildings.filter(b => b.type === 'gate').map(key));
    for (const slot of gates) {
      if (standing.has(key(slot)) || oldGates.has(key(slot))) continue;
      const moved = movable.shift();
      if (moved) { Object.assign(moved, { x: slot.x, y: slot.y, rotation: slot.rotation }); this.buildings.push(moved); }
      else this.addBuilding('gate', slot.x, slot.y, slot.rotation).perimeter = true;
    }
    for (const b of movable) for (const [r, n] of Object.entries(BUILDINGS.gate.cost)) this.resources[r] += Math.floor(n / 2);
    // A watchtower the new wall now runs through comes down, refunded in full.
    const engulfed = this.buildings.filter(b => b.type === 'tower' && touchesLand(this.land, boundsOf(b, 12)) && !ownsRect(this.land, boundsOf(b, 24)));
    for (const b of engulfed) this.refundTower(b);
    if (engulfed.length) this.notify('Watchtower dismantled', 'The new wall runs through ' + (engulfed.length > 1 ? engulfed.length + ' watchtowers' : 'a watchtower') + '. Materials refunded in full; build it again clear of the fence.', 'warn');
    const slots = new Set(wanted.map(key));
    this.openings = this.openings.filter(k => slots.has(k));
    this.navVersion++;
  }
  // A fence panel the wall no longer needs: part of its cost and upgrades come back.
  refundPanel(b) {
    this.resources.wood += 6;
    this.resources.metal += 1;
    for (const id of b.upgrades) for (const [r, n] of Object.entries(BUILDING_TREES.barricade.find(n => n.id === id).cost)) this.resources[r] += Math.floor(n / 2);
  }
  // Saves from before gates: hang one in every open road gap that nothing else fills.
  addMissingGates() {
    for (const slot of gateSlots(this.land)) {
      const r = boundsOf({ type: 'gate', ...slot });
      if (this.buildings.some(b => { const o = boundsOf(b); return r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top; })) continue;
      this.addBuilding('gate', slot.x, slot.y, slot.rotation).perimeter = true;
    }
  }
  refundTower(b) {
    for (const cost of [BUILDINGS.tower.cost, ...b.upgrades.map(id => BUILDING_TREES.tower.find(n => n.id === id).cost)]) for (const [r, n] of Object.entries(cost)) this.resources[r] += n;
    this.buildings = this.buildings.filter(o => o !== b);
    this.releasePost(b);
    this.buildingLost(b);
    this.navVersion++;
  }
  // Saves from before free-standing watchtowers: the wider road gaps and the corner gaps close up,
  // and each wall tower steps out to stand just beyond the fence, keeping its upgrades and sentry.
  // One with no room out there is refunded in full.
  migrateSouthGate() {
    const towers = this.buildings.filter(b => b.type === 'tower' && b.perimeter);
    this.buildings = this.buildings.filter(b => !towers.includes(b));
    this.extendPerimeter(this.land, true);
    for (const b of towers) {
      delete b.perimeter;
      const out = { x: 0, y: 0 };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.outside({ x: b.x + dx * 32, y: b.y + dy * 32 })) { out.x += dx; out.y += dy; }
      Object.assign(b, { x: b.x + out.x * 48, y: b.y + out.y * 48 });
      const r = boundsOf(b, 4), clear = (out.x || out.y) && !touchesLand(this.land, boundsOf(b, 12)) && !this.buildings.some(o => { const q = boundsOf(o); return r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top; });
      this.buildings.push(b);
      if (!clear) this.refundTower(b);
    }
    this.navVersion++;
  }
  // Saves from when only the south road had a gate: the panels across the other roads come down
  // (refunded like any panel the wall no longer needs) and a gate goes up in each gap.
  openRoadGates() {
    this.extendPerimeter(this.land);
    this.addMissingGates();
  }
  // Fence slots with no panel or gate in them, other than ones the player opened on purpose.
  breaches() {
    const key = b => [b.x, b.y, b.rotation || 0].join(',');
    const standing = new Set(this.buildings.filter(b => b.type === 'barricade').map(key)), open = new Set(this.openings), gates = this.buildings.filter(b => b.type === 'gate');
    return perimeterSlots(this.land).map(slot => ({ ...slot, key: key(slot) })).filter(slot => !standing.has(slot.key) && !open.has(slot.key) && !gates.some(g => underGate(slot, g)));
  }
  // A gate goes across a road opening or two neighbouring fence slots, so a gate placement snaps
  // to the nearest; on the fence it takes the place of the panels there.
  // A barricade near a hole in the perimeter fence snaps into that fence slot, which sits
  // off the 16-unit placement grid.
  snapPlacement(type, x, y, rotation = 0) {
    if (type === 'barricade') {
      const key = b => [b.x, b.y, b.rotation || 0].join(',');
      const standing = new Set(this.buildings.filter(b => b.type === 'barricade').map(key));
      const hole = perimeterSlots(this.land).filter(slot => !standing.has(key(slot))).sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))[0];
      return hole && distance(hole, { x, y }) < 20 ? { x: hole.x, y: hole.y, rotation: hole.rotation, wall: true } : { x, y, rotation };
    }
    if (type === 'tower') return { x, y, rotation: 0 };
    if (type !== 'gate') return { x, y, rotation };
    const roads = gateSlots(this.land), slot = [...roads, ...fenceGateSlots(this.land)].sort((a, b) => distance(a, { x, y }) - distance(b, { x, y }))[0];
    return slot && distance(slot, { x, y }) < 40 ? { x: slot.x, y: slot.y, rotation: slot.rotation, fence: !roads.includes(slot) } : { x, y, rotation, off: true };
  }
  repairAllCost() { return { wood: this.buildings.filter(b => b.hp < buildingMaxHP(b) - .01).reduce((sum, b) => sum + this.repairCost(b).wood, 0) }; }
  repairAll() {
    const cost = this.repairAllCost();
    if (this.status !== 'playing' || !cost.wood || !this.spend(cost)) return false;
    for (const b of this.buildings) { b.hp = buildingMaxHP(b); delete b.raising; }
    this.notify('Refuge repaired', 'All standing buildings and barricades are back to full durability.', 'good');
    return true;
  }
  // Housing: every bed holds one resident. Away survivors keep their bed.
  beds(b) { return b.type === 'core' ? 2 + (has(b, 'radio') ? 2 : 0) : b.type === 'dorm' ? 4 + (has(b, 'bunks') ? 2 : 0) + (has(b, 'annex') ? 4 : 0) : b.type === 'barracks' ? 2 : 0; }
  get capacity() { return this.buildings.reduce((n, b) => n + this.beds(b), 0); }
  residents(b) { return this.survivors.filter(s => s.home === b.id); }
  get freeBeds() { return this.capacity - this.survivors.filter(s => s.home != null).length; }
  get unhoused() { return this.survivors.filter(s => s.home == null); }
  assignHome(s) {
    const isGuard = s.role === 'guard' || (s.post && this.postOf(s)?.type === 'barracks');
    const order = isGuard ? { barracks: 0, dorm: 1, core: 2 } : { dorm: 0, barracks: 1, core: 2 };
    const b = this.buildings.filter(b => this.beds(b) > this.residents(b).length).sort((a, c) => order[a.type] - order[c.type])[0];
    s.home = b ? b.id : null;
    return !!b;
  }
  // Keeps bed assignments valid after housing is built, upgraded, damaged or lost.
  rehouse() {
    for (const b of this.buildings) this.residents(b).slice(this.beds(b)).forEach(s => { s.home = null; });
    for (const s of this.survivors) if (s.home != null && !this.buildings.some(b => b.id === s.home)) s.home = null;
    for (const s of this.survivors) if (s.home == null) this.assignHome(s);
  }
  addBuilding(type, x, y, rotation = 0) {
    const b = { id: this.nextId++, type, x, y, rotation, hp: BUILDINGS[type].hp, upgrades: [], cooldown: 0 };
    this.buildings.push(b);
    this.navVersion++;
    return b;
  }
  canPlace(type, x, y, rotation = 0) {
    if (!BUILDINGS[type] || type === 'core') return { ok: false, reason: 'Choose a building from the catalog.' };
    const spot = this.snapPlacement(type, x, y, rotation);
    if (spot.off) return { ok: false, reason: 'A gate goes across a road opening or a stretch of the perimeter fence.' };
    ({ x, y, rotation } = spot);
    // A gate or a rebuilt fence panel fits flush against the panels beside it (corner panels overlap by design).
    const flush = type === 'gate' || spot.wall;
    const rect = boundsOf({ type, x, y, rotation }, flush ? 0 : type === 'barricade' ? 1 : 8);
    // A watchtower can also stand out in the open, clear of the wall and in sight of it.
    const outside = type === 'tower' && !touchesLand(this.land, boundsOf({ type, x, y }, 12));
    if (outside) {
      if (!touchesLand(this.land, boundsOf({ type, x, y }, 200)) || Math.abs(x) + 40 > this.bounds.x || Math.abs(y) + 40 > this.bounds.y) return { ok: false, reason: 'Too far out: keep watchtowers within sight of the wall.' };
      if (this.forest.trees.some(t => inside(t, boundsOf({ type, x, y }, 8)))) return { ok: false, reason: 'Trees are in the way.' };
    } else if (!flush && !ownsRect(this.land, boundsOf({ type, x, y, rotation }, type === 'barricade' ? 1 : type === 'tower' ? 24 : 48))) return { ok: false, reason: type === 'tower' ? 'Watchtowers go inside the refuge or out in the open, clear of the wall.' : 'Use owned land and leave space for the outer patrol. Expand [L] for more room.' };
    if (this.buildings.some(b => { if ((spot.wall || spot.fence && underGate(b, spot)) && b.perimeter && b.type === 'barricade') return false; const r = boundsOf(b); return rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top; })) return { ok: false, reason: 'This space is occupied.' };
    if (this.patrols.some(s => inside(s, rect))) return { ok: false, reason: 'A survivor is in the way.' };
    if (!this.afford(BUILDINGS[type].cost)) return { ok: false, reason: 'Not enough supplies.' };
    return { ok: true, reason: 'Click to build here.' };
  }
  build(type, x, y, rotation = 0) {
    if (this.status !== 'playing') return false;
    const check = this.canPlace(type, x, y, rotation);
    if (!check.ok) { this.notify('Cannot build', check.reason, 'warn'); return false; }
    this.spend(BUILDINGS[type].cost);
    const spot = this.snapPlacement(type, x, y, rotation);
    ({ x, y, rotation } = spot);
    const b = this.addBuilding(type, x, y, rotation);
    if (type === 'gate' || spot.wall) b.perimeter = true;
    if (spot.wall) this.openings = this.openings.filter(k => k !== [x, y, rotation].join(','));
    if (spot.fence) {
      // The panels under a gate on the fence come down and are refunded like any spare panel.
      const replaced = this.buildings.filter(o => o.type === 'barricade' && o.perimeter && underGate(o, b));
      this.buildings = this.buildings.filter(o => !replaced.includes(o));
      for (const o of replaced) this.refundPanel(o);
      this.openings = this.openings.filter(k => { const [sx, sy, sr] = k.split(',').map(Number); return !underGate({ x: sx, y: sy, rotation: sr }, b); });
      this.navVersion++;
    }
    this.rehouse();
    this.notify(BUILDINGS[type].name + ' built', type === 'dorm' ? 'Four new beds are ready.' : type === 'farm' ? 'Your crops are growing. Food arrives automatically.' : type === 'gate' ? (spot.fence ? 'A new way through the wall.' : 'The road is sealed again.') : type === 'tower' ? 'Post guards to it to keep watch in shifts.' : spot.wall ? 'The hole in the fence is sealed.' : 'Your settlement is growing.', 'good');
    return b;
  }
  upgradeBuilding(id, upgradeId) {
    if (this.status !== 'playing') return false;
    const b = this.buildings.find(b => b.id === id);
    const upgrade = b && BUILDING_TREES[b.type].find(n => n.id === upgradeId);
    if (!upgrade || has(b, upgrade.id) || (upgrade.requires && !has(b, upgrade.requires)) || !this.afford(upgrade.cost)) return false;
    const hp = buildingMaxHP(b);
    this.spend(upgrade.cost);
    b.upgrades.push(upgrade.id);
    b.hp += buildingMaxHP(b) - hp;
    this.rehouse();
    this.notify(upgrade.name, upgrade.description, 'good');
    return true;
  }
  repairCost(b) { return { wood: Math.max(2, Math.ceil((buildingMaxHP(b) - b.hp) / 16)) }; }
  repair(id) {
    const b = this.buildings.find(b => b.id === id);
    if (this.status !== 'playing' || !b || b.hp >= buildingMaxHP(b) || !this.spend(this.repairCost(b))) return false;
    b.hp = buildingMaxHP(b);
    delete b.raising;
    return true;
  }
  demolish(id) {
    const b = this.buildings.find(b => b.id === id);
    if (this.status !== 'playing' || !b || b.type === 'core') return false;
    for (const [r, n] of Object.entries(BUILDINGS[b.type].cost)) this.resources[r] += Math.floor(n / 2);
    this.buildings = this.buildings.filter(item => item.id !== id);
    if (b.perimeter && b.type === 'barricade') this.openings.push([b.x, b.y, b.rotation || 0].join(','));
    // Taking down a gate on the fence leaves its stretch open on purpose, like dismantled panels.
    if (b.type === 'gate') for (const slot of perimeterSlots(this.land)) if (underGate(slot, b)) this.openings.push([slot.x, slot.y, slot.rotation].join(','));
    this.releasePost(b);
    this.buildingLost(b);
    this.navVersion++;
    return true;
  }

  // ---- Shelter: non-guards take cover in one building; guards keep defending ----
  shelterCapacity(b) { return b.type === 'core' ? T.shelter.core : b.type === 'barracks' ? T.shelter.barracks : b.type === 'dorm' ? this.beds(b) : b.type === 'tower' ? (T.shelter.tower ?? 2) : 0; }
  orderShelter(buildingId) {
    const b = this.buildings.find(b => b.id === buildingId);
    if (this.status !== 'playing' || !b || !this.shelterCapacity(b)) return false;
    for (const s of this.survivors) if (!s.resting) { s.shelter = null; s.sheltered = false; }
    let slots = this.shelterCapacity(b);
    const placed = [], unplaced = [];
    for (const s of this.survivors.filter(s => !s.expedition && jobOf(s) !== 'guard').sort((a, c) => distance(a, b) - distance(c, b))) {
      if (s.condition === 'downed') unplaced.push(s.name + ' (downed)');
      else if (slots > 0) { s.shelter = b.id; s.goalKey = ''; placed.push(s.name); slots--; }
      else unplaced.push(s.name);
    }
    this.shelterOrder = { buildingId: b.id };
    this.notify('Shelter ordered', (placed.length ? placed.length + ' heading into the ' + BUILDINGS[b.type].name.toLowerCase() + '.' : 'Nobody needs to shelter.') + (unplaced.length ? ' No room for ' + unplaced.join(', ') + '.' : '') + ' Guards stay on duty.', unplaced.length ? 'warn' : 'good');
    return { placed, unplaced };
  }
  clearShelter() {
    if (!this.shelterOrder) return false;
    for (const s of this.survivors) if (!s.resting) { s.shelter = null; s.sheltered = false; }
    this.shelterOrder = null;
    this.notify('All clear', 'Sheltered survivors are heading back to work.', 'good');
    return true;
  }
  goShelter(s, stats, dt) {
    const b = this.buildings.find(b => b.id === s.shelter);
    if (!b) { s.shelter = null; return false; }
    const spot = this.goalFor(s, b);
    if (!spot) { s.task = 'no-route'; return true; }
    if (this.travel(s, spot, stats.speed * 1.1, dt)) { s.sheltered = true; s.task = 'sheltered'; } else s.task = 'to-shelter';
    return true;
  }
  // A destroyed or dismantled building evicts its sheltered people and residents.
  buildingLost(b) {
    for (const s of this.survivors) { if (s.towerId === b.id) this.dismount(s); if (s.resting && s.restAt === b.id) this.wake(s); }
    const inside = this.survivors.filter(s => s.shelter === b.id);
    for (const s of inside) { s.shelter = null; s.sheltered = false; }
    if (this.shelterOrder?.buildingId === b.id) this.shelterOrder = null;
    if (inside.length) this.notify('Shelter lost', inside.map(s => s.name).join(', ') + ' had to flee the ' + BUILDINGS[b.type].name.toLowerCase() + '.', 'warn');
    const before = this.unhoused.length;
    this.rehouse();
    if (this.unhoused.length > before) this.notify('Survivors without beds', this.unhoused.map(s => s.name).join(', ') + ' need somewhere to sleep. Build or upgrade a bunkhouse.', 'warn');
  }
}
