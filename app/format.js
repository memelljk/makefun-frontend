// format.js — turning what the API sends into what a person reads:
// money, dates, countdowns, win rates, sizes, and safe HTML for prose.

const MISSING = '—';

const currencyFormat = (extra) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...extra });
const usdWhole = currencyFormat({});
const usdExact = currencyFormat({ minimumFractionDigits: 2 });
const plainCount = new Intl.NumberFormat('en-US', {});
const day = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' });
const clock = new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' });

// Money arrives as numbers (rewardAmount) and as decimal strings (potUsd,
// the rewardsNow amounts); both pass through here.
export const money = (value) => {
  if (value == null) return MISSING;
  const amount = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(amount)) return MISSING;
  return Number.isInteger(amount) ? usdWhole.format(amount) : usdExact.format(amount);
}; // money

export const count = (value) => (value == null ? MISSING : plainCount.format(value));

export const dateTime = (iso) => {
  if (!iso) return MISSING;
  const date = new Date(iso);
  return `${day.format(date)}, ${clock.format(date)}`;
}; // dateTime

// The board's heartbeat: "2d 4h left", "5h 12m left", "45s left",
// "Closed 3d ago". The last minute counts in seconds, so a bounty closing
// right now reads exactly instead of sitting on "0m left".
export const timeLeft = (iso, now = Date.now()) => {
  const target = iso ? new Date(iso).getTime() : Number.NaN;
  if (Number.isNaN(target)) return 'No deadline';
  const delta = target - now;
  const span = Math.abs(delta);
  if (span < 60000) {
    const s = Math.floor(span / 1000);
    return delta >= 0 ? `${s}s left` : `Closed ${s}s ago`;
  } // last minute
  const minutes = Math.floor(span / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const text = minutes >= 2880 ? `${days}d ${hours}h`
    : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes}m`;
  return delta >= 0 ? `${text} left` : `Closed ${text} ago`;
}; // timeLeft

// A bounty can still read status "open" after its deadline; entries are
// open only while the deadline is ahead (and the API accepts them).
export const takesEntries = (bounty, now = Date.now()) => {
  const closedToEntries = bounty.acceptingSubmissions === false;
  if (closedToEntries) return false;
  return bounty.deadline
    ? new Date(bounty.deadline).getTime() > now
    : bounty.status === 'open';
}; // takesEntries

// Leaderboard values are micro-units: 956066 is a 95.6066% win rate.
export const winRate = (micro) => (micro == null ? MISSING : `${(micro / 10000).toFixed(2)}%`);

export const fileSize = (bytes) => {
  if (bytes == null) return MISSING;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}; // fileSize

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const inlineHtml = (s) => {
  let out = esc(s);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}; // inlineHtml

const blockHtml = (lines) => {
  const bullet = (l) => /^\s*[-*] /.test(l);
  const numbered = (l) => /^\s*\d+\. /.test(l);
  if (lines.every(bullet)) {
    return `<ul>${lines.map((l) => `<li>${inlineHtml(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`;
  } // bullets
  if (lines.every(numbered)) {
    return `<ol>${lines.map((l) => `<li>${inlineHtml(l.replace(/^\s*\d+\. /, ''))}</li>`).join('')}</ol>`;
  } // numbered
  if (lines.length === 1 && /^#{1,3} /.test(lines[0])) {
    return `<h3>${inlineHtml(lines[0].replace(/^#{1,3} /, ''))}</h3>`;
  } // heading
  return `<p>${lines.map(inlineHtml).join('<br>')}</p>`;
}; // blockHtml

// The API's descriptions are light markdown: paragraphs, ## headings, -
// and 1. lists, **bold** and `code` are rendered, and everything else is
// escaped, so API prose can never inject HTML.
export const prose = (markdown) => {
  const text = String(markdown ?? '');
  if (!text) return '';
  const out = [];
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length) out.push(blockHtml(lines));
  } // blocks
  return out.join('');
}; // prose
