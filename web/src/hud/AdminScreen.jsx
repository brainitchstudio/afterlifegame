import { useState, useRef, useEffect } from 'react';
import { B, E, L, cls } from './ui.jsx';
import { Heading } from './TabletParts.jsx';

// The tablet's Admin screen: cheats, spawners and a command line.
export function AdminScreen({ game }) {
  const f = game.frame || {};
  const d = game.data || {};
  const hud = game.hud;
  const survivors = (f.entities || []).filter(e => e.kind === 'survivor');
  const zombies = (f.entities || []).filter(e => e.kind === 'zombie');

  const [activeTab, setActiveTab] = useState('cheats');
  const [cliInput, setCliInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [logs, setLogs] = useState([
    { type: 'info', text: 'ADMIN CONSOLE INITIALIZED. Hold ~ or F1 to toggle. Type "help" for command syntax.' },
    { type: 'info', text: `Refuge Status: Day ${f.day || 1} · ${f.phase || 'DAWN'} · Wood: ${Math.floor(f.wood || 0)} · Survivors: ${survivors.length} · Zombies: ${zombies.length}` }
  ]);
  const logScrollRef = useRef(null);

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (type, text) => {
    setLogs(prev => [...prev.slice(-80), { type, text, time: new Date().toLocaleTimeString() }]);
  };

  const executeCommand = (rawCmd) => {
    const cmdStr = (rawCmd || cliInput).trim();
    if (!cmdStr) return;

    setHistory(prev => [cmdStr, ...prev.filter(x => x !== cmdStr)].slice(0, 30));
    setHistoryIndex(-1);
    setCliInput('');

    addLog('cmd', `> ${cmdStr}`);

    const parts = cmdStr.split(/\s+/);
    const op = parts[0].toLowerCase();
    const arg1 = parts[1];
    const arg2 = parts[2];

    switch (op) {
      case 'help':
        addLog('info', 'AVAILABLE COMMANDS:');
        addLog('info', '  wood [n]                - Add wood (e.g. wood 1000, wood -50)');
        addLog('info', '  scrap [n] / food [n]    - Add scrap metal or food');
        addLog('info', '  give [resource] [n]     - Add any supply (ammo, cloth, components, planks...)');
        addLog('info', '  resources [n]           - Add [n] to every supply');
        addLog('info', '  unlock / unlockall      - Unlock every building and upgrade tier');
        addLog('info', '  freebuild [on|off]      - Toggle or set free build mode');
        addLog('info', '  survivor [count] [role] - Spawn survivors (patrol, guard, medic, etc)');
        addLog('info', '  zombie [type] [count]   - Spawn zombies (walker, runner, brute, bloater, soldier)');
        addLog('info', '  horde [count]           - Spawn a horde of zombies around perimeter');
        addLog('info', '  killall / clear         - Eliminate all zombies');
        addLog('info', '  repair                  - Fully repair all buildings for free');
        addLog('info', '  heal                    - Fully heal and stabilize all survivors');
        addLog('info', '  land / expand           - Claim all available territory parcels');
        addLog('info', '  godmode [on|off]        - Toggle invulnerability for colony');
        addLog('info', '  time [0-23] / dawn/dusk - Set time of day');
        addLog('info', '  day / nextday           - Advance to next day');
        addLog('info', '  season [spring..winter] - Switch weather season');
        addLog('info', '  incursion / swarm       - Trigger immediate director swarm');
        addLog('info', '  alarm [on|off]          - Raise or clear alarm');
        addLog('info', '  clearlog                - Clear console log');
        break;

      case 'clearlog':
        setLogs([]);
        break;

      case 'wood': {
        const val = Number(arg1) || 500;
        game.command('devAddWood', val);
        addLog('success', `Added ${val} wood. Stock: ${Math.round(game.frame.wood)}.`);
        break;
      }

      case 'metal':
      case 'scrap': {
        const val = Number(arg1) || 200;
        game.command('devGrantResource', 'scrap_metal', val);
        addLog('success', `Added ${val} scrap. Stock: ${Math.round(game.frame.scrap_metal)}.`);
        break;
      }

      case 'give': {
        const val = Number(arg2) || 100, owned = game.data?.ledger?.owned || {};
        if (!(arg1 in owned)) { addLog('error', `Unknown supply '${arg1}'. Try: ${Object.keys(owned).join(', ')}.`); break; }
        game.command('devGrantResource', arg1, val);
        addLog('success', `Added ${val} ${arg1}.`);
        break;
      }

      case 'food': {
        const val = Number(arg1) || 200;
        game.command('devGrantResource', 'food', val);
        addLog('success', `Added ${val} food. Stock: ${Math.round(game.frame.food)}.`);
        break;
      }

      case 'resources':
      case 'all': {
        const val = Number(arg1) || 1000;
        grantAll(game, val);
        addLog('success', `Granted ${val} of each supply resource.`);
        break;
      }

      case 'unlock':
      case 'unlockall':
        game.command('devUnlockAll');
        addLog('success', 'Every building and upgrade tier unlocked!');
        break;

      case 'freebuild': {
        let enable = !game.frame.freeBuild;
        if (arg1 === 'on' || arg1 === '1' || arg1 === 'true') enable = true;
        else if (arg1 === 'off' || arg1 === '0' || arg1 === 'false') enable = false;
        game.command('devSetFreeBuild', enable);
        addLog('success', `Free Build mode ${enable ? 'ENABLED' : 'DISABLED'}.`);
        break;
      }

      case 'survivor': {
        const count = Math.min(20, Math.max(1, Number(arg1) || 1));
        const role = (arg2 || (isNaN(Number(arg1)) ? arg1 : 'patrol')).toLowerCase();
        for (let i = 0; i < count; i++) {
          game.command('spawnSurvivor', role || 'patrol');
        }
        addLog('success', `Spawned ${count} survivor(s) with role: ${role || 'patrol'}.`);
        break;
      }

      case 'zombie': {
        const validTypes = ['walker', 'runner', 'brute', 'bloater', 'soldier'];
        const type = validTypes.includes(arg1?.toLowerCase()) ? arg1.toLowerCase() : 'walker';
        const count = Math.min(50, Math.max(1, Number(arg2) || (isNaN(Number(arg1)) ? 1 : Number(arg1))));
        for (let i = 0; i < count; i++) {
          game.command('spawnZombie', type);
        }
        addLog('success', `Spawned ${count} ${type}(s).`);
        break;
      }

      case 'horde': {
        const count = Math.min(50, Math.max(1, Number(arg1) || 10));
        game.command('devSpawnHorde', count, 'mixed');
        addLog('success', `Horde of ${count} zombies dispatched around perimeter.`);
        break;
      }

      case 'killall':
      case 'clear':
        game.command('killAllZombies');
        addLog('success', 'All zombies eliminated.');
        break;

      case 'repair':
        game.command('devRepairAllFree');
        addLog('success', 'All structures restored to 100% integrity.');
        break;

      case 'heal':
        game.command('devHealAllSurvivors');
        addLog('success', 'All survivors fully cured, stabilized and restored to max HP.');
        break;

      case 'land':
      case 'expand':
        game.command('devClaimAllLand');
        addLog('success', 'Expanded territory across all available frontier parcels.');
        break;

      case 'godmode':
      case 'god': {
        let enable = !game.frame.godmode;
        if (arg1 === 'on' || arg1 === '1' || arg1 === 'true') enable = true;
        else if (arg1 === 'off' || arg1 === '0' || arg1 === 'false') enable = false;
        game.command('devSetGodmode', enable);
        addLog('success', `Godmode ${enable ? 'ENABLED (Invulnerable)' : 'DISABLED'}.`);
        break;
      }

      case 'time': {
        const hour = Number(arg1);
        if (!isNaN(hour)) {
          game.command('devSetTime', hour % 24);
          addLog('success', `Clock advanced to ${Math.floor(hour % 24)}:00.`);
        } else {
          addLog('error', 'Specify an hour 0-23 (e.g. time 12).');
        }
        break;
      }

      case 'dawn':
        game.command('devSetTime', 6);
        addLog('success', 'Time set to Dawn (06:00).');
        break;
      case 'noon':
        game.command('devSetTime', 12);
        addLog('success', 'Time set to Noon (12:00).');
        break;
      case 'dusk':
        game.command('devSetTime', 18);
        addLog('success', 'Time set to Dusk (18:00).');
        break;
      case 'night':
      case 'midnight':
        game.command('devSetTime', 0);
        addLog('success', 'Time set to Midnight (00:00).');
        break;

      case 'day':
      case 'nextday':
        game.command('devAdvanceDay');
        addLog('success', `Advanced to Day ${game.frame.day}.`);
        break;

      case 'season': {
        const s = arg1?.toLowerCase();
        if (['spring', 'summer', 'fall', 'winter'].includes(s)) {
          game.command('setSeason', s);
          addLog('success', `Season changed to ${s.toUpperCase()}.`);
        } else {
          addLog('error', 'Invalid season. Choose: spring, summer, fall, or winter.');
        }
        break;
      }

      case 'incursion':
      case 'swarm':
        game.command('triggerIncursion');
        addLog('success', 'Director announced incursion swarm.');
        break;

      case 'alarm': {
        const raise = arg1 === 'on' || (arg1 !== 'off' && !game.frame.alarm);
        game.command(raise ? 'raiseAlarm' : 'clearAlarm');
        addLog('success', `Colony alarm ${raise ? 'RAISED' : 'CLEARED'}.`);
        break;
      }

      default:
        addLog('error', `Unknown command "${cmdStr}". Type "help" for syntax.`);
        break;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(nextIdx);
        setCliInput(history[nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCliInput(history[nextIdx] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCliInput('');
      }
    }
  };

  const spawnAtCursor = (kind, isZombie = true) => {
    const mouse = game.input?.mouse;
    const pt = (game.world && mouse) ? game.world.pointerWorld(mouse) : { x: 0, y: 0 };
    if (isZombie) {
      game.command('spawnZombieAt', kind, pt.x, pt.y);
      addLog('success', `Spawned ${kind} zombie at (${Math.round(pt.x)}, ${Math.round(pt.y)}).`);
    } else {
      game.command('spawnSurvivor', kind, pt.x, pt.y);
      addLog('success', `Spawned ${kind} survivor at (${Math.round(pt.x)}, ${Math.round(pt.y)}).`);
    }
  };

  return (
    <E c="admin-embed">
      <Heading right="~ / F1">ADMIN COMMAND CONSOLE</Heading>

      {/* Real-time Status Banner */}
      <E c="admin-status-strip">
        <E c="admin-status-pill">
          <L c="admin-pill-lbl">WOOD</L>
          <L c="admin-pill-val" style={{ color: '#d8b58a' }}>{Math.floor(f.wood || 0)}</L>
        </E>
        <E c="admin-status-pill">
          <L c="admin-pill-lbl">SCRAP</L>
          <L c="admin-pill-val" style={{ color: '#a6bfb0' }}>{Math.floor(f.scrap_metal || 0)}</L>
        </E>
        <E c="admin-status-pill">
          <L c="admin-pill-lbl">FOOD</L>
          <L c="admin-pill-val" style={{ color: '#b5cc85' }}>{Math.floor(f.food || 0)}</L>
        </E>
        <E c="admin-status-pill">
          <L c="admin-pill-lbl">SURVIVORS</L>
          <L c="admin-pill-val">{survivors.length} / {f.capacity || 0}</L>
        </E>
        <E c="admin-status-pill">
          <L c="admin-pill-lbl">DEAD</L>
          <L c="admin-pill-val" style={{ color: zombies.length ? '#e87869' : '#8da47e' }}>{zombies.length}</L>
        </E>
        <B
          c={cls('admin-toggle-pill', f.freeBuild && 'active')}
          title="Click to toggle Free Build mode"
          onClick={() => {
            const next = !f.freeBuild;
            game.command('devSetFreeBuild', next);
            addLog('success', `Free Build mode ${next ? 'ACTIVATED' : 'DEACTIVATED'}.`);
          }}
        >
          <L c="admin-pill-lbl">FREE BUILD</L>
          <L c="admin-pill-val">{f.freeBuild ? 'ON' : 'OFF'}</L>
        </B>
        <B
          c={cls('admin-toggle-pill', f.godmode && 'active')}
          title="Click to toggle Godmode (Invulnerability)"
          onClick={() => {
            const next = !f.godmode;
            game.command('devSetGodmode', next);
            addLog('success', `Godmode ${next ? 'ACTIVATED' : 'DEACTIVATED'}.`);
          }}
        >
          <L c="admin-pill-lbl">GODMODE</L>
          <L c="admin-pill-val">{f.godmode ? 'ON' : 'OFF'}</L>
        </B>
      </E>

      {/* Terminal CLI Line */}
      <E c="admin-cli-wrapper">
        <E c="admin-cli-input-row">
          <span className="admin-prompt">ADMIN&gt;</span>
          <input
            type="text"
            className="admin-cmd-input"
            value={cliInput}
            placeholder="Type cheat command or 'help' (e.g. wood 1000, unlock, freebuild, survivor 3, zombie brute)..."
            onChange={e => setCliInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <B c="btn-admin-exec" onClick={() => executeCommand()}>RUN</B>
          <B c="btn-admin-clear" onClick={() => setLogs([])}>CLEAR</B>
        </E>

        {/* Scrollable CLI Terminal Output */}
        <div className="admin-log-box ui-scroll" ref={logScrollRef}>
          {logs.map((log, idx) => (
            <div key={idx} className={cls('admin-log-line', log.type)}>
              {log.time && <span className="admin-log-time">[{log.time}] </span>}
              <span>{log.text}</span>
            </div>
          ))}
        </div>
      </E>

      {/* Mode / Category Selector Tabs */}
      <E c="admin-tabs-row">
        {[
          { id: 'cheats', label: 'RESOURCES & PROGRESSION' },
          { id: 'build', label: 'BUILD & UNLOCKS' },
          { id: 'spawners', label: 'SPAWN SURVIVORS & DEAD' },
          { id: 'world', label: 'WORLD & TIME' }
        ].map(t => (
          <B
            key={t.id}
            c={cls('admin-tab-btn', activeTab === t.id && 'active')}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </B>
        ))}
      </E>

      {/* Tab Panels */}
      <div className="admin-tab-content">
        {activeTab === 'cheats' && (
          <E c="admin-section-grid">
            <E c="admin-card">
              <L c="card-title">WOOD SUPPLY GRANTS</L>
              <L c="body">Add timber directly into your wood pile for building & tech.</L>
              <E c="admin-btn-row">
                <B onClick={() => { game.command('devAddWood', 100); addLog('success', '+100 wood added.'); }}>+100 Wood</B>
                <B onClick={() => { game.command('devAddWood', 500); addLog('success', '+500 wood added.'); }}>+500 Wood</B>
                <B onClick={() => { game.command('devAddWood', 2000); addLog('success', '+2,000 wood added.'); }}>+2,000 Wood</B>
                <B onClick={() => { game.command('devAddWood', 10000); addLog('success', '+10,000 wood added.'); }}>+10,000 Wood</B>
                <B c="danger" onClick={() => { game.command('devAddWood', -f.wood); addLog('warn', 'Wood emptied to 0.'); }}>Zero Wood</B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">SCRAP & FOOD SUPPLY GRANTS</L>
              <L c="body">Add scrap metal or farm sustenance instantly.</L>
              <E c="admin-btn-row">
                <B onClick={() => { game.command('devGrantResource', 'scrap_metal', 200); addLog('success', '+200 scrap added.'); }}>+200 Scrap</B>
                <B onClick={() => { game.command('devGrantResource', 'scrap_metal', 1000); addLog('success', '+1,000 scrap added.'); }}>+1,000 Scrap</B>
                <B onClick={() => { game.command('devGrantResource', 'food', 200); addLog('success', '+200 food added.'); }}>+200 Food</B>
                <B onClick={() => { game.command('devGrantResource', 'food', 1000); addLog('success', '+1,000 food added.'); }}>+1,000 Food</B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">BULK RESOURCE PACKAGES</L>
              <L c="body">One-click bundles to supply all logistics for stress testing.</L>
              <E c="admin-btn-row">
                <B c="primary" onClick={() => {
                  grantAll(game, 1000);
                  addLog('success', '+1,000 to all resources granted.');
                }}>+1,000 All Supplies</B>
                <B c="primary" onClick={() => {
                  grantAll(game, 25000);
                  addLog('success', 'MAX RESOURCES GRANTED (25,000 each).');
                }}>MAX 25,000 All Supplies</B>
              </E>
            </E>
          </E>
        )}

        {activeTab === 'build' && (
          <E c="admin-section-grid">
            <E c="admin-card">
              <L c="card-title">UNLOCK PROGRESSION & WORKBENCH</L>
              <L c="body">Bypass tree chopping research requirements and unlock every catalog structure.</L>
              <E c="admin-btn-row">
                <B c="primary" onClick={() => {
                  game.command('devUnlockAll');
                  addLog('success', 'Unlocked every structure and upgrade tier.');
                }}>
                  🔓 Unlock Every Building
                </B>
                <B onClick={() => hud.showTablet('quests')}>
                  Open Quests
                </B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">FREE BUILD MODE (CHEAT)</L>
              <L c="body">
                {f.freeBuild
                  ? 'Active: All buildings in Build Mode [B] are 100% FREE and placeable without cost or quest unlocks.'
                  : 'Disabled: Buildings require quest unlocks and consume regular wood & metal supplies.'}
              </L>
              <E c="admin-btn-row">
                <B
                  c={f.freeBuild ? 'danger' : 'primary'}
                  onClick={() => {
                    const next = !f.freeBuild;
                    game.command('devSetFreeBuild', next);
                    addLog('success', `Free Build ${next ? 'ACTIVATED' : 'DEACTIVATED'}.`);
                  }}
                >
                  {f.freeBuild ? 'Disable Free Build Mode' : '⚡ Enable Free Build Mode'}
                </B>
                <B onClick={() => hud.showBuild()}>
                  Open Build Menu [ B ]
                </B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">TERRITORY & STRUCTURAL MAINTENANCE</L>
              <L c="body">Instantly claim frontier expansion parcels or repair damaged fortifications.</L>
              <E c="admin-btn-row">
                <B c="primary" onClick={() => {
                  game.command('devClaimAllLand');
                  addLog('success', 'Claimed and cleared all available land parcels.');
                }}>
                  Expand All Land Parcels
                </B>
                <B onClick={() => {
                  game.command('devRepairAllFree');
                  addLog('success', 'Restored 100% HP to all settlement buildings and walls.');
                }}>
                  🔨 Repair All (0 Cost)
                </B>
              </E>
            </E>
          </E>
        )}

        {activeTab === 'spawners' && (
          <E c="admin-section-grid">
            <E c="admin-card">
              <L c="card-title">INSTANT SURVIVOR SPAWNER</L>
              <L c="body">Immediately add survivors to your colony without recruitment delays or costs.</L>
              <E c="admin-btn-row">
                <B onClick={() => { game.command('spawnSurvivor', 'patrol'); addLog('success', 'Spawned Patrol survivor.'); }}>+1 Patrol</B>
                <B onClick={() => { game.command('spawnSurvivor', 'guard'); addLog('success', 'Spawned Guard survivor.'); }}>+1 Guard (Combat)</B>
                <B onClick={() => { game.command('spawnSurvivor', 'medic'); addLog('success', 'Spawned Medic survivor.'); }}>+1 Medic (Clinic)</B>
                <B onClick={() => { game.command('spawnSurvivor', 'engineer'); addLog('success', 'Spawned Engineer survivor.'); }}>+1 Engineer (Workshop)</B>
                <B onClick={() => { game.command('spawnSurvivor', 'farmer'); addLog('success', 'Spawned Farmer survivor.'); }}>+1 Farmer</B>
                <B onClick={() => { game.command('spawnSurvivor', 'logger'); addLog('success', 'Spawned Logger survivor.'); }}>+1 Logger</B>
                <B onClick={() => { game.command('spawnSurvivor', 'researcher'); addLog('success', 'Spawned Researcher survivor.'); }}>+1 Researcher</B>
                <B c="primary" onClick={() => {
                  for (let i = 0; i < 5; i++) game.command('spawnSurvivor', 'patrol');
                  addLog('success', 'Spawned 5 new survivors.');
                }}>+5 Survivors</B>
                <B onClick={() => spawnAtCursor('patrol', false)}>Spawn at Cursor</B>
                <B c="primary" onClick={() => { game.command('devHealAllSurvivors'); addLog('success', 'All survivors fully healed.'); }}>✚ Heal & Cure All</B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">ZOMBIE INFECTION & THREAT SPAWNER</L>
              <L c="body">Spawn specific mutant variants to test defenses, weapons, and AI pathfinding.</L>
              <E c="admin-btn-row">
                <B onClick={() => { game.command('spawnZombie', 'walker'); addLog('warn', 'Spawned Walker.'); }}>Spawn Walker</B>
                <B onClick={() => { game.command('spawnZombie', 'runner'); addLog('warn', 'Spawned Runner (Fast).'); }}>Spawn Runner</B>
                <B onClick={() => { game.command('spawnZombie', 'brute'); addLog('warn', 'Spawned Brute (Tank).'); }}>Spawn Brute</B>
                <B onClick={() => { game.command('spawnZombie', 'bloater'); addLog('warn', 'Spawned Bloater (Explosive).'); }}>Spawn Bloater</B>
                <B onClick={() => { game.command('spawnZombie', 'soldier'); addLog('warn', 'Spawned Soldier.'); }}>Spawn Soldier</B>
                <B onClick={() => spawnAtCursor('walker', true)}>Walker at Cursor</B>
                <B onClick={() => spawnAtCursor('brute', true)}>Brute at Cursor</B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">SWARM & PACIFICATION TOOLS</L>
              <L c="body">Test combat under swarm pressure or instantly neutralize all hostiles.</L>
              <E c="admin-btn-row">
                <B c="primary" onClick={() => { game.command('devSpawnHorde', 10, 'mixed'); addLog('warn', 'Spawned 10 mixed zombies.'); }}>Spawn Horde (10)</B>
                <B c="primary" onClick={() => { game.command('devSpawnHorde', 25, 'mixed'); addLog('warn', 'Spawned mega horde (25).'); }}>Spawn Mega Horde (25)</B>
                <B onClick={() => { game.command('triggerIncursion'); addLog('warn', 'Swarm incursion announced!'); }}>Trigger Swarm Incursion</B>
                <B c="danger" onClick={() => { game.command('killAllZombies'); addLog('success', 'Neutralized all active dead.'); }}>☠ Kill All Dead (Clear)</B>
              </E>
            </E>
          </E>
        )}

        {activeTab === 'world' && (
          <E c="admin-section-grid">
            <E c="admin-card">
              <L c="card-title">CHRONO & TIME CONTROL</L>
              <L c="body">{`Mission Clock: Day ${f.day} · Hour ${(f.hour || 0).toFixed(1)} (${f.phase})`}</L>
              <E c="admin-btn-row">
                <B onClick={() => { game.command('devSetTime', ((f.hour || 0) + 1) % 24); addLog('info', 'Advanced 1 hour.'); }}>+1 Hour</B>
                <B onClick={() => { game.command('devSetTime', 6); addLog('info', 'Time set to Dawn (06:00).'); }}>Set Dawn (06:00)</B>
                <B onClick={() => { game.command('devSetTime', 12); addLog('info', 'Time set to Noon (12:00).'); }}>Set Noon (12:00)</B>
                <B onClick={() => { game.command('devSetTime', 18); addLog('info', 'Time set to Dusk (18:00).'); }}>Set Dusk (18:00)</B>
                <B onClick={() => { game.command('devSetTime', 0); addLog('info', 'Time set to Midnight (00:00).'); }}>Set Night (00:00)</B>
                <B c="primary" onClick={() => { game.command('devAdvanceDay'); addLog('info', `Advanced to Day ${game.frame.day}.`); }}>Fast Forward 1 Day</B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">ENVIRONMENT & SEASONS</L>
              <L c="body">{`Current Season: ${(f.season || 'spring').toUpperCase()}`}</L>
              <E c="admin-btn-row">
                <B onClick={() => { game.command('setSeason', 'spring'); addLog('info', 'Season set to Spring.'); }}>Spring</B>
                <B onClick={() => { game.command('setSeason', 'summer'); addLog('info', 'Season set to Summer.'); }}>Summer</B>
                <B onClick={() => { game.command('setSeason', 'fall'); addLog('info', 'Season set to Fall.'); }}>Fall</B>
                <B onClick={() => { game.command('setSeason', 'winter'); addLog('info', 'Season set to Winter.'); }}>Winter</B>
              </E>
            </E>

            <E c="admin-card">
              <L c="card-title">ALARM & DEFENSE DIRECTIVES</L>
              <L c="body">Control emergency alerts and survivor stationing.</L>
              <E c="admin-btn-row">
                <B c={f.alarm ? 'danger' : 'primary'} onClick={() => {
                  const raise = !f.alarm;
                  game.command(raise ? 'raiseAlarm' : 'clearAlarm');
                  addLog('info', raise ? 'Alarm sounded.' : 'Alarm cleared.');
                }}>
                  {f.alarm ? 'Silence Colony Alarm' : '🔔 Sound Alarm'}
                </B>
                <B
                  c={f.godmode ? 'danger' : 'primary'}
                  onClick={() => {
                    const next = !f.godmode;
                    game.command('devSetGodmode', next);
                    addLog('success', `Godmode ${next ? 'ACTIVATED' : 'DEACTIVATED'}.`);
                  }}
                >
                  {f.godmode ? 'Disable Godmode' : '🛡 Enable Godmode (Invulnerable)'}
                </B>
              </E>
            </E>
          </E>
        )}
      </div>
    </E>
  );
}

// Every supply the run keeps: the three of a legacy run, or a campaign's whole ledger.
function grantAll(game, amount) {
  for (const r of Object.keys(game.data?.ledger?.owned || { wood: 0, scrap_metal: 0, food: 0 })) game.command('devGrantResource', r, amount);
}
