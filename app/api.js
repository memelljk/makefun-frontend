// Data layer for make.fun's public read-only API (https://make.fun/api, CORS open).
//
// Performance strategy, matched to how the API behaves:
//  - ETag revalidation: every response's ETag is stored and sent back as
//    If-None-Match; the API's ETags are minute-bound, so a 304 within the same
//    minute costs no body transfer and is treated as fresh data.
//  - In-memory cache with stale-while-revalidate: a cached response renders
//    instantly, then one background revalidation refreshes the view only when
//    the payload actually changed.
//  - One request per view: board, bounty, leaderboard and profile each need a
//    single GET (the leaderboard view adds the bounty GET for its prize table).

export const API_BASE = 'https://make.fun/api';

/** How long a cached payload is served without any network check at all. */
const FRESH_MS = 20_000;

/** The cache is a session convenience, not a store: past this many URLs the
 *  oldest entries are evicted, so a long browsing session stays bounded. */
const MAX_CACHE_ENTRIES = 64;

/** Backoff between retries of a transient failure (network error, 502–504). */
const RETRY_DELAYS_MS = [300, 900];

/** One attempt's budget: a hung connection must not hang a view forever. */
const REQUEST_TIMEOUT_MS = 10_000;

/** url -> { etag, data, fetchedAt } for every successful GET this session. */
const responseCache = new Map();

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Store a response in the bounded cache, evicting the oldest URLs first. */
function rememberResponse(url, entry) {
  responseCache.delete(url);
  responseCache.set(url, entry);
  while (responseCache.size > MAX_CACHE_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value);
  }
}

/**
 * fetch() with a per-attempt timeout and bounded retries: a network error or
 * a transient 502/503/504 is retried after a short backoff; anything else is
 * returned (or thrown) at once so the caller's own fallbacks decide.
 */
async function fetchWithRetry(url, headers) {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      const transient = res.status === 502 || res.status === 503 || res.status === 504;
      if (!transient || attempt >= RETRY_DELAYS_MS.length) return res;
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
    } finally {
      clearTimeout(timer);
    }
    await sleep(RETRY_DELAYS_MS[attempt]);
  }
}

/** Build the absolute API URL for a path like '/competitions'. */
export function apiUrl(path) {
  return API_BASE + path;
}

/** The public avatar URL for a profile handle (an image, not JSON). */
export function profilePictureUrl(handle) {
  return `${API_BASE}/profiles/${encodeURIComponent(handle)}/picture.png`;
}

/**
 * GET JSON from the API with ETag revalidation.
 * Returns the parsed body; throws an Error with a readable message on failure.
 */
export async function fetchJson(path) {
  const url = apiUrl(path);
  const hit = responseCache.get(url);
  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetchWithRetry(url, headers);
  } catch {
    if (hit) return hit.data;
    throw new Error('Could not reach make.fun. Check your connection and try again.');
  }
  if (res.status === 304 && hit) {
    hit.fetchedAt = Date.now();
    return hit.data;
  }
  if (!res.ok) {
    if (hit && res.status >= 500) return hit.data;
    throw new Error(`make.fun answered ${res.status} for this page.`);
  }
  const data = await res.json();
  rememberResponse(url, { etag: res.headers.get('etag'), data, fetchedAt: Date.now() });
  return data;
}

/**
 * Stale-while-revalidate load: calls onData(data, { stale }) with the cached
 * copy immediately when one exists, then again with the revalidated copy when
 * it differs. Calls onError only when there is nothing cached to show.
 */
export function loadWithRevalidate(path, onData, onError) {
  const url = apiUrl(path);
  const hit = responseCache.get(url);
  if (hit) {
    onData(hit.data, { stale: true });
    if (Date.now() - hit.fetchedAt < FRESH_MS) return;
    fetchJson(path)
      .then((fresh) => { if (fresh !== hit.data) onData(fresh, { stale: false }); })
      .catch(() => { /* the stale copy stays on screen */ });
    return;
  }
  fetchJson(path).then((data) => onData(data, { stale: false })).catch(onError);
}

/** The open bounty board: { items: [...] } with live pots, fees and deadlines. */
export function fetchBountyBoard() {
  return '/competitions?status=open&activity=times';
}

/** One competition by slug: summary, description, rules, rewards and dates. */
export function competitionPath(slug) {
  return `/competitions/${encodeURIComponent(slug)}`;
}

/** One competition's leaderboard: { competition, columns, entries: [...] }. */
export function leaderboardPath(slug) {
  return `/competitions/${encodeURIComponent(slug)}/leaderboard`;
}

/** One account's public profile by handle. */
export function profilePath(handle) {
  return `/profiles/${encodeURIComponent(handle)}`;
}
