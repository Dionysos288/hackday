/* The bug: the small mark a broadcast keeps in a corner. On a project sheet it holds the city code, the place, the votes
   and the time left, as four shared cells. It sits in the corner the config says, at the config's size, and takes no
   pointer events, so it never covers a control. */
import type { Corner } from './config';

export function Bug({ code, place, votes, left, corner, className }: { code: string; place: string; votes: string; left: string; corner: Corner; className?: string }) {
  return (
    <div className={'bg' + (className ? ' ' + className : '')} data-corner={corner} role="img" aria-label={`${code}, ${place}, ${votes} votes, ${left}`}>
      <span className="bg-code">{code}</span><span>{place}</span><span>{votes}</span><span>{left}</span>
    </div>
  );
}
