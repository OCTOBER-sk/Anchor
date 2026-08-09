/**
 * Time formatting helpers for the dashboard — frontend.md §5A.3 (relative
 * "last used" times) and key-list created dates.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 12 * MONTH_MS;

/** "Just now", "2m ago", "3h ago", "5d ago", "2mo ago", "1y ago". */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);

  if (diff < MINUTE_MS) return 'Just now';
  const minutes = Math.floor(diff / MINUTE_MS);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diff / HOUR_MS);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(diff / DAY_MS);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(diff / MONTH_MS);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(diff / YEAR_MS);
  return `${years}y ago`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Aug" — compact created-date display for key rows. */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
}
