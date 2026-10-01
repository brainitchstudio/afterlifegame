// Port of Assets/Afterlife/Scripts/Simulation.cs. The web host talks to the original simulation
// through the same boundary Unity used (engine/unity.mjs: afFrame, afDeltaFrame, afCommand, ...),
// so every command, preview and inspector view matches the Unity build exactly.
import { game } from '../engine/unity.mjs';
import { Game } from '../engine/model.mjs';

const af = globalThis;
const WORLD_REPLACING = new Set(['reset', 'generateWorld', 'loadSurvMap', 'loadOutpostMap']);

export class Simulation {
  constructor() {
    this.entityMap = new Map();
    this.liveFrame = { entities: [], effects: [], scavengedPois: [], territory: { left: 0, right: 0, top: 0, bottom: 0 } };
    this.resetDelta();
  }

  step(seconds) { af.afStep(seconds); }
  setBounds(x, y) { af.afBounds(x, y); }

  // Entities arrive once in full, then as compact [id, x, y, hp, flags, targetId] updates.
  readFrame() {
    const delta = JSON.parse(af.afDeltaFrame());
    const frame = this.liveFrame;
    for (const key of ['elapsed', 'day', 'hour', 'phase', 'status', 'season', 'wood', 'scrap_metal', 'food', 'capacity', 'kills', 'alarm', 'landRevision', 'territory', 'incoming', 'director', 'effects', 'scavengedPois', 'harvest'])
      frame[key] = delta[key];
    for (const id of delta.removed) this.entityMap.delete(id);
    for (const e of delta.added) {
      const existing = this.entityMap.get(e.id);
      if (existing) Object.assign(existing, e); else this.entityMap.set(e.id, e);
    }
    let survivors = 0, zombies = 0;
    const u = delta.u;
    for (let i = 0; i + 5 < u.length; i += 6) {
      const ent = this.entityMap.get(u[i]);
      if (!ent) continue;
      const flags = u[i + 4];
      ent.x = u[i + 1]; ent.y = u[i + 2]; ent.hp = u[i + 3];
      ent.facing = flags & 1 ? -1 : 1;
      ent.fighting = !!(flags & 2);
      ent.downed = !!(flags & 4);
      ent.hidden = !!(flags & 8);
      ent.stationed = !!(flags & 16);
      ent.away = !!(flags & 32);
      ent.targetId = u[i + 5];
      if (ent.kind !== 'building') ent.groundY = ent.y;
      if (ent.kind === 'survivor') survivors++;
      else if (ent.kind === 'zombie') zombies++;
    }
    frame.survivorCount = survivors;
    frame.zombieCount = zombies;
    frame.entities = [...this.entityMap.values()];
    return frame;
  }

  readFullFrame() { return JSON.parse(af.afFrame()); }
  resetDelta() { this.entityMap.clear(); af.afResetDelta(); }
  readTerrain() { return JSON.parse(af.afTerrain()); }
  readHud() { return JSON.parse(af.afHud()); }
  readTablet() { return JSON.parse(af.afTablet()); }
  readMinimap() { return JSON.parse(af.afMinimap()); }
  readCatalog() { return JSON.parse(af.afCatalog()); }
  readDetails(id) { return JSON.parse(af.afDetails(id)); }
  treeHint(id) { return af.afTreeHint(id); }
  debrisHint(id) { return af.afDebrisHint(id); }
  preview(type, x, y, rotation) { return JSON.parse(af.afPlacement(type, x, y, rotation)); }
  party(ids, kind) { return JSON.parse(af.afParty(JSON.stringify(ids), kind)); }
  mission(site, ids) { return JSON.parse(af.afMission(site, JSON.stringify(ids))); }

  command(name, ...args) {
    const ok = af.afCommand(name, JSON.stringify(args));
    // These replace every entity; the boundary restarts its delta stream, so the cache must too.
    if (WORLD_REPLACING.has(name)) this.resetDelta();
    return ok;
  }

  generateWorld(size = 'medium', seed = 1, options = {}) { return this.command('generateWorld', size, seed, options); }
  beginWorldGeneration(size, seed, options = {}) { af.afBeginWorld(size, seed, options); }
  // A new campaign; advanceWorldGeneration then runs its deployment (engine/deployment.mjs).
  beginCampaign(settings) { af.afBeginCampaign(JSON.stringify(settings)); this.resetDelta(); }
  advanceWorldGeneration() {
    const progress = JSON.parse(af.afAdvanceWorld());
    if (progress.done) this.entityMap.clear(); // The boundary restarts its delta stream here too.
    return progress;
  }
  loadOutpostMap() { return this.command('loadOutpostMap'); }
  setSeason(season) { return this.command('setSeason', season); }
  setDifficulty(difficulty) { return this.command('setDifficulty', difficulty); }
  // The seed and size of a generated world, so players can share or replay a map.
  worldInfo() { return game.worldMeta?.seed ? { seed: game.worldMeta.seed, size: game.worldMeta.size, custom: game.worldMeta.custom, hordes: game.worldMeta.hordes?.length || 0 } : null; }
  serialize() { return af.afSave(); }
  restoreError(json) { return af.afRestoreError(json); }
  restore(json) {
    const ok = af.afRestore(json);
    this.resetDelta();
    return ok;
  }

  // Validates a save in an isolated simulation, like Unity's throwaway probe Simulation.
  static probe(json) {
    const probe = new Game();
    try {
      return probe.restore(json) ? '' : probe.restoreError(json) || 'Save restoration failed.';
    } catch (error) {
      return error.message || 'Save restoration failed.';
    }
  }
}
