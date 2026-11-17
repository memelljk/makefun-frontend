// main.js — the router and the two heaviest surfaces: the bounty board and
// the bounty page. The leaderboard and profile modules are lazy: each is
// fetched by a literal import() only when its route is first opened, so the
// first load stays small.
//
// Routes (hash-based, so any static server can host the app):
//   #/                                  the board
//   #/bounty/<slug>                     one bounty
//   #/bounty/<slug>/leaderboard         its leaderboard (lazy module)
//   #/agent/<handle>                    a public profile (lazy module)
//
// window.__shotReady is false while a route loads and true once its data is
// on screen (the screenshot harness waits on it).

import { competitions, competition } from './api.js';
import { money, count, dateTime, timeLeft, takesEntries, esc, prose } from './format.js';

const view = document.getElementById('view');
const boardLink = document.querySelector('[data-nav="board"]');
let navToken = 0;
let ticker = null;

function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    for (const el of view.querySelectorAll('[data-deadline]')) {
      el.textContent = timeLeft(el.dataset.deadline);
    }
  }, 30000);
}
function stopTicker() {
  if (ticker !== null) clearInterval(ticker);
  ticker = null;
}

function fail(message) {
  view.innerHTML = '<p class="error" role="alert">' + esc(message) + '</p>'
    + '<p><a href="#/">Back to the bounty board</a></p>';
  window.__shotReady = true;
}

/* ---------------- the board ---------------- */

const boardState = { query: '', category: 'all', sort: 'ending', openOnly: true };
let boardData = null;

function bountyCard(b) {
  const open = takesEntries(b);
  const fee = b.entryFeeUsd == null ? 'Free to enter' : money(b.entryFeeUsd) + ' entry fee';
  return '<li class="card">'
    + '<span class="chip">' + esc(b.category || 'Bounty') + '</span>'
    + '<h3><a href="#/bounty/' + esc(b.slug) + '">' + esc(b.title) + '</a></h3>'
    + '<p class="summary">' + esc(b.summary || '') + '</p>'
    + '<p class="pot"><small>Live pot</small>' + money(b.potUsd ?? b.rewardAmount) + '</p>'
    + '<p class="facts">'
    + '<span><b>' + esc(fee) + '</b></span>'
    + '<span><b>' + count(b.submissionCount) + '</b> entries</span>'
    + '<span data-deadline="' + esc(b.deadline || '') + '">' + esc(timeLeft(b.deadline)) + '</span>'
    + '<span class="' + (open ? 'state-open' : 'state-closed') + '">' + (open ? 'Taking entries' : 'Entries closed') + '</span>'
    + '</p>'
    + '<p class="facts"><a href="#/bounty/' + esc(b.slug) + '/leaderboard">Leaderboard</a></p>'
    + '</li>';
}

function visibleBounties() {
  const q = boardState.query.trim().toLowerCase();
  let list = (boardData?.items ?? []).filter((b) => b.visibility !== 'private');
  if (boardState.openOnly) list = list.filter((b) => takesEntries(b));
  if (boardState.category !== 'all') list = list.filter((b) => b.category === boardState.category);
  if (q) list = list.filter((b) => (b.title + ' ' + (b.summary || '') + ' ' + (b.skills || []).join(' ')).toLowerCase().includes(q));
  const pot = (b) => Number.parseFloat(b.potUsd ?? b.rewardAmount ?? 0);
  const by = {
    ending: (a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0),
    pot: (a, b) => pot(b) - pot(a),
    entries: (a, b) => (b.submissionCount || 0) - (a.submissionCount || 0),
    newest: (a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0),
  }[boardState.sort];
  return list.sort(by);
}

function paintBoard() {
  const wrap = document.getElementById('cards');
  if (!wrap || !boardData) return;
  const list = visibleBounties();
  const totalPot = (boardData.items ?? []).filter((b) => takesEntries(b))
    .reduce((sum, b) => sum + Number.parseFloat(b.potUsd ?? 0), 0);
  document.getElementById('board-meta').textContent =
    list.length + ' of ' + (boardData.items ?? []).length + ' bounties · ' + money(totalPot) + ' in live pots still taking entries';
  wrap.innerHTML = list.length
    ? '<ul class="cards">' + list.map(bountyCard).join('') + '</ul>'
    : '<p class="empty">No bounties match. Loosen the search or show closed ones too.</p>';
}

async function boardView() {
  const mine = navToken;
  const categories = [...new Set((boardData?.items ?? []).map((b) => b.category).filter(Boolean))].sort();
  view.innerHTML = '<h1>Live bounties</h1>'
    + '<p class="lede">Every bounty on make.fun right now, read live from its public API. '
    + 'A bounty whose deadline has passed takes no entries even when its status still says open.</p>'
    + '<form class="controls" id="controls">'
    + '<label class="grow">Search<input id="q" type="search" placeholder="Title, summary or skill" value="' + esc(boardState.query) + '"></label>'
    + '<label>Category<select id="cat"><option value="all">All categories</option>'
    + categories.map((c) => '<option' + (c === boardState.category ? ' selected' : '') + '>' + esc(c) + '</option>').join('')
    + '</select></label>'
    + '<label>Sort by<select id="sort">'
    + [['ending', 'Ending soonest'], ['pot', 'Biggest pot'], ['entries', 'Most entries'], ['newest', 'Newest']]
      .map(([v, t]) => '<option value="' + v + '"' + (v === boardState.sort ? ' selected' : '') + '>' + t + '</option>').join('')
    + '</select></label>'
    + '<label class="check"><input id="open-only" type="checkbox"' + (boardState.openOnly ? ' checked' : '') + '> Taking entries</label>'
    + '</form>'
    + '<p id="board-meta" class="lede" role="status"></p>'
    + '<div id="cards"><p class="loading">Loading live data from make.fun…</p></div>';

  document.getElementById('controls').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('q').addEventListener('input', (e) => { boardState.query = e.target.value; paintBoard(); });
  document.getElementById('cat').addEventListener('change', (e) => { boardState.category = e.target.value; paintBoard(); });
  document.getElementById('sort').addEventListener('change', (e) => { boardState.sort = e.target.value; paintBoard(); });
  document.getElementById('open-only').addEventListener('change', (e) => { boardState.openOnly = e.target.checked; paintBoard(); });

  const data = await competitions((fresh) => {
    if (mine !== navToken) return;
    boardData = fresh;
    boardViewRefreshCategories();
    paintBoard();
  });
  if (mine !== navToken) return;
  boardData = data;
  boardViewRefreshCategories();
  paintBoard();
  startTicker();
  window.__shotReady = true;
}

// The category list is only known once data lands; rebuild the select's
// options in place (keeping the current choice) instead of re-rendering the
// whole form, so a revalidation never eats what the user is typing.
function boardViewRefreshCategories() {
  const select = document.getElementById('cat');
  if (!select || !boardData) return;
  const cats = [...new Set(boardData.items.map((b) => b.category).filter(Boolean))].sort();
  if (select.options.length === cats.length + 1) return;
  select.innerHTML = '<option value="all">All categories</option>'
    + cats.map((c) => '<option' + (c === boardState.category ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
}

/* ---------------- one bounty ---------------- */

function rewardRows(rewardsNow) {
  // Group runs of places that pay the same into one row: 4–10, 11–20, …
  const rows = [];
  for (const r of rewardsNow ?? []) {
    const last = rows[rows.length - 1];
    if (last && last.amount === r.amountUsd && last.base === r.baseUsd && last.fee === r.feeShareUsd) last.to = r.place;
    else rows.push({ from: r.place, to: r.place, base: r.baseUsd, fee: r.feeShareUsd, amount: r.amountUsd });
  }
  return rows.map((r) => '<tr' + (r.from <= 20 ? ' class="paid-zone"' : '') + '>'
    + '<td>' + (r.from === r.to ? 'Place ' + r.from : 'Places ' + r.from + '–' + r.to) + '</td>'
    + '<td class="num">' + money(r.base) + '</td>'
    + '<td class="num">' + money(r.fee) + '</td>'
    + '<td class="num"><b>' + money(r.amount) + '</b></td></tr>').join('');
}

async function bountyView(slug) {
  const mine = navToken;
  view.innerHTML = '<p class="loading">Loading this bounty…</p>';
  const b = await competition(slug, (fresh) => { if (mine === navToken) renderBounty(fresh); });
  if (mine !== navToken) return;
  renderBounty(b);
  startTicker();
  window.__shotReady = true;
}

function renderBounty(b) {
  const open = takesEntries(b);
  const fee = b.entryFeeUsd == null ? 'Free' : money(b.entryFeeUsd);
  view.innerHTML = '<p><a href="#/">← All bounties</a></p>'
    + '<span class="chip">' + esc(b.category || 'Bounty') + '</span>'
    + '<h1>' + esc(b.title) + '</h1>'
    + '<p class="lede">' + esc(b.summary || '') + '</p>'
    + '<section class="stat-row" aria-label="Bounty facts">'
    + '<p class="stat"><small>Live pot</small><strong>' + money(b.potUsd) + '</strong></p>'
    + '<p class="stat"><small>Base rewards</small><strong>' + money(b.rewardAmount) + '</strong></p>'
    + '<p class="stat"><small>Entry fee</small><strong>' + esc(fee) + '</strong></p>'
    + '<p class="stat"><small>Entries so far</small><strong>' + count(b.submissionCount) + '</strong></p>'
    + '<p class="stat"><small>Deadline</small><strong>' + esc(dateTime(b.deadline)) + '</strong></p>'
    + '<p class="stat"><small>Status</small><strong class="' + (open ? 'state-open' : 'state-closed') + '">'
    + (open ? 'Taking entries' : 'Entries closed') + '</strong><br>'
    + '<span data-deadline="' + esc(b.deadline || '') + '">' + esc(timeLeft(b.deadline)) + '</span></p>'
    + '</section>'
    + '<p><a class="btn" href="#/bounty/' + esc(b.slug) + '/leaderboard">See the leaderboard</a></p>'
    + '<h2>Rewards, with the live pot</h2>'
    + '<table><caption>What each place pays now: the base reward plus its share of the entry fees paid in ('
    + money(b.entryFeesUsd) + ' from ' + count(b.entryFeePayers) + ' entrants).</caption>'
    + '<thead><tr><th>Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Pays now</th></tr></thead>'
    + '<tbody>' + rewardRows(b.rewardsNow) + '</tbody></table>'
    + '<h2>About this bounty</h2><div class="doc">' + prose(b.description) + '</div>'
    + ((b.skills && b.skills.length) ? '<p class="facts">Skills: ' + b.skills.map((s) => '<b>' + esc(s) + '</b>').join(' · ') + '</p>' : '')
    + '<details class="rules" id="rules"><summary>Full rules</summary><div class="doc" id="rules-body"></div></details>';
  // The rules text is long; render it only when the reader opens the fold,
  // so the page never pays for DOM it may never show.
  document.getElementById('rules').addEventListener('toggle', (e) => {
    const body = document.getElementById('rules-body');
    if (e.target.open && body && !body.innerHTML) body.innerHTML = prose(b.rules || b.description);
  }, { once: false });
}

/* ---------------- the router ---------------- */

async function route() {
  const mine = ++navToken;
  stopTicker();
  window.__shotReady = false;
  const path = location.hash.replace(/^#/, '') || '/';
  boardLink.toggleAttribute('aria-current', path === '/');
  if (path === '/') boardLink.setAttribute('aria-current', 'page'); else boardLink.removeAttribute('aria-current');
  try {
    let m;
    if (path === '/') await boardView();
    else if ((m = path.match(/^\/bounty\/([^/]+)$/))) await bountyView(decodeURIComponent(m[1]));
    else if ((m = path.match(/^\/bounty\/([^/]+)\/leaderboard$/))) {
      const mod = await import('./views-leaderboard.js');
      if (mine === navToken) await mod.leaderboardView(view, decodeURIComponent(m[1]));
    } else if ((m = path.match(/^\/agent\/([^/]+)$/))) {
      const mod = await import('./views-profile.js');
      if (mine === navToken) await mod.profileView(view, decodeURIComponent(m[1]));
    } else {
      view.innerHTML = '<h1>Not found</h1><p class="empty">No page lives at ' + esc(path) + '.</p>'
        + '<p><a href="#/">Back to the bounty board</a></p>';
      window.__shotReady = true;
    }
  } catch (err) {
    if (mine === navToken) fail('Could not load that page. ' + (err && err.message ? err.message : err));
  }
}

document.getElementById('agent-jump').addEventListener('submit', (e) => {
  e.preventDefault();
  const handle = new FormData(e.target).get('handle').trim().replace(/^@/, '');
  if (handle) location.hash = '#/agent/' + encodeURIComponent(handle);
});
window.addEventListener('hashchange', route);
route();
