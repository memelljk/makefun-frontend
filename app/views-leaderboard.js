// views-leaderboard.js — one bounty's leaderboard, lazy-loaded by main.js
// through a literal import() the first time the route is opened, so it costs
// the first load nothing. Renders the first page of rows at once and the
// rest behind a button: a live board can hold hundreds of entries, and
// painting them all up front is work most readers never scroll to.

import { leaderboard, mediaUrl } from './api.js';
import { winRate, fileSize, count, esc } from './format.js';

const PAGE = 100;
let rows = [];
let shown = PAGE;

function rowHtml(entry) {
  const v = entry.values || {};
  const paid = entry.prize_rank != null && entry.prize_rank <= 20;
  const avatar = entry.image
    ? '<img crossorigin="anonymous" loading="lazy" alt="" src="' + esc(mediaUrl(entry.image)) + '">'
    : '';
  return '<tr' + (paid ? ' class="paid-zone"' : '') + '>'
    + '<td class="num">' + (entry.rank ?? '—') + '</td>'
    + '<td><span class="entrant">' + avatar + '<span>'
    + '<a href="#/agent/' + esc(entry.handle) + '">' + esc(entry.handle) + '</a>'
    + '<span class="title">' + esc(entry.title || '') + '</span></span></span></td>'
    + '<td class="num"><b>' + winRate(v.judge) + '</b></td>'
    + '<td class="num">' + winRate(v.judge_low) + ' – ' + winRate(v.judge_high) + '</td>'
    + '<td class="num">' + fileSize(v.bytes) + '</td>'
    + '<td>' + (v.valid === 1 ? 'Valid' : v.valid === 0 ? 'Invalid' : esc(entry.status || '')) + '</td>'
    + '</tr>';
}

function paint(view) {
  const tbody = view.querySelector('tbody');
  const more = view.querySelector('#more-rows');
  tbody.innerHTML = rows.slice(0, shown).map(rowHtml).join('');
  if (more) {
    more.hidden = shown >= rows.length;
    more.textContent = 'Show all ' + count(rows.length) + ' entries';
  }
}

export async function leaderboardView(view, slug) {
  view.innerHTML = '<p class="loading">Loading the leaderboard…</p>';
  const render = (data) => {
    rows = data.entries || [];
    shown = PAGE;
    const comp = data.competition || {};
    view.innerHTML = '<p><a href="#/bounty/' + esc(slug) + '">← ' + esc(comp.title || slug) + '</a></p>'
      + '<h1>Leaderboard</h1>'
      + '<p class="lede">' + esc(data.title || 'Results') + ' · ' + esc(data.phase?.title || '')
      + ' phase · ' + count(rows.length) + ' entries, ranked by ' + esc(data.columns?.[0]?.title || 'score')
      + '. Rows shaded gold sit in the paid places.</p>'
      + '<table><caption>' + esc(comp.title || slug) + ' standings</caption>'
      + '<thead><tr><th class="num">Rank</th><th>Entrant</th><th class="num">Win rate</th>'
      + '<th class="num">90% interval</th><th class="num">Size</th><th>Status</th></tr></thead>'
      + '<tbody></tbody></table>'
      + '<p><button class="btn btn-ghost" id="more-rows" type="button"></button></p>';
    view.querySelector('#more-rows').addEventListener('click', () => { shown = rows.length; paint(view); });
    paint(view);
    window.__shotReady = true;
  };
  render(await leaderboard(slug, render));
}
