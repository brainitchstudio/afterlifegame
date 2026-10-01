// React equivalents of GameHud's Element / Label / Button / Icon / Card helpers. Class names are the
// Unity ones, styled by afterlife.css (converted from Afterlife.uss).
import sprites from './uiSprites.json';
import { audio } from '../host/audio.js';

const ui = new Set(sprites.UI), buildings = new Set(sprites.Buildings);
export const cls = (...names) => names.filter(Boolean).join(' ');

// GameHud.GetSprite: UI/<name>, then Buildings/<name>.
export function spriteUrl(name) {
  if (!name) return null;
  if (ui.has(name)) return `unity/UI/${name}.png`;
  if (buildings.has(name)) return `unity/Buildings/${name}.png`;
  return null;
}

const BUILDING_SPRITES = { core: 'town_hall', dorm: 'bunkhouse', tower: 'icon_tower', barricade: 'icon_barricade', gate: 'icon_gate' };
// GameHud.GetBuildingSprite: the building art, then its placement ghost, then an icon.
export function buildingSpriteUrl(type) {
  if (!type) return null;
  const mapped = BUILDING_SPRITES[type] || type;
  return spriteUrl(mapped) || spriteUrl(`ghost_${mapped}_ok`) || spriteUrl(`ghost_${type}_ok`) || spriteUrl('icon_' + mapped) || spriteUrl('icon_' + type);
}

// The kit parts host.css draws the tablet (and the HUD cards in its style) with, as absolute URLs so
// they resolve from any stylesheet.
const KIT_PARTS = ['btn_close', 'btn_close_down', 'btn_close_hover', 'frame_btn', 'frame_hover', 'frame_select', 'sup_bar_back', 'sup_fill_amber', 'sup_fill_lime', 'sup_fill_red', 'tablet_frame'];
export const kitVars = () => Object.fromEntries(KIT_PARTS.map(n => ['--kit-' + n.replaceAll('_', '-'), `url(${new URL(spriteUrl(n), document.baseURI).href})`]));

export const titleUrl = name => `unity/Title/${name}.png`;
export const bg = url => (url ? { backgroundImage: `url(${url})` } : undefined);

export function E({ c = '', children, style, onClick, title }) {
  return <div className={c} style={style} onClick={onClick} title={title}>{children}</div>;
}

export function L({ c = 'body', children, style, title }) {
  return <div className={cls('ui-label', c)} style={style} title={title}>{children}</div>;
}

// Every HUD button clicks and blurs, so Space and Enter stay game shortcuts.
export function B({ c = '', onClick, enabled = true, children, title, style, onMouseEnter }) {
  return (
    <button type="button" className={c} disabled={!enabled} title={title} style={style} onMouseEnter={onMouseEnter}
      onClick={e => {
        e.currentTarget.blur();
        audio.playClick();
        try { onClick?.(e); } catch (error) { console.error(error); }
      }}>
      {children}
    </button>
  );
}

export function Icon({ name, c = 'pixel-icon' }) {
  return <div className={cls('ui-sprite', c)} style={bg(spriteUrl(name))} />;
}

export function Card({ title, body, children }) {
  return (
    <E c="card">
      <L c="card-title">{title}</L>
      {body ? <L c="body">{body}</L> : null}
      {children}
    </E>
  );
}

export function Scroll({ c, children, scrollRef }) {
  return <div className={cls('ui-scroll', c)} ref={scrollRef}>{children}</div>;
}

// Portraits cycle through four kit faces by survivor id, as in the Unity HUD.
export const portrait = id => spriteUrl('portrait_' + (1 + (id % 4)));
