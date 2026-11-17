'use client';
import type { ReactNode } from 'react';
import { LookProvider, useLook, type Look } from '@/components/home/look';

/* The home's tuning page: the lab's own state on top of the home's look, and the fold under round 1. The Sheet's parts
   live in components/home and are re-exported here, so the other directions (Front page, Focus) draw from the same
   parts the real home uses. */
export * from '@/components/home/sheet-parts';
export type { HoverMode, Round, WireMode, Zoom } from '@/components/home/look';

export type Dir = 'baseline' | 'sheet' | 'front' | 'focus';
export type Sizes = { nm: number; rh: number; sw: number };
export type LabHome = Look & { dir: Dir; sizes: Sizes };
export function LabHomeProvider({ value, children }: { value: LabHome; children: ReactNode }) { return <LookProvider value={value}>{children}</LookProvider>; }
export const useLabHome = useLook;

/* the end of the first viewport's job: what comes below is round 3 */
export function LabFold() {
  return <p className="mx-(--m) mt-12 mb-32 py-3 type-label text-ink-3 rule-t" aria-hidden="true">Tuning page: the final, the prizes and the rest of the home come in round 3</p>;
}
