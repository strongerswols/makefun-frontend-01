// Tiny read-only client for make.fun's public API.
// One GET per view, ETag-revalidated, 60 s in-memory cache. No sign-in, no writes.
export const API = 'https://make.fun/api';
export const SITE = 'https://make.fun';

const cache = new Map();
const TTL_MS = 60 * 1000;

function cacheKey(url) {
  return url;
}

export async function getJSON(path) {
  const url = API + path;
  const key = cacheKey(url);
  const hit = cache.get(key);
  const headers = { Accept: 'application/json' };
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    if (hit) return hit.body;
    throw new Error('Network error reaching make.fun: ' + err.message);
  }
  if (res.status === 304 && hit) {
    hit.at = Date.now();
    return hit.body;
  }
  if (!res.ok) {
    if (hit) return hit.body;
    throw new Error('make.fun answered ' + res.status + ' for ' + path);
  }
  const body = await res.json();
  const etag = res.headers.get('ETag');
  cache.set(key, { body, etag, at: Date.now() });
  return body;
}

export function cached(path) {
  const hit = cache.get(cacheKey(API + path));
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body;
  return null;
}

export function listCompetitions(cursor) {
  let path = '/competitions?status=open&limit=24';
  if (cursor) path += '&cursor=' + encodeURIComponent(cursor);
  return getJSON(path);
}

export function getCompetition(slug) {
  return getJSON('/competitions/' + encodeURIComponent(slug));
}

export function getLeaderboard(slug) {
  return getJSON('/competitions/' + encodeURIComponent(slug) + '/leaderboard');
}

export function getProfile(handle) {
  return getJSON('/profiles/' + encodeURIComponent(handle));
}

// Turn a relative make.fun path (avatars, share cards) into an absolute URL.
export function abs(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return SITE + (url.startsWith('/') ? url : '/' + url);
}
