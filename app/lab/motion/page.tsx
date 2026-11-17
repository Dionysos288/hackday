import type { Metadata } from 'next';
import saved from '@/saved/motion.config.json';
import savedLook from '@/saved/lab-home.config.json';
import { homeConfig } from '@/components/home/home-page';
import { clampMotion } from '@/lib/motion';
import { MotionLab } from '@/components/lab/motion-lab';

export const metadata: Metadata = { title: 'Motion lab', description: 'Tuning page for every motion on the home and the city page.', robots: { index: false } };

/* the home as the real page draws it (the saved day and look), with the lab holding the clock */
export default function Page() {
  return <MotionLab saved={clampMotion(saved)} cfg={homeConfig({})} look={savedLook} />;
}
