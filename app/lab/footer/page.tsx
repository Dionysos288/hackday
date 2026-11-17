import type { Metadata } from 'next';
import saved from '@/saved/footer.config.json';
import home from '@/saved/day-home.config.json';
import city from '@/saved/day-city.config.json';
import parts from '@/saved/parts.config.json';
import { clampFoot, type FootCfg } from '@/components/day/footer-config';
import type { DayHomeCfg } from '@/components/day/day-home';
import type { DayCityCfg } from '@/components/day/day-city';
import type { PartsCfg } from '@/components/board/config';
import { FormsProvider } from '@/components/forms/forms-provider';
import { FooterLab } from '@/components/lab/footer-lab';

export const metadata: Metadata = { title: 'Footer lab', description: 'How every day page ends: the horizon, the index, closedown and the end board, on the day home and a city page, before, during and after the day.', robots: { index: false } };

/* ?page=home|city|sheet, ?city=<id>, ?moment=before|during|after (or any of the six), ?dir=, ?bare hides the panel,
   ?top=1 starts at the top of the page instead of at the footer */
function requestTime() { return Date.now(); }

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  return (
    <FormsProvider>
      <FooterLab saved={clampFoot(saved as Partial<FootCfg>)} home={home as Partial<DayHomeCfg>} city={city as Partial<DayCityCfg>} parts={parts as Partial<PartsCfg>} q={q} nowMs={requestTime()} />
    </FormsProvider>
  );
}
