'use client';
import { useCallback, useEffect, useState } from 'react';
import { WHEEL_BOUNDS, WHEEL_CHOICES, clampWheel, type WheelCfg } from '@/components/wheel/config';
import { WHEEL_LABELS } from '@/components/wheel/knobs';
import type { Group } from '@/components/admin/kit';
import { LabPanel, togglePanel, useLabSave } from '@/components/admin/kit';
import type { Here, OurWheel } from '../facts';
import { FOLD_BOUNDS, FOLD_CHOICES, FOLD_INT, clampFold, type FoldCfg } from './config';
import { FOLD_GROUPS, FOLD_LABELS } from './knobs';
import { FoldPage } from './fold';

/* /preview: the wheel, then the day under the fold, as saved in saved/fold.config.json (tuned at /lab/fold). Always
   the line direction: base and plain live in the lab, and so does unroll. ?city= opens on a city (0 to 9), ?gl=0
   draws without WebGL, ?admin shows the page's knobs, and Save writes the file on the dev server. The panel also holds
   the wheel's mark and globe (the BUILD mark or the Builder Day pixel globe; the glass ball, the text globe or none),
   saved on their own to saved/wheel.config.json. */
/* the panel's keys for the wheel's knobs, prefixed so they never meet the page's own (the page has a "globe" too) */
const W_KEYS: Record<string, keyof WheelCfg> = { wMark: 'mark', wGlobe: 'globe', wFps: 'globeFps', wEdge: 'globeEdge', wShift: 'globeShift', wBare: 'bareShift' };
const W_GROUP: Group = { name: 'Mark and globe', knobs: [{ k: 'wMark', kind: 'select', label: 'Mark' }, { k: 'wGlobe', kind: 'select', label: 'Globe' },
  { k: 'wFps', kind: 'range', label: 'Text frames / s' }, { k: 'wEdge', kind: 'range', label: 'Text globe smear' }, { k: 'wShift', kind: 'range', label: 'Text globe left' }, { k: 'wBare', kind: 'range', label: 'No globe: hub right' }] };
const W_BOUNDS = Object.fromEntries(Object.entries(W_KEYS).filter(([, w]) => WHEEL_BOUNDS[w]).map(([k, w]) => [k, WHEEL_BOUNDS[w]]));
export function FoldPreview({ saved, wheel, ours, here, q, nowMs }: { saved: Partial<FoldCfg>; wheel: WheelCfg; ours: OurWheel; here: Here | null; q: Record<string, string | undefined>; nowMs: number }) {
  const admin = q.admin !== undefined;
  const [cfg, setCfg] = useState<FoldCfg>(() => ({ ...clampFold(saved), dir: 'line' }));
  const set = useCallback((k: string, v: unknown) => setCfg((c) => ({ ...clampFold({ ...c, [k]: v }), dir: 'line' })), []);
  const { save, msg, rail } = useLabSave('fold', 'lab-fold-saved');
  const doSave = useCallback(() => save({ ...cfg }), [cfg, save]);
  const [w, setW] = useState<WheelCfg>(wheel);
  const wheelSave = useLabSave('wheel', 'lab-wheel-saved');
  const doSaveWheel = useCallback(() => wheelSave.save({ ...w }), [w, wheelSave]);
  const setAny = useCallback((k: string, v: unknown) => { const wk = W_KEYS[k]; if (wk) setW((c) => clampWheel({ ...c, [wk]: v })); else set(k, v); }, [set]);
  const panelCfg = { ...cfg, ...Object.fromEntries(Object.entries(W_KEYS).map(([k, wk]) => [k, w[wk]])) };
  useEffect(() => {
    if (!admin) return;
    const on = (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (e.metaKey || e.ctrlKey || e.altKey || (t && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(t.tagName))) return; if (e.key === '\\') togglePanel(); else if (e.key === 's' || e.key === 'S') doSave(); };
    document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on);
  }, [admin, doSave]);
  const forced = q.city !== undefined && q.city !== '' ? Math.max(0, Math.min(ours.cities.length - 1, Math.round(Number(q.city)) || 0)) : null;
  const out = (k: string) => { const v = (panelCfg as Record<string, unknown>)[k]; return typeof v === 'number' ? (FOLD_INT.has(k) || k === 'wFps' ? String(v) : String(+v.toFixed(3))) : String(v); };
  return (
    <FoldPage cfg={cfg} wheel={w} ours={ours} forced={forced} here={here} noGl={q.gl === '0'} nowMs={nowMs}>
      {admin ? (
        <LabPanel tab="Admin" title="Preview: admin" cfg={panelCfg} bounds={{ ...FOLD_BOUNDS, ...W_BOUNDS }} choices={{ ...FOLD_CHOICES, dir: ['line'], wMark: WHEEL_CHOICES.mark, wGlobe: WHEEL_CHOICES.globe }} groups={[W_GROUP, ...FOLD_GROUPS]} set={setAny} moments={[]} momentIdx={-1}
          out={out} optionLabel={(k, v) => (W_KEYS[k] ? WHEEL_LABELS[v] : FOLD_LABELS[v]) || v} meter={{ text: 'The page as saved in saved/fold.config.json.', bad: false }}
          msg={wheelSave.msg || msg} rail={rail} railLabel={(s) => `${s.dir}, ${s.order}, ${s.glass}, ${s.globe}, ${s.jump}, ${s.cities}`} apply={(s) => setCfg({ ...clampFold(s), dir: 'line' })}
          buttons={[['Save', doSave, true], ['Save mark and globe', doSaveWheel, false]]} />
      ) : null}
    </FoldPage>
  );
}
