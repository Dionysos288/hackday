'use client';
import type { CSSProperties } from 'react';
import { cutText, fmtN, local, rowCls, sheetLabel, sheetList, slotText, view } from '@/lib/city';
import { Picture } from '@/components/pictures/picture';
import { useCity } from '@/components/city/city-context';
import { Tower } from '@/components/city/tower';
import { Cut, FlashTick, NameLink, Placeholder, SealMark, SheetFoot, SheetHead, Slot, Tie, Trace, VoteBtn, useRowAttrs } from '@/components/city/sheet-parts';

/* The city page's layouts that were not chosen, kept on the tuning page to compare: Race (bars by votes), Gallery
   (pictures first), Leader (a poster for first place). They share the tower's rows and model. */
export function CitySheet({ mode }: { mode: string }) {
  if (mode === 'race') return <Race />;
  if (mode === 'gallery') return <Gallery />;
  if (mode === 'leader') return <Leader />;
  return <Tower />;
}

function Race() {
  const { W, cfg: c, shownIds } = useCity(), V = view(W), list = sheetList(W, shownIds, c.top), max = W.lead ? Math.max(1, W.lead.v) : 1, attrs = useRowAttrs();
  return (
    <section className="cl-sheet cl-race" id="sheet" aria-label={sheetLabel(W, c)}>
      <SheetHead W={W} V={V} />
      <ol className="cl-rows">
        {list.map((o, j) => {
          if (!o) return <Placeholder key={'e' + j} j={j} />;
          const w = W.votesOn ? Math.round(o.v / max * 1000) / 1000 : 0;
          return (
            <li key={'p' + o.p.id} {...attrs(o, rowCls(W, o, 'rc-row'), j)}>
              <NameLink o={o} />
              <span className="cl-strip rc-track">{W.votesOn
                ? <><i className="rc-bar" style={{ '--w': w } as CSSProperties} data-g={o === W.lead ? '1' : undefined} /><span className="rc-n" style={{ '--w': w } as CSSProperties}>{fmtN(o.v)}</span></>
                : <span className="rc-arr">Arrived {local(W, o.arrive)}</span>}</span>
              <Slot o={o} c={c} /><VoteBtn o={o} /><Tie o={o} /><SealMark o={o} c={c} /><Cut c={c} j={j} />
            </li>
          );
        })}
      </ol>
      <SheetFoot c={c} />
    </section>
  );
}

function Gallery() {
  const { W, cfg: c, shownIds } = useCity(), list = sheetList(W, shownIds, c.top), attrs = useRowAttrs(), cut = W.votesOn ? cutText(W, c) : '';
  return (
    <section className="cl-sheet cl-gallery" id="sheet" aria-label={sheetLabel(W, c)}>
      <p className="gl-cut">{cut}</p>
      <ol className="gl-grid" style={{ '--n': c.top } as CSSProperties}>
        {list.map((o, j) => {
          const big = j === 0;
          if (!o) return <li key={'e' + j} className={'gl-t is-empty' + (big ? ' gl-big' : '')} data-k={'e' + j}><span className="gl-pic"><i className="pic pic-empty" /></span><span className="gl-tx"><span className="gl-k" /><span className="gl-n" /><span className="gl-v" /><span className="gl-b" /></span></li>;
          const t = slotText(W, o), lead = o === W.lead;
          return (
            <li key={'p' + o.p.id} {...attrs(o, 'gl-t' + (big ? ' gl-big' : '') + (lead ? ' is-lead' : '') + (c.you === o.k ? ' is-you' : ''), j)}>
              <span className="gl-pic"><Picture p={o.p} /></span>
              <span className="gl-tx">
                <span className={'gl-k slot-k' + (lead ? ' g' : '')}>{lead ? <i className="gsq" data-g="1" /> : null}{t.k}</span>
                <NameLink o={o} cls="gl-n" />
                <span className="gl-v">{W.votesOn ? <><b>{fmtN(o.v)}</b> {o.v === 1 ? 'vote' : 'votes'}</> : t.a}</span><span className="gl-b">{t.b}</span>
                <VoteBtn o={o} />
              </span>
              <SealMark o={o} c={c} />
            </li>
          );
        })}
      </ol>
      <SheetFoot c={c} />
    </section>
  );
}

function Leader() {
  const { W, cfg: c, shownIds } = useCity(), V = view(W), list = sheetList(W, shownIds, c.top), first = list[0], rest = list.slice(1), t = slotText(W, first), attrs = useRowAttrs(), cut = W.votesOn ? cutText(W, c) : '';
  const lead = !!first && first === W.lead;
  return (
    <section className="cl-sheet cl-leader" id="sheet" aria-label={sheetLabel(W, c)}>
      {first ? (
        <div {...attrs(first, 'ld-poster' + (lead ? ' is-lead' : ''))}>
          <span className="ld-pic"><Picture p={first.p} /></span>
          <p className={'ld-k slot-k' + (lead ? ' g' : '')}>{lead ? <i className="gsq" data-g="1" /> : null}{W.votesOn ? t.k : W.state === 'build' ? 'Newest entry' : ''}</p>
          <NameLink o={first} cls="ld-n" />
          <p className="ld-v">{W.votesOn ? <><b>{fmtN(first.v)}</b> {first.v === 1 ? 'vote' : 'votes'}</> : t.a}</p>
          <p className="ld-b">{W.votesOn ? t.b : '@' + first.p.handle}</p>
          <VoteBtn o={first} /><SealMark o={first} c={c} />
        </div>
      ) : (
        <div className="ld-poster is-empty" data-k="e0"><span className="ld-pic"><i className="pic pic-empty" /></span><p className="ld-k slot-k" /><span className="ld-n" /><p className="ld-v" /><p className="ld-b" /></div>
      )}
      <div className="ld-side">
        <p className="ld-cut">{cut}</p>
        <ol className="cl-rows">
          {rest.map((o, j) => {
            if (!o) return <Placeholder key={'e' + (j + 1)} j={j + 1} />;
            return (
              <li key={'p' + o.p.id} {...attrs(o, rowCls(W, o, 'ld-row'), j + 1)}>
                <NameLink o={o} />
                <span className="cl-strip"><Trace W={W} V={V} o={o} c={c} /><FlashTick W={W} V={V} o={o} /></span>
                <span className="ld-c">{W.votesOn ? fmtN(o.v) : local(W, o.arrive)}</span><VoteBtn o={o} />
              </li>
            );
          })}
        </ol>
      </div>
      <SheetFoot c={c} />
    </section>
  );
}
