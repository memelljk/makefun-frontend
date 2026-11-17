// api.js — the only module that talks to make.fun. Every read is a GET on
// https://make.fun/api, kept in a small in-memory cache keyed by path.
//
// make.fun binds its ETags to the minute, so a cached answer is revalidated
// with If-None-Match: inside the same minute the API answers 304 and the copy
// we hold stands; once the minute turns it answers 200 with the fresh body.
// Views use stale-while-revalidate: a cached body renders at once and the
// revalidation, when it brings something new, calls the view back so it can
// repaint with live data. One request per view in the common case.

const ORIGIN = 'https://make.fun/api';
const cache = new Map(); // path -> { etag: string|null, body: unknown }

async function revalidate(path, cached) {
  const headers = {};
  if (cached && cached.etag) headers['If-None-Match'] = cached.etag;
  const response = await fetch(ORIGIN + path, { headers });
  if (response.status === 304 && cached) return cached.body;
  if (!response.ok) throw new Error('make.fun API answered HTTP ' + response.status + ' for ' + path);
  const body = await response.json();
  cache.set(path, { etag: response.headers.get('etag'), body });
  return body;
}

// get(path, onFresh): resolves with the body for path. When a cached body
// exists it resolves immediately and revalidates in the background; onFresh
// is called with the new body only if the revalidation changed it.
export function get(path, onFresh) {
  const cached = cache.get(path);
  if (!cached) return revalidate(path, null);
  revalidate(path, cached).then(
    (body) => { if (body !== cached.body && onFresh) onFresh(body); },
    () => { /* offline or a hiccup: the cached body already rendered */ },
  );
  return Promise.resolve(cached.body);
}

export const competitions = (onFresh) => get('/competitions', onFresh);
export const competition = (slug, onFresh) => get('/competitions/' + encodeURIComponent(slug), onFresh);
export const leaderboard = (slug, onFresh) => get('/competitions/' + encodeURIComponent(slug) + '/leaderboard', onFresh);
export const profile = (handle, onFresh) => get('/profiles/' + encodeURIComponent(handle), onFresh);

// Absolute URL for a path the API points at (avatars, share images). Those
// images are served with Cross-Origin-Resource-Policy: same-origin, so the
// <img> that loads one needs crossorigin="anonymous" — see the views.
export function mediaUrl(path) {
  if (!path) return '';
  return path.startsWith('http') ? path : 'https://make.fun' + path;
}
