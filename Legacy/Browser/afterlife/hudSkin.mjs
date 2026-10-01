// Survival HUD Kit skin: rasterizes the procedural pixel UI (ui-kit/, imported
// unchanged from the Claude Design project) and exposes the pieces to CSS as
// custom properties. The stylesheet only uses them under html.px-ui, so the
// original HUD styling remains the fallback if the kit fails to build.
import { buildUI } from './ui-kit/pixel-ui.js';
import { draw } from './ui-kit/pixel-assets-v2.js';

// The kit is authored at 1× and meant to be shown at 2× (1080p) or 3× (1440p).
export const SCALE = 2;

const FRAMES = ['panel', 'inset', 'alert', 'select', 'btn', 'hover', 'down', 'off', 'primary', 'primaryDown', 'owned', 'research', 'maxed'];

let atlas = null;
const urls = {};

export function spriteURL(sprite, z = SCALE) {
  const src = document.createElement('canvas'); draw(src, sprite);
  const out = document.createElement('canvas'); out.width = sprite.w * z; out.height = sprite.h * z;
  const ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.drawImage(src, 0, 0, out.width, out.height);
  return out.toDataURL();
}

// Data URL for a named kit sprite (e.g. 'icon_alarm'), or '' before the kit loads.
export const kitURL = name => urls[name] || (atlas && atlas[name] ? (urls[name] = spriteURL(atlas[name])) : '');

export async function applyHudSkin(root = document.documentElement) {
  atlas = await buildUI();
  const vars = [];
  for (const k of FRAMES) vars.push('--px-frame-' + k + ':url(' + kitURL('frame_' + k) + ')');
  // Every icon, mini icon, badge and cursor, e.g. --px-icon-alarm, --px-mini-wood, --px-badge-check, --px-cursor-build.
  for (const k of Object.keys(atlas)) if (/^(icon|mini|badge|cursor)_/.test(k)) vars.push('--px-' + k.replace('_', '-') + ':url(' + kitURL(k) + ')');
  vars.push('--px-bar-track:url(' + kitURL('bar_empty') + ')');
  const style = document.createElement('style'); style.id = 'px-ui-vars';
  style.textContent = ':root{' + vars.join(';') + '}';
  document.head.appendChild(style);
  root.classList.add('px-ui');
  return atlas;
}
