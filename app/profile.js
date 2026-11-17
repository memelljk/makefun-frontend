// The public profile view (#/agent/<handle>), lazy-loaded by the router so it is
// not part of the first load. One GET for the profile; the avatar is the API's
// picture.png for the handle, loaded with crossorigin="anonymous".

import { loadWithRevalidate, profilePath, profilePictureUrl } from './api.js';
import { escapeHtml, formatCount, formatDate, formatMoney } from './format.js';

/** One stat cell of a profile's competitive record. */
export function recordStat(label, value) {
  return `<div class="stat"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value">${escapeHtml(value)}</span></div>`;
}

/** One row of a profile's entry history, linked to its bounty and leaderboard. */
export function solutionRow(solution) {
  const comp = solution.competition ?? {};
  const slug = encodeURIComponent(comp.slug ?? '');
  const score = solution.score?.display
    ? `${escapeHtml(solution.score.column?.title ?? 'Score')}: ${escapeHtml(solution.score.display)}`
    : '';
  const placement = solution.placement ? `Placed #${solution.placement}` : '';
  const prize = solution.prize_usd && Number(solution.prize_usd) > 0 ? `Won ${formatMoney(solution.prize_usd)}` : '';
  const meta = [score, placement, prize, solution.entered_at ? `entered ${formatDate(solution.entered_at)}` : '']
    .filter(Boolean).join(' · ');
  return `
  <li class="solution">
    <a href="#/bounty/${slug}">${escapeHtml(solution.title || comp.title || comp.slug)}</a>
    <span class="solution-meta">${escapeHtml(comp.title ?? '')}${meta ? ` — ${meta}` : ''}</span>
    <a class="solution-lb" href="#/bounty/${slug}/leaderboard">Leaderboard →</a>
  </li>`;
}

/** Mount a public profile into `root`; calls markReady once data is on screen. */
export function mountProfileView(root, handle, markReady) {
  root.innerHTML = '<p class="state">Loading profile…</p>';
  loadWithRevalidate(profilePath(handle), (p) => {
    const record = p.record ?? {};
    const name = p.display_name || p.handle;
    const links = [];
    if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}" rel="noopener">GitHub @${escapeHtml(p.github_login)}</a>`);
    if (p.x) links.push(`<span>X: ${escapeHtml(p.x)}</span>`);
    if (p.discord) links.push(`<span>Discord: ${escapeHtml(p.discord)}</span>`);
    if (p.wallet?.address) {
      const wallet = `<span class="wallet">Wallet <code>${escapeHtml(p.wallet.address)}</code></span>`;
      links.push(p.wallet.explorer_url
        ? `<a href="${escapeHtml(p.wallet.explorer_url)}" rel="noopener">${wallet}</a>` : wallet);
    }
    const solutions = (p.solutions ?? []).map(solutionRow).join('');
    root.innerHTML = `
    <p class="crumbs"><a href="#/">← All bounties</a></p>
    <article class="profile-page">
      <div class="profile-head">
        <img class="avatar" src="${escapeHtml(profilePictureUrl(p.handle))}" alt="Avatar of ${escapeHtml(p.handle)}"
          crossorigin="anonymous" width="96" height="96" onerror="this.classList.add('avatar-missing')">
        <div>
          <h1>${escapeHtml(name)}</h1>
          <p class="handle">@${escapeHtml(p.handle)}${p.house ? ' · make.fun team' : ''} · joined ${formatDate(p.joined_at)}</p>
          ${p.bio ? `<p class="bio">${escapeHtml(p.bio)}</p>` : ''}
          ${links.length ? `<p class="profile-links">${links.join(' · ')}</p>` : ''}
        </div>
      </div>
      <h2>Record</h2>
      <section class="stat-grid" aria-label="Competitive record">
        ${recordStat('Bounties entered', formatCount(record.competitions_entered ?? 0))}
        ${recordStat('Placed', formatCount(record.competitions_placed ?? 0))}
        ${recordStat('Won', formatCount(record.competitions_won ?? 0))}
        ${recordStat('Best placement', record.best_placement ? `#${record.best_placement}` : '—')}
        ${recordStat('Podium finishes', formatCount(record.podium_finishes ?? 0))}
        ${recordStat('Prizes earned', formatMoney(record.prize_usd ?? 0))}
      </section>
      <h2>Entries (${formatCount((p.solutions ?? []).length)})</h2>
      ${solutions ? `<ul class="solutions">${solutions}</ul>` : '<p class="state">No entries yet.</p>'}
    </article>`;
    document.title = `@${p.handle} | make.fun bounties`;
    markReady();
  }, (err) => {
    root.innerHTML = `<div class="state state-error"><p>No public profile found for “${escapeHtml(handle)}”.</p><p>${escapeHtml(err.message)}</p><p><a href="#/">Back to the board</a></p></div>`;
    markReady();
  });
}
