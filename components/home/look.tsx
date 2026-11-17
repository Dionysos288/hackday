'use client';
import { createContext, useContext, type ReactNode } from 'react';

/* The home's look, from saved/lab-home.config.json: what the wire shows, how the hover preview behaves, the strip's
   zoom, whether the facts name the prizes, and the round the join line is drawn for ('final': the final is drawn below,
   so the join line leaves the prize to it). */
export type WireMode = 'off' | 'sentence' | 'list';
export type HoverMode = 'off' | 'strip' | 'pointer' | 'docked';
export type Zoom = 'day' | 'fitted' | 'folded';
export type Round = 'first' | 'final';
export type Look = { wire: WireMode; hover: HoverMode; zoom: Zoom; round: Round; factPrizes: boolean };

const LookContext = createContext<Look | null>(null);
export function LookProvider({ value, children }: { value: Look; children: ReactNode }) { return <LookContext.Provider value={value}>{children}</LookContext.Provider>; }
export function useLook(): Look { const v = useContext(LookContext); if (!v) throw new Error('useLook outside LookProvider'); return v; }
