// views-profile.js — an account's public profile, loaded on demand by
// main.js through a literal import() the first time a profile route opens.
// What you see comes from the public /profiles/<handle> answer: who they
// are, their record across every bounty, and each solution they have
// entered with where it placed. External links open in a new tab with
// rel="noopener", and a wallet is linked only when the API gives both an
// address and an explorer URL for it.

import { mediaUrl } from './api.js';
import { profile } from './api.js';
import { count } from './format.js';
import { dateTime } from './format.js';
import { esc } from './format.js';
import { money } from './format.js';

const ready = () => { window.__shotReady = true; };

const loadingHtml = (what) => `<p class="loading">Fetching ${what}…</p>`;

const recordStat = (label, value) =>
  `<p class="stat"><small>${esc(label)}</small><strong>${esc(value)}</strong></p>`; // recordStat

const solutionRow = (s) => {
  const comp = s.competition || {};
  const placed = s.placement != null ? `Placed #${s.placement}` : 'Not placed yet';
  const prize = s.prize_usd != null && Number.parseFloat(s.prize_usd) > 0 ? ` · won ${money(s.prize_usd)}` : '';
  const score = s.score?.display != null
    ? ` · ${esc(s.score.column?.title || 'Score')}: ${esc(s.score.display)}` : '';
  return `<li><a href="#/bounty/${esc(comp.slug)}"><b>${esc(s.title || comp.title || 'Entry')}</b></a>
    <br><span>${esc(comp.title || '')} — ${placed}${prize}${score}</span>
    <br><span>Entered ${esc(dateTime(s.entered_at))}</span></li>`;
}; // solutionRow

export const profileView = async (view, handle) => {
  view.innerHTML = loadingHtml('this profile');
  const paint = (p) => {
    const { image, avatar } = p;
    const photo = image || avatar;
    const display = p.display_name || p.handle;
    let avatarHtml = `<span class="avatar" aria-hidden="true">${esc((display || '?').charAt(0).toUpperCase())}</span>`;
    if (photo) {
      avatarHtml = `<span class="avatar"><img crossorigin="anonymous" alt="" src="${esc(mediaUrl(photo))}"></span>`;
    } // photo
    const outlinks = [];
    if (p.github_login) {
      outlinks.push(`<a rel="noopener" target="_blank" href="https://github.com/${esc(p.github_login)}">GitHub: ${esc(p.github_login)}</a>`);
    } // github
    if (p.x) {
      outlinks.push(`<a rel="noopener" target="_blank" href="https://x.com/${esc(String(p.x).replace(/^@/, ''))}">X: ${esc(p.x)}</a>`);
    } // x
    if (p.discord) outlinks.push(`<span>Discord: ${esc(p.discord)}</span>`);
    const address = p.wallet?.address;
    if (address && p.wallet.explorer_url) {
      outlinks.push(`<a rel="noopener" target="_blank" href="${esc(p.wallet.explorer_url)}">Wallet ${esc(address.slice(0, 6))}…${esc(address.slice(-4))}</a>`);
    } // wallet
    const record = p.record || {};
    document.title = `${display || handle} (@${p.handle || handle}) — make.fun front`;
    view.innerHTML = `<p><a href="#/">← All bounties</a></p>
      <div class="profile-head">${avatarHtml}<div>
        <h1>${esc(display)}</h1>
        <p class="lede">@${esc(p.handle)}${p.house ? ' · house account' : ''}${p.demo ? ' · demo' : ''}
        · joined ${esc(dateTime(p.joined_at))}</p>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
      </div></div>
      ${outlinks.length ? `<p class="links">${outlinks.join('')}</p>` : ''}
      <h2>Record</h2><section class="stat-row" aria-label="Competition record">
        ${recordStat('Entered', count(record.competitions_entered))}
        ${recordStat('Placed', count(record.competitions_placed))}
        ${recordStat('Won', count(record.competitions_won))}
        ${recordStat('Podiums', count(record.podium_finishes))}
        ${recordStat('Best placement', record.best_placement != null ? `#${record.best_placement}` : '—')}
        ${recordStat('Prizes', money(record.prize_usd))}
      </section>
      <h2>Solutions</h2>
      ${p.solutions?.length
        ? `<ul class="solutions">${p.solutions.map(solutionRow).join('')}</ul>`
        : '<p class="empty">No entries yet.</p>'}`;
    ready();
  }; // paint
  paint(await profile(handle, paint));
}; // profileView
