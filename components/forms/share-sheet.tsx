'use client';
import { useEffect, useRef, useState } from 'react';
import { cardAlt, cardSVG, cityLabel, projectURL, shareText, slugOf, type CardColours, type ShareProject } from '@/lib/forms';
import { forCity, toSvgString } from '@/lib/seal';
import { useSealCfg } from '@/components/seal/seal-config';
import { formsState } from './store';
import { FM_H, FM_P, IconOut, Sheet, token, useSheet } from './sheet';

/* Share: the project's link, a post on X, and the share card as a file */

/* the card's colours come from the --fm-card-* tokens, turned into hex so any viewer can open the file */
function hexOf(css: string): string {
  const c = document.createElement('canvas'); c.width = c.height = 1; const x = c.getContext('2d'); if (!x) return css;
  x.fillStyle = 'transparent'; x.fillStyle = css; x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data, h = (n: number) => n.toString(16).padStart(2, '0');
  return '#' + h(d[0]) + h(d[1]) + h(d[2]) + (d[3] < 255 ? h(d[3]) : '');
}
function cardColours(): CardColours {
  const cs = getComputedStyle(document.documentElement), g = (n: string) => hexOf(cs.getPropertyValue(n).trim());
  return { ground: g('--fm-card-ground'), ink: g('--fm-card-ink'), ink2: g('--fm-card-ink-2'), line: g('--fm-card-line'), green: g('--fm-card-green') };
}
function fallbackCopy(text: string): boolean {
  const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
  const host = document.querySelector('dialog[open]') || document.body; host.appendChild(t); t.select(); let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* no copy */ }
  t.remove(); return ok;
}

export function ShareSheet({ p, done }: { p: ShareProject; done: () => void }) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  return (
    <Sheet wide label="Share" focusRef={linkRef} onDone={done}>
      <ShareBody p={p} linkRef={linkRef} />
    </Sheet>
  );
}

function ShareBody({ p, linkRef }: { p: ShareProject; linkRef: React.RefObject<HTMLAnchorElement | null> }) {
  const sh = useSheet(), id = sh.id, seal = useSealCfg();
  /* the card is drawn once, as the sheet opens (it reads the page's colours) */
  const [cardURL] = useState(() => {
    let inner = '';
    if (p.city) { try { inner = toSvgString(forCity(seal, p.city, { size: 200 })).replace(/^<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, ''); } catch { /* no seal: the card still reads */ } }
    return URL.createObjectURL(new Blob([cardSVG(p, cardColours(), inner)], { type: 'image/svg+xml' }));
  });
  const [copied, setCopied] = useState<null | boolean>(null), tm = useRef(0);
  useEffect(() => () => { clearTimeout(tm.current); URL.revokeObjectURL(cardURL); }, [cardURL]);
  const url = projectURL(p);
  const x = 'https://x.com/intent/post?text=' + encodeURIComponent(shareText(p, formsState().handle)) + '&url=' + encodeURIComponent(url);
  const copy = () => {
    const after = (ok: boolean) => { setCopied(ok); clearTimeout(tm.current); tm.current = window.setTimeout(() => setCopied(null), token('--dur-flash')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => after(true), () => after(fallbackCopy(url)));
    else after(fallbackCopy(url));
  };
  const download = () => {
    const a = document.createElement('a'); a.href = cardURL; a.download = 'supabase-hackathon-' + (p.slug || slugOf(p.name)) + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
  };
  return (
    <>
      <h2 className={FM_H} id={id + '-h'} tabIndex={-1}>Share {p.name || 'this project'}</h2>
      {p.pitch ? <p className={FM_P}>{p.pitch}</p> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- a card drawn in the browser, as a blob URL */}
      <img className="mt-6 block aspect-[1200/630] h-auto w-full [box-shadow:0_0_0_var(--line-thin)_var(--c-line)]" src={cardURL} alt={cardAlt({ ...p, cityName: p.cityName || cityLabel(p.city) })} width={1200} height={630} />
      <div className="mt-4 grid grid-cols-3 gap-2 phone-window:grid-cols-[minmax(0,1fr)] [&>.fm-b]:px-3">
        <a ref={linkRef} className="fm-b g" href={x} target="_blank" rel="noopener">Share on X <IconOut /></a>
        <button className="fm-b" type="button" data-copy aria-live="polite" onClick={copy}>{copied == null ? 'Copy link' : copied ? 'Link copied' : 'Copy failed. Select the link below.'}</button>
        <button className="fm-b" type="button" data-svg onClick={download}>Download share card</button>
      </div>
      <p className="mt-3 font-mono text-xs/[1.4] font-medium text-ink-2 wrap-anywhere">{url.replace(/^https:\/\//, '')}</p>
    </>
  );
}
