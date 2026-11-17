'use client';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { EDITORS, RULES, SERVER, sayIt } from '@/lib/hackday-server';
import { lumaHref } from '@/lib/luma';
import './get-ready.css';

/* Get ready: what to do before the day, and on the day how to submit from your editor. Step 0 of How it works.
   - before: register, add the server to your editor, the sentence to say on the day, the rules that are checked.
   - building: the same, with "say it now" first in weight and the browser as the other way in.
   While the server is not open (SERVER.live false) no address is shown: the command cell is dashed and says so.
   The lab passes live and url to see the open state with a marked stand-in address. */

export type ReadyState = 'before' | 'building';
const H = ({ level, id, children }: { level: 2 | 3; id: string; children: string }) => (level === 3 ? <h3 id={id} className="ex-h">{children}</h3> : <h2 id={id} className="ex-h">{children}</h2>);

/* a copy key: the line goes to the clipboard and the key says so for a moment. Where the clipboard is blocked the
   line is selected instead and the key says which keys copy it. The words are read out once, from the live region. */
export function CopyKey({ text, label, from }: { text: string; label: string; from?: RefObject<HTMLElement | null> }) {
  const [said, setSaid] = useState(''), t = useRef(0);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const copy = async () => {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch { /* clipboard blocked: select the line instead */ }
    if (!ok) {
      const el = from?.current, sel = window.getSelection();
      if (el && sel) { sel.selectAllChildren(el); }
    }
    const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
    setSaid(ok ? 'Copied' : 'Press ' + (mac ? '⌘C' : 'Ctrl+C'));
    window.clearTimeout(t.current); t.current = window.setTimeout(() => setSaid(''), 1600);
  };
  return (
    <button type="button" className="gr-copy" onClick={copy} aria-label={label}>
      <span aria-hidden="true">{said || 'Copy'}</span>
      <span className="gr-live" aria-live="polite">{said}</span>
    </button>
  );
}

/* the sentence to say, with its copy key */
function Say({ say }: { say: string }) {
  const q = useRef<HTMLQuoteElement>(null);
  return <div className="gr-cmd gr-say"><q ref={q}>{say}</q><CopyKey text={say} label="Copy the sentence" from={q} /></div>;
}

function Picker({ live, url }: { live: boolean; url: string | null }) {
  const [pick, setPick] = useState(EDITORS[0]?.id ?? 'other'), name = useId(), pre = useRef<HTMLPreElement>(null);
  const ed = EDITORS.find((e) => e.id === pick), line = live && url ? (ed ? ed.line(url, SERVER.name) : url) : '';
  /* while the server is not open there is nothing to pick: the editors are named, and the line comes later */
  if (!live || !url) return (
    <div className="gr-pick">
      <p className="gr-cmd" data-off="">The server is not open yet. The line for your editor appears here when it is.</p>
      <p className="gr-note">It works in {EDITORS.map((e) => e.name).join(', ')}, and any editor that can add a remote MCP server.</p>
    </div>
  );
  return (
    <div className="gr-pick">
      <fieldset className="gr-eds">
        <legend className="ex-k">Your editor</legend>
        {[...EDITORS.map((e) => [e.id, e.name] as const), ['other', 'Other'] as const].map(([id, nm]) => (
          <label key={id} className="gr-ed"><input type="radio" name={name} value={id} checked={pick === id} onChange={() => setPick(id)} /><span>{nm}</span></label>
        ))}
      </fieldset>
      <div className="gr-cmd" data-kind={ed?.kind}><pre ref={pre} tabIndex={ed?.kind === 'file' ? 0 : undefined} role={ed?.kind === 'file' ? 'region' : undefined} aria-label={ed?.kind === 'file' ? 'The lines for ' + ed.name : undefined}><code>{line}</code></pre><CopyKey text={line} label={ed ? 'Copy the line for ' + ed.name : 'Copy the address'} from={pre} /></div>
      <p className="gr-note">
        {ed ? <>{ed.kind === 'command' ? 'Run it in a terminal.' : <>Add it to <code>{ed.where}</code>.</>} <a href={ed.docs} target="_blank" rel="noreferrer">{ed.name}’s guide</a></> : 'Any editor that can add a remote MCP server: give it this address.'}
      </p>
    </div>
  );
}

export function GetReady({ state = 'before', city, cityId, live = SERVER.live, url = SERVER.url, compact = false, id = 'ready', level = 2, onBrowser, register = true }: {
  state?: ReadyState; city?: string; cityId?: string; live?: boolean; url?: string | null; compact?: boolean; id?: string; level?: 2 | 3; onBrowser?: () => void;
  /** the register step; off where the page already has its own register link just above */
  register?: boolean;
}) {
  const say = sayIt(city), now = state === 'building', reg = register && !now, n = (i: number) => i + (reg ? 1 : 0);
  return (
    <section className="ex gr" data-compact={compact ? '' : undefined} data-state={state} aria-labelledby={id + '-h'}>
      <div className="ex-top"><H level={level} id={id + '-h'}>{now ? 'Submit from your editor' : 'Get ready'}</H></div>
      <ol className="gr-steps">
        {reg ? (
          <li className="gr-step"><span className="gr-n" aria-hidden="true">1</span>
            <div className="gr-body"><p className="ex-t">Register for {city ?? 'your city'}</p><a className="gr-a" href={lumaHref(cityId)}>Register</a></div>
          </li>
        ) : null}
        <li className="gr-step"><span className="gr-n" aria-hidden="true">{n(1)}</span>
          <div className="gr-body"><p className="ex-t">Add the Hackday server to your editor</p><Picker live={live} url={url} /></div>
        </li>
        <li className="gr-step" data-now={now ? '' : undefined}><span className="gr-n" aria-hidden="true">{n(2)}</span>
          <div className="gr-body">
            <p className="ex-t">{now ? 'Say it now' : 'On the day, say it'}</p>
            <Say say={say} />
            <p className="gr-note">Your editor fills in the name, the pitch and the repository from the project it is in, and sends it. It answers with your project’s link; add a picture there.</p>
            {now && onBrowser ? <p className="gr-note">Or <button type="button" className="gr-link" onClick={onBrowser}>submit in the browser</button>. Both run the same checks.</p> : null}
          </div>
        </li>
        <li className="gr-step"><span className="gr-n" aria-hidden="true">{n(3)}</span>
          <div className="gr-body"><p className="ex-t">What is checked</p><ul className="gr-rules">{RULES.map((r) => <li key={r}>{r}</li>)}</ul></div>
        </li>
      </ol>
    </section>
  );
}

/* The submit sheet's first part: from your editor. The sheet's second part is today's form, under "In the browser". */
export function FromEditor({ city, live = SERVER.live, rules = true }: { city?: string; live?: boolean; rules?: boolean }) {
  const say = sayIt(city);
  return (
    <div className="ex gr gr-door">
      <p className="ex-k">From your editor</p>
      {live
        ? <><Say say={say} />
            <p className="gr-note">Say it in your editor with the Hackday server added. It checks your repository against the rules and sends your entry, then answers with your project’s link, where you add a picture.</p></>
        : <p className="gr-cmd" data-off="">The server is not open yet. Submit in the browser below.</p>}
      {rules ? <p className="gr-note">The rules, for both ways in: {RULES.join(' ')}</p> : null}
    </div>
  );
}
