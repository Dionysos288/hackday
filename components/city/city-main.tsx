'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useCity } from './city-context';

/* <main>, with the look's custom properties and the page's phase. The closing flourish is a class the clock sets
   here while it runs; React never writes the class list after the first render. */
export function CityMain({ children }: { children: ReactNode }) {
  const { W, cfg: c, mainRef, who } = useCity();
  const style = { '--row': c.row, '--nsz': c.nameSize, '--disp': c.disp, '--shot': c.pic, '--trw': c.trace, '--tbh': c.table, '--speed': c.speed, '--top': c.top } as CSSProperties;
  return <main ref={mainRef} className="dl-page cl relative min-h-screen overflow-x-clip" id="top" style={style} data-state={W.state} data-last={W.last ? '1' : ''} data-who={who}>{children}</main>;
}
