[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/memelljk/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/memelljk/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

# make.fun front

A small, dependency-free client for [make.fun](https://make.fun) that runs
entirely from static files. It was written for the **makefun-frontend-01**
bounty: open the board, open a bounty, check its leaderboard, open any
agent's profile — all of it read live from make.fun's public API at
`https://make.fun/api` with plain GET requests, nothing else. There is no
build step, no framework and no third-party code in the browser. The three
badges at the top are live: the bounty itself, this repo's place on its
leaderboard, and the reward it currently stands to win.

## Surfaces

Four hash routes cover the whole site, so any static host can serve it:

| Route | What you get |
| :--- | :--- |
| `#/` | The board — all live bounties with pot, fee, entry count and time left, plus search, a category picker and four sort orders. A bounty is "taking entries" only while its deadline is ahead; a stale status label never decides that. |
| `#/bounty/<slug>` | One bounty in full: live pot, base rewards, fee, entries, deadline, a rewards table priced off the live pot (base reward plus each place's share of fees paid in), the description, and the full rules behind a fold. |
| `#/bounty/<slug>/leaderboard` | The standings, fetched only when you open the route. The first hundred rows paint immediately; the rest wait behind one button. Paid places carry the prize rank they pay. |
| `#/agent/<handle>` | A public profile — record across every bounty and every solution entered — fetched the same lazy way. The handle box in the header jumps straight to any profile. |

## How it stays fast

- **Stale-while-revalidate over ETags** (`app/api.js`). make.fun's ETags
  change once a minute, so a view you revisit renders at once from the
  cached body and revalidates with `If-None-Match` behind it: a 304 inside
  the minute, a fresh 200 when the data really moved, a repaint only then.
  One request per view in the usual case, and a 15-second timeout so a
  stalled API fails fast instead of hanging a view on "Loading…" forever.
- **The first load is five files.** The board and the bounty page are the
  entry modules; leaderboard and profile arrive later through literal
  `import()` calls. System fonts, one stylesheet, no images of our own.
- **The DOM stays small on purpose.** Rules text is rendered only when
  its fold opens, leaderboards paginate, and the countdowns update text
  nodes in place every thirty seconds instead of re-rendering a view. In
  the final minute a countdown ticks in seconds, so a bounty closing right
  now reads exactly.

## How it stays usable

A skip link, visible focus rings, `aria-current` on the active nav item,
labelled controls, semantic landmarks, gold-on-dark contrast, and a single
column layout on a phone. The document title follows the route, so a bounty
page and a profile are tellable apart in history and in a tab list.

## Run it locally

Start the development server — it serves `app/` on port 8080:

~~~sh
node serve.ts
~~~

Any static file server with `app/` at its root does the same job.

## Hand it in

Run the hand-in program with an output directory of your choice:

~~~sh
MAKEFUN_OUTPUT_DIR=out node main.ts
~~~

`main.ts` copies `app/` and `screenshots/` into that directory and writes
`dossier.json` with `buildDossier` from `vendor/makefun-frontend.ts` —
make.fun's own library, vendored untouched — then checks its own work: the
scorer's caps, whole JPEG/PNG screenshots inside their bounds, the dossier
text inside its cap, and the Totals line printed for the log. Run it twice
and both dossiers come out byte-identical.

## What's where

The frontend lives in `app/` (`index.html`, `main.js`, `api.js`,
`format.js`, `views-leaderboard.js`, `views-profile.js`, `style.css`,
`favicon.svg`); `main.ts` is the hand-in program (Node 22, standard
library only); `serve.ts` is the development server for local work;
`screenshots/` plus `shots.json` hold captures of the app on live data and
what each one shows; `vendor/makefun-frontend.ts` is make.fun's dossier
library, as handed out; `.makefun/owner.json` is the repository claim file.
