'use client';
import { HomeMasthead } from '@/components/home/home-masthead';
import { Timetable } from '@/components/home/timetable';

/* Baseline: today's home as it ships (the masthead band and the Timetable), so every direction is judged against it */
export function Baseline() {
  return <><HomeMasthead /><Timetable /></>;
}
