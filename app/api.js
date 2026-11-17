// api.js — the one module that talks to make.fun. Every read is a GET on
// https://make.fun/api, held in a small in-memory cache keyed by path.
// make.fun binds its ETags to the minute. A cached answer is revalidated
// with If-None-Match: inside the same minute the API answers 304 and the
// copy we hold stands; once the minute turns it answers 200 with a fresh
// body. Views read stale-while-revalidate: a cached body renders at once,
// the revalidation runs behind it, and only a body that actually changed
// calls the view back to repaint. One request per view in the usual case.
// A fetch that stalls is cut off after fifteen seconds, so a view fails
// fast with its error state instead of sitting on "Loading…" forever.

const API_ORIGIN = 'https://make.fun/api';
const TIMEOUT_MS = 15000;

// path -> { etag, body }
const store = new Map();

const fetchPath = async (path, headers) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_ORIGIN}${path}`, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  } // timeout
}; // fetchPath

const refresh = async (path, cached) => {
  const headers = cached?.etag ? { 'If-None-Match': cached.etag } : {};
  const response = await fetchPath(path, headers);
  if (cached && response.status === 304) return cached.body;
  if (!response.ok) throw new Error(`make.fun API answered HTTP ${response.status} for ${path}`);
  const fresh = await response.json();
  const etag = response.headers.get('etag');
  store.set(path, { etag, body: fresh });
  return fresh;
}; // refresh

// get(path, onFresh) resolves with the body for path. A cached body
// resolves at once while a revalidation runs in the background; onFresh is
// called with the new body only when the revalidation changed it.
export const get = async (path, onFresh) => {
  const cached = store.get(path);
  if (!cached) return refresh(path, null);
  void (async () => {
    try {
      const body = await refresh(path, cached);
      if (body !== cached.body && onFresh) onFresh(body);
    } catch {
      // Offline or a hiccup: the cached body already rendered.
    } // revalidate
  })();
  return cached.body;
}; // get

const endpoint = (path) => (onFresh) => get(path, onFresh);

export const competitions = endpoint('/competitions');
export const competition = (slug, onFresh) => get(`/competitions/${encodeURIComponent(slug)}`, onFresh);
export const leaderboard = (slug, onFresh) => get(`/competitions/${encodeURIComponent(slug)}/leaderboard`, onFresh);
export const profile = (handle, onFresh) => get(`/profiles/${encodeURIComponent(handle)}`, onFresh);

// Turn a path the API points at into an absolute URL (avatars, share
// images). Those images are served with Cross-Origin-Resource-Policy:
// same-origin, so the <img> loading one needs crossorigin="anonymous" —
// see the views.
export const mediaUrl = (path) => path
  ? (path.startsWith('http') ? path : `https://make.fun${path}`)
  : '';
