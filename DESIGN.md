# Design

Read this before changing how anything looks, reads or moves.

## The idea

**The site is the day's sheet: one drawing at three scales.**

| Scale | Rows are | The strip spans | Page |
|---|---|---|---|
| Day | ten cities | the whole day, in UTC | `index.html` |
| City | projects | that city's session, in local time | `city.html` |
| Project | one project | the same session | the project sheet |

Time runs across. Things hang on it in rows. One green line marks now. On the home, each city's winner sits on a line, and the ten lines join into one: the pick.

The family is the row, not a colour. A row is always a name, a strip and a slot, on the same grid, with the same hairlines. A 400px square cropped from the home and one from a city page should look like the same drawing.

## Rules

### The drawing

1. Cities are in time-zone order, east to west, always. They are never sorted by score.
2. One now line, full height, green. It is the only thing that moves when the page is idle.
3. Day and night are two tones only: the ground, and one lifted tone for the daylight band. The band has a soft edge.
4. Every row has a fixed height. Text never reflows when a state changes.
5. Unchanged cells do not move.
6. One typeface, two weights. The heavier weight means live.
7. Angles are 0°, 45° or 90°. Vote traces are step lines.
8. Dashed means not yet. Hatched means closed.
9. Square corners everywhere. Only true markers are round.
10. A line breaks where it meets lettering.

### Meaning

11. Green means one thing: now, the leader or winner, you, or the main action. It stays under 5% of any viewport.
12. Only the top result is announced. A city shows its leader or its winner; the full ranking is one click away.
13. Ten become one through joining lines. Never a pile, a carousel or a blend.
14. The winner's mark is line work: the city's seal, drawn once when voting closes. The pick's seal is the ten interlaced. Nothing else is decorated.
15. Every picture is a project picture.
16. Winner and the rest share one row. The winner differs by order, one label and the seal.
17. The page always has a finished state. After the day, the pick and the results replace the countdown.

### The city page

18. Projects re-sort; cities never do. Rows glide when the order changes. Numbers never animate.
19. A row never moves under a pointer or a focused control. Reorders are batched. A change of leader is the one reorder that does not wait.
20. One winner, one cut line, under first place.
21. Two densities and no duplicates: the top ten are rows in the drawing, everyone else is a compact table that starts at 11. Your own project is always in view.
22. You vote in the row and the row answers. No toast for a vote that worked.
23. While a city is building there is no ranking: entries are in arrival order, newest first, with no counts.
24. Every vote lands where you can see it: a tick at the now line on its row.
25. The rest of the day is always in reach: a miniature of the home drawing sits in every city page's masthead.

## Colour

All colour is OKLCH and comes from `shared/palette.js` (the base five) and `shared/brand.css` (the roles derived from them). Never write a raw colour in new CSS.

| Ground | Value | Ink on ground | Green for lines and labels |
|---|---|---|---|
| Night (default) | `oklch(0.19 0.0025 157.5)` | 16.0:1 | `oklch(0.762 0.154 159.4)`, the brand green, 9.2:1 |
| Paper | `oklch(0.93 0.003 250)` | 14.7:1 | `oklch(0.46 0.105 159.4)`, 5.5:1 |
| Mint | `oklch(0.93 0.052 158)` | 15.7:1 | `oklch(0.46 0.105 159.4)`, 5.6:1 |

- Every grey on night carries hue 157.5, so the neutrals are faintly green.
- The brand green is 1.6:1 on the two light grounds, so it cannot draw a line or set a label there. Lines, labels and the button use the same hue at lightness 0.46. To repair contrast, move lightness only.
- The Supabase mark keeps the brand green on every ground (`--brand`).
- Roles: `--c-ink` text and strokes, `--c-ink-2` secondary text, `--c-ink-3` lines only, `--c-line` hairlines, `--c-day` the daylight band, `--c-accent` green.

## Type

- Geist 400, 500 and 600, and Geist Mono 500. No other weights: they would be synthesised.
- Display sizes are `--t-d48`, `--t-d72`, `--t-d96` and `--t-d128`, each with its own tracking. City names on the home and the city name on its own page are the largest things on their pages.
- Mono is only for small caps labels at `--t-label` (10px). Write the source in sentence case; CSS uppercases it.
- Figures that change use tabular numerals.

## Space and lines

- Space is on a 4px base: 4, 8, 12, 16, 24, 32, 48, 72.
- Layout is a 12-column grid. Home rows split 5, 5 and 2 columns (name, strip, slot). City rows split 4, 5 and 3.
- Lines are `--line-hair`, `--line-thin` and `--line-thick`. No shadows, no blur, no gradients except the daylight band's edge.

## Motion

Every duration and curve is a token in `shared/brand.css`. Animate transform and opacity only. Every motion has a reduced-motion version: the finished state.

| Moment | How often | Spec |
|---|---|---|
| Arrival | Once per session | The pen draws the strip, then rows land in order, inside `--dur-scene`. |
| Now line | Always | Real time, linear. |
| A state changes | A few times | The label swaps in `--dur-panel`. Nothing else in the row moves. |
| Counts | Constantly | Never animated. |
| Hover | Often | `--dur-hover`. Pointer devices only. |
| Home to city | Often | The city name and its bar are shared elements. `--dur-panel`, `--ease-move`. |
| Reorder | Every few seconds at most | Rows glide, `--dur-panel`, `--ease-move`. |
| Open a sheet | Often | `--dur-panel`, `--ease-drawer`. Closing is `--dur-panel-exit`, `--ease-exit`. |
| Keyboard | Repeated | Snap. No animation. |
| A winner lands, voting closes | Once per city | The line draws in `--dur-draw`. |
| The pick | Once, ever | Staged inside `--dur-reveal`. |

## Words

- Short declaratives with a period. Say what happened and what it means.
- Buttons name the outcome. Errors say how to fix it.
- The event is "Supabase Hackathon". Before voting a thing is an entry; once voting opens it is a project.
- Tense follows the phase. After voting closes, nothing says "to go" or "win".
- Times are 24-hour. The home strip is UTC; a city page is local, with UTC said once per block.
- Real characters: ’ “ ” … – ×. US spelling.

## Still open

- The ground: night, paper or mint.
- The ten cities and the date.
- Who can vote in a city: the room, or anyone online.
- How many entries a city has, venue names, and whether entries are solo.
- The join on the home is a thin line at the right edge. It is the signature and wants more weight.
