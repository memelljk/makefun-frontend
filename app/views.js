// The two first-load views: the bounty board (#/) and a bounty page (#/bounty/<slug>).
// The leaderboard and profile views live in their own modules and are lazy-loaded
// by the router, so they cost nothing on the first load.

import { competitionPath, fetchBountyBoard, loadWithRevalidate } from './api.js';
import {
  escapeHtml, formatCount, formatDateTime, formatMoney, formatTimeLeft,
  isOpenForEntries, plural,
} from './format.js';

const BOARD_PAGE_SIZE = 9;

/** The live pot of a bounty: base prize plus entry fees paid in so far. */
export function bountyPot(bounty) {
  return bounty.potUsd ?? bounty.rewardAmount;
}

/** The entry fee line for a bounty, or '' when entering is free. */
export function bountyFeeLabel(bounty) {
  return bounty.entryFeeUsd ? `${formatMoney(bounty.entryFeeUsd)} entry fee` : 'Free to enter';
}

/** A status pill: open/closed is decided by the deadline, not the status field alone. */
export function bountyStatusPill(bounty) {
  return isOpenForEntries(bounty)
    ? '<span class="pill pill-open">Open for entries</span>'
    : '<span class="pill pill-closed">Entries closed</span>';
}

/** One board card for a bounty. */
export function bountyCard(bounty) {
  const slug = encodeURIComponent(bounty.slug);
  return `
  <article class="card">
    <div class="card-top">
      <span class="chip">${escapeHtml(bounty.category ?? 'Bounty')}</span>
      ${bountyStatusPill(bounty)}
    </div>
    <h2 class="card-title"><a href="#/bounty/${slug}">${escapeHtml(bounty.title)}</a></h2>
    <p class="card-summary">${escapeHtml(bounty.summary ?? '')}</p>
    <div class="card-pot"><span class="pot-label">Live pot</span><span class="pot-value">${formatMoney(bountyPot(bounty))}</span></div>
    <ul class="card-meta">
      <li>${bountyFeeLabel(bounty)}</li>
      <li>${plural(bounty.submissionCount ?? 0, 'entry', 'entries')}</li>
      <li><a href="#/bounty/${slug}/leaderboard">Leaderboard →</a></li>
    </ul>
    <p class="card-deadline"><span class="countdown" data-deadline="${escapeHtml(bounty.deadline ?? '')}">${formatTimeLeft(bounty.deadline)}</span>
      <span class="deadline-date">· ends ${formatDateTime(bounty.deadline)}</span></p>
  </article>`;
}

/** Apply search text, category and sort to the board items. */
export function filterAndSortBounties(items, { query, category, sort }) {
  const q = query.trim().toLowerCase();
  let out = items.filter((b) => {
    if (category !== 'all' && (b.category ?? '') !== category) return false;
    if (!q) return true;
    return `${b.title} ${b.summary ?? ''} ${b.category ?? ''} ${(b.skills ?? []).join(' ')}`
      .toLowerCase().includes(q);
  });
  out = [...out];
  if (sort === 'pot') out.sort((a, b) => Number(bountyPot(b) ?? 0) - Number(bountyPot(a) ?? 0));
  else if (sort === 'time') out.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  else if (sort === 'entries') out.sort((a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0));
  else if (sort === 'title') out.sort((a, b) => String(a.title).localeCompare(String(b.title)));
  return out;
}

/** Mount the bounty board into `root`; calls markReady once data is on screen. */
export function mountBoardView(root, markReady) {
  const state = { items: [], query: '', category: 'all', sort: 'pot', shown: BOARD_PAGE_SIZE };
  root.innerHTML = `
    <section class="board-head">
      <h1>Live bounty board</h1>
      <p class="lede" id="board-stats">Loading live bounties…</p>
      <div class="board-controls">
        <label class="control grow">Search
          <input id="board-search" type="search" placeholder="Search bounties, skills, categories…" autocomplete="off">
        </label>
        <label class="control">Category
          <select id="board-category"><option value="all">All categories</option></select>
        </label>
        <label class="control">Sort by
          <select id="board-sort">
            <option value="pot">Biggest pot</option>
            <option value="time">Ending soon</option>
            <option value="entries">Most entries</option>
            <option value="title">Title A–Z</option>
          </select>
        </label>
      </div>
    </section>
    <div id="board-list" class="card-grid" aria-live="polite"><p class="state">Loading bounties…</p></div>
    <div id="board-more" class="more-row"></div>`;

  const listEl = root.querySelector('#board-list');
  const statsEl = root.querySelector('#board-stats');
  const moreEl = root.querySelector('#board-more');
  const categoryEl = root.querySelector('#board-category');

  function renderList() {
    const visible = filterAndSortBounties(state.items, state);
    if (visible.length === 0) {
      listEl.innerHTML = '<p class="state">No bounties match. Try a different search or category.</p>';
      moreEl.innerHTML = '';
      return;
    }
    // Targeted update: only the card grid is re-rendered, controls keep focus.
    listEl.innerHTML = visible.slice(0, state.shown).map(bountyCard).join('');
    moreEl.innerHTML = visible.length > state.shown
      ? `<button type="button" id="board-show-more">Show more (${formatCount(visible.length - state.shown)} more)</button>`
      : '';
    const btn = moreEl.querySelector('#board-show-more');
    if (btn) btn.addEventListener('click', () => { state.shown += BOARD_PAGE_SIZE; renderList(); });
  }

  function renderBoard(data) {
    state.items = data.items ?? [];
    const totalPot = state.items.reduce((sum, b) => sum + Number(bountyPot(b) ?? 0), 0);
    const openCount = state.items.filter(isOpenForEntries).length;
    statsEl.textContent = `${state.items.length} bounties · ${openCount} still taking entries · ${formatMoney(totalPot)} in live pots`;
    const categories = [...new Set(state.items.map((b) => b.category).filter(Boolean))].sort();
    const current = categoryEl.value;
    categoryEl.innerHTML = '<option value="all">All categories</option>'
      + categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    categoryEl.value = categories.includes(current) ? current : 'all';
    state.category = categoryEl.value;
    renderList();
    markReady();
  }

  root.querySelector('#board-search').addEventListener('input', (e) => {
    state.query = e.target.value; state.shown = BOARD_PAGE_SIZE; renderList();
  });
  categoryEl.addEventListener('change', (e) => {
    state.category = e.target.value; state.shown = BOARD_PAGE_SIZE; renderList();
  });
  root.querySelector('#board-sort').addEventListener('change', (e) => {
    state.sort = e.target.value; state.shown = BOARD_PAGE_SIZE; renderList();
  });

  loadWithRevalidate(fetchBountyBoard(), renderBoard, (err) => {
    listEl.innerHTML = `<div class="state state-error"><p>${escapeHtml(err.message)}</p><button type="button" onclick="location.reload()">Retry</button></div>`;
    markReady();
  });
}

/** Render a description's light markdown (headings, lists, bold, code, links) from escaped text. */
export function renderDescriptionMarkdown(text) {
  const lines = escapeHtml(text ?? '').split('\n');
  const out = [];
  let listOpen = false;
  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };
  const inline = (s) => s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s/.test(trimmed)) {
      closeList();
      const level = trimmed.startsWith('###') ? 3 : 2;
      out.push(`<h${level}>${inline(trimmed.replace(/^#{1,3}\s+/, ''))}</h${level}>`);
    } else if (/^[-*]\s/.test(trimmed)) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push(`<li>${inline(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
    } else if (trimmed === '') {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(trimmed)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

/** The rewards table rows: live amounts from rewardsNow, falling back to the base rewards map. */
export function rewardsTableRows(bounty) {
  if (Array.isArray(bounty.rewardsNow) && bounty.rewardsNow.length > 0) {
    return bounty.rewardsNow.map((r) => `
      <tr><td>#${r.place}</td><td>${formatMoney(r.baseUsd)}</td>
      <td>${formatMoney(r.feeShareUsd ?? 0)}</td><td class="num-strong">${formatMoney(r.amountUsd)}</td></tr>`).join('');
  }
  const rewards = bounty.rewards ?? {};
  return Object.keys(rewards).sort((a, b) => Number(a) - Number(b)).map((place) => `
    <tr><td>#${place}</td><td>${formatMoney(rewards[place])}</td><td>—</td>
    <td class="num-strong">${formatMoney(rewards[place])}</td></tr>`).join('');
}

/** Normalise a rules field (string, list of strings, or list of objects) to HTML list items. */
export function rulesListItems(rules) {
  if (!rules) return '';
  const items = Array.isArray(rules) ? rules : String(rules).split('\n');
  return items.map((item) => {
    const text = typeof item === 'string' ? item : (item.text ?? item.title ?? JSON.stringify(item));
    return text && String(text).trim() ? `<li>${escapeHtml(text)}</li>` : '';
  }).join('');
}

/** Mount one bounty page into `root`; calls markReady once data is on screen. */
export function mountBountyView(root, slug, markReady) {
  root.innerHTML = '<p class="state">Loading bounty…</p>';
  loadWithRevalidate(competitionPath(slug), (b) => {
    const rules = rulesListItems(b.rules);
    const skills = (b.skills ?? []).map((s) => `<span class="chip">${escapeHtml(s)}</span>`).join(' ');
    root.innerHTML = `
    <p class="crumbs"><a href="#/">← All bounties</a> · <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a></p>
    <article class="bounty-page">
      <div class="card-top"><span class="chip">${escapeHtml(b.category ?? 'Bounty')}</span> ${bountyStatusPill(b)}
        ${b.sponsor?.name ? `<span class="sponsor">by ${escapeHtml(b.sponsor.name)}${b.sponsor.isVerified ? ' ✓' : ''}</span>` : ''}</div>
      <h1>${escapeHtml(b.title)}</h1>
      <p class="lede">${escapeHtml(b.summary ?? '')}</p>
      <section class="stat-grid" aria-label="Bounty facts">
        <div class="stat"><span class="stat-label">Live pot</span><span class="stat-value pot-value">${formatMoney(bountyPot(b))}</span>
          <span class="stat-note">prize ${formatMoney(b.rewardAmount)} + ${formatMoney(b.entryFeesUsd ?? 0)} in fees</span></div>
        <div class="stat"><span class="stat-label">Entry fee</span><span class="stat-value">${b.entryFeeUsd ? formatMoney(b.entryFeeUsd) : 'Free'}</span>
          <span class="stat-note">${formatCount(b.entryFeePayers ?? 0)} fee payers</span></div>
        <div class="stat"><span class="stat-label">Entries</span><span class="stat-value">${formatCount(b.submissionCount ?? 0)}</span>
          <span class="stat-note"><a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard →</a></span></div>
        <div class="stat"><span class="stat-label">Time left</span>
          <span class="stat-value countdown" data-deadline="${escapeHtml(b.deadline ?? '')}">${formatTimeLeft(b.deadline)}</span>
          <span class="stat-note">deadline ${formatDateTime(b.deadline)}</span></div>
      </section>
      ${skills ? `<p class="skills">${skills}</p>` : ''}
      <h2>Rewards — paid from the live pot of ${formatMoney(bountyPot(b))}</h2>
      <div class="table-wrap"><table class="data-table rewards-table">
        <thead><tr><th>Place</th><th>Base prize</th><th>Share of entry fees</th><th>Pays now</th></tr></thead>
        <tbody>${rewardsTableRows(b)}</tbody>
      </table></div>
      <h2>Key dates</h2>
      <dl class="dates">
        ${b.publishedAt ? `<div><dt>Published</dt><dd>${formatDateTime(b.publishedAt)}</dd></div>` : ''}
        ${b.opensAt ? `<div><dt>Entries opened</dt><dd>${formatDateTime(b.opensAt)}</dd></div>` : ''}
        <div><dt>Deadline</dt><dd>${formatDateTime(b.deadline)} (${formatTimeLeft(b.deadline)})</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(b.status ?? '')}${b.acceptingSubmissions === false ? ' · not accepting submissions' : ''}</dd></div>
      </dl>
      ${rules ? `<h2>Rules</h2><ul class="rules">${rules}</ul>` : ''}
      ${b.rulesNote ? `<p class="note">${escapeHtml(b.rulesNote)}</p>` : ''}
      <h2>About this bounty</h2>
      <div class="description">${renderDescriptionMarkdown(b.description ?? '')}</div>
    </article>`;
    document.title = `${b.title} | make.fun bounties`;
    markReady();
  }, (err) => {
    root.innerHTML = `<div class="state state-error"><p>${escapeHtml(err.message)}</p><p><a href="#/">Back to the board</a></p></div>`;
    markReady();
  });
}
