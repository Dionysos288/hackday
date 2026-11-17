'use client';
import { useCallback, useState } from 'react';
import { CITIES } from '@/lib/day-data';
import { CODE } from '@/lib/places';
import { NeoPrize } from '@/components/day/neo';
import { NEO_BOUNDS, NEO_MODES, clampNeo, type NeoLook } from '@/components/day/neo-config';
import { LabPanel, useLabSave, type Group } from './lab-kit';
import '@/components/day/explain.css';
import './neo-lab.css';

/* The city prize lab: one picture at real size, then the same picture at the prize column's width and a phone's.
   Click the big picture for a new seed; the knobs change it live; Save writes saved/neo.config.json, which the prize
   block reads (Prizes, with "MacBook Neo" set to drawn). "Winners known" is a preview only and is never saved. */

const GROUPS: Group[] = [
  { name: 'Mode', knobs: [{ k: 'mode', kind: 'select', label: 'How it is drawn' }] },
  { name: 'Every mode', knobs: [{ k: 'width', kind: 'range', label: 'Laptop width' }, { k: 'rim', kind: 'range', label: 'Rim light' }, { k: 'white', kind: 'range', label: 'Light, blue to white' }, { k: 'screen', kind: 'range', label: 'Screen light' }, { k: 'label', kind: 'range', label: 'Code size, px' }] },
  { name: 'Stack', knobs: [{ k: 'thick', kind: 'range', label: 'Slab thickness' }, { k: 'gap', kind: 'range', label: 'Gap between' }, { k: 'depth', kind: 'range', label: 'Top face depth' }, { k: 'persp', kind: 'range', label: 'Back edge narrows' }, { k: 'jitter', kind: 'range', label: 'Off line (seeded)' }] },
  { name: 'Ajar', knobs: [{ k: 'open', kind: 'range', label: 'Lid gap' }, { k: 'glow', kind: 'range', label: 'Glow' }, { k: 'spill', kind: 'range', label: 'Light on the ground' }] },
  { name: 'Screen and row', knobs: [{ k: 'lid', kind: 'range', label: 'Lid height' }, { k: 'cycle', kind: 'range', label: 'Seconds per city' }, { k: 'fringe', kind: 'range', label: 'Colour split' }, { k: 'streak', kind: 'range', label: 'Streak on the screen' }] },
];
const LABELS: Record<string, string> = { stack: 'Stack: ten closed, one per city', ajar: 'Ajar: light from the lid', screen: 'Screen: the ten cities in turn', row: 'Row: ten small, open' };
const codes = CITIES.map((c) => CODE[c.id]);

export function NeoLab({ saved }: { saved: NeoLook }) {
  const [cfg, setCfg] = useState<NeoLook>(saved), [won, setWon] = useState(0);
  const set = useCallback((k: string, v: unknown) => { if (k === 'won') setWon(Number(v)); else setCfg((c) => clampNeo({ ...c, [k]: v })); }, []);
  const { save, msg, rail } = useLabSave('neo', 'lab-neo-saved');
  const reseed = () => setCfg((c) => ({ ...c, seed: 1 + Math.floor(Math.random() * 99998) }));
  const out = (k: string) => { const v = Number(cfg[k as keyof NeoLook]); return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, ''); };
  const w = codes.slice(0, won);
  return (
    <>
      <main className="nl">
        <h1 className="nl-h">City prize · {LABELS[cfg.mode]}</h1>
        <p className="nl-p">Click the picture for a new seed. Knobs change it live. Save keeps it.</p>
        <div className="nl-big" onClick={reseed} title="New seed"><NeoPrize cfg={cfg} cities={codes} won={w} /></div>
        <div className="nl-sizes">
          <figure><figcaption>In its column (410px)</figcaption><div style={{ width: 410 }}><NeoPrize cfg={cfg} cities={codes} won={w} /></div></figure>
          <figure><figcaption>On a phone (358px)</figcaption><div style={{ width: 358 }}><NeoPrize cfg={cfg} cities={codes} won={w} /></div></figure>
        </div>
      </main>
      <LabPanel title="City prize lab" cfg={{ ...cfg, won }} bounds={{ ...NEO_BOUNDS, won: [0, 10, 1] }} choices={{ mode: NEO_MODES }} optionLabel={(_k, v) => LABELS[v] || v}
        groups={[...GROUPS, { name: 'Preview only (not saved)', knobs: [{ k: 'won', kind: 'range', label: 'Winners known' }] }]} set={set} moments={[]} momentIdx={-1} out={(k) => (k === 'won' ? String(won) : out(k))}
        buttons={[['Save', () => save({ ...cfg }), true], ['New seed', reseed]]} meter={{ text: 'Seed ' + cfg.seed + ' · ' + cfg.mode, bad: false }} msg={msg} rail={rail}
        railLabel={(s) => String(s.mode) + ' · ' + String(s.seed)} apply={(s) => setCfg(clampNeo(s as Partial<NeoLook>))} />
    </>
  );
}
