// Formatting helpers shared by every view: escaping, money, dates, countdowns and scores.

/** Escape a value so it is safe to interpolate into HTML markup. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** Format a USD amount ('1000.00', 0.5, null) as '$1,000' or '$0.50'; '—' when absent. */
export function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Format a plain count with thousands separators. */
export function formatCount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

/** Format an ISO timestamp as a UTC date and time, e.g. 'Nov 17, 2026, 12:30 PM UTC'. */
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** Format an ISO timestamp as a UTC calendar date only. */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
}

/** Milliseconds from now until an ISO deadline (negative once it has passed). */
export function msUntil(iso) {
  return new Date(iso).getTime() - Date.now();
}

/** Whether a bounty still takes entries: its deadline is in the future. */
export function isOpenForEntries(bounty) {
  return Boolean(bounty?.deadline) && msUntil(bounty.deadline) > 0;
}

/**
 * Human countdown for a deadline: '3d 4h left', '5h 12m 09s left' under a day
 * (seconds included so a per-second ticker visibly moves), or 'entries closed'.
 */
export function formatTimeLeft(iso) {
  const ms = msUntil(iso);
  if (!Number.isFinite(ms)) return '—';
  if (ms <= 0) return 'entries closed';
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s left`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s left`;
  return `${seconds}s left`;
}

/** Format a byte size as B, KB or MB with one decimal where useful. */
export function formatBytes(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Format one leaderboard metric. Win-rate style micro values (0–1,000,000) become
 * percents; the API's display string wins for anything else numeric.
 */
export function formatMetric(column, entry) {
  const raw = entry?.values?.[column.key];
  const display = entry?.display?.[column.key];
  if (raw === null || raw === undefined) return display ?? '—';
  const source = column.source ?? '';
  if (source.includes('win_rate_micro') || source.includes('_micro')) {
    return `${(Number(raw) / 10000).toFixed(1)}%`;
  }
  if (column.key === 'bytes') return formatBytes(raw);
  if (display !== undefined && display !== null && display !== '') {
    const n = Number(display);
    return Number.isFinite(n) && Math.abs(n) >= 1000 ? formatCount(n) : String(display);
  }
  return String(raw);
}

/** '1 entry' / '2 entries' style pluralisation for a count and a noun. */
export function plural(count, singular, pluralForm) {
  return `${formatCount(count)} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}
