# Supabase Hackathon

The site for a hackathon that runs in ten cities on one day. Each city builds, then votes, and the project with the most votes wins its city. Ant and Copple then pick one of the ten.

It is a static site: plain HTML, CSS and JavaScript, with no build step and no dependencies. Data is sample data until the backend exists.

## Run it

```bash
node tools/serve.mjs 4320
```

Then open `http://localhost:4320/`.

## Pages

| Page | What it is |
|---|---|
| `index.html` | The home: the day. Ten cities in time-zone order on one time strip, each city's winner, and the pick. |
| `city.html?city=berlin` | One city: its session, the top ten projects, every entry, voting. Add `&p=<slug>` to open a project. |
| `lab/day-lab.html` | Tuning page for the home. Four layouts and every knob. Save writes `saved/day.config.json`. |
| `lab/city-lab.html` | Tuning page for the city page. Save writes `saved/city.config.json`. |
| `lab/seal-lab.html` | The generator for the city seals. Save writes `saved/seal.config.json`. |
| `lab/forms-lab.html` | Sign-in, submit, the voting email step, remind me and share, one button each. |

The real pages read the three files in `saved/`. To change the look, tune it in the lab, press Save, and reload the page.

## Seeing every state

The pages follow the real clock. To look at another moment, add parameters to the URL. They carry across links between the home and the city pages.

| Parameter | Values |
|---|---|
| `moment` on the home | `announced`, `first`, `mid`, `closed`, `picked`, `archived` |
| `moment` on a city page | `before`, `build`, `vote`, `last`, `closed`, `picked` |
| `t` | `0` to `1`, a position in the day (home) or the session (city) |
| `ground` | `night`, `paper`, `mint` |
| `city` | `sydney`, `tokyo`, `singapore`, `bengaluru`, `berlin`, `lagos`, `london`, `sao-paulo`, `new-york`, `san-francisco` |
| `seed` | Any number. Changes the sample data. |

## Checking a change

Take a still at desktop and phone size and read it before calling a change done.

```bash
node tools/still.mjs "http://localhost:4320/index.html?moment=mid" shots/home-mid.png 3000 "" 100
```

```bash
W=390 H=844 MOBILE=1 node tools/still.mjs "http://localhost:4320/city.html?city=berlin&moment=vote" shots/city-vote-390.png 3000 "" 100
```

Check the six moments of each page, on the ground in use, at 1440×900 and 390×844.

## Layout of the repository

| Path | Holds |
|---|---|
| `shared/brand.css` | Every design token: colour roles, type, space, lines, motion. Load it first. |
| `shared/palette.js` | The three grounds, written once as OKLCH. |
| `shared/day-data.js`, `shared/data.js` | The sample data: cities, schedules, projects, arrivals, votes, past events, questions. |
| `shared/sample-pictures.js` | Draws the sample project pictures. One function returns a project's picture URL, so real image URLs can replace it. |
| `shared/day.js`, `shared/day.css` | The home. |
| `shared/city.js`, `shared/city.css` | The city page and the project sheet. |
| `shared/forms.js`, `shared/forms.css` | Sign-in, submit, voting email, remind me, share. |
| `shared/seal.js` | Draws a city's seal and the winner's seal. |
| `saved/` | The saved configs the pages read. |
| `lab/` | The tuning pages, with the layouts that were tried and not chosen. Nothing in production loads them. |
| `tools/` | The dev server and the screenshot tool. |
| `DESIGN.md` | The idea, the rules and the tokens. Read it before changing how anything looks or moves. |

## Not real yet

- **The date and the cities.** Dec 11, 2026 and the ten cities are placeholders.
- **The data.** Projects, votes and pictures are generated from a seed.
- **The backend.** Sign-in, submit and votes are stored in the browser. `shared/forms.js` keeps that in one place (`store`) so an API can replace it.
- **The Supabase mark** in the masthead is a redrawn stand-in. Replace it with the official asset.
- **Past hackathons** list three events and no winners.
