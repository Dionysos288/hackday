# Supabase Hackathon

The site for a hackathon that runs in ten cities on one day. Each city builds for 90 minutes and votes while it builds, with 30 more minutes of voting after building closes. The project with the most votes wins its city. Ant and Copple then pick one of the ten.

It is a Next.js app (App Router, TypeScript, Tailwind CSS 4). Data is sample data until the backend exists.

## Run it

```bash
npm install
npm run dev
```

Then open `http://localhost:4320/`.

Before a change goes in, all three must pass:

```bash
npm run lint
npm run typecheck
npm run build
```

## Pages

| Route | What it is |
|---|---|
| `/` | The home: the day. Ten cities in time-zone order on one time strip, each city's winner, and the pick. |
| `/city/berlin` | One city: its session, the top ten projects, every entry, voting. Add `?p=<slug>` to open a project. An unknown city is a 404. |
| `/lab/day` | Tuning page for the home. Four layouts and every knob. Save writes `saved/day.config.json`. |
| `/lab/city` | Tuning page for the city page. Save writes `saved/city.config.json`. |
| `/lab/seal` | The generator for the city seals. Save writes `saved/seal.config.json`. |
| `/lab/forms` | Sign-in, submit, the voting email step, remind me and share, one button each. |

The real pages read the three files in `saved/`. To change the look, tune it in a lab, press Save, and reload the page. Save writes the file (and a dated copy, which git ignores) only on the development server, through `/api/save`. On a deployed site it copies the config to the clipboard instead.

The labs are not linked from the real pages and are not indexed.

The old addresses still work: `/index.html` goes to `/`, `/city.html?city=tokyo&moment=vote` goes to `/city/tokyo?moment=vote`, and `/lab/*-lab.html` goes to `/lab/*`.

## Seeing every state

The pages follow the real clock. To look at another moment, add parameters to the URL. They carry across links between the home and the city pages.

| Parameter | Values |
|---|---|
| `moment` on the home | `announced`, `first`, `mid`, `closed`, `picked`, `archived` |
| `moment` on a city page | `before`, `build`, `vote`, `last`, `closed`, `picked` |
| `t` | `0` to `1`, a position in the day (home) or the session (city) |
| `ground` | `night`, `paper`, `mint` |
| `seed` | Any number. Changes the sample data. |
| `p` on a city page | A project's slug. Opens that project. |

Both pages are rendered on each request because they start from these parameters; the city ids are fixed, so any other id is a 404.

## Checking a change

Take a still at desktop and phone size and read it before calling a change done. Run these with `npm run dev` going.

```bash
node tools/still.mjs "http://localhost:4320/?moment=mid" shots/home-mid.png 3000 "" 100
```

```bash
W=390 H=844 MOBILE=1 node tools/still.mjs "http://localhost:4320/city/berlin?moment=vote" shots/city-vote-390.png 3000 "" 100
```

Check the six moments of each page, on the ground in use, at 1440×900 and 390×844.

## How styles are written

Tailwind CSS 4, set up in CSS (`app/globals.css`, through `postcss.config.mjs`). The default theme is cleared: the only colours, sizes, curves and durations are the site's own tokens, so `bg-ground`, `text-ink-2`, `text-label`, `tracking-d72`, `duration-panel` and `ease-move` all read `globals.css`, and a class like `bg-blue-500` does not exist.

- Write utilities in the markup. Use `clsx` for classes that depend on state, and name a class string that recurs as a constant next to the component that owns it.
- `phone:` and `tablet:` are container queries on the page frame (`FRAME` in `components/shared/page-parts.tsx`); `phone-window:` is the window, for sheets outside the frame. `hover:` only fires on a fine pointer.
- Plain CSS stays where utilities would be hard to read: grid templates driven by custom properties, `:has()` and sibling selectors, keyframes, `::backdrop`, hatching, dialog shells, controls with many states, and class names that scripts read. Keep it short, next to its area, inside `@layer components`, and on the same tokens.
- Each property of an element comes from one place: utilities or that CSS, never both.

## Layout of the repository

| Path | Holds |
|---|---|
| `app/` | Routes only: the home, `city/[city]`, the four labs, `api/save`, the layout and `globals.css` (every design token, and the Tailwind theme that reads them). |
| `components/home/`, `components/city/` | The home and the city page. Styles are utilities in the markup; each folder's CSS (`day.css`, `city.css`) holds only what utilities cannot say well. |
| `components/forms/` | Sign-in, submit, voting email, remind me, share. `store.ts` is the one place the browser storage lives, so an API can replace it. |
| `components/seal/`, `components/pictures/`, `components/ground/`, `components/shared/` | Seals, project pictures, the ground set before first paint, the parts both pages draw (`page-parts.tsx`) and every view transition (`view-transitions.css`). |
| `components/lab/` | The tuning pages, with the layouts that were tried and not chosen. The real pages import nothing from here. |
| `lib/` | Plain typed modules with no React: the clock, the sample data, the home and city models, the palette, the seal drawing, the form checks. |
| `lib/palette.ts` | The three grounds, written once as OKLCH. |
| `lib/day-data.ts`, `lib/data.ts` | The sample data: cities, schedules, projects, arrivals, votes, past events, questions. |
| `lib/pictures.ts` | Draws the sample project pictures. One function returns a project's picture URL, so real image URLs can replace it. |
| `saved/` | The saved configs the pages read. |
| `proxy.ts` | Sends the old `/city.html?city=` address to `/city/<id>`. |
| `tools/still.mjs` | The screenshot tool. |
| `DESIGN.md` | The idea, the rules and the tokens. Read it before changing how anything looks or moves. |

## Not real yet

- **The date and the cities.** Dec 11, 2026 and the ten cities are placeholders.
- **The data.** Projects, votes and pictures are generated from a seed.
- **The backend.** Sign-in, submit and votes are stored in the browser. `components/forms/store.ts` keeps that in one place so an API can replace it.
- **The Supabase mark** in the masthead is a redrawn stand-in. Replace it with the official asset.
- **Past hackathons** list three events and no winners.
