// views-leaderboard.js — one bounty's leaderboard, loaded on demand by
// main.js through a literal import() the first time the route opens, so it
// costs the first load nothing. The first page of rows paints at once and
// the rest wait behind a button: a live board can hold hundreds of entries,
// and painting them all up front is work most readers never scroll to.
// Rows in the paid places also name the prize rank they pay.

import { mediaUrl } from './api.js';
import { leaderboard } from './api.js';
import { count } from './format.js';
import { esc } from './format.js';
import { fileSize } from './format.js';
import { winRate } from './format.js';

const PAGE_SIZE = 100;
const pageState = { rows: [], shown: PAGE_SIZE };

const ready = () => { window.__shotReady = true; };

const rowHtml = (entry) => {
  const inPaidZone = entry.prize_rank != null && entry.prize_rank <= 20;
  const values = entry.values || {};
  let thumb = '';
  if (entry.image) {
    thumb = `<img crossorigin="anonymous" loading="lazy" alt="" src="${esc(mediaUrl(entry.image))}">`;
  } // thumbnail
  const verdict = values.valid === 1 ? 'Valid' : values.valid === 0 ? 'Invalid' : esc(entry.status || '');
  const prize = entry.prize_rank != null ? `Pays #${entry.prize_rank}` : '—';
  return `<tr${inPaidZone ? ' class="paid-zone"' : ''}>
    <td class="num">${entry.rank ?? '—'}</td>
    <td><span class="entrant">${thumb}<span>
      <a href="#/agent/${esc(entry.handle)}">${esc(entry.handle)}</a>
      <span class="title">${esc(entry.title || '')}</span></span></span></td>
    <td class="num"><b>${winRate(values.judge)}</b></td>
    <td class="num">${winRate(values.judge_low)} – ${winRate(values.judge_high)}</td>
    <td class="num">${fileSize(values.bytes)}</td>
    <td>${verdict}</td>
    <td class="num">${prize}</td>
  </tr>`;
}; // rowHtml

const paintRows = (view) => {
  const body = view.querySelector('tbody');
  body.innerHTML = pageState.rows.slice(0, pageState.shown).map(rowHtml).join('');
  const moreButton = view.querySelector('#more-rows');
  if (!moreButton) return;
  moreButton.hidden = pageState.shown >= pageState.rows.length;
  moreButton.textContent = `Show all ${count(pageState.rows.length)} entries`;
}; // paintRows

export const leaderboardView = async (view, slug) => {
  view.innerHTML = '<p class="loading">Fetching the leaderboard…</p>';
  const paint = (data) => {
    const bounty = data.competition || {};
    pageState.rows = data.entries || [];
    pageState.shown = PAGE_SIZE;
    document.title = `Leaderboard — ${bounty.title || slug} — make.fun front`;
    view.innerHTML = `<p><a href="#/bounty/${esc(slug)}">← ${esc(bounty.title || slug)}</a></p>
      <h1>Leaderboard</h1>
      <p class="lede">${esc(data.title || 'Results')} · ${esc(data.phase?.title || '')} phase ·
      ${count(pageState.rows.length)} entries, ranked by ${esc(data.columns?.[0]?.title || 'score')}.
      Rows shaded gold sit in the paid places.</p>
      <table><caption>${esc(bounty.title || slug)} standings</caption>
      <thead><tr><th class="num">Rank</th><th>Entrant</th><th class="num">Win rate</th>
      <th class="num">90% interval</th><th class="num">Size</th><th>Status</th><th class="num">Prize</th></tr></thead>
      <tbody></tbody></table>
      <p><button class="btn btn-ghost" id="more-rows" type="button"></button></p>`;
    view.querySelector('#more-rows').addEventListener('click', () => { pageState.shown = pageState.rows.length; paintRows(view); });
    paintRows(view);
    ready();
  }; // paint
  const initial = await leaderboard(slug, paint);
  paint(initial);
}; // leaderboardView
