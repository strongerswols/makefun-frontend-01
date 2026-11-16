// Pure view renderers: data in, HTML string out. No fetching here.
// Every link below is a hash route the router in main.js understands.
import { abs } from './api.js';
import { esc, usd, usdExact, feeLabel, fmtDate, timeLeft, timeAgo, isOpen, winRate, bytesLabel } from './format.js';

// A small, safe markdown subset for bounty descriptions: headings, bold,
// italic, inline code, links, lists and paragraphs. Input is escaped first,
// so no raw HTML from the API can ever execute.
export function md(src) {
  const lines = String(src || '').split('\n');
  let out = '';
  let list = null;
  const flushList = () => {
    if (list) { out += list === 'ul' ? '</ul>' : '</ol>'; list = null; }
  };
  const inline = (text) => {
    let t = esc(text);
    t = t.replace(/`([^`]+)`/g, (_m, code) => '<code>' + code + '</code>');
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, (_m, label, href) => '<a href="' + href + '">' + label + '</a>');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return t;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^#{1,3}\s/.test(line)) {
      flushList();
      const level = line.match(/^#+/)[0].length;
      out += '<h' + (level + 1) + '>' + inline(line.replace(/^#+\s*/, '')) + '</h' + (level + 1) + '>';
    } else if (/^[-*]\s+/.test(line)) {
      if (list !== 'ul') { flushList(); out += '<ul>'; list = 'ul'; }
      out += '<li>' + inline(line.replace(/^[-*]\s+/, '')) + '</li>';
    } else if (/^\d+[.)]\s+/.test(line)) {
      if (list !== 'ol') { flushList(); out += '<ol>'; list = 'ol'; }
      out += '<li>' + inline(line.replace(/^\d+[.)]\s+/, '')) + '</li>';
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      out += '<p>' + inline(line) + '</p>';
    }
  }
  flushList();
  return out;
}

export function loadingView(text) {
  return '<p class="loading" role="status">' + esc(text || 'Loading live data from make.fun…') + '</p>';
}

export function errorView(message) {
  return '<div class="error" role="alert"><p><strong>Could not load live data.</strong></p><p>'
    + esc(message || 'make.fun did not answer.') + '</p><p><a href="#/">Back to the board</a></p></div>';
}

function bountyCard(c) {
  const open = isOpen(c);
  const fee = feeLabel(c.entryFeeUsd);
  return '<article class="card">'
    + '<h3><a href="#/bounty/' + esc(c.slug) + '">' + esc(c.title) + '</a></h3>'
    + '<p class="meta">' + esc(c.category || '') + (c.sponsor && c.sponsor.name ? ' · by ' + esc(c.sponsor.name) : '') + '</p>'
    + '<div class="stats">'
    + '<div class="pot"><b>' + usd(c.potUsd ?? c.rewardAmount) + '</b><span>live pot</span></div>'
    + '<div><b>' + esc(fee) + '</b><span>entry fee</span></div>'
    + '<div><b data-countdown="' + esc(c.deadline || '') + '">' + esc(timeLeft(c.deadline)) + '</b><span>time left</span></div>'
    + '<div><b>' + Number(c.submissionCount || 0).toLocaleString('en-US') + '</b><span>entries</span></div>'
    + '</div>'
    + '<p class="row" style="margin:10px 0 0"><span class="chip ' + (open ? 'open' : 'closed') + '">' + (open ? 'Open' : 'Closed') + '</span>'
    + '<a href="#/bounty/' + esc(c.slug) + '/leaderboard">Leaderboard →</a></p>'
    + '</article>';
}

export function boardView(items, cursor, state) {
  const cards = items.map(bountyCard).join('');
  const more = cursor
    ? '<div class="center"><button class="btn ghost" id="more-btn" type="button">Load more bounties</button></div>'
    : '';
  return '<h1>Live bounties</h1>'
    + '<p class="lede">Every bounty below is live on make.fun right now — pot, entry fee, time left and entries, fetched fresh from the public API. Open one to see its rules, rewards and leaderboard.</p>'
    + '<div class="toolbar" role="search">'
    + '<input type="search" id="board-q" placeholder="Filter by title or category…" value="' + esc(state.q || '') + '" aria-label="Filter bounties">'
    + '<select id="board-sort" aria-label="Sort bounties">'
    + '<option value="pot"' + (state.sort === 'pot' ? ' selected' : '') + '>Biggest pot first</option>'
    + '<option value="soon"' + (state.sort === 'soon' ? ' selected' : '') + '>Ending soonest</option>'
    + '<option value="entries"' + (state.sort === 'entries' ? ' selected' : '') + '>Most entries</option>'
    + '<option value="new"' + (state.sort === 'new' ? ' selected' : '') + '>Newest first</option>'
    + '</select>'
    + '<span class="count" id="board-count">' + items.length + ' shown</span>'
    + '</div>'
    + '<div class="grid" id="board-grid">' + cards + '</div>'
    + more;
}

export function bountyView(d) {
  const open = isOpen(d);
  const fee = feeLabel(d.entryFeeUsd);
  const rewards = Array.isArray(d.rewardsNow) ? d.rewardsNow : [];
  const rewardRows = rewards.map((r) => '<tr><td>' + esc(r.place) + '</td><td class="num">' + usdExact(r.amountUsd) + '</td>'
    + '<td class="num hide-sm">' + usdExact(r.baseUsd) + '</td><td class="num hide-sm">' + usdExact(r.feeShareUsd) + '</td></tr>').join('');
  const subs = Array.isArray(d.submissions) ? d.submissions.slice(0, 10) : [];
  const subRows = subs.map((s) => '<tr><td><a href="#/u/' + esc(s.hunter) + '">' + esc(s.hunter) + '</a></td>'
    + '<td>' + esc(s.title || '—') + '</td>'
    + '<td><span class="chip ' + (s.status === 'passed' ? 'open' : '') + '">' + esc(s.status || '—') + '</span></td>'
    + '<td class="hide-sm">' + esc(timeAgo(s.createdAt)) + '</td></tr>').join('');
  return '<p><a href="#/">← All bounties</a></p>'
    + '<h1>' + esc(d.title) + '</h1>'
    + '<p class="lede">' + esc(d.summary || '') + '</p>'
    + '<p class="row"><span class="chip ' + (open ? 'open' : 'closed') + '">' + (open ? 'Accepting entries' : 'Closed') + '</span>'
    + '<span class="chip ' + (fee === 'Free' ? 'free' : 'paid') + '">' + esc(fee) + '</span>'
    + '<span class="small">Category: ' + esc(d.category || '—') + '</span>'
    + (d.sponsor && d.sponsor.name ? '<span class="small">Sponsor: ' + esc(d.sponsor.name) + '</span>' : '') + '</p>'
    + '<div class="stats" style="margin:14px 0">'
    + '<div class="pot"><b>' + usd(d.potUsd ?? d.rewardAmount) + '</b><span>live pot</span></div>'
    + '<div><b>' + Number(d.entryFeePayers || 0).toLocaleString('en-US') + '</b><span>fees paid</span></div>'
    + '<div><b data-countdown="' + esc(d.deadline || '') + '">' + esc(timeLeft(d.deadline)) + '</b><span>time left</span></div>'
    + '<div><b>' + Number(d.submissionCount || 0).toLocaleString('en-US') + '</b><span>entries</span></div>'
    + '</div>'
    + '<p class="small">Opens ' + esc(fmtDate(d.opensAt || d.publishedAt)) + ' · Deadline ' + esc(fmtDate(d.deadline)) + ' · Status: ' + esc(d.status || '—') + '</p>'
    + '<h2>Rewards</h2>'
    + (rewardRows
      ? '<table><thead><tr><th>Place</th><th class="num">Total</th><th class="num hide-sm">Base</th><th class="num hide-sm">Fee share</th></tr></thead><tbody>' + rewardRows + '</tbody></table>'
      : '<p class="small">No reward table published yet.</p>')
    + '<p class="row" style="margin-top:12px"><a class="btn" href="#/bounty/' + esc(d.slug) + '/leaderboard">See the leaderboard →</a>'
    + '<a class="btn ghost" href="' + esc(abs('/bounty/' + d.slug)) + '" target="_blank" rel="noopener">Open on make.fun ↗</a></p>'
    + '<h2>About this bounty</h2><div class="md">' + md(d.description || '') + '</div>'
    + (d.rules
      ? '<h2>Rules</h2><details class="rules"><summary>Read the full rules (' + Math.round(String(d.rules).length / 1024) + ' KB)</summary><pre>' + esc(d.rules) + '</pre></details>'
      : '')
    + (subRows
      ? '<h2>Latest entries</h2><table><thead><tr><th>Hunter</th><th>Entry</th><th>Status</th><th class="hide-sm">When</th></tr></thead><tbody>' + subRows + '</tbody></table>'
      : '');
}
