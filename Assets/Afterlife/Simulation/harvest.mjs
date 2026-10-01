// Felling trees for wood, from the design kit's Starter Camp. The player marks trees; the nearest
// free survivor walks out, chops, and carries the logs back to the camp's wood pile. A felled tree
// grows back after a minute or so of game time. Installed onto Game.prototype by model.mjs.
import { TUNING as T, statFactor } from './survivors.mjs';
import { distance, has } from './data.mjs';
import { CAMP, TREE_YIELD, TREE_NAMES, regrowSeconds, CHOP_SECONDS, CARRY_SPEED } from './camp.mjs';

const HARVESTERS = new Set(['patrol', 'logger']);
export const treeKind = t => t.k || (t.kind === 2 ? 'tree_pine' : 'tree_oak');

export class Harvest {
  treeById(id) {
    const forest = this.forest;
    if (!forest.byId) forest.byId = new Map(forest.trees.map(t => [t.id, t]));
    return forest.byId.get(id) || null;
  }
  regrowing(t) { return (this.treeRegrow[t.id] || 0) > this.elapsed; }
  // Marks a tree for felling, or takes the mark off again. False for a tree still growing back.
  toggleHarvest(id) {
    const t = this.treeById(id);
    if (this.status !== 'playing' || !t || this.regrowing(t)) return false;
    const job = this.harvestJobs.find(j => j.tree === id);
    if (!job) { this.harvestJobs.push({ tree: id, by: null }); return true; }
    this.harvestJobs = this.harvestJobs.filter(j => j !== job);
    const s = this.survivors.find(s => s.id === job.by);
    if (s?.harvest?.tree === id) s.harvest = undefined;
    return true;
  }
  // Free to fell a tree: a patrol or logger on duty, fit, and not needed for anything more urgent.
  canHarvest(s) {
    return HARVESTERS.has(s.role || 'patrol') && !s.expedition && !s.sheltered && s.condition === 'healthy' && s.towerId == null && !s.order
      && s.shelter == null && s.rescue == null && !s.respond && !s.arriving && !this.alarm.raised && this.onDuty(s);
  }
  // Hands each marked tree to the nearest free survivor; loggers first. A survivor who is pulled
  // away before the tree is down gives it back.
  assignHarvest(dt) {
    this.harvestTimer = (this.harvestTimer || 0) - dt;
    if (this.harvestTimer > 0 || !this.harvestJobs.length) return;
    this.harvestTimer = .25;
    this.harvestJobs = this.harvestJobs.filter(j => this.treeById(j.tree));
    for (const job of this.harvestJobs) {
      const s = job.by != null && this.survivors.find(s => s.id === job.by);
      if (s && s.harvest?.tree === job.tree && s.hp > 0 && (s.harvest.phase === 'chop' || this.canHarvest(s))) continue;
      if (s && s.harvest?.tree === job.tree) s.harvest = undefined;
      job.by = null;
    }
    for (const job of this.harvestJobs) {
      if (job.by != null) continue;
      const t = this.treeById(job.tree);
      const pick = this.survivors.filter(s => !s.harvest && this.canHarvest(s)).sort((a, b) => (a.role === 'logger' ? 0 : 1) - (b.role === 'logger' ? 0 : 1) || distance(a, t) - distance(b, t))[0];
      if (!pick) break;
      job.by = pick.id;
      pick.harvest = { tree: job.tree, phase: 'toTree' };
      pick.path = []; pick.pathVersion = -1;
    }
  }
  // A standing spot beside the trunk, out of the other trunks, nearest `from`: off claimed land, or
  // on its walkable grid for a tree standing on a camp's own land.
  treeSpot(t, from) {
    const trees = this.forest.trees.filter(o => o !== t && distance(o, t) < 40);
    const spots = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, p = { x: Math.round(t.x + Math.cos(a) * (t.radius + 7)), y: Math.round(t.y + Math.sin(a) * (t.radius + 7) * .7) };
      if (this.outside(p) && !this.wetAt(p)) spots.push(p);
    }
    for (let x = Math.round(t.x / 16) * 16 - 32; x <= t.x + 32; x += 16) for (let y = Math.round(t.y / 16) * 16 - 32; y <= t.y + 32; y += 16) {
      const p = { x, y }, d = distance(p, t);
      if (!this.outside(p) && d >= t.radius + 4 && d <= 28 && this.walkable(p)) spots.push(p);
    }
    let best = null, bestDistance = Infinity;
    for (const p of spots) {
      if (trees.some(o => distance(o, p) < o.radius + 5)) continue;
      const d = distance(p, from);
      if (d < bestDistance) { best = p; bestDistance = d; }
    }
    return best || { x: t.x, y: t.y + t.radius + 6 };
  }
  // Felled on a camp's own land, a tree is cleared for good; out in the wilds it grows back.
  clears(t) { return this.start === 'camp' && !this.outside(t); }
  // Where logs are dropped: the camp's wood pile, or beside the HQ in a refuge without one.
  get woodPile() { return this.buildings.some(b => b.type === 'campfire') ? CAMP.pile : null; }
  // Runs a survivor's felling job from work(). False when they have none.
  harvestWork(s, stats, dt) {
    const h = s.harvest;
    if (!h) return false;
    if (h.phase === 'toPile') {
      const pile = this.woodPile, spot = pile ? { x: pile.x, y: pile.y + 16 } : this.core && this.goalFor(s, this.core);
      if (!spot || this.travel(s, spot, stats.speed * CARRY_SPEED, dt)) {
        this.resources.wood += h.carry;
        const at = pile || s;
        this.effects.push({ type: 'wood', x: at.x, y: at.y - 14, amount: h.carry, life: 1.4, maxLife: 1.4 });
        s.harvest = undefined;
        s.task = 'stacking-wood';
      } else s.task = 'carrying-wood';
      return true;
    }
    const t = this.treeById(h.tree), job = this.harvestJobs.find(j => j.tree === h.tree && j.by === s.id);
    if (!t || !job) { s.harvest = undefined; return false; }
    if (h.phase === 'toTree') {
      if (!h.spot) h.spot = this.treeSpot(t, s);
      if (!this.travel(s, h.spot, stats.speed, dt)) { s.task = 'to-tree'; return true; }
      Object.assign(h, { phase: 'chop', left: CHOP_SECONDS, swing: 0 });
    }
    // Chopping: Strength speeds it, and so does a lumber mill's log chute for its loggers.
    const post = this.postOf(s), speed = statFactor(s.stats.str, T.effects.workPerIntelligence) * (post && has(post, 'log_chute') ? 1.3 : 1);
    h.left -= dt * speed;
    s.task = 'chopping';
    s.facing = t.x < s.x ? -1 : 1;
    const swing = Math.floor((CHOP_SECONDS - h.left) * 2.2);
    if (swing !== h.swing) { h.swing = swing; this.effects.push({ type: 'chip', x: t.x, y: t.y - 8, life: .5, maxLife: .5 }); }
    if (h.left > 0) return true;
    const k = treeKind(t);
    if (this.clears(t)) { this.cleared.push(t.id); this.landRevision++; } else this.treeRegrow[t.id] = this.elapsed + regrowSeconds(k);
    this.harvestJobs = this.harvestJobs.filter(j => j !== job);
    if (this.progress) this.progress.tally.felled++;
    this.grantXP(s, T.xp.dutyPerSecond * 30);
    s.harvest = { phase: 'toPile', carry: Math.round((TREE_YIELD[k] || 4) * statFactor(s.stats.str, T.effects.carryPerStrength)) };
    s.path = []; s.pathVersion = -1;
    return true;
  }
  // What the view draws over the trees: marks, regrowth, who is chopping and who carries logs.
  harvestView() {
    const out = { jobs: [], regrow: [], chopping: [], carrying: [], pile: this.woodPile };
    for (const j of this.harvestJobs) { const t = this.treeById(j.tree); if (t) out.jobs.push({ id: t.id, x: t.x, y: t.y, assigned: j.by != null }); }
    for (const [id, end] of Object.entries(this.treeRegrow)) {
      const t = end > this.elapsed && this.treeById(id);
      if (t) out.regrow.push({ id, x: t.x, y: t.y, f: 1 - (end - this.elapsed) / regrowSeconds(treeKind(t)) });
    }
    for (const s of this.survivors) {
      if (s.harvest?.phase === 'chop') out.chopping.push({ tree: s.harvest.tree, survivor: s.id, swing: (CHOP_SECONDS - s.harvest.left) * 2.2 % 1 });
      if (s.harvest?.phase === 'toPile') out.carrying.push(s.id);
    }
    return out;
  }
  // A line for hovering a tree.
  treeHint(id) {
    const t = this.treeById(id);
    if (!t) return '';
    const k = treeKind(t), left = Math.ceil((this.treeRegrow[id] || 0) - this.elapsed), job = this.harvestJobs.find(j => j.tree === id);
    const who = job?.by != null && this.survivors.find(s => s.id === job.by);
    return `${TREE_NAMES[k]} · ${TREE_YIELD[k]} wood · ` + (left > 0 ? `growing back, ${left}s` : job ? (who ? `${who.name} is on it · click to cancel` : 'marked · click to cancel') : this.clears(t) ? 'click to clear for good' : 'click to fell');
  }
}
