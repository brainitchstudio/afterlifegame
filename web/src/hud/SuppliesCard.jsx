// The supplies card, top right, as a small overseer tablet like the clock and survivors cards: each
// stock against its storage on the kit's supply bars, its net rate per game hour and when it fills
// up or runs out, then beds, weapons and the settlement's live warnings. Everything explains itself
// on hover; a row opens the tablet's stockpile. It folds to a single line of stock.
import { useEffect, useRef, useState } from 'react';
import { B, E, L, Icon, cls, kitVars } from './ui.jsx';
import { Bar } from './TabletParts.jsx';
import { RESOURCE_INFO, RESOURCE_GROUPS } from './resources.js';

const COLLAPSED_KEY = 'Afterlife.SuppliesCollapsed';
const HOUR = 42; // Game seconds per game hour; the simulation's rates are per game second.
// Smaller changes are production ticking over; only lump sums (builds, trades, loot) float a +N/-N.
const POP_THRESHOLD = 5;
const RESOURCES = ['wood', 'scrap_metal', 'food'].map(id => ({ id, ...RESOURCE_INFO[id] }));
// A campaign's other resources, shown as a compact grid under the essentials.
const OTHERS = RESOURCE_GROUPS.slice(1).flatMap(g => g.ids).map(id => ({ id, ...RESOURCE_INFO[id] }));

const signed = v => (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 10 ? 0 : 1);
const hours = h => (h >= 48 ? `${Math.round(h / 24)}d` : h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`);
function readCollapsed() { try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; } }

// When a stock fills its storage or runs dry at the current rate, in game hours.
function outlook(amount, cap, perHour) {
  if (perHour < -0.05) return amount <= 0 ? { text: 'EMPTY', tone: 'red', hint: 'Out of stock.' } : { text: `EMPTY IN ${hours(amount / -perHour)}`, tone: amount / -perHour < 6 ? 'red' : 'amber', hint: `Runs out in about ${hours(amount / -perHour)} of game time at this rate.` };
  if (perHour > 0.05) return amount >= cap ? { text: 'FULL', tone: 'amber', hint: 'Storage is full; build or upgrade a Storage depot to hold more.' } : { text: `FULL IN ${hours((cap - amount) / perHour)}`, tone: '', hint: `Storage fills in about ${hours((cap - amount) / perHour)} of game time at this rate.` };
  return { text: 'STEADY', tone: '', hint: 'Nothing is coming in or going out right now.' };
}

export function SuppliesCard({ game, onHeight }) {
  const hud = game.hud, f = game.frame, d = game.data;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [pops, setPops] = useState({});
  const ref = useRef(null), prev = useRef(null);

  // Reports its height in panel units so the inspector below can follow it.
  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeight) return;
    const report = () => onHeight(el.offsetHeight);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [onHeight]);

  // A campaign shows what is available (stock minus what is reserved) against one shared storage capacity.
  const ledger = d.campaign ? d.ledger : null;
  const amounts = RESOURCES.map(r => Math.floor(ledger ? ledger.available[r.id] ?? 0 : f[r.id] ?? 0));
  useEffect(() => {
    const last = prev.current;
    prev.current = amounts;
    if (!last) return;
    const next = {};
    amounts.forEach((n, i) => { if (Math.abs(n - last[i]) >= POP_THRESHOLD) next[RESOURCES[i].id] = { delta: n - last[i], key: performance.now() }; });
    if (Object.keys(next).length) setPops(p => ({ ...p, ...next }));
  });

  const toggle = () => {
    setCollapsed(c => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1'); } catch { /* preference is best effort */ }
      return !c;
    });
  };

  const survivors = f.entities.filter(e => e.kind === 'survivor').length;
  const housed = f.capacity - (d.freeBeds ?? 0);
  const unhoused = Math.max(0, survivors - housed);
  const weapons = (d.weapons || []).reduce((n, w) => n + w.count, 0);
  const warnings = d.warnings || [];

  return (
    <div className="supplies-tablet" style={kitVars()} ref={ref}>
      <E c="tablet-screen">
        <E c="tablet-head supplies-head">
          <Icon name="icon_capacity" c="tablet-head-icon" />
          <L c="tablet-title">SUPPLIES</L>
          <E c="spacer" />
          <B c="tablet-btn supplies-head-btn" title="Tablet · Stockpile, workshop & trader" onClick={() => hud.showStockpile()}>STOCKPILE</B>
          <B c="tablet-btn supplies-head-btn supplies-fold" title={collapsed ? 'Show supplies' : 'Fold supplies'} onClick={toggle}>{collapsed ? '+' : '−'}</B>
        </E>
        {collapsed ? (
          <E c="supplies-compact">
            {RESOURCES.map((r, i) => (
              <E key={r.id} c="tab-row supplies-compact-item" title={`${r.label[0] + r.label.slice(1).toLowerCase()}: ${amounts[i]}${ledger ? '' : ` of ${d.storage?.[r.id] ?? '?'}`} · ${signed((d.rates?.[r.id] ?? 0) * HOUR)} per hour`}>
                <Icon name={r.icon} c="supplies-compact-icon" />
                <L c={cls('supplies-compact-amount', !ledger && amounts[i] > (d.storage?.[r.id] ?? Infinity) && 'amber')}>{String(amounts[i])}</L>
              </E>
            ))}
            {ledger?.outputBlocked && <L c="tab-pill amber supplies-compact-warn" title={OUTPUT_BLOCKED}>FULL</L>}
            {warnings.length > 0 && <L c="tab-pill amber supplies-compact-warn" title={warnings.join('\n')}>{`⚠ ${warnings.length}`}</L>}
          </E>
        ) : (
          <>
            {ledger && <StorageRow ledger={ledger} onClick={() => hud.showStockpile()} />}
            {RESOURCES.map((r, i) => {
              if (ledger) return <LedgerRow key={r.id} r={r} ledger={ledger} perHour={(d.rates?.[r.id] ?? 0) * HOUR} pop={pops[r.id]} onClick={() => hud.showStockpile()} />;
              const n = amounts[i], cap = Math.max(1, d.storage?.[r.id] ?? 1), perHour = (d.rates?.[r.id] ?? 0) * HOUR;
              const o = outlook(n, cap, perHour), pop = pops[r.id];
              const tone = n > cap ? 'amber' : n < cap * 0.15 ? 'red' : 'lime';
              const tip = `${r.label[0] + r.label.slice(1).toLowerCase()} — ${r.about}\n\nStock ${n} of ${cap} storage\nNet ${signed(perHour)} per game hour\n${o.hint}\n\nClick to open the stockpile.`;
              return (
                <E key={r.id} c="supplies-row" title={tip} onClick={() => hud.showStockpile()}>
                  <Icon name={r.icon} c="supplies-icon" />
                  <E c="tab-col grow">
                    <E c="tab-row supplies-line">
                      <L c="tab-caption">{r.label}</L>
                      <L c={cls('supplies-amount', n > cap && 'amber')}>{String(n)}<span className="tab-dim">{` / ${cap}`}</span></L>
                      {pop && <L key={pop.key} c={cls('supplies-pop', pop.delta < 0 && 'down')}>{(pop.delta > 0 ? '+' : '−') + Math.abs(pop.delta)}</L>}
                      <E c="spacer" />
                      <L c={cls('tab-rate supplies-rate', perHour > 0.05 ? 'lime' : perHour < -0.05 ? 'red' : '')}>{signed(perHour) + ' / H'}</L>
                    </E>
                    <Bar value={n} count={cap} tone={tone} />
                    <L c={cls('supplies-outlook', o.tone)}>{o.text}</L>
                  </E>
                </E>
              );
            })}
            {ledger && (
              <E c="supplies-others">
                {OTHERS.map(r => (
                  <E key={r.id} c="tab-row supplies-other" title={`${r.label[0] + r.label.slice(1).toLowerCase()} — ${r.about}\n\nAvailable ${Math.floor(ledger.available[r.id] ?? 0)}${ledger.reserved[r.id] ? ` · ${ledger.reserved[r.id]} reserved` : ''}`} onClick={() => hud.showStockpile()}>
                    <Icon name={r.icon} c="supplies-compact-icon" />
                    <L c="supplies-other-label">{r.label}</L>
                    <E c="spacer" />
                    <L c="supplies-other-amount">{String(Math.floor(ledger.available[r.id] ?? 0))}</L>
                  </E>
                ))}
              </E>
            )}
            <E c="supplies-stats">
              <B c={cls('supplies-stat', unhoused > 0 && 'warn')} title={`Beds — ${housed} of ${f.capacity} taken by ${survivors} survivor${survivors === 1 ? '' : 's'}.${unhoused ? ` ${unhoused} without a bed; build a bunkhouse.` : d.freeBeds > 0 ? ` ${d.freeBeds} free for recruits.` : ' No room for recruits; build more housing.'}\n\nClick to open the crew.`} onClick={() => hud.showCrew()}>
                <Icon name="icon_survivor" c="supplies-stat-icon" />
                <L c="supplies-stat-value">{`${housed}/${f.capacity}`}</L>
                <L c="supplies-stat-label">BEDS</L>
              </B>
              <B c="supplies-stat" title={`Weapons — ${weapons} in the stockpile, ready to hand out to guards.${(d.weapons || []).filter(w => w.count).map(w => `\n${w.name}: ${w.count}`).join('')}\n\nClick to open the workshop.`} onClick={() => hud.showStockpile()}>
                <Icon name="icon_damage" c="supplies-stat-icon" />
                <L c="supplies-stat-value">{String(weapons)}</L>
                <L c="supplies-stat-label">ARMS</L>
              </B>
              <B c={cls('supplies-stat', warnings.length > 0 && 'warn')} title={warnings.length ? `Warnings — needs your attention:\n${warnings.map(w => '• ' + w).join('\n')}\n\nClick to open the journal.` : 'Warnings — nothing needs your attention.\n\nClick to open the journal.'} onClick={() => hud.showJournal()}>
                <Icon name="icon_alarm" c="supplies-stat-icon" />
                <L c="supplies-stat-value">{String(warnings.length)}</L>
                <L c="supplies-stat-label">ALERTS</L>
              </B>
            </E>
            {warnings.length > 0 && (
              <E c="supplies-warnings">
                {warnings.slice(0, 3).map(w => <L key={w} c="supplies-warning" title={w}>{'⚠ ' + w}</L>)}
                {warnings.length > 3 && <L c="supplies-warning more">{`+${warnings.length - 3} more in the journal`}</L>}
              </E>
            )}
          </>
        )}
      </E>
    </div>
  );
}

const OUTPUT_BLOCKED = 'Output is ready but storage is full. Use stock or add operational storage.';

// A campaign's shared storage: everything's weight against the capacity of working storage.
function StorageRow({ ledger, onClick }) {
  const cap = ledger.capacity ?? 0, weight = Math.round(ledger.weight), over = ledger.overflow > 0;
  const tip = `Storage — stock weighs ${weight} against ${cap} capacity.${over ? `\n\n${Math.ceil(ledger.overflow)} over: ${OUTPUT_BLOCKED}` : ''}\nAmmo weighs a quarter; spare equipment 2 each.\n\nClick to open the stockpile.`;
  return (
    <E c="supplies-row" title={tip} onClick={onClick}>
      <Icon name="icon_capacity" c="supplies-icon" />
      <E c="tab-col grow">
        <E c="tab-row supplies-line">
          <L c="tab-caption">STORAGE</L>
          <L c={cls('supplies-amount', over && 'amber')}>{String(weight)}<span className="tab-dim">{` / ${cap}`}</span></L>
        </E>
        <Bar value={Math.min(weight, cap)} count={Math.max(1, cap)} tone={over ? 'amber' : weight > cap * .85 ? 'amber' : 'lime'} />
        {over && <L c="supplies-outlook amber">{`OVERFLOW ${Math.ceil(ledger.overflow)} · OUTPUT STOPPED`}</L>}
      </E>
    </E>
  );
}

function LedgerRow({ r, ledger, perHour, pop, onClick }) {
  const n = Math.floor(ledger.available[r.id] ?? 0), held = ledger.reserved[r.id] || 0;
  const days = perHour < -0.01 ? n / -perHour / 24 : null;
  const tip = `${r.label[0] + r.label.slice(1).toLowerCase()} — ${r.about}\n\nAvailable ${n}${held ? ` (${held} more reserved for work in progress)` : ''}\nNet ${signed(perHour)} per game hour${days != null ? `\nLasts about ${days.toFixed(1)} days at this rate` : ''}\n\nClick to open the stockpile.`;
  return (
    <E c="supplies-row" title={tip} onClick={onClick}>
      <Icon name={r.icon} c="supplies-icon" />
      <E c="tab-col grow">
        <E c="tab-row supplies-line">
          <L c="tab-caption">{r.label}</L>
          <L c="supplies-amount">{String(n)}{held > 0 && <span className="tab-dim">{` +${held} reserved`}</span>}</L>
          {pop && <L key={pop.key} c={cls('supplies-pop', pop.delta < 0 && 'down')}>{(pop.delta > 0 ? '+' : '−') + Math.abs(pop.delta)}</L>}
          <E c="spacer" />
          <L c={cls('tab-rate supplies-rate', perHour > 0.05 ? 'lime' : perHour < -0.05 ? 'red' : '')}>{signed(perHour) + ' / H'}</L>
        </E>
        {days != null && <L c={cls('supplies-outlook', days < 1 ? 'red' : days < 3 ? 'amber' : '')}>{`LASTS ${days >= 10 ? Math.round(days) : days.toFixed(1)} DAYS`}</L>}
      </E>
    </E>
  );
}
