// The backdrop dialogs from GameHud.cs (Open(title) panels): menu, outcome, custom setup,
// confirmation and licenses, plus save import and the overseer's tablet (Tablet.jsx). The tablet hosts construction, the stockpile, crew, expeditions,
// settings and the admin console as screens; the menu dialog is only shown over the title screen.
import { useState } from 'react';
import { B, E, L, Icon, Card, cls, bg, buildingSpriteUrl } from './ui.jsx';
import { Tablet } from './Tablet.jsx';
import { Heading } from './TabletParts.jsx';
import { SaveStore } from '../host/saveStore.js';
import { audio } from '../host/audio.js';

function Panel({ game, title, children }) {
  return (
    <E c="panel modal">
      <E c="row">
        <L c="heading">{title}</L>
        <E c="spacer" />
        <B c="close" onClick={() => game.hud.closeModal()}>×</B>
      </E>
      <div className="ui-scroll modal-scroll">{children}</div>
    </E>
  );
}

export function Dialog({ game, modal }) {
  switch (modal.kind) {
    case 'tablet': return <Tablet game={game} modal={modal} />;
    case 'menu': return <MenuDialog game={game} />;
    case 'outcome': return game.data.campaign?.loss ? <CampaignLossDialog game={game} loss={game.data.campaign.loss} /> : <OutcomeDialog game={game} />;
    case 'phase2': return <Phase2Dialog game={game} />;
    case 'encounter': return <EncounterDialog game={game} />;
    case 'custom': return <CustomSetupDialog game={game} />;
    case 'import': return <ImportDialog game={game} modal={modal} />;
    case 'licenses': return <Panel game={game} title="THIRD-PARTY LICENSES"><L c="small">{modal.text}</L></Panel>;
    case 'confirm': return (
      <Panel game={game} title={modal.title}>
        <L c="body">{modal.message}</L>
        <E c="row">
          <B c="primary" onClick={() => { game.hud.closeModal(); modal.action(); }}>Confirm</B>
          <B onClick={() => game.hud.closeModal()}>Cancel</B>
        </E>
      </Panel>
    );
    default: return null;
  }
}

const CATEGORY = {
  barricade: 'DEFENSE', gate: 'DEFENSE', tower: 'DEFENSE', shelter: 'DEFENSE',
  dorm: 'HOUSING', barracks: 'HOUSING',
  farm: 'PRODUCTION', workshop: 'PRODUCTION', lumber_mill: 'PRODUCTION', storage: 'PRODUCTION', lab: 'PRODUCTION', armory: 'PRODUCTION', clinic: 'PRODUCTION',
  tent: 'HOUSING', makeshift_shelter: 'HOUSING', lookout_post: 'DEFENSE', guard_post: 'DEFENSE',
  supply_stash: 'PRODUCTION', garden_plot: 'PRODUCTION', field_workbench: 'PRODUCTION', aid_station: 'PRODUCTION', radio_kit: 'PRODUCTION', salvage_pile: 'PRODUCTION',
};
const categoryOf = type => CATEGORY[type] || 'OTHER';

// Whether a catalog entry's cost is covered by what is available (stock not already reserved).
function canAfford(costMap, game) {
  const have = game.data?.ledger?.available || game.frame;
  return Object.entries(costMap || {}).every(([r, n]) => (have[r] ?? 0) >= n);
}

// The tablet's Construction screen: the catalog. Choosing a building closes the tablet to place it.
export function ConstructionScreen({ game }) {
  const buildings = game.catalog.buildings;
  const filter = game.hud.buildFilter;
  const setFilter = value => game.hud.setBuildFilter(value);
  const open = buildings.filter(b => !b.locked).length;
  return (
    <>
      <Heading right={`${open} OF ${buildings.length} UNLOCKED`}>CONSTRUCTION</Heading>
      <E c="build-hint-bar"><L c="build-hint-text">Click to place  ·  [R] Rotate barricade & gate  ·  [Right-Click / Esc] Finish</L></E>
      <E c="build-tabs">
        {['ALL', 'DEFENSE', 'HOUSING', 'PRODUCTION'].map(cat => (
          <B key={cat} c={cls('build-tab-btn', filter === cat && 'active-tab')} onClick={() => setFilter(cat)}>
            {`${cat} (${cat === 'ALL' ? buildings.length : buildings.filter(b => categoryOf(b.id) === cat).length})`}
          </B>
        ))}
      </E>
      <E c="build-grid">
        {buildings.filter(b => filter === 'ALL' || categoryOf(b.id) === filter).map(item => {
          const affordable = game.freeBuild || (canAfford(item.costMap, game) && !item.locked);
          return (
            <E key={item.id} c={cls('build-card-compact', !affordable && 'unaffordable')}>
              <div className="ui-sprite build-card-thumb" style={bg(buildingSpriteUrl(item.id))} />
              <E c="build-card-info">
                <E c="build-card-title-row">
                  <L c="build-card-title">{item.name}</L>
                  <L c="build-card-badge">{categoryOf(item.id)}</L>
                </E>
                <L c="build-card-desc">{item.description}</L>
                <L c={cls('build-card-cost', !affordable && 'cannot-afford')}>{game.freeBuild ? 'FREE (Free Build Mode)' : item.locked ? 'Locked · quest: ' + item.unlockedBy : item.cost}</L>
              </E>
              <B c="btn-build-action" enabled={affordable} onClick={() => game.beginBuilding(item.id)}>{item.locked && !game.freeBuild ? 'Locked' : 'Build'}</B>
            </E>
          );
        })}
      </E>
    </>
  );
}

// The workshop and trader on the tablet's Stockpile screen.
export function WorkshopSection({ game }) {
  const d = game.data;
  return (
    <>
      <Heading right="GUARDS AND SENTRIES GET FIRST PICK">WORKSHOP</Heading>
      {!d.weapons.some(w => w.enabled) && <L c="tab-empty">Weapons are fabricated at a workshop and handed out automatically by job.</L>}
      <E c="tab-grid3">
        {d.weapons.map(w => (
          <E key={w.id} c="tab-card">
            <E c="tab-row">
              <Icon name="icon_damage" c="tab-icon" />
              <E c="tab-col grow"><L c="tab-name">{w.name}</L><L c="tab-sub">{`${w.count} owned · ${w.cost}`}</L></E>
            </E>
            <E c="tab-actions"><B c="tablet-btn primary" enabled={w.enabled} onClick={() => game.command('fabricate', w.id)}>Fabricate</B></E>
          </E>
        ))}
      </E>
      <Heading>TRADER</Heading>
      {d.trader ? (
        <E c="tab-card">
          <L c="tab-body">{d.trader}</L>
          <E c="tab-actions">
            <B c="tablet-btn primary" enabled={d.tradeEnabled} onClick={() => game.command('trade')}>Accept trade</B>
            <B c="tablet-btn" onClick={() => game.command('dismissTrader')}>Dismiss trader</B>
          </E>
        </E>
      ) : <L c="tab-empty">No trader at the gate. Watch for arrivals while time advances.</L>}
    </>
  );
}

// The tablet's Expeditions screen: destinations, the party and sending it out.
export function ExpeditionsScreen({ game }) {
  const hud = game.hud, catalog = game.catalog;
  const trip = hud.trip;
  const away = game.frame.entities.filter(e => e.kind === 'survivor' && e.away);
  let tripName = '', tripDesc = '';
  const chosen = catalog.expeditions.find(e => e.id === trip);
  if (chosen) {
    tripName = chosen.name;
    tripDesc = `${chosen.description}\n${chosen.hours} game hours · ${chosen.cost} per member\nBase reward: ${chosen.reward}`;
  } else {
    const poi = (catalog.pois || []).find(p => String(p.id) === trip);
    if (poi) { tripName = poi.name; tripDesc = (poi.description || 'Physical site expedition on the world map.') + '\nPhysical site expedition on the world map.'; }
  }
  const info = game.simulation.party([...hud.party], trip);
  return (
    <>
      <Heading right={`${away.length} AWAY`}>EXPEDITIONS</Heading>
      <L c="body">{`Choose a destination and up to ${game.data.partyCap} survivors. Someone must stay behind. The game is paused while you plan.`}</L>
      {away.map(e => <L key={e.id} c="small">{`${e.name} · ${e.task}`}</L>)}
      <E c="row">
        {catalog.expeditions.map(t => <B key={t.id} c={trip === t.id ? 'primary' : ''} onClick={() => hud.chooseTrip(t.id)}>{(trip === t.id ? '• ' : '') + t.name}</B>)}
      </E>
      {catalog.pois?.length > 0 && (
        <E c="row" style={{ flexWrap: 'wrap' }}>
          {catalog.pois.map(p => <B key={p.id} c={trip === String(p.id) ? 'primary' : ''} onClick={() => hud.chooseTrip(String(p.id))}>{(trip === String(p.id) ? '• ' : '') + p.name}</B>)}
        </E>
      )}
      <Card title={tripName} body={tripDesc} />
      {info.members.map(s => {
        const selected = hud.party.has(s.id);
        return (
          <B key={s.id} c={selected ? 'primary' : ''} enabled={s.enabled || selected} onClick={() => hud.toggleParty(s.id)}>
            <E c="row-center">
              <Icon name={selected ? 'badge_check' : 'icon_survivor'} c="badge-icon" />
              <L c="btn-text">{`${s.name} · ${s.description}`}</L>
            </E>
          </B>
        );
      })}
      <L c="cost">{`Cost: ${info.cost} · Risk per member: ${Math.round(info.risk * 100)}%`}</L>
      <L c="body">{info.reason || ''}</L>
      <B c="primary" enabled={!info.reason} onClick={() => { if (game.command('sendExpedition', [...hud.party], trip)) { hud.party.clear(); hud.closeModal(); } }}>Send party</B>
    </>
  );
}

async function copySave(game) {
  const json = game.simulation.serialize();
  try {
    await navigator.clipboard.writeText(json);
    game.hud.notify('Save copied', 'Keep the JSON somewhere safe, or import it in the Unity version.');
  } catch {
    game.hud.notify('Copy failed', 'The browser blocked clipboard access.');
  }
}

async function importFromClipboard(game) {
  let text = null;
  try { text = await navigator.clipboard.readText(); } catch { /* fall back to pasting */ }
  if (!text) { game.hud.showImport('The browser did not share the clipboard. Paste the save JSON below.'); return; }
  const error = game.importSave(text);
  game.hud.notify(error ? 'Import failed' : 'Save imported', error || 'The game is paused. Resume when ready.');
}

function ImportDialog({ game, modal }) {
  const [text, setText] = useState('');
  return (
    <Panel game={game} title="IMPORT SAVE">
      <L c="body">{modal.message}</L>
      <textarea className="save-import-field" value={text} onChange={e => setText(e.target.value)} spellCheck={false} placeholder="{ ... }" />
      <E c="row">
        <B c="primary" enabled={text.trim().length > 0} onClick={() => {
          const error = game.importSave(text.trim());
          if (error) game.hud.showImport('Import failed: ' + error);
          else game.hud.notify('Save imported', 'The game is paused. Resume when ready.');
        }}>Import</B>
        <B onClick={() => game.hud.closeModal()}>Cancel</B>
      </E>
    </Panel>
  );
}

function MenuDialog({ game }) {
  return <Panel game={game} title="AFTERLIFE"><MenuItems game={game} /></Panel>;
}

// The menu's settings and save controls; also the tablet's Settings tab.
export function MenuItems({ game, inTablet = false }) {
  const hud = game.hud;
  const warnings = game.data.warnings?.length ?? 0;
  const soundOn = audio.sfxEnabled;
  // Toggles re-open whichever view they were pressed in so it shows the new setting.
  const menu = () => inTablet ? hud.showTablet('settings') : hud.showMenu();
  const world = game.simulation.worldInfo(), campaign = game.data.campaign;
  return (
    <>
      <L c="body">{campaign
        ? `Overseer ${campaign.settings.overseerName}, Region ${campaign.regionId}. Your task is to turn this provisional camp into a certified outpost, one CentroCom authorization at a time. Each game hour lasts 42 seconds at 1×. Tasks, messages and authorizations are on your SeerPad [Tab].`
        : 'You are the overseer: grow a camp into a city and survive 24 complete days. Each game hour lasts 42 seconds at 1×. Your orders, milestones and messages are on your tablet [Tab].'}</L>
      <Card title="CONTROLS" body={'Click survivors or buildings to inspect.\nWASD / Arrows · pan camera    Scroll / +/- / HUD · zoom\nF · focus on selected / center    Home · reset view\nTab · overseer tablet    B · construction    C · crew    E · expeditions    J · journal    L · land\nR · rotate wall/gate    Space · pause\n1 / 2 / 4 · speed    Escape / right click · cancel\nMenus and an unfocused window pause the simulation.'} />
      {!inTablet && <B onClick={() => hud.showTablet('messages')}>{`Tablet messages · ${warnings} warnings`}</B>}
      {!campaign && <B onClick={() => hud.showCustomGameSetup()}>Custom territory & seasons</B>}
      <B onClick={() => { game.togglePauseOnIncursion(); menu(); }}>{'Pause on incursion: ' + (game.pauseOnIncursion ? 'ON' : 'OFF')}</B>
      <B onClick={() => { audio.toggleSound(); menu(); }}>{soundOn ? 'Sound Effects: ENABLED' : 'Sound Effects: MUTED'}</B>
      <B onClick={async () => { if (await game.save()) hud.notify('Saved', 'Progress is stored on this computer.'); }}>Save now</B>
      <B onClick={() => copySave(game)}>Copy save to clipboard</B>
      <B onClick={() => hud.confirm('Import save', 'Replace this run with the Afterlife save JSON on your clipboard? The previous run is backed up.', () => importFromClipboard(game))}>Import save from clipboard</B>
      <B onClick={() => SaveStore.openFolder().catch(error => hud.notify('Save folder', error.message))}>Open save folder</B>
      {campaign
        ? <B c="danger" onClick={() => hud.confirm('Request a new deployment', 'Abandon Region ' + campaign.regionId + ' and apply for a new assignment? CentroCom keeps your current run as the backup save, for compliance purposes.', () => hud.beginNewRefuge())}>New deployment</B>
        : <B c="danger" onClick={() => hud.confirm('Start a new refuge', 'Start over from Day 1? Your current run will be kept as the backup save.', () => hud.beginNewRefuge())}>New refuge</B>}
      <B c="primary" onClick={() => { hud.closeModal(); hud.showStartScreen(); }}>Return to Title Screen</B>
      {!hud.isStartScreenOpen && !inTablet && <B c="primary" onClick={() => hud.showAdmin()}>Admin Command Tool [ ~ / F1 ]</B>}
      {game.debugToolsEnabled && <DebugTools game={game} />}
      <B onClick={() => hud.showLicenses()}>Third-party licenses</B>
      <B onClick={() => game.quit()}>Quit</B>
      <L c="small">{'React presentation · original Afterlife simulation' + (campaign ? `\nRegion ${campaign.regionId} · seed ${campaign.settings.seed || 'random'}` : world ? `\nWorld seed: ${world.seed} (${world.size})` : '') + '\nSaves: ' + SaveStore.pathname}</L>
    </>
  );
}

// The Unity build's debug menu section plus its component context-menu actions.
function DebugTools({ game }) {
  const hud = game.hud;
  const done = (title, message) => { hud.closeModal(); hud.notify(title, message); };
  return (
    <>
      <L c="section">ADMIN & TESTING TOOLS</L>
      <E c="row" style={{ flexWrap: 'wrap' }}>
        <B c="primary" onClick={() => hud.showAdmin()}>Open Admin Console</B>
      </E>
      <L c="section">ZOMBIE TESTING & COMBAT</L>
      <E c="row" style={{ flexWrap: 'wrap' }}>
        <B onClick={() => { game.command('spawnZombie', 'walker', 0); done('Spawned', 'Walker spawned beyond the north gate.'); }}>Spawn Zombie</B>
        <B onClick={() => { game.command('spawnZombie', 'runner', 0); done('Spawned', 'Runner spawned beyond the north gate.'); }}>Spawn Runner</B>
        <B onClick={() => { game.command('spawnZombie', 'brute', 0); done('Spawned', 'Brute spawned beyond the north gate.'); }}>Spawn Brute</B>
        <B onClick={() => { game.command('triggerIncursion'); done('Swarm Inbound', 'Director triggered an incursion!'); }}>Trigger Swarm</B>
        <B onClick={() => { game.command('killAllZombies'); hud.notify('Cleared', 'All active zombies eliminated.'); }}>Kill All Dead</B>
      </E>
      <L c="section">DEVELOPER TOOLS</L>
      <E c="row" style={{ flexWrap: 'wrap' }}>
        <B onClick={() => { for (const r of Object.keys(game.data?.ledger?.owned || { wood: 0, scrap_metal: 0, food: 0 })) game.command('devGrantResource', r, 100); }}>+100 all supplies</B>
        <B onClick={() => { game.debugGenerateWorld('medium'); done('Procedural World Generated', 'Generated a medium world in place.'); }}>Generate world</B>
        <B onClick={() => { game.debugLoadOutpost(); done('Outpost Map Loaded', 'Loaded the outpost territory in place.'); }}>Load outpost map</B>
        <B onClick={() => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); }}>Toggle fullscreen</B>
        <B onClick={() => window.open('/dashboard/', '_blank')}>Upgrades & Content Studio</B>
      </E>
      <L c="small">Z spawns a walker at the cursor · H triggers an incursion.</L>
    </>
  );
}

// P1-10 complete: the camp is classified and Phase 2 waits for the Overseer. The simulation holds meanwhile.
function Phase2Dialog({ game }) {
  const p = game.data.campaign?.phase2;
  if (!p) return null;
  return (
    <Panel game={game} title={p.title}>
      <L c="body">{p.body}</L>
      {p.mara && <L c="body">{'MARA VENN · “' + p.mara + '”'}</L>}
      <L c="small">{p.risk}</L>
      <B c="primary" onClick={() => game.beginPhase2()}>{p.button}</B>
    </Panel>
  );
}

// An expedition's encounter: the team waits on site, and the game with it, until the Overseer decides.
function EncounterDialog({ game }) {
  const e = game.data.campaign?.encounter;
  if (!e) return null;
  return (
    <Panel game={game} title={`${e.code} · ${e.title}`}>
      <L c="small">{`${e.name} · ${e.team.join(', ')}${e.kits ? ` · ${e.kits} First Aid Kit in provisions` : ''}`}</L>
      <L c="body">{e.text}</L>
      {e.choices.map(c => (
        <B key={c.id} c="primary" title={c.detail} onClick={() => game.chooseEncounter(c.id)}>{`${c.label} — ${c.detail}`}</B>
      ))}
    </Panel>
  );
}

// A campaign ends when nobody is left: load the last milestone autosave, deploy again on the same seed, or leave.
function CampaignLossDialog({ game, loss }) {
  const f = game.frame, hud = game.hud;
  return (
    <Panel game={game} title={loss.title}>
      <L c="body">{loss.body}</L>
      <L c="body">{'MARA VENN · “' + loss.mara + '”'}</L>
      <L c="heading">{`Day ${f.day} · ${f.kills} infected neutralized.`}</L>
      <B c="primary" enabled={!!game.lastAutosave} title={game.lastAutosave ? game.lastAutosave.reason : 'No milestone autosave in this session'} onClick={() => game.loadLastAutosave()}>{game.lastAutosave ? 'Load autosave · ' + game.lastAutosave.reason : 'Load autosave'}</B>
      <B onClick={() => game.restartCampaign()}>Restart this region (same seed)</B>
      <B onClick={() => { hud.closeModal(); hud.showStartScreen(); }}>Return to Title Screen</B>
    </Panel>
  );
}

function OutcomeDialog({ game }) {
  const f = game.frame, won = f.status === 'won';
  const hud = game.hud;
  return (
    <Panel game={game} title={won ? 'TWENTY-FOUR DAYS. STILL HERE.' : 'THE REFUGE HAS FALLEN'}>
      <L c="body">{won ? 'Your people survived. The refuge held through all 24 days.' : 'The dead destroyed the HQ. Build, staff, and reinforce a new refuge to try again.'}</L>
      <L c="heading">{`Day ${f.day} · ${f.kills} zombies defeated.`}</L>
      <B c="primary" onClick={() => hud.beginNewRefuge()}>Start a new refuge</B>
      <B onClick={() => { hud.closeModal(); hud.showStartScreen(); }}>Return to Title Screen</B>
      <B onClick={() => hud.showMenu()}>Save & menu</B>
    </Panel>
  );
}

function CustomSetupDialog({ game }) {
  const hud = game.hud;
  const season = (name, label) => () => { game.setSeason(name); hud.notify('Season Set', `Starting in ${label}.`); };
  return (
    <Panel game={game} title="CUSTOM REFUGE SETUP">
      <L c="body">Choose your starting territory, terrain generator, and starting season.</L>
      <Card title="WORLD GENERATOR" body="Generate an expansive procedural map with clustered POIs and wilderness decor, or load the classic Outpost territory." />
      <E c="row">
        <B c="primary" onClick={() => { game.startCustomRun('medium'); hud.notify('Procedural World Generated', 'Explore POIs and scavenge outside the refuge gates.'); }}>Procedural World (Medium)</B>
        <B c="primary" onClick={() => { game.startCustomRun('outpost'); hud.notify('Outpost Territory Loaded', 'Defend the perimeter and manage your crew.'); }}>Outpost Map (Survival Kit)</B>
        <B c="primary" onClick={() => { game.startCustomRun('large'); hud.notify('Large World Generated', 'A vast wilderness awaits.'); }}>Procedural World (Large)</B>
      </E>
      <L c="section">STARTING SEASON</L>
      <E c="row">
        <B onClick={season('spring', 'Spring')}>Spring (Days 1–6)</B>
        <B onClick={season('summer', 'Summer')}>Summer (Days 7–12)</B>
        <B onClick={season('fall', 'Fall')}>Fall (Days 13–18)</B>
        <B onClick={season('winter', 'Winter')}>Winter (Days 19–24)</B>
      </E>
      <B onClick={() => { hud.closeModal(); hud.showStartScreen(); }}>Cancel / Return</B>
    </Panel>
  );
}
