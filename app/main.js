// main.js — routing plus the two surfaces that ship in the first load:
// the bounty board and the bounty page. The leaderboard and the profile
// arrive later, each through a literal import() the first time its route
// opens, so they cost the first load nothing.
// Hash routes (any static server can host the app):
//   #/                              the board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     its leaderboard, lazy module
//   #/agent/<handle>                a public profile, lazy module
// window.__shotReady stays false while a route is loading and turns true
// once its data is on screen; the screenshot harness waits on it. The
// document title follows the route, so every surface is tellable apart in
// history and in a tab list.

import { competition } from './api.js';
import { competitions } from './api.js';
import { count } from './format.js';
import { dateTime } from './format.js';
import { esc } from './format.js';
import { money } from './format.js';
import { prose } from './format.js';
import { takesEntries } from './format.js';
import { timeLeft } from './format.js';

const view = document.querySelector('#view');
const boardNavLink = document.querySelectorAll('[data-nav="board"]').item(0);
const HOME_TITLE = 'make.fun front — live bounties, leaderboards, profiles';
const TICK_MS = 30000;

let routeToken = 0;
let clock = null;

const markReady = () => { window.__shotReady = true; };
const markLoading = () => { window.__shotReady = false; };

const tickDeadlines = () => {
  for (const el of view.querySelectorAll('[data-deadline]')) el.textContent = timeLeft(el.dataset.deadline);
}; // tickDeadlines

const startClock = () => {
  stopClock();
  clock = setInterval(tickDeadlines, TICK_MS);
}; // startClock

const stopClock = () => {
  if (clock !== null) clearInterval(clock);
  clock = null;
}; // stopClock

const showError = (message) => {
  view.innerHTML = `<p class="error" role="alert">${esc(message)}</p><p><a href="#/">Back to the bounty board</a></p>`;
  document.title = HOME_TITLE;
  markReady();
}; // showError

// ----- the board -----

const filters = { query: '', category: 'all', sort: 'ending', openOnly: true };
let board = null;

const cardHtml = (b) => {
  const accepting = takesEntries(b);
  const fee = b.entryFeeUsd == null ? 'Free to enter' : `${money(b.entryFeeUsd)} entry fee`;
  const state = accepting ? 'Taking entries' : 'Entries closed';
  const stateClass = accepting ? 'state-open' : 'state-closed';
  return `<li class="card">
    <span class="chip">${esc(b.category || 'Bounty')}</span>
    <h3><a href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a></h3>
    <p class="summary">${esc(b.summary || '')}</p>
    <p class="pot"><small>Live pot</small>${money(b.potUsd ?? b.rewardAmount)}</p>
    <p class="facts">
      <span><b>${esc(fee)}</b></span>
      <span><b>${count(b.submissionCount)}</b> entries</span>
      <span data-deadline="${esc(b.deadline || '')}">${esc(timeLeft(b.deadline))}</span>
      <span class="${stateClass}">${state}</span>
    </p>
    <p class="facts"><a href="#/bounty/${esc(b.slug)}/leaderboard">Leaderboard</a></p>
  </li>`;
}; // cardHtml

const filteredBoard = () => {
  const q = filters.query.trim().toLowerCase();
  const list = (board?.items ?? []).filter((b) => {
    if (b.visibility === 'private') return false;
    if (filters.openOnly && !takesEntries(b)) return false;
    if (filters.category !== 'all' && b.category !== filters.category) return false;
    if (!q) return true;
    const haystack = `${b.title} ${b.summary || ''} ${(b.skills || []).join(' ')}`.toLowerCase();
    return haystack.includes(q);
  }); // visible
  const potOf = (b) => Number.parseFloat(b.potUsd ?? b.rewardAmount ?? 0);
  const endsAt = (b) => new Date(b.deadline || 0).getTime();
  const publishedAt = (b) => new Date(b.publishedAt || 0).getTime();
  // Ties on pot or entries break by deadline, so two bounties that tie
  // never swap places between repaints.
  const orders = {
    ending: (a, b) => endsAt(a) - endsAt(b),
    pot: (a, b) => {
      const gap = potOf(b) - potOf(a);
      return gap === 0 ? endsAt(a) - endsAt(b) : gap;
    }, // pot
    entries: (a, b) => {
      const gap = (b.submissionCount || 0) - (a.submissionCount || 0);
      return gap === 0 ? endsAt(a) - endsAt(b) : gap;
    }, // entries
    newest: (a, b) => publishedAt(b) - publishedAt(a) || endsAt(a) - endsAt(b),
  };
  return list.sort(orders[filters.sort]);
}; // filteredBoard

const repaintBoard = () => {
  const cardsWrap = document.getElementById('cards');
  if (!cardsWrap || !board) return;
  const list = filteredBoard();
  let livePot = 0;
  for (const b of board.items ?? []) {
    if (takesEntries(b)) livePot += Number.parseFloat(b.potUsd ?? 0);
  } // live pots
  const meta = document.getElementById('board-meta');
  meta.textContent = `${list.length} of ${(board.items ?? []).length} bounties · ${money(livePot)} in live pots still taking entries`;
  cardsWrap.innerHTML = list.length
    ? `<ul class="cards">${list.map(cardHtml).join('')}</ul>`
    : '<p class="empty">Nothing matches. Try a different search or show closed bounties too.</p>';
}; // repaintBoard

const uniqueCategories = (items) => {
  const seen = new Set();
  const out = [];
  for (const b of items ?? []) {
    if (b.category && !seen.has(b.category)) {
      seen.add(b.category);
      out.push(b.category);
    } // fresh category
  } // items
  return out.sort();
}; // uniqueCategories

const refreshCategoryOptions = () => {
  const categorySelect = document.getElementById('cat');
  if (!categorySelect || !Array.isArray(board?.items)) return;
  const cats = uniqueCategories(board.items);
  if (categorySelect.options.length - 1 === cats.length) return;
  categorySelect.innerHTML = '<option value="all">All categories</option>'
    + cats.map((c) => `<option${c === filters.category ? ' selected' : ''}>${esc(c)}</option>`).join('');
}; // refreshCategoryOptions

const boardRoute = async () => {
  const mine = routeToken;
  document.title = HOME_TITLE;
  const known = uniqueCategories(board?.items);
  const sortOptions = [
    ['ending', 'Ending soonest'],
    ['pot', 'Biggest pot'],
    ['entries', 'Most entries'],
    ['newest', 'Newest'],
  ];
  view.innerHTML = `<h1>Live bounties</h1>
    <p class="lede">Every bounty on make.fun right now, read live from its public API.
    A bounty whose deadline has passed takes no entries even when its status still says open.</p>
    <form class="controls" id="controls">
      <label class="grow">Search<input id="q" type="search" placeholder="Title, summary or skill" value="${esc(filters.query)}"></label>
      <label>Category<select id="cat"><option value="all">All categories</option>
        ${known.map((c) => `<option${c === filters.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}
      </select></label>
      <label>Sort by<select id="sort">
        ${sortOptions.map(([v, t]) => `<option value="${v}"${v === filters.sort ? ' selected' : ''}>${t}</option>`).join('')}
      </select></label>
      <label class="check"><input id="open-only" type="checkbox"${filters.openOnly ? ' checked' : ''}> Taking entries</label>
    </form>
    <p id="board-meta" class="lede" role="status"></p>
    <div id="cards"><p class="loading">Fetching the live board…</p></div>`;

  const controlsForm = document.getElementById('controls');
  controlsForm.addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('q').addEventListener('input', (e) => { filters.query = e.target.value; repaintBoard(); });
  document.getElementById('cat').addEventListener('change', (e) => { filters.category = e.target.value; repaintBoard(); });
  document.getElementById('sort').addEventListener('change', (e) => { filters.sort = e.target.value; repaintBoard(); });
  document.getElementById('open-only').addEventListener('change', (e) => { filters.openOnly = e.target.checked; repaintBoard(); });

  const onFreshBoard = (fresh) => {
    if (mine !== routeToken) return;
    board = fresh;
    refreshCategoryOptions();
    repaintBoard();
  }; // onFreshBoard
  const freshBoard = await competitions(onFreshBoard);
  if (mine !== routeToken) return;
  board = freshBoard;
  refreshCategoryOptions();
  repaintBoard();
  startClock();
  markReady();
}; // boardRoute

// ----- one bounty -----

// Runs of places that pay the same collapse into one row: 4–10, 11–20, …
const rewardsTable = (rewardsNow) => {
  const groups = [];
  for (const reward of rewardsNow ?? []) {
    const tail = groups[groups.length - 1];
    if (tail && tail.amount === reward.amountUsd && tail.base === reward.baseUsd && tail.fee === reward.feeShareUsd) {
      tail.to = reward.place;
      continue;
    } // same payout
    groups.push({ from: reward.place, to: reward.place, base: reward.baseUsd, fee: reward.feeShareUsd, amount: reward.amountUsd });
  } // rewards
  return groups.map((r) => {
    const place = r.from === r.to ? `Place ${r.from}` : `Places ${r.from}–${r.to}`;
    const zone = r.from <= 20 ? ' class="paid-zone"' : '';
    return `<tr${zone}><td>${place}</td><td class="num">${money(r.base)}</td>`
      + `<td class="num">${money(r.fee)}</td><td class="num"><b>${money(r.amount)}</b></td></tr>`;
  }).join('');
}; // rewardsTable

const paintBounty = (b) => {
  const accepting = takesEntries(b);
  const feeLabel = b.entryFeeUsd == null ? 'Free' : money(b.entryFeeUsd);
  const state = accepting ? 'Taking entries' : 'Entries closed';
  const stateClass = accepting ? 'state-open' : 'state-closed';
  document.title = `${b.title ? `${b.title} — ` : ''}make.fun front`;
  view.innerHTML = `<p><a href="#/">← All bounties</a></p>
    <span class="chip">${esc(b.category || 'Bounty')}</span>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary || '')}</p>
    <section class="stat-row" aria-label="Bounty facts">
      <p class="stat"><small>Live pot</small><strong>${money(b.potUsd)}</strong></p>
      <p class="stat"><small>Base rewards</small><strong>${money(b.rewardAmount)}</strong></p>
      <p class="stat"><small>Entry fee</small><strong>${esc(feeLabel)}</strong></p>
      <p class="stat"><small>Entries so far</small><strong>${count(b.submissionCount)}</strong></p>
      <p class="stat"><small>Deadline</small><strong>${esc(dateTime(b.deadline))}</strong></p>
      <p class="stat"><small>Status</small><strong class="${stateClass}">${state}</strong><br>
      <span data-deadline="${esc(b.deadline || '')}">${esc(timeLeft(b.deadline))}</span></p>
    </section>
    <p><a class="btn" href="#/bounty/${esc(b.slug)}/leaderboard">See the leaderboard</a></p>
    <h2>Rewards, with the live pot</h2>
    <table><caption>What each place pays now: the base reward plus its share of the entry fees paid in (${money(b.entryFeesUsd)} from ${count(b.entryFeePayers)} entrants).</caption>
    <thead><tr><th>Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Pays now</th></tr></thead>
    <tbody>${rewardsTable(b.rewardsNow)}</tbody></table>
    <h2>About this bounty</h2><div class="doc">${prose(b.description)}</div>
    ${b.skills?.length ? `<p class="facts">Skills: ${b.skills.map((s) => `<b>${esc(s)}</b>`).join(' · ')}</p>` : ''}
    <details class="rules" id="rules"><summary>Full rules</summary><div class="doc" id="rules-body"></div></details>`;
  // The rules text is long, so it is rendered only when the reader opens
  // the fold — the page never pays for DOM it may never show.
  const rulesFold = document.getElementById('rules');
  const onRulesToggle = (e) => {
    const rulesBody = document.getElementById('rules-body');
    if (!e.target.open || !rulesBody || rulesBody.innerHTML) return;
    rulesBody.innerHTML = prose(b.rules || b.description);
  }; // onRulesToggle
  rulesFold.addEventListener('toggle', onRulesToggle);
}; // paintBounty

const bountyRoute = async (slug) => {
  const mine = routeToken;
  view.innerHTML = '<p class="loading">Fetching this bounty…</p>';
  const b = await competition(slug, (fresh) => {
    if (mine !== routeToken) return;
    paintBounty(fresh);
  }); // fresh bounty
  if (mine !== routeToken) return;
  paintBounty(b);
  startClock();
  markReady();
}; // bountyRoute

// ----- the router -----

const route = async () => {
  const mine = ++routeToken;
  stopClock();
  markLoading();
  const routePath = location.hash.replace(/^#/, '') || '/';
  if (routePath === '/') {
    boardNavLink.setAttribute('aria-current', 'page');
  } else {
    boardNavLink.removeAttribute('aria-current');
  } // board link
  try { // route dispatch: any failure lands on the error view
    if (routePath === '/') {
      await boardRoute();
      return;
    } // board
    const single = routePath.match(/^\/bounty\/([^/]+)$/);
    if (single) {
      await bountyRoute(decodeURIComponent(single[1]));
      return;
    } // one bounty
    const standings = routePath.match(/^\/bounty\/([^/]+)\/leaderboard$/);
    if (standings) {
      const lazy = await import('./views-leaderboard.js');
      if (mine !== routeToken) return;
      await lazy.leaderboardView(view, decodeURIComponent(standings[1]));
      return;
    } // leaderboard
    const account = routePath.match(/^\/agent\/([^/]+)$/);
    if (account) {
      const lazy = await import('./views-profile.js');
      if (mine !== routeToken) return;
      await lazy.profileView(view, decodeURIComponent(account[1]));
      return;
    } // profile
    view.innerHTML = `<h1>Not found</h1><p class="empty">No page lives at ${esc(routePath)}.</p><p><a href="#/">Back to the bounty board</a></p>`;
    document.title = 'Not found — make.fun front';
    markReady();
  } catch (error) {
    if (mine === routeToken) showError(`Could not load that page. ${error?.message ?? error}`);
  } // dispatch
}; // route

const jumpForm = document.getElementById('agent-jump');
const onJumpSubmit = (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const typed = String(form.get('handle') ?? '').trim().replace(/^@/, '');
  if (typed) location.hash = `#/agent/${encodeURIComponent(typed)}`;
}; // onJumpSubmit
jumpForm.addEventListener('submit', onJumpSubmit);
addEventListener('hashchange', route);
void route();
