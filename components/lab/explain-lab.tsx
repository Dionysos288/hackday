'use client';
import { useCallback, useEffect, useState } from 'react';
import { CITIES, EVENT } from '@/lib/day-data';
import { CODE } from '@/lib/places';
import { SCOPE_BOUNDS, SCOPE_CHOICES, SCOPE_LABELS, clampScope, type Facts, type Scene, type ScopeCfg } from '@/components/day/scope';
import { Tube } from '@/components/day/tube';
import { HowItWorks, PrizeBlock } from '@/components/day/explain';
import { LabPanel, togglePanel, useLabSave, type Group } from './lab-kit';
import '@/components/day/explain.css';
import './explain-lab.css';

/* The tube lab: the how-it-works and prize drawings as a generator. Every tube on the page is one scene of scope.ts
   at full size; click one for a new seed, pick a mode per scene, turn the knobs; Save writes saved/explain.config.json,
   which the wheel's sheet, the day home and the city page read. Under it, the sheet and a page as they will look. */

const GROUPS: Group[] = [
  { name: 'Modes', knobs: [{ k: 'layout', kind: 'select', label: 'Layout' }, { k: 'build', kind: 'select', label: 'Build' }, { k: 'vote', kind: 'select', label: 'Vote' }, { k: 'final', kind: 'select', label: 'Final' }, { k: 'cash', kind: 'select', label: '$10,000' }, { k: 'neo', kind: 'select', label: 'MacBook Neo' }] },
  { name: 'Beam', knobs: [{ k: 'glow', kind: 'range', label: 'Glow' }, { k: 'lw', kind: 'range', label: 'Line' }, { k: 'jitter', kind: 'range', label: 'Wobble' }, { k: 'trail', kind: 'range', label: 'Afterglow' }, { k: 'decay', kind: 'range', label: 'Fade' }, { k: 'scan', kind: 'range', label: 'Scan lines' }, { k: 'hover', kind: 'toggle', label: 'Pointing turns the beam up' }] },
  { name: 'Time', knobs: [{ k: 'loop', kind: 'range', label: 'Loop, s' }, { k: 'fps', kind: 'range', label: 'Frames/s' }, { k: 'hold', kind: 'range', label: 'Hold at end' }, { k: 'still', kind: 'range', label: 'Still (reduced)' }] },
  { name: 'Vote', knobs: [{ k: 'blips', kind: 'range', label: 'Radar votes' }] },
];
const SCENES: [Scene, string][] = [['build', 'Build'], ['vote', 'Vote'], ['final', 'Final'], ['cash', 'The global prize'], ['neo', 'The city prize'], ['reel', 'The reel: one tube plays the day']];
const F: Facts = { buildMin: 90, voteAfter: 30, startHour: 9, codes: CITIES.map((c) => CODE[c.id]), top: EVENT.finalists };
const DAY = { buildMin: 90, voteAfter: 30, startHour: 9 };

export function ExplainLab({ saved, bare }: { saved: ScopeCfg; bare: boolean }) {
  const [cfg, setCfg] = useState<ScopeCfg>(saved);
  const set = useCallback((k: string, v: unknown) => setCfg((c) => clampScope({ ...c, [k]: v })), []);
  const reseed = useCallback(() => setCfg((c) => clampScope({ ...c, seed: 1 + Math.floor(Math.random() * 99998) })), []);
  const { save, msg, rail } = useLabSave('explain', 'lab-explain-saved');
  const doSave = useCallback(() => save({ ...cfg }), [cfg, save]);
  useEffect(() => { if (bare) document.documentElement.classList.add('lab-closed', 'no-lab'); }, [bare]);
  const out = (k: string) => { const v = cfg[k as keyof ScopeCfg]; return k === 'loop' ? v + 's' : String(v); };
  return (
    <div className="xl">
      <header className="xl-h">
        <h1>Tubes</h1>
        <p>How it works and the prizes, drawn the way a vector monitor draws. Click a tube for a new seed. Seed {cfg.seed}.</p>
      </header>
      <ul className="xl-grid">
        {SCENES.map(([s, name]) => (
          <li key={s} data-wide={s === 'reel' ? '' : undefined}>
            <button type="button" className="xl-hit" onClick={reseed} aria-label={'New seed (' + name + ')'}><Tube scene={s} cfg={cfg} f={F} /></button>
            <p className="xl-cap">{name}{s === 'reel' ? '' : ': ' + SCOPE_LABELS[cfg[s] as string]}</p>
          </li>
        ))}
      </ul>
      <section className="xl-in" aria-label="As it will look">
        <div className="xl-sheet">
          <p className="xl-cap">In the preview home’s sheet</p>
          <HowItWorks f={DAY} compact id="xl-how" scope={cfg} />
          <PrizeBlock compact id="xl-prize" scope={cfg} />
        </div>
        <div className="xl-page">
          <p className="xl-cap">On a day page</p>
          <HowItWorks f={DAY} id="xl-how2" scope={cfg} />
          <PrizeBlock id="xl-prize2" scope={cfg} />
        </div>
      </section>
      <LabPanel title="Tube lab" cfg={cfg} bounds={SCOPE_BOUNDS} choices={SCOPE_CHOICES} groups={GROUPS} set={set} moments={[]} momentIdx={-1} out={out}
        optionLabel={(_, v) => SCOPE_LABELS[v] ?? v}
        buttons={[['Save', doSave, true], ['New seed', reseed], ['Hide panel', togglePanel]]}
        meter={{ text: 'Every tube runs only while it is on screen.', bad: false }} msg={msg} rail={rail}
        railLabel={(s) => s.layout + ' · ' + s.build + '/' + s.vote + '/' + s.final + ' · ' + s.seed} apply={(s) => setCfg(clampScope(s as Partial<ScopeCfg>))} />
    </div>
  );
}
