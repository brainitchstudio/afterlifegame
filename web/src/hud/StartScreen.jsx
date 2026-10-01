// GameHud's title screen: the pre-drawn Title/title_screen art with transparent hotspots over its four
// menu buttons, a keyboard caret, the two-step new game setup and the world-loading progress panel.
import { useEffect, useRef, useState } from 'react';
import { B, E, L, cls, bg, titleUrl } from './ui.jsx';
import { SIZES, WATER_OPTIONS, CUSTOM_TYPES, CUSTOM_FEATURES, CUSTOM_PRESETS, CUSTOM_GROUPS } from '../engine/worldgen.mjs';
import { CAMPAIGN, fill } from '../engine/campaignState.mjs';
import { DIFFICULTIES, MAP_SIZES, SETUP } from './hudStore.js';
import { LegalAgreement, Passage } from './LegalAgreement.jsx';

const CARET_TOPS = [263, 299, 335, 371];
const HOTSPOTS = ['start-btn-new-game', 'start-btn-load-game', 'start-btn-settings', 'start-btn-quit'];
const text = (id, vars) => fill(CAMPAIGN.strings[id] ?? id, vars);

// The 960 × 540 title art covers the screen (ApplyStartCanvasScale uses the larger ratio); the setup and
// loading panels fit inside it (the smaller ratio) so no choice is ever cropped off a narrow window.
function useCoverScale(ref) {
  const [scale, setScale] = useState({ cover: 1, fit: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 10 && height > 10) setScale({ cover: Math.max(width / 960, height / 540), fit: Math.min(width / 960, height / 540) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return scale;
}

export function StartScreen({ game }) {
  const hud = game.hud;
  const screen = useRef(null);
  const { cover, fit } = useCoverScale(screen);
  const overlay = { width: '100%', height: '100%' }, panel = { transform: `scale(${fit})` };
  const actions = [() => hud.startNewGame(), () => hud.continueGame(), () => hud.showMenu(), () => game.quit()];
  const step = hud.setupStep;

  return (
    <div className="start-screen" ref={screen}>
      <E c="start-canvas ui-sprite" style={{ ...bg(titleUrl('title_screen')), backgroundSize: 'contain', transform: `scale(${cover})` }}>
        <E c="start-caret-blank" style={{ display: hud.startMenuIndex === 0 ? 'none' : 'flex', top: CARET_TOPS[hud.startMenuIndex] }} />
        <div className="ui-sprite start-caret" style={{ ...bg(titleUrl('caret')), backgroundSize: 'contain', top: CARET_TOPS[hud.startMenuIndex] }} />
        {HOTSPOTS.map((spot, i) => (
          <B key={spot} c={cls('start-title-btn', spot)} onClick={actions[i]} onMouseEnter={() => hud.setStartMenuSelection(i)} />
        ))}
      </E>
      {step === SETUP.letter && <LegalAgreement game={game} style={overlay} panel={panel} />}
      {step === SETUP.accepted && (
        <E c="new-game-overlay" style={overlay}>
          <E c="new-game-panel accepted-panel" style={panel} role="dialog" aria-labelledby="accepted-status">
            <L c="new-game-eyebrow">AFTERLIFE INC. · EXPLORATION & RECLAMATION DIVISION</L>
            <h2 id="accepted-status" className="new-game-heading">{text('letter_after_status')}</h2>
            <E c="new-game-scroll-body letter-body">
              <Passage text={text('letter_after_message', { overseerName: hud.overseerName.trim() || 'Overseer' })} />
            </E>
            <E c="new-game-footer">
              <B c="new-game-secondary" onClick={() => hud.backFromNewGameSetup()}>BACK</B>
              <B c="new-game-primary" onClick={() => hud.advanceNewGameSetup()}>BEGIN DEPLOYMENT  →</B>
            </E>
          </E>
        </E>
      )}
      {(step === SETUP.settings || step === SETUP.region) && (
        <E c="new-game-overlay" style={overlay}>
          <E c="new-game-panel" style={panel}>
            <L c="new-game-eyebrow">NEW CAMPAIGN · AFTERLIFE INC.</L>
            <L c="new-game-heading">{step === SETUP.settings ? 'DEPLOYMENT SETTINGS' : 'REGIONAL ASSIGNMENT'}</L>
            <L c="new-game-description">
              {hud.setupDescriptionOverride || (step === SETUP.settings ? text('start_difficulty_hint') : 'Choose the size of the region CentroCom assigns you. Your seed decides everything in it.')}
            </L>

            {step === SETUP.settings ? (
              <E c="new-game-scroll-body">
                <E c="new-game-choices three-cols">
                  {DIFFICULTIES.map((id, i) => {
                    const d = CAMPAIGN.difficulties[id];
                    return (
                      <B key={id} c={cls('new-game-choice', hud.setupIndex === i && 'selected')} title={`${d.name} — ${d.description}`}
                        onClick={() => hud.setSetupSelection(i)} onDoubleClick={() => hud.chooseSetupOption(i)}>
                        <L c="new-game-map-name">{d.name.toUpperCase()}</L>
                        <L c="new-game-map-detail">{`Supplies ×${d.resourceMult} · Infected ×${d.threatMult}`}</L>
                        <L c="new-game-map-detail">{d.description}</L>
                      </B>
                    );
                  })}
                </E>
                <E c="new-game-seed-row">
                  <label className="new-game-seed-label" htmlFor="overseer-name">OVERSEER NAME</label>
                  <input id="overseer-name" className="new-game-seed-field wide" maxLength={48} placeholder="Overseer" autoComplete="off"
                    value={hud.overseerName} onChange={e => hud.setOverseerName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); hud.advanceNewGameSetup(); } else if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); } }} />
                  <L c="new-game-seed-hint">{text('start_name_hint')}</L>
                </E>
              </E>
            ) : (
              <E c="new-game-scroll-body">
                <E c="new-game-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                  <L c="new-game-section-title">REGION SIZE</L>
                  <E c="new-game-choices three-cols">
                    {MAP_SIZES.map((id, i) => {
                      const m = CAMPAIGN.tuning.world.mapSizes[id], size = SIZES[m.worldgen];
                      return (
                        <B key={id} c={cls('new-game-choice', hud.setupIndex === i && 'selected')} title={`${m.label} — ${size.w} × ${size.h} tiles`}
                          onClick={() => hud.setSetupSelection(i)} onDoubleClick={() => hud.chooseSetupOption(i)}>
                          <L c="new-game-map-name">{m.label.toUpperCase()}</L>
                          <L c="new-game-map-detail">{`${size.w} × ${size.h} tiles  ·  ${size.pois} locations`}</L>
                        </B>
                      );
                    })}
                  </E>
                </E>

                <E c="new-game-seed-row">
                  <label className="new-game-seed-label" htmlFor="region-seed">REGION SEED</label>
                  <input id="region-seed" className="new-game-seed-field wide" maxLength={64} placeholder="Random" autoComplete="off"
                    value={hud.seedText} onChange={e => hud.setSeedText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); hud.advanceNewGameSetup(); }
                      else if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); }
                    }} />
                  <B c="new-game-seed-btn" title="Pick a random seed" onClick={() => hud.randomizeSeed()}>RANDOM</B>
                  {hud.seedText && <B c="new-game-seed-btn" title="Clear to get a new random region" onClick={() => hud.setSeedText('')}>CLEAR</B>}
                  <L c="new-game-seed-hint">{hud.seedText ? text('start_seed_hint') + ' Words work too.' : 'Leave blank for a random region.'}</L>
                </E>

                <E c="new-game-section">
                  <E c="new-game-section-header">
                    <L c="new-game-section-title">WATER FEATURES</L>
                  </E>
                  <E c="new-game-chip-row">
                    {WATER_OPTIONS.map(([k, label]) => (
                      <button key={k} type="button" className={cls('new-game-chip', hud.water[k] && 'active')} onClick={() => hud.toggleWater(k)}>
                        {label}
                      </button>
                    ))}
                  </E>
                </E>

                <E c="new-game-section">
                  <E c="new-game-section-header">
                    <L c="new-game-section-title">SPAWN CUSTOMIZER</L>
                    <E c="new-game-toggle-group">
                      <button type="button" className={cls('new-game-toggle-btn', !hud.customOn && 'active')} onClick={() => hud.setCustomOn(false)}>DEFAULT</button>
                      <button type="button" className={cls('new-game-toggle-btn', hud.customOn && 'active')} onClick={() => hud.setCustomOn(true)}>CUSTOM</button>
                    </E>
                  </E>
                  {!hud.customOn ? (
                    <L c="new-game-seed-hint" style={{ marginTop: 0 }}>Standard amounts for this map size. Switch to Custom to fine-tune spawns, hordes, places and nature.</L>
                  ) : (
                    <>
                      <E c="new-game-presets-row">
                        {CUSTOM_PRESETS.map(([label, vals]) => {
                          const isPresetActive = Object.keys(vals).every(k => Math.abs((hud.custom[k] ?? 1) - vals[k]) < 1e-4);
                          return (
                            <button key={label} type="button" className={cls('new-game-preset-btn', isPresetActive && 'active')} onClick={() => hud.applyCustomPreset(vals)}>
                              {label}
                            </button>
                          );
                        })}
                      </E>
                      <E c="new-game-sliders-grid">
                        {CUSTOM_GROUPS.map(([groupName, rows]) => (
                          <E key={groupName} c="new-game-slider-card">
                            <L c="new-game-slider-card-title">{groupName}</L>
                            {rows.map(([key, label, min, max, step]) => {
                              const val = hud.custom[key] ?? 1;
                              const textVal = key === 'hordes' ? (val ? `${val}` : 'none') : val === 0 ? 'none' : '×' + Number(val).toFixed(val * 100 % 10 ? 2 : 1);
                              return (
                                <E key={key} c="new-game-slider-item">
                                  <L c="new-game-slider-name">{label}</L>
                                  <L c="new-game-slider-val">{textVal}</L>
                                  <input className="new-game-slider-input" type="range" min={min} max={max} step={step} value={val} onChange={e => hud.setCustomSlider(key, e.target.value)} />
                                </E>
                              );
                            })}
                          </E>
                        ))}
                      </E>
                      <E c="new-game-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                        <L c="new-game-slider-card-title">Place Types</L>
                        <E c="new-game-chip-row">
                          {CUSTOM_TYPES.map(([k, label]) => (
                            <button key={k} type="button" className={cls('new-game-chip', hud.custom.types?.[k] && 'active')} onClick={() => hud.toggleCustomType(k)}>
                              {label}
                            </button>
                          ))}
                        </E>
                      </E>
                      <E c="new-game-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                        <L c="new-game-slider-card-title">Structures & Landmarks</L>
                        <E c="new-game-chip-row">
                          {CUSTOM_FEATURES.map(([k, label]) => (
                            <button key={k} type="button" className={cls('new-game-chip', hud.custom[k] && 'active')} onClick={() => hud.toggleCustomFeature(k)}>
                              {label}
                            </button>
                          ))}
                        </E>
                      </E>
                      <button type="button" className="new-game-reset-btn" onClick={() => hud.resetCustom()}>RESET TO DEFAULTS</button>
                    </>
                  )}
                </E>
              </E>
            )}

            <E c="new-game-footer">
              <B c="new-game-secondary" onClick={() => hud.backFromNewGameSetup()}>BACK</B>
              <B c="new-game-primary" onClick={() => hud.advanceNewGameSetup()}>{step === SETUP.settings ? 'NEXT  →' : 'REVIEW OFFER  →'}</B>
            </E>
          </E>
        </E>
      )}
      {hud.worldLoading && (
        <E c="world-loading-overlay" style={overlay}>
          <E c="world-loading-panel" style={panel}>
            <L c="world-loading-eyebrow">AFTERLIFE INC. · CENTROCOM</L>
            <L c="world-loading-heading">REGIONAL DEPLOYMENT</L>
            <L c="world-loading-description">{`Overseer ${hud.overseerName.trim() || 'Overseer'} · ${CAMPAIGN.difficulties[hud.selectedDifficulty]?.name || ''} · seed ${hud.pendingSeed || ''}`}</L>
            <L c="world-loading-activity">{hud.worldLoading.activity}</L>
            <E c="world-loading-track"><E c="world-loading-fill" style={{ width: hud.worldLoading.progress * 100 + '%' }} /></E>
            <L c="world-loading-percent">{Math.round(hud.worldLoading.progress * 100) + '%'}</L>
          </E>
        </E>
      )}
    </div>
  );
}

