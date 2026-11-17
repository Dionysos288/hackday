import type { WheelFact } from '@/components/wheel/wheel';
import type { WheelStatus } from '@/components/wheel/click';
import { zoneText } from '@/components/preview/facts';

/* The study's own facts, kept as they were so the baseline can be checked against it: ten cities from the first to
   start to the last, December UTC offsets, made-up counts and states, and one session time for all. */
const ROWS: [string, number, number, number, number, WheelStatus][] = [
  ['Sydney', -33.87, 151.21, 11, 180, 'open'], ['Tokyo', 35.68, 139.69, 9, 300, 'nearing'], ['Singapore', 1.35, 103.82, 8, 300, 'full'],
  ['Bengaluru', 12.97, 77.59, 5.5, 300, 'nearing'], ['Berlin', 52.52, 13.4, 1, 300, 'open'], ['Lagos', 6.52, 3.38, 1, 120, 'open'],
  ['London', 51.51, -0.13, 0, 240, 'nearing'], ['Sao Paulo', -23.55, -46.63, -3, 150, 'open'], ['New York', 40.71, -74.01, -5, 260, 'full'],
  ['San Francisco', 37.77, -122.42, -8, 280, 'nearing'],
];
export const STUDY_SESSION = '09:00–11:30';
export const STUDY_DATE = '10th December, 2026';

export const STUDY_CITIES: WheelFact[] = ROWS.map(([name, lat, lon, offset, people, status]) => ({
  id: name.toLowerCase().replace(' ', '-'), name, lat, lon, status,
  session: `${STUDY_SESSION} ${zoneText(offset)}`, count: `${people} people`,
  href: `#${name.toLowerCase().replace(' ', '-')}`,
  action: status === 'full' ? `Join the waiting list in ${name}` : `Join in ${name}`,
}));
