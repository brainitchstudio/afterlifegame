// Port of Assets/Afterlife/Scripts/AfterlifeGame.cs: lifecycle, fixed-step simulation, input,
// commands, autosave, new runs with the world-loading screen, save import and the debug tools.
import { Simulation } from './simulation.js';
import { WorldView } from './worldView.js';
import { SaveStore } from './saveStore.js';
import { Input } from './input.js';
import { audio } from './audio.js';
import { HudStore } from '../hud/hudStore.js';

const LAST_AUTOSAVE_KEY = 'afterlife.campaign.lastAutosave';

const STEP = 0.05;
const PAUSE_ON_INCURSION_KEY = 'Afterlife.PauseOnIncursion';
// Keys that open a tablet screen.
const SCREEN_KEYS = [['KeyB', 'construction'], ['KeyC', 'crew'], ['KeyE', 'expeditions'], ['KeyJ', 'journal'], ['Backquote', 'admin'], ['F1', 'admin']];
const randomSeed = (max = 2147483647) => 1 + Math.floor(Math.random() * (max - 1));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));

export class AfterlifeGame {
  constructor() {
    this.paused = false;
    // Screens that stop the clock while they are open (the recruitment letter, tutorials, encounter cards), by name.
    // Several can hold at once; the clock runs again only when the last lets go. The player's own pause is `paused`.
    this.pauseHolds = new Set();
    this.expanding = false;
    this.building = null;
    this.rotation = 0;
    this.speed = 1;
    this.ready = false;
    this.fatal = null;
    this.accumulator = 0;
    this.hudTimer = 0;
    this.saveTimer = 0;
    this.lastAutosave = null;
    try { const kept = JSON.parse(localStorage.getItem(LAST_AUTOSAVE_KEY) || 'null'); if (typeof kept?.json === 'string' && typeof kept.reason === 'string') this.lastAutosave = kept; } catch { /* none kept */ }
    this.focused = document.hasFocus();
    this.preview = null;
    this.outcomeShown = false;
    this.hadIncoming = false;
    this.generatingNewRun = false;
    this.panSpeed = 650;
    this.zoomSensitivity = 1.4;
    const params = new URLSearchParams(location.search);
    this.debugToolsEnabled = import.meta.env.DEV || params.has('debug');
    // --afterlife-smoke in Unity: run the smoke check without reading or writing the save.
    this.smokeMode = params.has('smoke');
    try { this.pauseOnIncursion = localStorage.getItem(PAUSE_ON_INCURSION_KEY) === '1'; } catch { this.pauseOnIncursion = false; }
    this.audio = audio;
    this.hud = new HudStore(this);
  }

  async start(element) {
    try {
      this.simulation = new Simulation();
      const warning = this.smokeMode ? '' : await SaveStore.load(this.simulation);
      this.catalog = this.simulation.readCatalog(); // After loading: points of interest come from the saved world.
      this.world = new WorldView(element, audio);
      await this.world.load();
      this.input = new Input(this.world.canvas, () => audio.unlock());
      this.frame = this.simulation.readFrame();
      this.refreshTerrain();
      this.world.present(this.frame, performance.now() / 1000, 0);
      this.data = this.simulation.readHud();
      this.hadIncoming = !!this.frame.incoming;
      if (warning) this.hud.notify('Save recovery', warning);
      this.ready = true;
      if (this.smokeMode) import('./smokeCheck.js').then(m => m.runSmokeCheck(this));
      else this.hud.showStartScreen();
      window.addEventListener('focus', () => { this.focused = true; });
      window.addEventListener('blur', () => { this.focused = false; if (this.ready) this.save(); });
      document.addEventListener('visibilitychange', () => { if (document.hidden && this.ready) this.save(); });
      window.addEventListener('pagehide', () => { if (this.ready && !this.generatingNewRun && !this.smokeMode) SaveStore.writeOnExit(this.simulation.serialize()); });
      this.last = performance.now();
      requestAnimationFrame(now => this.loop(now));
    } catch (error) { this.fail(error); }
  }

  loop(nowMs) {
    const dt = Math.max(0, (nowMs - this.last) / 1000), now = nowMs / 1000;
    this.last = nowMs;
    if (this.ready) {
      try { this.update(dt, now); } catch (error) { this.fail(error); }
    }
    if (this.world?.frame) this.world.update(Math.min(dt, 0.25), now);
    this.hud.tick(now);
    this.input?.endFrame();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt, now) {
    this.handleInput(Math.min(dt, .1));
    if (this.hud.isWorldLoading) return;
    if (this.world.fit(this.frame, this.expanding)) { this.simulation.setBounds(this.world.bounds.x, this.world.bounds.y); this.world.rebuildTerrain(this.simulation.readTerrain()); }
    if (!this.clockStopped && !this.hud.modalOpen && this.focused && this.frame.status === 'playing') {
      this.accumulator += Math.min(dt, .15) * this.speed;
      let steps = 0;
      while (this.accumulator >= STEP && steps++ < 12) { this.simulation.step(STEP); this.accumulator -= STEP; }
      // Bounded catch-up prevents a slow frame from creating an unbounded work queue.
      this.accumulator = Math.min(this.accumulator, .6);
      if (steps > 0) { this.frame = this.simulation.readFrame(); this.world.present(this.frame, now, dt); this.checkIncursion(); }
    }
    this.hudTimer += dt; this.saveTimer += dt;
    if (this.hudTimer >= .25) {
      this.hudTimer = 0; this.data = this.simulation.readHud(); this.refreshCatalog(); this.hud.refresh();
      if (this.data.autosave) { this.saveTimer = 0; this.rememberAutosave(this.data.autosave); this.save(); }
      // Established Camp: the classification screen holds the simulation until Phase 2 is begun.
      if (this.data.campaign?.phase2 && this.hud.modal?.kind !== 'phase2') { this.hud.open('phase2'); this.holdPause('phase2'); }
      // An expedition's encounter card holds the simulation until a choice is made.
      if (this.data.campaign?.encounter && this.hud.modal?.kind !== 'encounter') { this.hud.open('encounter'); this.holdPause('encounter'); }
    }
    if (this.saveTimer >= 5) { this.saveTimer = 0; this.save(); }
    if (this.frame.status !== 'playing' && !this.outcomeShown && !this.hud.modalOpen) {
      this.outcomeShown = true;
      audio.playOutcome(this.frame.status === 'won');
      this.hud.showOutcome();
    }
  }

  handleInput(dt) {
    const input = this.input, hud = this.hud, world = this.world;
    if (hud.isWorldLoading) return;
    if (hud.isStartScreenOpen) {
      if (world?.canvas) world.canvas.style.cursor = 'default';
      if (input.getKeyDown('KeyW', 'ArrowUp') || (hud.isNewGameSetupOpen && input.getKeyDown('ArrowLeft'))) { hud.selectPreviousStartMenuItem(); return; }
      if (input.getKeyDown('KeyS', 'ArrowDown') || (hud.isNewGameSetupOpen && input.getKeyDown('ArrowRight'))) { hud.selectNextStartMenuItem(); return; }
      if (input.getKeyDown('Enter', 'NumpadEnter', 'Space')) { hud.activateCurrentStartMenuItem(); return; }
      if (input.getKeyDown('Escape') && hud.isNewGameSetupOpen) { hud.backFromNewGameSetup(); return; }
      if (input.getKeyDown('KeyN') && !hud.isNewGameSetupOpen) { hud.startNewGame(); return; }
      if (input.getKeyDown('KeyC') && !hud.isNewGameSetupOpen) { hud.continueGame(); return; }
      // Unity quits here; a settings or confirm dialog over the title closes instead.
      if (input.getKeyDown('Escape')) { if (hud.modal) hud.closeModal(); else this.quit(); }
      return;
    }

    if (input.getKeyDown('Escape') || input.getRightClick()) { this.cancel(); return; }
    // Tab opens and closes the overseer's tablet (it never opens over another dialog).
    if (input.getKeyDown('Tab')) { hud.toggleTablet(); return; }
    // Screen hotkeys work with the tablet open too: they switch screens, or close the one showing.
    const screen = SCREEN_KEYS.find(([code]) => input.getKeyDown(code));
    if (screen) { hud.toggleScreen(screen[1]); return; }
    if (hud.modalOpen) {
      if (world?.canvas) world.canvas.style.cursor = 'default';
      return;
    }

    // Camera panning with WASD or the arrow keys.
    const panStep = this.panSpeed * dt;
    let px = 0, py = 0;
    if (input.getKey('KeyW', 'ArrowUp')) py -= panStep;
    if (input.getKey('KeyS', 'ArrowDown')) py += panStep;
    if (input.getKey('KeyA', 'ArrowLeft')) px -= panStep;
    if (input.getKey('KeyD', 'ArrowRight')) px += panStep;
    if (px || py) world.panCamera(px, py);

    // Mouse drag panning (primary left mouse, middle mouse, or right mouse drag).
    const isWallDragging = this.building === 'barricade' && input.getMouseButton(0);
    const isPannableDrag = (!isWallDragging && input.isLeftDragging()) || input.getMouseButton(1) || input.getMouseButton(2);
    if (isPannableDrag && (input.drag.x || input.drag.y)) world.dragCamera(input.drag.x, input.drag.y);

    // Mouse wheel zoom, directed toward the cursor.
    if (input.overCanvas && Math.abs(input.wheel) > 0.005) world.zoomCamera(input.wheel * this.zoomSensitivity * 0.35, input.mouse);

    // Keyboard zoom (+ / - / PageUp / PageDown / [ / ]).
    if (input.getKeyDown('Equal', 'NumpadAdd', 'PageUp', 'BracketRight')) world.zoomCamera(0.06);
    if (input.getKeyDown('Minus', 'NumpadSubtract', 'PageDown', 'BracketLeft')) world.zoomCamera(-0.06);

    // Focus on the selection or reset the camera (F or Home).
    if (input.getKeyDown('KeyF')) this.focusOrResetCamera();
    if (input.getKeyDown('Home')) world.resetCamera();

    if (input.getKeyDown('Space')) this.togglePause();
    if (input.getKeyDown('KeyL')) this.toggleExpansion();
    if (input.getKeyDown('KeyR') && this.building) this.rotation = 1 - this.rotation;
    if (input.getKeyDown('Digit1', 'Numpad1')) this.setSpeed(1);
    if (input.getKeyDown('Digit2', 'Numpad2')) this.setSpeed(2);
    if (input.getKeyDown('Digit4', 'Numpad4')) this.setSpeed(4);
    if (this.debugToolsEnabled && input.getKeyDown('KeyZ')) {
      const p = world.pointerWorld(input.mouse);
      this.command('spawnZombieAt', 'walker', p.x, p.y);
      hud.notify('Zombie spawned', 'Spawned a walker at cursor position.');
    }
    if (this.debugToolsEnabled && input.getKeyDown('KeyH')) {
      this.command('triggerIncursion');
      hud.notify('Incursion triggered', 'Director announced an incoming swarm!');
    }
    if (hud.modalOpen) {
      if (world?.canvas) world.canvas.style.cursor = 'default';
      return;
    }
    if (!input.overCanvas) {
      if (world?.canvas) world.canvas.style.cursor = 'default';
      world.showPlacement(null);
      this.hoverTree(null);
      world.hoverClaim(null);
      return;
    }
    const point = world.pointerWorld(input.mouse);
    world.hoverClaim(this.expanding ? point : null);
    const hitId = world.hit(point);
    const hitPoi = world.hitPoi(point);
    const hitTree = !this.building && !this.expanding && hitId < 0 ? world.hitTree(point) : null;
    // A campaign's debris piles are marked for gathering the same way trees are marked for felling.
    const hitDebris = !this.building && !this.expanding && hitId < 0 && !hitTree ? world.hitDebris(point) : null;
    this.hoverTree(hitTree);
    this.hoverDebris(hitDebris);
    const isInteractive = !this.building && !this.expanding && (hitId >= 0 || hitPoi >= 0 || !!hitTree || !!hitDebris);

    // Dynamic cursor states:
    // 1. Grabbing when dragging the map with cursor.
    // 2. Crosshair when placing buildings.
    // 3. Cell when in land expansion mode.
    // 4. Pointer when hovering interactive entities (survivors, buildings, trees, POIs).
    // 5. Grab over open ground.
    if (isPannableDrag || (input.getMouseButton(0) && !this.building && !this.expanding && !isInteractive)) {
      world.canvas.style.cursor = 'grabbing';
    } else if (this.building) {
      world.canvas.style.cursor = 'crosshair';
    } else if (this.expanding) {
      world.canvas.style.cursor = 'cell';
    } else if (isInteractive) {
      world.canvas.style.cursor = 'pointer';
    } else {
      world.canvas.style.cursor = 'grab';
    }

    // Dragging with walls lays a run: it keeps to the row (or column) the first panel went into
    // and fills every panel from the last one to the pointer, however fast the pointer moves.
    const dragging = this.building === 'barricade' && !input.getMouseButtonDown(0) && input.getMouseButton(0) && this.wallRun;
    if (!input.getMouseButton(0)) this.wallRun = null;
    if (this.building) {
      const at = dragging ? (this.rotation ? { x: this.wallRun.x, y: point.y } : { x: point.x, y: this.wallRun.y }) : point;
      this.preview = this.simulation.preview(this.building, at.x, at.y, this.rotation);
      world.showPlacement(this.preview);
      const canRotate = this.building === 'barricade' || this.building === 'gate';
      hud.setHint(this.preview.reason + (canRotate ? '   R rotate' : '') + (this.building === 'barricade' ? ' · Drag to lay a wall' : '') + (canRotate ? ' · Right click finish' : '   Right click finish'));
    }
    if (dragging) {
      this.extendWallRun();
      return;
    }

    // Barricade wall placement begins on mouse down so dragging immediately draws a line
    if (this.building === 'barricade') {
      if (input.getMouseButtonDown(0)) {
        if (this.preview?.ok) {
          if (this.command('build', 'barricade', this.preview.x, this.preview.y, this.preview.rotation)) {
            this.wallRun = { x: this.preview.x, y: this.preview.y, last: this.rotation ? this.preview.y : this.preview.x };
          } else hud.notify('Cannot build here', this.preview.reason);
        } else if (this.preview) hud.notify('Cannot build here', this.preview.reason);
      }
      return;
    }

    // All other click interactions (building placement, land purchase, POI expeditions, tree harvest, unit selection)
    // require a clean click release without dragging the camera.
    if (!input.getLeftClick()) return;
    if (this.building) {
      if (this.preview?.ok) {
        if (this.command('build', this.building, this.preview.x, this.preview.y, this.preview.rotation)) {
          this.building = null;
          world.showPlacement(null);
          hud.setHint('');
        } else hud.notify('Cannot build here', this.preview.reason);
      } else if (this.preview) hud.notify('Cannot build here', this.preview.reason);
      return;
    }
    if (this.expanding) { this.command('buyLand', Math.floor((point.x + 128) / 256), Math.floor((point.y + 96) / 192)); return; }
    if (hitPoi >= 0) { hud.showPoiExpedition(hitPoi); return; }
    if (hitTree) { this.markTree(hitTree); return; }
    if (hitDebris) { if (this.command('gatherDebris', hitDebris)) audio.playClick(); this.hoverDebris(hitDebris, true); return; }
    this.select(hitId);
  }

  // Builds each panel between the last one laid in this drag and the one under the pointer.
  extendWallRun() {
    const run = this.wallRun, p = this.preview, axis = this.rotation ? 'y' : 'x';
    if (!p || p.rotation !== this.rotation || p[axis] === run.last) return;
    const step = Math.sign(p[axis] - run.last) * 32;
    for (let v = run.last + step; step * (p[axis] - v) >= 0; v += step) {
      const spot = { ...run, [axis]: v }, next = this.simulation.preview('barricade', spot.x, spot.y, this.rotation);
      if (next.ok && next.rotation === this.rotation && next[axis] === v) this.command('build', 'barricade', next.x, next.y, next.rotation);
      run.last = v;
    }
  }

  // Hovering a tree rings it and shows what felling it gives; the hint is cleared on the way out.
  hoverTree(id) {
    if (id === this.world.hoverTree && !id) return;
    this.world.hoverTree = id;
    if (id) { this.hud.setHint(this.simulation.treeHint(id)); this.treeHinted = true; }
    else if (this.treeHinted) { this.treeHinted = false; if (!this.building && !this.expanding) this.hud.setHint(''); }
  }

  hoverDebris(id, force = false) {
    if (id === this.world.hoverDebris && !force) return;
    this.world.hoverDebris = id;
    if (id) { this.hud.setHint(this.simulation.debrisHint(id)); this.debrisHinted = true; }
    else if (this.debrisHinted) { this.debrisHinted = false; if (!this.building && !this.expanding && !this.treeHinted) this.hud.setHint(''); }
  }

  // Marks a tree for felling, or takes the mark off. A felled tree says how long it has left to grow.
  markTree(id) {
    const hint = this.simulation.treeHint(id);
    if (/growing back/.test(hint)) { this.hud.notify('Growing back', hint); return; }
    if (this.command('harvest', id)) audio.playClick();
  }

  focusOrResetCamera() {
    const sel = this.world.selected >= 0 ? this.frame?.entities.find(e => e.id === this.world.selected) : null;
    if (sel) this.world.focusOn({ x: sel.x, y: sel.y }); else this.world.resetCamera();
  }

  select(id) {
    this.world.selected = id; this.hud.showInspector(id);
    const entity = this.frame?.entities.find(e => e.id === id);
    if (entity?.type === 'cache') this.hud.showTablet('stockpile');
    // Selecting a resident counts for the campaign's first task.
    if (entity?.kind === 'survivor' && this.data?.campaign) this.simulation.command('campaignInteraction', 'select_resident');
  }
  beginBuilding(type) { this.hud.closeModal(); this.building = type; this.rotation = 0; this.expanding = false; this.select(-1); this.refreshTerrain(); }
  toggleExpansion() {
    this.hud.closeModal(); this.building = null; this.world.showPlacement(null); this.expanding = !this.expanding; this.select(-1); this.refreshTerrain();
    this.hud.setHint(this.expanding ? 'Click a highlighted parcel to claim it · ' + this.data.landCost + ' · Escape to finish' : '');
  }
  cancel() {
    if (this.world.followTargetId >= 0) this.world.clearFollow();
    if (this.hud.modalOpen) { this.hud.closeModal(); return; }
    this.building = null; this.world.showPlacement(null); this.expanding = false; this.select(-1); this.refreshTerrain(); this.hud.setHint('');
  }
  togglePause() { this.paused = !this.paused; this.hud.refresh(); }
  get clockStopped() { return this.paused || this.pauseHolds.size > 0; }
  holdPause(reason) { this.pauseHolds.add(reason); this.hud.refresh(); }
  releasePause(reason) { this.pauseHolds.delete(reason); this.hud.refresh(); }
  setSpeed(speed) { this.speed = speed === 2 || speed === 4 ? speed : 1; this.hud.refresh(); }
  togglePauseOnIncursion() {
    this.pauseOnIncursion = !this.pauseOnIncursion;
    try { localStorage.setItem(PAUSE_ON_INCURSION_KEY, this.pauseOnIncursion ? '1' : '0'); } catch { /* preference is best effort */ }
  }

  checkIncursion() {
    const incoming = !!this.frame.incoming;
    if (incoming && !this.hadIncoming && this.pauseOnIncursion) {
      this.paused = true;
      this.hud.notify('Incursion — paused', 'Prepare your defenses, then press Space to resume.');
      this.hud.refresh();
    }
    this.hadIncoming = incoming;
  }

  command(name, ...args) {
    const ok = this.simulation.command(name, ...args);
    this.frame = this.simulation.readFrame(); this.data = this.simulation.readHud();
    this.freeBuild = !!this.frame?.freeBuild;
    this.world.present(this.frame, performance.now() / 1000, 0);
    this.checkIncursion(); this.refreshTerrain(); this.hud.refresh(); this.hud.refreshInspector();
    if (ok) {
      if (name === 'devUnlockAll' || name === 'devSetFreeBuild') { this.catalog = this.simulation.readCatalog(); audio.playBuild(); }
      if (name === 'build') audio.playBuild();
      else if (name === 'raiseAlarm') audio.playAlarm();
    } else this.hud.notify('Action unavailable', 'Check supplies, capacity, placement, and current assignments.');
    return ok;
  }

  // Quests unlock structures as they complete; the construction catalog follows.
  refreshCatalog() {
    const key = this.data?.unlockKey;
    if (key !== this.catalogKey) { this.catalogKey = key; this.catalog = this.simulation.readCatalog(); }
  }

  refreshTerrain() {
    if (this.world.fit(this.frame, this.expanding) || !this.world.terrain) {
      this.simulation.setBounds(this.world.bounds.x, this.world.bounds.y);
      this.world.rebuildTerrain(this.simulation.readTerrain());
    }
  }

  // The campaign's milestone autosaves (deployment, task completions) are kept apart from the rolling save, so a
  // lost region can go back to the last one. Browser storage keeps it across sessions when it can.
  rememberAutosave(reason) {
    if (this.smokeMode || !this.data?.campaign) return;
    try { this.lastAutosave = { reason, json: this.simulation.serialize() }; } catch { return; }
    try { localStorage.setItem(LAST_AUTOSAVE_KEY, JSON.stringify(this.lastAutosave)); } catch { /* storage unavailable */ }
  }
  loadLastAutosave() {
    if (!this.lastAutosave) return false;
    const error = this.importSave(this.lastAutosave.json);
    if (error) { this.hud.notify('Autosave could not be loaded', error); return false; }
    this.hud.closeModal();
    this.hud.notify('Autosave loaded', this.lastAutosave.reason);
    return true;
  }
  // Deploys again to the same region: the same seed, map size, difficulty and Overseer.
  restartCampaign() {
    const settings = this.data?.campaign?.settings;
    if (!settings) return false;
    this.hud.closeModal();
    this.hud.beginWorldLoading();
    this.startCampaignWithLoading({ ...settings });
    return true;
  }
  chooseEncounter(id) {
    this.simulation.command('chooseEncounter', id);
    this.data = this.simulation.readHud();
    this.releasePause('encounter');
    this.hud.closeModal();
  }
  beginPhase2() {
    this.simulation.command('beginPhase2');
    this.data = this.simulation.readHud();
    this.releasePause('phase2');
    this.hud.closeModal();
  }

  // Queues a save; failures are reported on the HUD. Resolves true when the save was written.
  save() {
    if (!this.simulation || this.generatingNewRun) return Promise.resolve(false);
    if (this.smokeMode) return Promise.resolve(true);
    let json;
    try { json = this.simulation.serialize(); } catch (error) { this.hud.notify('Save failed', error.message); return Promise.resolve(false); }
    return SaveStore.write(json).then(() => true, error => { console.warn(error); this.hud.notify('Save failed', error.message); return false; });
  }

  newRun(mapSize = null, difficulty = 'normal', options = {}) {
    this.save(); // Keep the previous save as the backup when the new run is written.
    this.resetNewRun(difficulty);
    if (mapSize && !this.simulation.generateWorld(mapSize, randomSeed(), options)) throw new Error('World generation failed for ' + mapSize);
    this.completeNewRun();
    this.save();
  }

  async startNewRunWithLoading(mapSize, difficulty, seed = null, options = {}) {
    if (this.generatingNewRun) return;
    this.generatingNewRun = true;
    let previousRun = null, failure = null;
    await nextFrame(); // Let the loading screen render before the first generation phase.
    try {
      previousRun = this.simulation.serialize();
      this.resetNewRun(difficulty);
      const opts = typeof mapSize === 'object' ? mapSize : { size: mapSize, seed: seed ?? randomSeed(), ...options };
      this.simulation.beginWorldGeneration(opts.size, opts.seed, opts);
      for (;;) {
        const step = this.simulation.advanceWorldGeneration();
        this.hud.updateWorldLoading(step.done ? .94 : step.progress, step.done ? 'Bringing the refuge into focus...' : step.activity);
        if (step.done) break;
        await nextFrame();
      }
      await nextFrame();
      this.completeNewRun();
      this.hud.updateWorldLoading(1, 'The refuge is ready. Good luck out there.');
      this.generatingNewRun = false;
      this.save();
      await nextFrame();
      this.hud.finishWorldLoading(opts.size, difficulty, this.simulation.worldInfo()?.seed);
    } catch (error) {
      failure = error;
    }
    if (failure) {
      console.error(failure);
      this.generatingNewRun = false;
      try { if (previousRun != null && this.simulation.restore(previousRun)) this.completeNewRun(); } catch (restoreError) { console.error(restoreError); }
      this.hud.failWorldLoading(failure.message);
    }
  }

  // New Game: a campaign deployment behind the loading screen, then the region fades in. The clock holds
  // while it does; the deployment autosave is written as soon as the camp lands.
  async startCampaignWithLoading(settings) {
    if (this.generatingNewRun) return;
    this.generatingNewRun = true;
    let previousRun = null, failure = null;
    await nextFrame();
    try {
      previousRun = this.simulation.serialize();
      this.simulation.beginCampaign(settings);
      for (;;) {
        const step = this.simulation.advanceWorldGeneration();
        this.hud.updateWorldLoading(step.progress, step.activity);
        if (step.done) break;
        await nextFrame();
      }
      await nextFrame();
      this.completeNewRun();
      this.generatingNewRun = false;
      this.data = this.simulation.readHud();
      this.save();
      this.holdPause('deployment');
      this.hud.finishDeployment(this.data.campaign?.regionId || '');
      setTimeout(() => { this.releasePause('deployment'); this.hud.endDeployIntro(); }, 3000);
    } catch (error) {
      failure = error;
    }
    if (failure) {
      console.error(failure);
      this.generatingNewRun = false;
      try { if (previousRun != null && this.simulation.restore(previousRun)) this.completeNewRun(); } catch (restoreError) { console.error(restoreError); }
      this.hud.failWorldLoading(failure.message);
    }
  }

  resetNewRun(difficulty) {
    this.simulation.command('reset');
    this.simulation.setDifficulty(difficulty);
  }

  completeNewRun() {
    this.outcomeShown = false; this.hadIncoming = false; this.hud.clearJournal(); this.accumulator = 0; this.paused = false; this.pauseHolds.clear(); this.speed = 1;
    this.building = null; this.expanding = false; this.world.showPlacement(null); this.world.selected = -1;
    this.world.resetCamera();
    this.catalog = this.simulation.readCatalog(); // Points of interest belong to the new world.
    this.frame = this.simulation.readFrame(); this.data = this.simulation.readHud(); this.refreshTerrain();
    this.world.rebuildTerrain(this.simulation.readTerrain()); this.world.present(this.frame, performance.now() / 1000, 0);
    this.hud.closeModal(); this.hud.showInspector(-1); this.hud.refresh();
  }

  // Validates in an isolated simulation before replacing the live game. Returns '' or an error.
  importSave(json) {
    const error = Simulation.probe(json);
    if (error) return error;
    this.save();
    if (!this.simulation.restore(json)) return 'Save restoration failed.';
    this.outcomeShown = false; this.hadIncoming = !!this.simulation.readFrame().incoming; this.hud.clearJournal();
    this.accumulator = 0; this.building = null; this.expanding = false; this.paused = true; this.world.selected = -1; this.world.showPlacement(null);
    this.world.resetCamera();
    this.catalog = this.simulation.readCatalog();
    this.frame = this.simulation.readFrame(); this.data = this.simulation.readHud(); this.refreshTerrain();
    this.world.rebuildTerrain(this.simulation.readTerrain()); this.world.present(this.frame, performance.now() / 1000, 0);
    this.hud.closeModal(); this.hud.showInspector(-1); this.hud.refresh(); this.save();
    return '';
  }

  // Unity quits the application; the web build saves, stops the local server and closes the page.
  async quit() {
    await this.save();
    await SaveStore.quit();
    this.ready = false;
    this.hud.showClosed();
    window.close();
  }

  fail(error) {
    this.ready = false;
    this.fatal = error?.stack || String(error);
    console.error(error);
    this.hud.notify('Afterlife stopped', error?.message || String(error));
    this.hud.bump();
  }

  // Unity exposes these on the component's context menu; here they back the debug menu section.
  debugSpawn(kind) { const p = this.world.pointerWorld(this.input.mouse); this.command('spawnZombieAt', kind, p.x, p.y); }
  reloadWorld() {
    this.catalog = this.simulation.readCatalog();
    this.frame = this.simulation.readFrame(); this.data = this.simulation.readHud(); this.refreshTerrain();
    this.world.rebuildTerrain(this.simulation.readTerrain()); this.world.present(this.frame, performance.now() / 1000, 0);
    this.hud.refresh();
  }
  debugGenerateWorld(size = 'medium') { this.simulation.generateWorld(size, randomSeed(99999)); this.reloadWorld(); }
  debugLoadOutpost() { this.simulation.loadOutpostMap(); this.reloadWorld(); }

  // Custom refuge setup (GameHud.ShowCustomGameSetup): a fresh run on a chosen map.
  startCustomRun(map) {
    this.hud.closeModal();
    this.hud.hideStartScreen();
    this.newRun();
    if (map === 'outpost') this.simulation.loadOutpostMap();
    else this.simulation.generateWorld(map, randomSeed(99999));
    this.reloadWorld();
    this.save();
  }
  setSeason(season) {
    this.simulation.setSeason(season);
    this.frame = this.simulation.readFrame(); this.world.rebuildTerrain(this.simulation.readTerrain());
  }
}
