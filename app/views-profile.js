// views-profile.js — an account's public profile, lazy-loaded by main.js
// through a literal import() the first time a profile route is opened.
// Everything shown comes from the public /profiles/<handle> answer: who
// they are, their record across every bounty, and each solution they have
// entered with where it placed.

import { profile, mediaUrl } from './api.js';
import { money, count, dateTime, esc } from './format.js';

function stat(label, value) {
  return '<p class="stat"><small>' + esc(label) + '</small><strong>' + esc(value) + '</strong></p>';
}

function solutionHtml(s) {
  const c = s.competition || {};
  const placed = s.placement != null ? 'Placed #' + s.placement : 'Not placed yet';
  const prize = s.prize_usd != null && Number.parseFloat(s.prize_usd) > 0 ? ' · won ' + money(s.prize_usd) : '';
  const score = s.score && s.score.display != null
    ? ' · ' + esc(s.score.column?.title || 'Score') + ': ' + esc(s.score.display) : '';
  return '<li><a href="#/bounty/' + esc(c.slug) + '"><b>' + esc(s.title || c.title || 'Entry') + '</b></a>'
    + '<br><span>' + esc(c.title || '') + ' — ' + placed + prize + score + '</span>'
    + '<br><span>Entered ' + esc(dateTime(s.entered_at)) + '</span></li>';
}

export async function profileView(view, handle) {
  view.innerHTML = '<p class="loading">Loading this profile…</p>';
  const render = (p) => {
    const name = p.display_name || p.handle;
    const picture = p.image || p.avatar;
    const avatar = picture
      ? '<span class="avatar"><img crossorigin="anonymous" alt="" src="' + esc(mediaUrl(picture)) + '"></span>'
      : '<span class="avatar" aria-hidden="true">' + esc((name || '?').charAt(0).toUpperCase()) + '</span>';
    const links = [];
    if (p.github_login) links.push('<a href="https://github.com/' + esc(p.github_login) + '">GitHub: ' + esc(p.github_login) + '</a>');
    if (p.x) links.push('<a href="https://x.com/' + esc(String(p.x).replace(/^@/, '')) + '">X: ' + esc(p.x) + '</a>');
    if (p.discord) links.push('<span>Discord: ' + esc(p.discord) + '</span>');
    if (p.wallet?.explorer_url) links.push('<a href="' + esc(p.wallet.explorer_url) + '">Wallet ' + esc(p.wallet.address.slice(0, 6)) + '…' + esc(p.wallet.address.slice(-4)) + '</a>');
    const r = p.record || {};
    view.innerHTML = '<p><a href="#/">← All bounties</a></p>'
      + '<div class="profile-head">' + avatar + '<div>'
      + '<h1>' + esc(name) + '</h1>'
      + '<p class="lede">@' + esc(p.handle)
      + (p.house ? ' · house account' : '') + (p.demo ? ' · demo' : '')
      + ' · joined ' + esc(dateTime(p.joined_at)) + '</p>'
      + (p.bio ? '<p>' + esc(p.bio) + '</p>' : '')
      + '</div></div>'
      + (links.length ? '<p class="links">' + links.join('') + '</p>' : '')
      + '<h2>Record</h2><section class="stat-row" aria-label="Competition record">'
      + stat('Entered', count(r.competitions_entered))
      + stat('Placed', count(r.competitions_placed))
      + stat('Won', count(r.competitions_won))
      + stat('Podiums', count(r.podium_finishes))
      + stat('Best placement', r.best_placement != null ? '#' + r.best_placement : '—')
      + stat('Prizes', money(r.prize_usd))
      + '</section>'
      + '<h2>Solutions</h2>'
      + ((p.solutions && p.solutions.length)
        ? '<ul class="solutions">' + p.solutions.map(solutionHtml).join('') + '</ul>'
        : '<p class="empty">No entries yet.</p>');
    window.__shotReady = true;
  };
  render(await profile(handle, render));
}
