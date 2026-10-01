// The Overseer recruitment offer (Appendix A), shown before deployment. [ I AGREE ] unlocks only once the
// letter has been scrolled to its end, by wheel, drag, keyboard (End, Page Down, arrows) or the "Go to final
// acknowledgment" control. The letter is a labelled document of headed sections for screen readers.
import { useEffect, useRef } from 'react';
import { B, E, L, cls } from './ui.jsx';
import { CAMPAIGN, fill } from '../engine/campaignState.mjs';

const text = (id, vars) => fill(CAMPAIGN.strings[id] ?? id, vars);

// Copy with blank lines between paragraphs and "- " lines as bullet lists.
export function Passage({ text: body }) {
  const blocks = String(body).split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.split('\n'), items = lines.filter(l => l.trim().startsWith('- ')), prose = lines.filter(l => !l.trim().startsWith('- '));
    return (
      <div key={i} className="letter-block">
        {prose.length > 0 && <p className="letter-p">{prose.map((l, j) => <span key={j} className="letter-line">{l}</span>)}</p>}
        {items.length > 0 && <ul className="letter-list">{items.map((l, j) => <li key={j}>{l.trim().slice(2)}</li>)}</ul>}
      </div>
    );
  });
}

export function LegalAgreement({ game, style, panel }) {
  const hud = game.hud, scroller = useRef(null), finalRef = useRef(null);
  const sections = CAMPAIGN.letter, last = sections.length - 1;
  const check = () => {
    const el = scroller.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 6) hud.markLetterRead();
  };
  // Focus the letter so the keyboard scrolls it straight away; a letter that fits needs no scrolling.
  // Every opening starts at the top of the letter.
  useEffect(() => { const el = scroller.current; if (el) { el.scrollTop = 0; el.focus(); } check(); }, []);
  // Scroll events don't fire when a gesture can't move the letter any further, so input re-checks too.
  const recheck = () => requestAnimationFrame(check);
  const toEnd = () => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    finalRef.current?.focus({ preventScroll: true });
    check();
  };
  // The game's input layer blocks the browser's own scrolling keys, so the letter scrolls itself.
  const onKey = e => {
    const el = scroller.current, page = el ? el.clientHeight * 0.9 : 0;
    const by = { ArrowDown: 40, ArrowUp: -40, PageDown: page, PageUp: -page, ' ': e.shiftKey ? -page : page }[e.key];
    if (e.key === 'End') { e.preventDefault(); toEnd(); }
    else if (e.key === 'Home' && el) { e.preventDefault(); el.scrollTop = 0; }
    else if (by && el) { e.preventDefault(); el.scrollTop += by; check(); }
    else if (e.key === 'Enter' && hud.letterRead) { e.preventDefault(); hud.advanceNewGameSetup(); }
  };
  const vars = { overseerName: hud.overseerName.trim() || 'Overseer' };
  return (
    <E c="new-game-overlay" style={style}>
      <E c="new-game-panel letter-panel" style={panel}>
        <section className="letter" role="document" aria-labelledby="letter-title" aria-describedby="letter-hint">
          <L c="new-game-eyebrow">CENTROCOM SECURE CORRESPONDENCE</L>
          <h2 id="letter-title" className="new-game-heading">OVERSEER RECRUITMENT OFFER</h2>
          <div className="letter-scroll ui-scroll" ref={scroller} tabIndex={0} onScroll={check} onKeyDown={onKey} onWheel={recheck} onPointerUp={recheck} onTouchEnd={recheck}
            aria-label="Recruitment offer. Scroll to the end to enable I agree.">
            <pre className="letter-header">{text('letter_header')}</pre>
            {sections.map((s, i) => (
              <article key={s.id} className={cls('letter-section', i === last && 'final')} ref={i === last ? finalRef : null} tabIndex={i === last ? -1 : undefined}
                aria-labelledby={s.id + '-title'}>
                <h3 id={s.id + '-title'} className="letter-title">{s.title}</h3>
                <Passage text={fill(s.text, vars)} />
              </article>
            ))}
            <p className="letter-statement">{text('letter_acceptance')}</p>
          </div>
          <E c="letter-foot">
            <L c={cls('letter-hint', hud.letterRead && 'read')} id="letter-hint" aria-live="polite">
              {hud.letterRead ? 'Final acknowledgment reached. You may accept the offer.' : text('letter_scroll_hint')}
            </L>
            <B c="new-game-seed-btn" onClick={toEnd} title="Jump to the final acknowledgment [ End ]">{text('letter_go_to_end').toUpperCase()}</B>
          </E>
        </section>
        <E c="new-game-footer">
          <B c="new-game-secondary" onClick={() => hud.backFromNewGameSetup()}>BACK</B>
          <B c="new-game-primary" enabled={hud.letterRead} title={hud.letterRead ? 'Accept the offer' : 'Read to the end of the offer first'} onClick={() => hud.advanceNewGameSetup()}>[ I AGREE ]</B>
        </E>
      </E>
    </E>
  );
}
