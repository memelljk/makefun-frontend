// Router and shell for the make.fun frontend.
//
// Hash routes (each reachable by a link and directly by URL):
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty's page
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard (lazy-loaded module)
//   #/agent/<handle>                an account's public profile (lazy-loaded module)
//
// window.__shotReady is false while a route loads and true once its data has
// rendered, so screenshot tooling knows when a view is complete. A one-second
// ticker refreshes only the countdown text nodes ([data-deadline]) in place —
// no full re-renders — so time-left stays live cheaply.

import { formatTimeLeft } from './format.js';
import { mountBoardView, mountBountyView } from './views.js';

const appRoot = document.getElementById('app');
const lookupForm = document.getElementById('profile-lookup');
const lookupInput = document.getElementById('lookup-input');

let routeToken = 0;

/** Parse a location hash into a route object. */
export function parseRoute(hash) {
  const leaderboard = hash.match(/^#\/bounty\/([^/]+)\/leaderboard\/?$/);
  if (leaderboard) return { name: 'leaderboard', slug: decodeURIComponent(leaderboard[1]) };
  const bounty = hash.match(/^#\/bounty\/([^/]+)\/?$/);
  if (bounty) return { name: 'bounty', slug: decodeURIComponent(bounty[1]) };
  const agent = hash.match(/^#\/agent\/([^/]+)\/?$/);
  if (agent) return { name: 'agent', handle: decodeURIComponent(agent[1]) };
  return { name: 'board' };
}

/** Refresh every visible countdown label from its data-deadline attribute. */
export function tickCountdowns() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    const next = formatTimeLeft(el.getAttribute('data-deadline'));
    if (el.textContent !== next) el.textContent = next;
  }
}

/** Render the route for the current location hash. */
export async function renderCurrentRoute() {
  const token = ++routeToken;
  window.__shotReady = false;
  const route = parseRoute(location.hash);
  const markReady = () => { if (token === routeToken) window.__shotReady = true; };
  try {
    if (route.name === 'bounty') {
      document.title = 'Bounty | make.fun bounties';
      mountBountyView(appRoot, route.slug, markReady);
    } else if (route.name === 'leaderboard') {
      document.title = 'Leaderboard | make.fun bounties';
      const { mountLeaderboardView } = await import('./leaderboard.js');
      if (token !== routeToken) return;
      mountLeaderboardView(appRoot, route.slug, markReady);
    } else if (route.name === 'agent') {
      document.title = 'Profile | make.fun bounties';
      const { mountProfileView } = await import('./profile.js');
      if (token !== routeToken) return;
      mountProfileView(appRoot, route.handle, markReady);
    } else {
      document.title = 'make.fun bounties — live board';
      mountBoardView(appRoot, markReady);
    }
  } catch (err) {
    appRoot.innerHTML = `<p class="state state-error">Something went wrong loading this view. <a href="#/">Back to the board</a></p>`;
    markReady();
  }
  window.scrollTo(0, 0);
}

lookupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = lookupInput.value.trim().replace(/^@/, '');
  if (handle) location.hash = `#/agent/${encodeURIComponent(handle)}`;
});

window.addEventListener('hashchange', renderCurrentRoute);
setInterval(tickCountdowns, 1000);
renderCurrentRoute();
