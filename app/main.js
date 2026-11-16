// Router + page state for make.fun lite. One fetch per view, views rendered
// in place (no full page rebuild), countdowns ticked by touching text nodes.
import { listCompetitions, getCompetition, getLeaderboard, getProfile } from './api.js';
import { boardView, bountyView, loadingView, errorView } from './views.js';
import { timeLeft } from './format.js';

const view = document.getElementById('view');
const boardState = { items: [], cursor: null, q: '', sort: 'pot' };

function shotReady(value) {
  window.__shotReady = value;
}

function parseHash() {
  const hash = window.location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'board' };
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') return { name: 'leaderboard', slug: parts[1] };
  if (parts[0] === 'bounty' && parts[1]) return { name: 'bounty', slug: parts[1] };
  if (parts[0] === 'u' && parts[1]) return { name: 'profile', handle: parts[1] };
  return { name: 'board' };
}

function sortItems(items, sort) {
  const copy = items.slice();
  if (sort === 'pot') copy.sort((a, b) => Number(b.potUsd ?? b.rewardAmount ?? 0) - Number(a.potUsd ?? a.rewardAmount ?? 0));
  if (sort === 'soon') copy.sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0));
  if (sort === 'entries') copy.sort((a, b) => Number(b.submissionCount || 0) - Number(a.submissionCount || 0));
  if (sort === 'new') copy.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  return copy;
}

function filterItems(items, q) {
  const needle = q.trim().toLowerCase();
  if (!needle) return items;
  return items.filter((c) => ((c.title || '') + ' ' + (c.category || '')).toLowerCase().includes(needle));
}

function renderBoard() {
  const shown = sortItems(filterItems(boardState.items, boardState.q), boardState.sort);
  view.innerHTML = boardView(shown, boardState.cursor, boardState);
  const q = document.getElementById('board-q');
  const sort = document.getElementById('board-sort');
  const more = document.getElementById('more-btn');
  if (q) q.addEventListener('input', () => { boardState.q = q.value; renderBoardKeepFocus(); });
  if (sort) sort.addEventListener('change', () => { boardState.sort = sort.value; renderBoard(); });
  if (more) more.addEventListener('click', loadMoreBoard);
  const count = document.getElementById('board-count');
  if (count) count.textContent = shown.length + ' of ' + boardState.items.length + ' loaded';
}

// Re-render after typing without stealing the search box's focus.
function renderBoardKeepFocus() {
  const pos = document.getElementById('board-q');
  const start = pos ? pos.selectionStart : 0;
  renderBoard();
  const next = document.getElementById('board-q');
  if (next) {
    next.focus();
    try { next.setSelectionRange(start, start); } catch (_e) { /* older browsers */ }
  }
}

async function loadMoreBoard() {
  if (!boardState.cursor) return;
  const btn = document.getElementById('more-btn');
  if (btn) btn.disabled = true;
  try {
    const page = await listCompetitions(boardState.cursor);
    boardState.items = boardState.items.concat(page.items || []);
    boardState.cursor = page.next_cursor || null;
    renderBoard();
  } catch (err) {
    if (btn) btn.disabled = false;
    view.insertAdjacentHTML('beforeend', '<p class="error">Could not load more: ' + err.message + '</p>');
  }
}

async function route() {
  shotReady(false);
  const r = parseHash();
  window.scrollTo(0, 0);
  try {
    if (r.name === 'board') {
      if (boardState.items.length === 0) {
        view.innerHTML = loadingView('Loading live bounties…');
        const page = await listCompetitions(null);
        boardState.items = page.items || [];
        boardState.cursor = page.next_cursor || null;
      }
      renderBoard();
    } else if (r.name === 'bounty') {
      view.innerHTML = loadingView('Loading bounty…');
      const d = await getCompetition(r.slug);
      view.innerHTML = bountyView(d);
    } else if (r.name === 'leaderboard') {
      view.innerHTML = loadingView('Loading leaderboard…');
      const { leaderboardView } = await import('./views-extra.js');
      const lb = await getLeaderboard(r.slug);
      view.innerHTML = leaderboardView(lb);
    } else if (r.name === 'profile') {
      view.innerHTML = loadingView('Loading profile…');
      const { profileView } = await import('./views-extra.js');
      const p = await getProfile(r.handle);
      view.innerHTML = profileView(p);
    }
  } catch (err) {
    view.innerHTML = errorView(err.message);
  }
  shotReady(true);
}

// Countdowns tick once a second by touching only the time-left text nodes.
setInterval(() => {
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    el.textContent = timeLeft(el.getAttribute('data-countdown'));
  });
}, 1000);

window.addEventListener('hashchange', route);
route();
