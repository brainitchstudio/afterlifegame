import { SIZES } from '../engine/worldgen.mjs';
import { SETUP } from '../hud/hudStore.js';
// Port of Assets/Afterlife/Scripts/PlayerSmokeCheck.cs. Open the game with ?smoke to run it; smoke
// mode never reads or writes the save. Results go to the console (AFTERLIFE_PLAYER_SMOKE_PASSED or
// _FAILED) and to window.afterlifeSmoke for automation.
const wait = seconds => new Promise(resolve => setTimeout(resolve, seconds * 1000));
const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const texts = selector => [...document.querySelectorAll(selector)].map(el => el.textContent);

export async function runSmokeCheck(game) {
  const results = [];
  let failed = false;
  const check = (condition, name) => {
    results.push({ name, passed: !!condition });
    if (!condition) { failed = true; console.error('SMOKE FAIL ' + name); } else console.log('SMOKE PASS ' + name);
  };
  const onError = () => { failed = true; };
  window.addEventListener('error', onError);
  window.afterlifeSmoke = { done: false, results };

  try {
    await wait(2);
    check(game.ready, 'Game booted');
    check(document.querySelector('.hud-root')?.getBoundingClientRect().width > 100, 'HUD laid out');
    check(game.world.lit.children.filter(s => s.visible && s.texture && s.texture.width > 1).length > 80, 'Sprite world rendered');
    game.togglePause();
    // A new run is a camp whose fixtures have no upgrades, so the inspector is checked on a tent.
    game.select(game.frame.entities.find(e => e.kind === 'building' && e.type === 'tent')?.id ?? 1);
    await wait(0.3);
    check(texts('.inspector .ui-label').some(t => t.includes('Tent')), 'Building inspector');
    game.setSpeed(0); check(game.speed === 1, 'Invalid speed falls back to 1x');
    game.hud.notify('Journal smoke check', 'A retained event');
    game.hud.showJournal(); await frame();
    check(texts('.tablet .ui-label').some(t => t.includes('A retained event')), 'Journal retains notifications');
    game.hud.closeModal();

    const originalPauseOnIncursion = game.pauseOnIncursion;
    if (!originalPauseOnIncursion) game.togglePauseOnIncursion();
    if (game.paused) game.togglePause();
    game.command('triggerIncursion');
    check(game.paused, 'Incursion pauses immediately when enabled');
    game.togglePause();
    game.command('clearAlarm');
    check(!game.paused, 'An existing incursion does not repeatedly pause');
    game.togglePause();
    if (!originalPauseOnIncursion) game.togglePauseOnIncursion();

    const beforeInvalidImport = game.simulation.serialize();
    check(game.importSave('{}').length > 0 && game.simulation.serialize() === beforeInvalidImport, 'Invalid import preserves live simulation');
    for (const [open, name] of [['showBuild', 'Construction screen'], ['showRecruitment', 'Recruitment screen'], ['showStockpile', 'Stockpile screen'], ['showExpeditions', 'Expedition screen'], ['showCrew', 'Crew screen'], ['showAdmin', 'Admin screen'], ['showMenu', 'Settings screen']]) {
      game.hud[open](); await frame();
      check(game.hud.modalOpen && document.querySelector('.backdrop .tablet .tablet-page > *'), name);
      game.hud.closeModal();
    }
    game.toggleExpansion(); await frame();
    check(game.expanding && game.world.terrain.frontier.length > 0 && game.world.claimFrontier.length > 0, 'Land expansion');
    game.toggleExpansion();
    game.beginBuilding('barricade'); await frame();
    check(game.building === 'barricade', 'Construction placement mode');
    game.cancel();
    const json = game.simulation.serialize();
    check(game.importSave(json) === '', 'Save import via web host');
    game.hud.closeModal(); game.select(-1);

    game.hud.showStartScreen(); await frame();
    check(game.hud.isStartScreenOpen && document.querySelector('.start-screen'), 'Start screen displayed');
    game.hud.startNewGame(); await frame();
    check(game.hud.isNewGameSetupOpen && game.hud.setupStep === SETUP.settings, 'Deployment settings displayed');
    game.hud.setOverseerName('Smoke'); game.hud.activateCurrentStartMenuItem(); await frame();
    check(game.hud.setupStep === SETUP.region, 'Regional assignment displayed');
    game.hud.setSeedText('smoke-region'); game.hud.activateCurrentStartMenuItem(); await frame();
    check(game.hud.setupStep === SETUP.letter && document.querySelector('.letter-scroll'), 'Recruitment letter displayed');
    game.hud.activateCurrentStartMenuItem(); await frame();
    check(game.hud.setupStep === SETUP.letter && document.querySelector('.letter-panel .new-game-primary')?.disabled, 'I AGREE waits until the letter is read');
    [...document.querySelectorAll('.letter-foot button')].at(-1)?.click(); await frame();
    check(game.hud.letterRead, 'Go to final acknowledgment reads the letter');
    game.hud.activateCurrentStartMenuItem(); await frame();
    check(game.hud.setupStep === SETUP.accepted, 'Acceptance notice displayed');
    game.hud.activateCurrentStartMenuItem();
    const deadline = performance.now() + 60000;
    while (game.hud.isWorldLoading && performance.now() < deadline) await frame();
    check(!game.hud.isWorldLoading, 'New Game loading completed');
    check(!game.hud.isStartScreenOpen, 'Start screen dismissed on New Game');
    check(game.world.terrain.mapWidth === SIZES.large.w && game.world.terrain.mapHeight === SIZES.large.h, 'Standard region generated');
    check(game.data.campaign?.regionId && game.frame.entities.filter(e => e.kind === 'survivor').length === 5, 'Campaign deployed with five survivors');
    check(game.simulation.readMinimap().region?.sites.length >= 9 && game.world.poiBadges.length === 0, 'Regional sites charted on Regional Intel');
    await wait(0.5);
  } catch (error) {
    console.error(error);
    failed = true;
  }
  window.removeEventListener('error', onError);
  window.afterlifeSmoke = { done: true, passed: !failed, results };
  console.log('AFTERLIFE_PLAYER_SMOKE_' + (failed ? 'FAILED' : 'PASSED'));
}
