/* the W2 directions, by key and name; plain data, so the server page can read ?dir= against it */
export type Direction = 'study' | 'base' | 'wheel' | 'rail' | 'sheet' | 'sheet2';
export const DIRECTIONS: [string, string][] = [['study', 'The study'], ['base', 'Baseline'], ['wheel', 'Wheel only'], ['rail', 'Facts rail'], ['sheet', 'Details sheet'], ['sheet2', 'Details sheet, new contents']];
export const isDirection = (s: string): s is Direction => DIRECTIONS.some(([k]) => k === s);
