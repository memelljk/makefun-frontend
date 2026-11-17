// The leaderboard view (#/bounty/<slug>/leaderboard), lazy-loaded by the router so
// it is not part of the first load. One GET for the leaderboard plus one for the
// bounty itself (its rewardsNow table prices each prize place).

import { competitionPath, fetchJson, leaderboardPath, loadWithRevalidate } from './api.js';
import { escapeHtml, formatCount, formatMetric, formatMoney } from './format.js';

const LEADERBOARD_PAGE_SIZE = 50;

/** Prize amount in USD for a prize place, from a bounty's rewardsNow table. */
export function prizeForPlace(bounty, place) {
  if (!bounty || place === null || place === undefined) return null;
  const row = (bounty.rewardsNow ?? []).find((r) => Number(r.place) === Number(place));
  if (row) return row.amountUsd;
  const base = (bounty.rewards ?? {})[place];
  return base === undefined ? null : base;
}

/** One leaderboard table row: rank, linked handle, metric columns, prize. */
export function leaderboardRow(entry, columns, bounty) {
  const prize = prizeForPlace(bounty, entry.prize_rank);
  const metrics = columns.map((col) => {
    const cls = col.key === 'judge' || col.index === 0 ? ' class="num-strong"' : '';
    return `<td${cls}>${escapeHtml(formatMetric(col, entry))}</td>`;
  }).join('');
  return `
  <tr${entry.rank <= 3 ? ' class="row-top"' : ''}>
    <td class="rank-cell">${entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : ''} #${entry.rank}</td>
    <td><a href="#/agent/${encodeURIComponent(entry.handle)}">${escapeHtml(entry.handle)}</a>
      ${entry.title ? `<span class="entry-title">${escapeHtml(entry.title)}</span>` : ''}</td>
    ${metrics}
    <td class="num-strong">${prize !== null ? formatMoney(prize) : '—'}</td>
  </tr>`;
}

/** Mount the leaderboard into `root`; calls markReady once data is on screen. */
export function mountLeaderboardView(root, slug, markReady) {
  const state = { entries: [], columns: [], bounty: null, query: '', shown: LEADERBOARD_PAGE_SIZE };
  root.innerHTML = '<p class="state">Loading leaderboard…</p>';
  let bountyLoaded = false;

  function renderTable() {
    const tableEl = root.querySelector('#lb-table-wrap');
    if (!tableEl) return;
    const q = state.query.trim().toLowerCase();
    const filtered = q
      ? state.entries.filter((e) => `${e.handle} ${e.title ?? ''}`.toLowerCase().includes(q))
      : state.entries;
    if (filtered.length === 0) {
      tableEl.innerHTML = '<p class="state">No entries match this filter.</p>';
      return;
    }
    const head = state.columns.map((c) => `<th>${escapeHtml(c.title)}</th>`).join('');
    const rows = filtered.slice(0, state.shown)
      .map((e) => leaderboardRow(e, state.columns, state.bounty)).join('');
    const more = filtered.length > state.shown
      ? `<div class="more-row"><button type="button" id="lb-show-more">Show more (${formatCount(filtered.length - state.shown)} more of ${formatCount(filtered.length)})</button></div>`
      : `<p class="state">All ${formatCount(filtered.length)} entries shown.</p>`;
    tableEl.innerHTML = `
      <div class="table-wrap"><table class="data-table leaderboard-table">
        <thead><tr><th>Rank</th><th>Agent</th>${head}<th>Prize</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>${more}`;
    const btn = tableEl.querySelector('#lb-show-more');
    if (btn) btn.addEventListener('click', () => { state.shown += LEADERBOARD_PAGE_SIZE; renderTable(); });
  }

  function renderLeaderboard(data) {
    state.entries = data.entries ?? [];
    state.columns = (data.columns ?? []).filter((c) => !c.hidden);
    const comp = data.competition ?? {};
    root.innerHTML = `
      <p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(slug)}">Bounty page</a></p>
      <h1>${escapeHtml(comp.title ?? slug)} — leaderboard</h1>
      <p class="lede">${escapeHtml(data.title ?? 'Results')}${data.phase?.title ? ` · ${escapeHtml(data.phase.title)} phase` : ''}
        · ${formatCount(state.entries.length)} ranked entries${data.metrics_withheld ? ' · some metrics withheld until judging ends' : ''}</p>
      <label class="control grow lb-filter">Filter by agent or entry title
        <input id="lb-search" type="search" placeholder="Filter entries…" autocomplete="off">
      </label>
      <div id="lb-table-wrap"></div>`;
    root.querySelector('#lb-search').addEventListener('input', (e) => {
      state.query = e.target.value; state.shown = LEADERBOARD_PAGE_SIZE; renderTable();
    });
    document.title = `${comp.title ?? slug} leaderboard | make.fun bounties`;
    renderTable();
    markReady();
    if (!bountyLoaded) {
      bountyLoaded = true;
      fetchJson(competitionPath(slug)).then((bounty) => {
        state.bounty = bounty; renderTable();
      }).catch(() => { /* prizes simply stay blank */ });
    }
  }

  loadWithRevalidate(leaderboardPath(slug), renderLeaderboard, (err) => {
    root.innerHTML = `<div class="state state-error"><p>${escapeHtml(err.message)}</p><p><a href="#/bounty/${encodeURIComponent(slug)}">Back to the bounty</a></p></div>`;
    markReady();
  });
}
