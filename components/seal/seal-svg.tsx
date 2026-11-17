import type { CSSProperties } from 'react';
import type { SealSvg } from '@/lib/seal';

/* draws a seal from lib/seal.ts as JSX. Works on the server and in the browser. */
export function SealSvgView({ seal }: { seal: SealSvg }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200" width={seal.size} height={seal.size}
      fill="none" stroke="currentColor" strokeWidth={seal.strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={seal.className} data-city={seal.city} style={seal.accent ? { color: 'var(--c-accent)' } : undefined}
      role="img" aria-label={seal.label}
    >
      {seal.paths.map((p, i) => (
        <path
          key={i} className={p.start ? 'seal-start' : undefined} d={p.d}
          vectorEffect={seal.nonScaling ? 'non-scaling-stroke' : undefined} pathLength={seal.pathLength ? 1 : undefined}
          style={p.k != null ? ({ '--k': p.k } as CSSProperties) : undefined}
        />
      ))}
    </svg>
  );
}
