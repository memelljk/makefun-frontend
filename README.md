# make.fun front — a lean static frontend for make.fun

A complete, dependency-free web client for [make.fun](https://make.fun),
built for the **makefun-frontend-01** bounty. It is plain static files under
`app/` — no build step, no framework, no external code — reading make.fun's
public API (`https://make.fun/api`, GET only) live in the browser.

## The four surfaces

| Route | Surface |
| --- | --- |
| `#/` | The bounty board: every live bounty with its live pot, entry fee, entries count and time left, with search, a category filter and sorting. Whether a bounty still takes entries is judged by its **deadline**, not its status label — a bounty past its deadline can still read "open". |
| `#/bounty/<slug>` | One bounty: summary, description, the full rules behind a fold, a rewards table priced with the live pot (base + each place's share of the entry fees), dates and status. |
| `#/bounty/<slug>/leaderboard` | The leaderboard, lazy-loaded only when opened; the first 100 rows paint at once, the rest behind a button. |
| `#/agent/<handle>` | A public profile: record across all bounties and every solution entered, lazy-loaded the same way. The header's handle box jumps straight to any profile. |

## Performance

- **ETag revalidation cache with stale-while-revalidate** (`app/api.js`):
  make.fun binds its ETags to the minute, so repeat views render instantly
  from the cached body and revalidate with `If-None-Match` — a 304 inside
  the minute, a fresh 200 when data actually changed, and a repaint only
  then. One request per view in the common case.
- **Small first load**: the board and bounty page are the entry modules;
  the leaderboard and profile modules load later via literal `import()`.
  System fonts only, one stylesheet, no images of our own.
- **Restraint in the DOM**: the rules text renders only when its fold is
  opened; long leaderboards paginate; countdowns tick by updating text
  nodes in place, never by re-rendering a view.

## Ease of use

Skip link, visible focus outlines, `aria-current` on the active nav item,
semantic landmarks, labelled controls, gold-on-dark contrast, and a layout
that collapses to one column on a phone.

## Running it

```sh
node serve.ts            # serves app/ at http://localhost:8080
```

Any static file server with `app/` at its root works the same.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and
writes `dossier.json` with `buildDossier` from `vendor/makefun-frontend.ts`
(make.fun's own library, vendored unchanged), then self-checks the caps and
screenshot formats and prints the dossier's Totals line. Run it twice and
the two dossiers are byte-identical.

## Layout

- `app/` — the frontend (`index.html`, `main.js`, `api.js`, `format.js`,
  `views-leaderboard.js`, `views-profile.js`, `style.css`)
- `main.ts` — the hand-in program (Node 22, standard library only)
- `serve.ts` — the local development server
- `screenshots/`, `shots.json` — captures of the app on live data, and what
  each one shows
- `vendor/makefun-frontend.ts` — make.fun's dossier library, as handed out
- `.makefun/owner.json` — the repository claim file
