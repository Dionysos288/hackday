'use client';
import { EVENT } from '@/lib/day-data';
import { NB, hhmm, plural } from '@/lib/format';
import { Picture } from '@/components/pictures/picture';
import { MergedSeal } from '@/components/seal/seal-config';
import { useDay } from './day-context';

/* The pick: Ant and Copple's one of the ten, once it is made; until then, how many winners are in. */
export function Pick() {
  const { cfg: c, W } = useDay(), pc = W.pick, p = pc.win.p;
  return (
    <section className={'pk' + (W.picked ? ' is-picked' : '')} id="pick" aria-labelledby="pk-h">
      <i className="pk-line" aria-hidden="true" />
      <div className="pk-pic">{W.picked ? <Picture p={p} /> : <i className="pic pic-empty" />}</div>
      <div className="pk-tx">
        <h2 className="lbl" id="pk-h">The pick</h2>
        {W.picked ? (
          <>
            <p className="pk-name">{p.name}</p>
            <p className="pk-who">{pc.name + '’s winner, @' + p.handle + '. ' + plural(pc.win.v, 'vote') + ' of ' + pc.entries + NB + 'entries.'}</p>
            <p className="pk-pitch">{p.pitch}</p>
          </>
        ) : (
          <>
            <p className="pk-name pk-wait">{W.allDone ? 'Ten winners. One pick.' : W.done.length + ' of 10 winners in'}</p>
            <p className="pk-who">{EVENT.pickers + ' pick one of the ten city winners at ' + hhmm(W.S.pickAt) + ' UTC.'}</p>
            <p className="pk-pitch">The pick is announced here.</p>
          </>
        )}
      </div>
      <div className="pk-seal" aria-hidden="true">{W.picked && c.seal ? <MergedSeal ids={W.cs.map((x) => x.id)} size={160} /> : null}</div>
    </section>
  );
}
