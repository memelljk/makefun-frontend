// format.js — turning API values into what a person reads: money, dates,
// countdowns, win rates, and safe HTML for the prose the API returns.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const plain = new Intl.NumberFormat('en-US');
const dayFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

// Money arrives both as numbers (rewardAmount) and as decimal strings
// (potUsd, rewardsNow amounts); both go through here.
export function money(value) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (n == null || Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? usd.format(n) : usdCents.format(n);
}

export function count(value) {
  return value == null ? '—' : plain.format(value);
}

export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return dayFmt.format(d) + ', ' + timeFmt.format(d);
}

// "2d 4h left", "5h 12m left", "Closed 3d ago" — the board's heartbeat.
export function timeLeft(iso, now = Date.now()) {
  if (!iso) return 'No deadline';
  const ms = new Date(iso).getTime() - now;
  const abs = Math.abs(ms);
  const mins = Math.floor(abs / 60000);
  const text = mins >= 2880 ? Math.floor(mins / 1440) + 'd ' + Math.floor((mins % 1440) / 60) + 'h'
    : mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm'
    : mins + 'm';
  return ms >= 0 ? text + ' left' : 'Closed ' + text + ' ago';
}

// A bounty can still say status "open" after its deadline; entries are open
// only while the deadline is in the future (and the API accepts them).
export function takesEntries(bounty, now = Date.now()) {
  if (bounty.acceptingSubmissions === false) return false;
  if (!bounty.deadline) return bounty.status === 'open';
  return new Date(bounty.deadline).getTime() > now;
}

// Leaderboard values are micro-units: 956066 means a 95.6066% win rate.
export function winRate(micro) {
  if (micro == null) return '—';
  return (micro / 10000).toFixed(2) + '%';
}

export function fileSize(bytes) {
  if (bytes == null) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// The API's descriptions are light markdown. This renders the shapes that
// actually occur — paragraphs, ## headings, - and 1. lists, **bold** and
// `code` — and escapes everything else, so API prose can never inject HTML.
export function prose(markdown) {
  if (!markdown) return '';
  const inline = (s) => esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  const blocks = String(markdown).split(/\n{2,}/);
  let html = '';
  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim() !== '');
    if (!lines.length) continue;
    if (lines.every((l) => /^\s*[-*] /.test(l))) {
      html += '<ul>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*] /, '')) + '</li>').join('') + '</ul>';
    } else if (lines.every((l) => /^\s*\d+\. /.test(l))) {
      html += '<ol>' + lines.map((l) => '<li>' + inline(l.replace(/^\s*\d+\. /, '')) + '</li>').join('') + '</ol>';
    } else if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
      html += '<h3>' + inline(lines[0].replace(/^#{1,3} /, '')) + '</h3>';
    } else {
      html += '<p>' + lines.map(inline).join('<br>') + '</p>';
    }
  }
  return html;
}
