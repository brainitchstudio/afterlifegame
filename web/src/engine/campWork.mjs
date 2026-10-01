// A campaign camp's work: blueprints raised by builders, debris gathered and carried to storage, garden
// plots tended by farmers and craft queues at workstations. Everything runs on the labor factor
// (crew.mjs) and the ledger (ledger.mjs). Installed onto Game.prototype by model.mjs.
import { CAMPAIGN, CONSUMABLES, campaignBuilding, campaignIdOf, engineTypeOf } from './campaignState.mjs';
import { laborFactor } from './crew.mjs';
import { BUILDINGS, HOUR_SECONDS, distance } from './data.mjs';
import { buildingMaxHP, boundsOf, inside, rectDistance } from './rules.mjs';
import { WEAPONS } from './survivors.mjs';

const C = CAMPAIGN.tuning.construction, G = CAMPAIGN.tuning.gathering, F = CAMPAIGN.tuning.farming;
// The engine role a campaign structure's job post gives.
// A General Worker's post (the Salvage Yard) uses the engine's spare 'logger' role, which saves already accept.
// Structures whose Guard keeps watch from a platform rather than patrolling.
export const WATCH_POSTS = ['lookout_post', 'watchtower'];
const ROLE_OF_JOB = { farmer: 'farmer', engineer: 'engineer', medic: 'medic', guard: 'guard', general_worker: 'logger' };
// Structures the campaign lets the player build: Phases 1 and 2, as far as their engine structures exist.
export const CAMPAIGN_CATALOG = Object.entries(CAMPAIGN.buildings)
  .filter(([id, d]) => d.phase <= 2 && d.unlockedBy !== 'starter' && BUILDINGS[engineTypeOf(id)])
  .map(([id]) => engineTypeOf(id));
const STATIONS = new Set(Object.values(CAMPAIGN.recipes).map(r => r.station));

export class CampWork {
  // ---- Structures ----
  campaignDef(b) { return this.campaign && b ? campaignBuilding(b.type) : null; }
  // The job post a structure offers: its role and number of slots. Legacy runs read the content's posts.
  roleFor(b) {
    if (!this.campaign) return null;
    const d = this.campaignDef(b);
    if (!d || b.blueprint || !d.job || !(d.workerSlots > 0)) return null;
    // A Guard at the Lookout is on watch, not on patrol.
    return WATCH_POSTS.includes(campaignIdOf(b.type)) ? 'sentry' : ROLE_OF_JOB[d.job] || null;
  }
  slotsOf(b) { return this.roleFor(b) ? this.campaignDef(b).workerSlots : 0; }
  structureCost(type) { return this.campaign ? campaignBuilding(type)?.cost || {} : BUILDINGS[type].cost; }

  // Where a campaign structure may go: inside the protected perimeter, on open dry level ground, clear of
  // trees, debris, ruins and the migration corridor.
  campaignPlacement(type, x, y, rotation) {
    const d = campaignBuilding(type);
    if (!d || !CAMPAIGN_CATALOG.includes(type)) return { ok: false, reason: 'Choose a structure from the build menu.' };
    if (!this.freeBuild && !this.taskUnlocked('buildings', campaignIdOf(type))) return { ok: false, reason: d.name + ' is not authorized yet. Check your tasks on the SeerPad [Tab].' };
    if (this.tokenBlock(type)) return { ok: false, reason: this.tokenBlock(type) };
    const rect = boundsOf({ type, x, y, rotation }, 4), centre = { x, y }, region = this.campaign.region;
    const limit = region?.protectedRadius || 288;
    if (Math.hypot(x, y) > limit) return { ok: false, reason: 'Too far from camp: build inside the protected perimeter.' };
    if (this.buildings.some(b => { const r = boundsOf(b); return rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top; })) return { ok: false, reason: 'This space is occupied.' };
    if (this.forest.trees.some(t => inside(t, rect))) return { ok: false, reason: 'Trees are in the way. Mark them for felling first.' };
    if ((this.debris || []).some(n => inside({ x: n.x, y: n.y - 6 }, boundsOf({ type, x, y, rotation }, 12)))) return { ok: false, reason: 'Salvage is in the way. Gather it first.' };
    const corners = [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }, { x: rect.left, y: rect.bottom }, { x: rect.right, y: rect.bottom }, centre];
    if (corners.some(p => this.wetAt?.(p))) return { ok: false, reason: 'Cannot build on water.' };
    if (corners.some(p => this.terrainAt(p) === 'k')) return { ok: false, reason: 'The ground is too steep and rocky here.' };
    if ((this.worldBuildings || []).some(w => rect.left < w.x + w.fw * 16 && rect.right > w.x && rect.top < w.y + w.fh * 16 && rect.bottom > w.y)) return { ok: false, reason: 'A ruin stands here.' };
    const lane = (CAMPAIGN.tuning.world.corridorWidthTiles + 1) * 16;
    if (region?.corridor?.points?.some(p => rectDistance(p, rect) < lane)) return { ok: false, reason: 'That would block the migration corridor.' };
    if (!this.freeBuild && this.survivors.some(s => !s.sheltered && inside(s, rect))) return { ok: false, reason: 'A survivor is in the way.' };
    if (!this.freeBuild && !this.afford(d.cost)) return { ok: false, reason: 'Not enough supplies. Costs are reserved when the blueprint is placed.' };
    return { ok: true, reason: this.freeBuild ? 'Click to build here (Free Build).' : 'Click to place the blueprint. Its cost is reserved now.' };
  }
  terrainAt(p) {
    const m = this.map, o = this.worldOrigin;
    if (!m || !o) return null;
    const tx = Math.floor(p.x / 16 + o.bcx), ty = Math.floor(p.y / 16 + o.bcy);
    return tx >= 0 && ty >= 0 && tx < m.w && ty < m.h ? m.terr[ty * m.w + tx] : null;
  }
  // Places a blueprint: its cost moves into reserve and builders raise it. Free Build skips straight to built.
  placeBlueprint(type, x, y, rotation) {
    const d = campaignBuilding(type);
    const tx = this.freeBuild ? null : this.reserve(d.cost, 'build', type);
    if (!this.freeBuild && !tx) return null;
    const b = this.addBuilding(type, x, y, rotation);
    b.built = true;
    this.relayPlaced(b);
    if (this.freeBuild) return b;
    b.blueprint = { tx, progress: 0 };
    b.hp = buildingMaxHP(b) * C.blueprintHpShare;
    this.notify('Blueprint placed: ' + d.name, `${d.laborHours} labor-hours of work. Free survivors will build it; Engineers work faster.`, 'good');
    return b;
  }
  // Cancelling a blueprint refunds its reservation by how far the work got.
  cancelBlueprint(b) {
    const refund = this.releaseReservation(b.blueprint.tx, b.blueprint.progress);
    this.notify('Blueprint cancelled', refund ? 'Returned: ' + Object.entries(refund).map(([r, n]) => n + ' ' + r.replace('_', ' ')).join(' · ') : 'Nothing to return.', '');
  }
  completeBlueprint(b) {
    this.commitReservation(b.blueprint.tx);
    delete b.blueprint;
    b.hp = buildingMaxHP(b);
    for (const s of this.survivors) if (s.camp?.kind === 'build' && s.camp.id === b.id) s.camp = null;
    this.rehouse();
    this.navVersion++;
    this.notify(campaignBuilding(b.type).name + ' complete', 'Construction finished and the structure is operational.', 'good');
  }

  // ---- Who does what ----
  // A General Worker free for camp work, or an Engineer whose workstation has nothing queued.
  campWorker(s) {
    if (s.model !== 'campaign' || s.harvest || s.exhausted || this.sheltering || this.onMission(s)) return false;
    if (s.role === 'engineer') { const post = this.postOf(s); if (post && post.queue?.length) return false; }
    else if (s.role && s.role !== 'patrol') return false;
    return !s.expedition && !s.sheltered && s.condition === 'healthy' && s.towerId == null && !s.order && s.shelter == null && s.rescue == null && !s.respond && !s.arriving && !this.alarm.raised && this.onDuty(s);
  }
  // Four times a second: builders to blueprints (two each at most), then gatherers to marked debris.
  assignCampWork(dt) {
    if (!this.campaign) return;
    this.campWorkTimer = (this.campWorkTimer || 0) - dt;
    if (this.campWorkTimer > 0) return;
    this.campWorkTimer = .25;
    for (const s of this.survivors) {
      const j = s.camp;
      if (!j) continue;
      const target = j.kind === 'build' ? this.buildings.find(b => b.id === j.id && b.blueprint)
        : j.kind === 'radio' ? this.campaign.radio.broadcast && this.buildings.find(b => b.id === j.id) : (this.debris || []).find(n => n.id === j.id);
      const busy = j.kind === 'gather' && j.phase === 'toStore';
      // A gatherer on the way to storage finishes the trip; anyone else stops when the job or their shift ends.
      if ((!target && !busy) || (!busy && !this.campWorker(s))) s.camp = null;
    }
    const free = () => this.survivors.filter(s => !s.camp && this.campWorker(s));
    for (const b of this.buildings.filter(b => b.blueprint)) {
      const crew = this.survivors.filter(s => s.camp?.kind === 'build' && s.camp.id === b.id).length;
      for (let n = crew; n < C.maxBuilders; n++) {
        const pick = free().sort((p, q) => (q.role === 'engineer') - (p.role === 'engineer') || distance(p, b) - distance(q, b))[0];
        if (!pick) break;
        pick.camp = { kind: 'build', id: b.id }; pick.path = []; pick.pathVersion = -1;
      }
      if (!this.survivors.some(s => s.camp?.kind === 'build' && s.camp.id === b.id)) this.campaignAlert('UI_NO_WORKER');
    }
    for (const n of (this.debris || []).filter(n => n.ordered && n.stock > 0)) {
      const crew = this.survivors.filter(s => s.camp?.kind === 'gather' && s.camp.id === n.id).length;
      for (let k = crew; k < (n.workers || 1); k++) {
        const pick = free().filter(s => s.role !== 'engineer').sort((p, q) => distance(p, n) - distance(q, n))[0];
        if (!pick) break;
        pick.camp = { kind: 'gather', id: n.id, phase: 'toNode', carry: 0, work: 0, resource: n.resource }; pick.path = []; pick.pathVersion = -1;
      }
    }
  }
  // Runs a survivor's camp job from work(). False when they have none.
  campWork(s, stats, dt) {
    const j = s.camp;
    if (!j) return false;
    return j.kind === 'build' ? this.buildWork(s, stats, dt) : j.kind === 'radio' ? this.radioWork(s, stats, dt) : this.gatherWork(s, stats, dt);
  }
  // Close enough to work on a structure: beside its footprint, or on the approach point the path ends at
  // (which can sit a little further out when neighbours crowd it).
  atSite(s, b) { return rectDistance(s, boundsOf(b)) <= 22 || (s.goalKey === b.id + ':' + this.navVersion && s.goal && distance(s, s.goal) < 3); }
  buildWork(s, stats, dt) {
    const b = this.buildings.find(b => b.id === s.camp.id && b.blueprint);
    if (!b) { s.camp = null; return false; }
    if (!this.atSite(s, b)) {
      const spot = this.goalFor(s, b);
      if (!spot) { s.camp = null; return false; }
      this.travel(s, spot, stats.speed, dt); s.task = 'to-blueprint';
      return true;
    }
    // The first builder works at full rate, the second at 0.75.
    const crew = this.survivors.filter(o => o.camp?.kind === 'build' && o.camp.id === b.id && this.atSite(o, b)).sort((p, q) => p.id - q.id);
    const share = crew.indexOf(s) === 0 ? 1 : C.secondBuilderFactor;
    const d = campaignBuilding(b.type);
    b.blueprint.progress = Math.min(1, b.blueprint.progress + dt / HOUR_SECONDS * laborFactor(s, 'build') * share / Math.max(.05, d.laborHours));
    b.hp = buildingMaxHP(b) * (C.blueprintHpShare + (1 - C.blueprintHpShare) * b.blueprint.progress);
    s.task = 'building'; s.facing = b.x < s.x ? -1 : 1;
    s.fxTimer = (s.fxTimer || 0) - dt;
    if (s.fxTimer <= 0) { s.fxTimer = .35; this.effects.push({ type: 'repair', x: s.x + s.facing * 9, y: s.y - 8, life: .45, maxLife: .45 }); }
    if (b.blueprint.progress >= 1) this.completeBlueprint(b);
    return true;
  }

  // ---- Debris ----
  // Marks a debris pile for gathering, or takes the mark off.
  toggleGather(id) {
    const n = (this.debris || []).find(n => n.id === id);
    if (this.status !== 'playing' || !n) return false;
    n.ordered = !n.ordered;
    if (!n.ordered) for (const s of this.survivors) if (s.camp?.kind === 'gather' && s.camp.id === id && s.camp.phase !== 'toStore') s.camp = null;
    return true;
  }
  // Working storage nearest to `p`: the cache or a stash.
  nearestStore(p) {
    return this.buildings.filter(b => this.operational(b) && campaignBuilding(b.type)?.capacity?.storage).sort((a, b) => distance(a, p) - distance(b, p))[0] || null;
  }
  gatherWork(s, stats, dt) {
    const j = s.camp, n = (this.debris || []).find(n => n.id === j.id);
    if (j.phase === 'toStore') {
      const store = this.nearestStore(s);
      const spot = store && this.goalFor(s, store);
      if (spot && !this.travel(s, spot, stats.speed * .85, dt)) { s.task = 'carrying-' + j.resource; return true; }
      if (!this.deposit(j.resource, j.carry)) { s.task = 'storage-full'; this.campaignAlert('UI_OUTPUT_BLOCKED'); return true; }
      this.effects.push({ type: 'wood', x: (store || s).x, y: (store || s).y - 14, amount: j.carry, life: 1.4, maxLife: 1.4 });
      this.tallyTask('gather', j.resource, j.carry);
      Object.assign(j, { phase: 'toNode', carry: 0 });
      if (!n || n.stock <= 0 || !n.ordered) s.camp = null;
      return true;
    }
    if (!n) { s.camp = null; return false; }
    if (j.phase === 'toNode') {
      if (distance(s, n) > 18) { this.travel(s, { x: n.x, y: n.y + 10 }, stats.speed, dt); s.task = 'to-debris'; return true; }
      j.phase = 'work';
    }
    // Units per labor-hour by resource; two on a large pile each work at 0.85.
    const perHour = G.yieldPerHour[n.resource] || 1 / (G.singleUnitHours[n.resource] || .5);
    const pair = this.survivors.filter(o => o.camp?.kind === 'gather' && o.camp.id === n.id && o.camp.phase === 'work').length > 1;
    j.work += dt / HOUR_SECONDS * laborFactor(s, 'gather') * (pair ? G.largeNodeEfficiency : 1);
    while (j.work >= 1 / perHour && n.stock > 0 && j.carry < G.carryPerTrip) { j.work -= 1 / perHour; j.carry++; n.stock--; }
    s.task = 'gathering'; s.facing = n.x < s.x ? -1 : 1;
    s.fxTimer = (s.fxTimer || 0) - dt;
    if (s.fxTimer <= 0) { s.fxTimer = .5; this.effects.push({ type: 'chip', x: n.x, y: n.y - 8, life: .5, maxLife: .5 }); }
    if (n.stock <= 0) this.removeDebris(n);
    if (j.carry >= G.carryPerTrip || n.stock <= 0) { j.phase = 'toStore'; s.path = []; s.pathVersion = -1; }
    return true;
  }
  // An emptied pile disappears from the map.
  removeDebris(n) { this.debris = this.debris.filter(o => o !== n); this.landRevision++; }
  debrisHint(id) {
    const n = (this.debris || []).find(n => n.id === id);
    if (!n) return '';
    const who = this.survivors.filter(s => s.camp?.kind === 'gather' && s.camp.id === id).map(s => s.name);
    return `${n.size === 'large' ? 'Large' : 'Small'} ${n.kind} pile · ${n.stock} ${n.resource.replace('_', ' ')} left · ${n.workers} worker${n.workers > 1 ? 's' : ''} · ` +
      (n.ordered ? (who.length ? who.join(', ') + ' on it · click to cancel' : 'marked · click to cancel') : 'click to gather');
  }

  // ---- Garden plots and Field Farms ----
  // Each farmer works their own lane: the first crop needs 12 effective hours, then a batch every 3. A Garden
  // Plot's single lane yields 0.25 Food per work-hour; each of a Field Farm's two lanes 0.5.
  cropTick(dt) {
    if (!this.campaign) return;
    for (const b of this.buildings) {
      const id = campaignIdOf(b.type), rate = id === 'garden_plot' ? F.gardenFoodPerWorkHour : id === 'field_farm' ? F.fieldFarmFoodPerWorkHour : 0;
      if (!rate || !this.operational(b)) continue;
      const lanes = this.cropLanes(b), staff = this.staffOf(b).sort((p, q) => p.id - q.id);
      lanes.forEach((crop, i) => {
        const s = staff[i];
        if (s && this.active(s) && !s.fighting && this.onDuty(s) && (rectDistance(s, boundsOf(b)) < 40 || this.atSite(s, b))) crop.labor += dt / HOUR_SECONDS * laborFactor(s, 'farm');
        const need = crop.first ? F.firstCropHours : F.batchHours;
        if (crop.labor >= need) { crop.labor -= need; crop.first = false; crop.pending += need * rate; }
        if (crop.pending > 0) {
          if (this.deposit('food', crop.pending)) {
            this.tallyTask('harvest', 'food', crop.pending, id);
            if (this.campaign.dayLog) this.campaign.dayLog.producedFood += crop.pending;
            this.effects.push({ type: 'wood', x: b.x + (i - (lanes.length - 1) / 2) * 24, y: b.y - 14, amount: Math.round(crop.pending * 100) / 100, life: 1.4, maxLife: 1.4 });
            crop.pending = 0;
          } else this.campaignAlert('UI_OUTPUT_BLOCKED');
        }
      });
      if (!staff.length) this.campaignAlert('UI_NO_FARMER');
    }
  }
  // A plot's lanes, one per farmer slot. Older saves kept a single `crop`.
  cropLanes(b) {
    const n = this.campaignDef(b)?.workerSlots || 1;
    if (!b.lanes) b.lanes = b.crop ? [b.crop] : [];
    while (b.lanes.length < n) b.lanes.push({ labor: 0, first: true, pending: 0 });
    b.crop = b.lanes[0];
    return b.lanes;
  }

  // ---- Workstations ----
  recipesAt(b) { return Object.entries(CAMPAIGN.recipes).filter(([, r]) => r.station === campaignIdOf(b.type)); }
  // Recipes this release can make: no item inputs (a club to reinforce), and an item output the equipment
  // stock or the consumables know.
  recipeReady(r) { return Object.keys(r.itemInputs || {}).every(t => WEAPONS[t]) && (!r.output.item || !!WEAPONS[r.output.item] || CONSUMABLES.includes(r.output.item)); }
  // Spare items an order may take: in the stock, carried by nobody and not already set aside.
  spareItems(type) { return this.items.filter(i => i.type === type && i.holder == null && !i.reservedFor); }
  itemsAvailable(r) { return Object.entries(r.itemInputs || {}).every(([t, n]) => this.spareItems(t).length >= n); }
  // An order that would leave fewer Components than the Radio Relay needs (6) while it isn't built yet.
  componentWarning(r) {
    const need = CAMPAIGN.buildings.radio_relay?.cost?.components || 6, left = this.available('components') - (r.inputs?.components || 0);
    return r.inputs?.components && left < need && !this.buildings.some(b => campaignIdOf(b.type) === 'radio_relay' && !b.blueprint) ? left : null;
  }
  queueCraft(buildingId, recipeId) {
    const b = this.buildings.find(b => b.id === buildingId), r = CAMPAIGN.recipes[recipeId], d = this.campaignDef(b);
    if (this.status !== 'playing' || !b || !r || !this.operational(b) || r.station !== campaignIdOf(b.type)) return false;
    if (!this.taskUnlocked('recipes', recipeId) && !this.freeBuild) { this.notify('Recipe not authorized', r.name + ' unlocks with a later task.', 'warn'); return false; }
    b.queue ??= [];
    if (b.queue.length >= (d.queueCapacity || 10)) { this.notify('Queue full', 'This station holds ' + (d.queueCapacity || 10) + ' orders.', 'warn'); return false; }
    if (!this.recipeReady(r)) { this.notify('Not yet in production', r.name + ' needs equipment CentroCom has not shipped yet.', 'warn'); return false; }
    if (!this.itemsAvailable(r)) { this.notify('No spare ' + Object.keys(r.itemInputs).map(t => WEAPONS[t].name).join(', '), 'Only items in the stock, carried by nobody, can be reworked.', 'warn'); return false; }
    const tx = this.reserve(r.inputs, 'craft', recipeId);
    if (!tx) { this.notify('Not enough supplies', 'Inputs are reserved when an order is queued.', 'warn'); return false; }
    // Item inputs (a club to reinforce) are set aside with the order.
    for (const [t, n] of Object.entries(r.itemInputs || {})) for (const i of this.spareItems(t).slice(0, n)) i.reservedFor = tx;
    b.queue.push({ recipe: recipeId, tx, progress: 0 });
    return true;
  }
  cancelCraft(buildingId, index) {
    const b = this.buildings.find(b => b.id === buildingId), entry = b?.queue?.[index];
    if (!entry) return false;
    this.releaseReservation(entry.tx, entry.progress);
    for (const i of this.items) if (i.reservedFor === entry.tx) delete i.reservedFor;
    b.queue.splice(index, 1);
    return true;
  }
  // An operator at the station works the first order; a new operator keeps its progress.
  craftWork(s, post, stats, dt) {
    if (!post?.queue?.length || !STATIONS.has(campaignIdOf(post.type)) || !this.operational(post)) return false;
    if (!this.atSite(s, post)) {
      const spot = this.goalFor(s, post);
      if (spot) { this.travel(s, spot, stats.speed, dt); s.task = 'to-station'; return true; }
      return false;
    }
    const entry = post.queue[0], r = CAMPAIGN.recipes[entry.recipe];
    // Two operators work one queue: the second at 0.75.
    const crew = this.staffOf(post).filter(o => this.atSite(o, post) && this.active(o)).sort((p, q) => p.id - q.id), share = crew.indexOf(s) > 0 ? C.secondBuilderFactor : 1;
    entry.progress = Math.min(1, entry.progress + dt / HOUR_SECONDS * laborFactor(s, 'craft') * share / Math.max(.05, r.laborHours));
    s.task = 'crafting'; s.facing = post.x < s.x ? -1 : 1;
    s.fxTimer = (s.fxTimer || 0) - dt;
    if (s.fxTimer <= 0) { s.fxTimer = .4; this.effects.push({ type: 'repair', x: s.x + s.facing * 9, y: s.y - 8, life: .45, maxLife: .45 }); }
    if (entry.progress < 1) return true;
    const out = r.output;
    // A resource output waits while storage overflows; an item goes to the shared equipment stock.
    if (out.resource && this.outputBlocked) { s.task = 'output-blocked'; this.campaignAlert('UI_OUTPUT_BLOCKED'); return true; }
    this.commitReservation(entry.tx);
    this.items = this.items.filter(i => i.reservedFor !== entry.tx);
    post.queue.shift();
    if (CONSUMABLES.includes(out.item)) this.campaign.stock[out.item] += out.count;
    else if (out.item) { for (let i = 0; i < out.count; i++) this.addItem(out.item); this.equipAll(); }
    else this.deposit(out.resource, out.count, true);
    this.tallyTask('craft', out.item || out.resource, out.count);
    this.notify(r.name + ' made', CONSUMABLES.includes(out.item) ? 'Added to the medical stock.' : out.item ? 'Added to the shared equipment stock.' : `+${out.count} ${out.resource.replace('_', ' ')}`, 'good');
    return true;
  }
}
