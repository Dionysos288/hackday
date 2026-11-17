/* places.ts: where each city is on the globe, in degrees (latitude, longitude). The globe needs it; the model does not.
   Pure. */
export const PLACE: Record<string, [number, number]> = {
  sydney: [-33.87, 151.21], tokyo: [35.68, 139.69], singapore: [1.35, 103.82], bengaluru: [12.97, 77.59], berlin: [52.52, 13.4],
  lagos: [6.52, 3.38], london: [51.51, -0.13], 'sao-paulo': [-23.55, -46.63], 'new-york': [40.71, -74.01], 'san-francisco': [37.77, -122.42],
};

/* the three letters a board shows for a city */
export const CODE: Record<string, string> = {
  sydney: 'SYD', tokyo: 'TYO', singapore: 'SIN', bengaluru: 'BLR', berlin: 'BER',
  lagos: 'LOS', london: 'LON', 'sao-paulo': 'SAO', 'new-york': 'NYC', 'san-francisco': 'SFO',
};

/* page numbers: home 100, the cities 101 to 110 east to west, the final 200, prizes 300, questions 400 */
export const PAGE = { home: 100, final: 200, prizes: 300, questions: 400 } as const;
export function cityPage(i: number): number { return 101 + i; }
