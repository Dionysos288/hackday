/* The HACK mark: a globe of thin smooth lines with the word HACK over it in pixel letters. The numbers are in cells
   of the letters, and the mark is 45 by 21 cells. The globe's lines stop one cell short of the letters, so the word
   reads, and the C stays open to the right so a line through it does not make it an E. */

const SIZE = { w: 45, h: 21 }, CENTER = { x: 22.5, y: 10.5 };
const OVALS = [22, 14.5, 7], HALF_HEIGHT = 10, PARALLELS = [5, 16], LINE_WIDTH = 0.5;
/* each letter is 7 by 7 cells, with upright strokes of double width */
const LETTERS = [
  '1100011 1100011 1100011 1111111 1100011 1100011 1100011',
  '0111110 1100011 1100011 1111111 1100011 1100011 1100011',
  '0111111 1100000 1100000 1100000 1100000 1100000 0111111',
  '1100011 1100110 1101100 1111000 1101100 1100110 1100011',
].map((l) => l.split(' '));
const WORD = { x: 6, y: 7, gap: 1 }, OPEN_LETTER = 2;

const word: string[] = [];
LETTERS.forEach((letter, index) => letter.forEach((bits, row) => {
  /* the top three rows sit one cell to the right, so the word leans */
  const left = WORD.x + index * (bits.length + WORD.gap) + (row < 3 ? 1 : 0);
  for (let col = 0; col < bits.length; col++) {
    if (bits[col] !== '1') continue;
    const from = col;
    while (bits[col + 1] === '1') col++;
    word.push(`M${left + from} ${WORD.y + row}h${col - from + 1}v1h${from - col - 1}z`);
  }
}));
const WORD_D = word.join('');
const reachAt = (y: number) => OVALS[0] * Math.sqrt(1 - ((y - CENTER.y) / HALF_HEIGHT) ** 2);
const ACROSS = [CENTER.y, ...PARALLELS].map((y) => ({ y, r: reachAt(y) }));
const LW = LETTERS[0][0].length;
const OPEN_BOX = { x: WORD.x + OPEN_LETTER * (LW + WORD.gap), y: WORD.y, w: LW + 1, h: LETTERS[0].length };

export function HackMark({ id = 'wh-mark', label = 'HackDay', className }: { id?: string; label?: string; className?: string }) {
  const mask = id + '-gap';
  return (
    <svg className={className} viewBox={`0 0 ${SIZE.w} ${SIZE.h}`} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <mask id={mask}>
        <rect width={SIZE.w} height={SIZE.h} fill="#fff" />
        <g fill="#000" stroke="#000" strokeWidth={2}>
          <path d={WORD_D} />
          <rect x={OPEN_BOX.x} y={OPEN_BOX.y} width={OPEN_BOX.w} height={OPEN_BOX.h} />
        </g>
      </mask>
      <g className="wh-mark-lines" mask={`url(#${mask})`} strokeWidth={LINE_WIDTH}>
        {OVALS.map((rx) => <ellipse key={rx} cx={CENTER.x} cy={CENTER.y} rx={rx} ry={HALF_HEIGHT} />)}
        <line x1={CENTER.x} y1={CENTER.y - HALF_HEIGHT} x2={CENTER.x} y2={CENTER.y + HALF_HEIGHT} />
        {ACROSS.map((a) => <line key={a.y} x1={CENTER.x - a.r} y1={a.y} x2={CENTER.x + a.r} y2={a.y} />)}
      </g>
      <path className="wh-mark-word" d={WORD_D} />
    </svg>
  );
}
