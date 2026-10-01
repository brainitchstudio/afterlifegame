// Pieces shared by the tablet's screens (Tablet.jsx) and the screens it hosts, such as the Crew
// screen (CrewScreen.jsx): kit-style headings, progress bars, objectives, structure thumbnails and
// the survivors waiting at the gate.
import { useEffect, useRef } from 'react';
import { B, E, L, Icon, cls, bg, portrait, buildingSpriteUrl } from './ui.jsx';
import { CAMP_ART } from '../engine/camp.mjs';

export function Heading({ children, right }) {
  return <E c="tab-heading"><L c="tab-heading-text">{children}</L><E c="spacer" />{right != null && <L c="tab-heading-right">{right}</L>}</E>;
}

// A progress bar from the Supplies card's parts: a dark well and a tiled lime, amber or red fill.
export function Bar({ value, count, tone }) {
  const f = count > 0 ? Math.min(1, value / count) : 0;
  return <div className="tab-bar"><div className={cls('tab-bar-fill', tone || (f >= 1 ? 'lime' : 'amber'))} style={{ width: f * 100 + '%' }} /></div>;
}

export function Objective({ o }) {
  return (
    <E c={cls('tab-objective', o.done && 'done')}>
      <E c="tab-row">
        <Icon name={o.done ? 'badge_check' : 'badge_up'} c="tab-badge" />
        <L c="tab-objective-text">{o.text}</L>
        <E c="spacer" />
        <L c="tab-count">{`${Math.floor(o.value)} / ${o.count}`}</L>
      </E>
      <Bar value={o.value} count={o.count} />
    </E>
  );
}

// A structure's picture: the building art, or for the camp's fixtures the world's own sprite (the
// atlas decor, or the supply cache the host draws), scaled up whole pixels to fit the thumbnail.
const FIXTURE_ART = { campfire: 'camp/fire', tent: 'camp/tent', cache: 'camp/cache' };
export function Thumb({ game, type }) {
  const ref = useRef(null), key = FIXTURE_ART[type];
  useEffect(() => {
    const canvas = ref.current, world = game.world, art = key && CAMP_ART[key];
    if (!canvas || !art) return;
    const own = world.campCanvases?.[art], e = !own && world.entries?.get(art);
    const src = own || world.atlasImage, [sx, sy, sw, sh] = own ? [0, 0, own.width, own.height] : e ? [e.x, e.y, e.w, e.h] : [];
    if (!src || !sw) return;
    const k = Math.max(1, Math.floor(Math.min(canvas.width / sw, canvas.height / sh))), ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(src, sx, sy, sw, sh, Math.round((canvas.width - sw * k) / 2), Math.round((canvas.height - sh * k) / 2), sw * k, sh * k);
  }, [game, key]);
  if (key) return <canvas ref={ref} width={80} height={64} className="tab-thumb" />;
  return <div className="ui-sprite tab-thumb" style={bg(buildingSpriteUrl(type))} />;
}

const SHORTAGE = {
  beds: 'Every bed is taken. Build a bunkhouse, or add bunks to one, before anyone else can stay.',
  food: 'Food is short. Build more farms and post farmers before taking in more mouths.',
};

export function Gate({ game }) {
  const t = game.simulation.readTablet();
  return (
    <>
      <Heading right={`${t.freeBeds} FREE BED${t.freeBeds === 1 ? '' : 'S'} · ${t.beds} TOTAL`}>AT THE GATE</Heading>
      {t.shortage && t.candidates.length > 0 && (
        <E c="tab-card tab-warnings"><E c="tab-row"><Icon name="icon_warning" c="tab-badge" /><L c="tab-body">{SHORTAGE[t.shortage]}</L></E></E>
      )}
      {t.candidates.length === 0 && <L c="tab-empty">{t.arrivalsPerDay > 0 ? `Nobody is waiting. Word of the base brings about ${t.arrivalsPerDay} a day in daylight.` : 'Nobody knows the camp is here yet. Finish your early orders and word will spread.'}</L>}
      {t.candidates.map(c => (
        <E key={c.id} c="tab-card tab-row tab-candidate">
          {portrait(c.id) && <div className="ui-sprite tab-portrait" style={bg(portrait(c.id))} />}
          <E c="tab-col grow">
            <L c="tab-name">{`${c.name} · ${c.label} · LV ${c.level}`}</L>
            <L c="tab-sub">{c.stats}</L>
            <L c="tab-sub">{`Waits ${c.expires.toFixed(1)} more hours`}</L>
          </E>
          <B c="tablet-btn primary" enabled={t.freeBeds > 0} onClick={() => game.command('acceptCandidate', c.id)}>Welcome</B>
          <B c="tablet-btn" onClick={() => game.command('declineCandidate', c.id)}>Turn away</B>
        </E>
      ))}
      <E c="tab-card tab-row">
        <Icon name="icon_message" c="tab-icon" />
        <E c="tab-col grow">
          <L c="tab-name">Radio broadcast</L>
          <L c="tab-sub">{t.broadcasting ? `On the air · someone may answer within ${(t.recruitTimer / 42).toFixed(1)}h` : `Call for survivors whenever you can spare ${t.recruitCost}.`}</L>
        </E>
        <B c="tablet-btn primary" enabled={t.recruitEnabled} onClick={() => game.command('recruit')}>{t.broadcasting ? 'Broadcasting' : 'Broadcast · ' + t.recruitCost}</B>
      </E>
    </>
  );
}

