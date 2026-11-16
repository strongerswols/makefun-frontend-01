// Leaderboard and profile views, loaded on demand: main.js imports this
// module only when the route needs it, so the first load stays small.
import { abs } from './api.js';
import { esc, usd, fmtDate, timeAgo, winRate, bytesLabel } from './format.js';

export function leaderboardView(lb) {
  const comp = lb.competition || {};
  const entries = Array.isArray(lb.entries) ? lb.entries : [];
  const rows = entries.map((e) => {
    const v = e.values || {};
    const img = e.image ? '<img src="' + esc(abs(e.image)) + '" alt="" crossorigin="anonymous" loading="lazy">' : '';
    const rate = winRate(v.judge);
    const interval = (v.judge_low !== undefined && v.judge_high !== undefined)
      ? winRate(v.judge_low) + ' – ' + winRate(v.judge_high) : '—';
    return '<tr><td class="num"><strong>' + esc(e.rank ?? '—') + '</strong></td>'
      + '<td><span class="who">' + img + '<a href="#/u/' + esc(e.handle) + '">' + esc(e.handle) + '</a></span></td>'
      + '<td>' + esc(e.title || '—') + '</td>'
      + '<td class="num"><strong>' + rate + '</strong></td>'
      + '<td class="num hide-sm">' + interval + '</td>'
      + '<td class="num hide-sm">' + bytesLabel(v.bytes) + '</td></tr>';
  }).join('');
  return '<p><a href="#/bounty/' + esc(comp.slug || '') + '">← ' + esc(comp.title || 'Bounty') + '</a></p>'
    + '<h1>Leaderboard</h1>'
    + '<p class="lede">' + esc(comp.title || '') + ' — ranked by judge win rate. Tap a hunter to open their public profile.</p>'
    + (rows
      ? '<table><thead><tr><th class="num">#</th><th>Hunter</th><th>Entry</th><th class="num">Win rate</th><th class="num hide-sm">90% interval</th><th class="num hide-sm">Size</th></tr></thead><tbody>' + rows + '</tbody></table>'
      : '<p class="small">No ranked entries yet — be the first to enter.</p>')
    + '<p class="small">Phase: ' + esc((lb.phase && lb.phase.title) || '—') + ' · ' + entries.length + ' entries shown.</p>';
}

export function profileView(p) {
  const rec = p.record || {};
  const sols = Array.isArray(p.solutions) ? p.solutions : [];
  const img = p.avatar && p.avatar.url ? p.avatar.url : p.image;
  const links = [];
  if (p.x && p.x.username) links.push('<a href="https://x.com/' + esc(p.x.username) + '">X @' + esc(p.x.username) + '</a>');
  if (p.github_login) links.push('<a href="https://github.com/' + esc(p.github_login) + '">GitHub ' + esc(p.github_login) + '</a>');
  if (p.wallet && p.wallet.address) links.push('<a href="' + esc(p.wallet.explorer_url || '') + '">Wallet ' + esc(String(p.wallet.address).slice(0, 6)) + '…' + esc(String(p.wallet.address).slice(-4)) + '</a>');
  const solRows = sols.map((s) => {
    const c = s.competition || {};
    const score = s.score && s.score.value !== undefined ? winRate(s.score.value) : '—';
    return '<tr><td><a href="#/bounty/' + esc(c.slug) + '">' + esc(c.title || c.slug || '—') + '</a></td>'
      + '<td>' + esc(s.title || '—') + '</td>'
      + '<td class="num">' + (s.placement ? '#' + esc(s.placement) : '—') + '</td>'
      + '<td class="num">' + (s.prize_usd ? usd(s.prize_usd) : '—') + '</td>'
      + '<td class="num hide-sm">' + score + '</td>'
      + '<td class="hide-sm">' + esc(timeAgo(s.entered_at)) + '</td></tr>';
  }).join('');
  return '<div class="profile-head">'
    + (img ? '<img class="avatar-lg" src="' + esc(abs(img)) + '" alt="" crossorigin="anonymous">' : '')
    + '<div class="id"><h1 style="margin:0">@' + esc(p.handle) + '</h1>'
    + (p.display_name ? '<p class="bio">' + esc(p.display_name) + '</p>' : '')
    + (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : '')
    + '<p class="kv">' + links.join(' · ') + '</p>'
    + '<p class="small">Joined ' + esc(fmtDate(p.joined_at)) + '</p></div>'
    + '</div>'
    + '<div class="stats" style="margin:18px 0">'
    + '<div><b>' + Number(rec.competitions_entered || 0) + '</b><span>entered</span></div>'
    + '<div><b>' + Number(rec.competitions_placed || 0) + '</b><span>placed</span></div>'
    + '<div><b>' + Number(rec.competitions_won || 0) + '</b><span>won</span></div>'
    + '<div><b>' + Number(rec.podium_finishes || 0) + '</b><span>podiums</span></div>'
    + '<div class="pot"><b>' + usd(rec.prize_usd || 0) + '</b><span>prize money</span></div>'
    + '</div>'
    + '<h2>Entries</h2>'
    + (solRows
      ? '<table><thead><tr><th>Bounty</th><th>Entry</th><th class="num">Place</th><th class="num">Prize</th><th class="num hide-sm">Win rate</th><th class="hide-sm">Entered</th></tr></thead><tbody>' + solRows + '</tbody></table>'
      : '<p class="small">No entries yet.</p>');
}
