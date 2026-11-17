'use client';
import { createContext, useContext, type ReactNode } from 'react';
import { useCity, type Judge, type PView, type Who } from '@/components/city/city-context';

/* The city's tuning page: which direction is drawn, on top of the city page's own state (who is looking, how a
   project opens, the judge, the share kit). The Tower with the final zone and its parts live in components/city and
   are re-exported here, so Stage and Split draw from the same parts the real page uses. */
export * from '@/components/city/final-parts';
export { ProjectTrace as LabTrace } from '@/components/city/final-parts';
export type { Judge, PView, Who } from '@/components/city/city-context';

export type CityDir = 'baseline' | 'tower' | 'stage' | 'split';
export type LabCity = { dir: CityDir; view: PView; who: Who; share: boolean; judge: Judge; setShare: (on: boolean) => void };
const DirContext = createContext<CityDir>('tower');
export function LabCityProvider({ dir, children }: { dir: CityDir; children: ReactNode }) { return <DirContext.Provider value={dir}>{children}</DirContext.Provider>; }
export function useLabCity(): LabCity {
  const dir = useContext(DirContext), c = useCity();
  return { dir, view: c.pview, who: c.who, share: c.share, judge: c.judge, setShare: c.setShare };
}
