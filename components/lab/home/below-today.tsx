'use client';
import { useDay } from '@/components/home/day-context';
import { HomeFooter, HowItWorks, PastHackathons, Questions } from '@/components/home/below';
import { Pick } from '@/components/home/pick';

/* Round 3's baseline: today's home below the first viewport (the pick box, how it works, the questions, past
   hackathons and the footer), under the picked Sheet. Unchanged: it still speaks of one winner per city. */
export function BelowToday() {
  const { cfg } = useDay();
  return (<><Pick /><HowItWorks c={cfg} /><Questions /><PastHackathons first={null} /><HomeFooter /></>);
}
