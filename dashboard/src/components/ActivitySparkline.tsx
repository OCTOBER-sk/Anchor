import type { ActivityItem } from '../lib/api';

/**
 * Tiny hand-rolled SVG sparkline — frontend.md §3.4. No chart library.
 * Buckets activity items by day over the last 14 days (including today) and
 * draws a single polyline; flat baseline when there's nothing to show.
 */

const DAYS = 14;
const WIDTH = 96;
const HEIGHT = 28;
const PADDING_Y = 3;

export function ActivitySparkline({ items }: { items: ActivityItem[] }) {
  const counts = new Array<number>(DAYS).fill(0);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const item of items) {
    const time = new Date(item.createdAt).getTime();
    if (Number.isNaN(time)) continue;
    const index = DAYS - 1 - Math.floor((now - time) / dayMs);
    if (index >= 0 && index < DAYS) {
      counts[index] += 1;
    }
  }

  const max = Math.max(1, ...counts);
  const points = counts
    .map((count, i) => {
      const x = (i / (DAYS - 1)) * WIDTH;
      const y = HEIGHT - PADDING_Y - (count / max) * (HEIGHT - 2 * PADDING_Y);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const hasActivity = counts.some((count) => count > 0);

  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      fill="none"
      className={hasActivity ? 'text-accent' : 'text-border-strong'}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={hasActivity ? 'Activity over the last 14 days' : 'No activity in the last 14 days'}
    >
      <polyline points={points} />
      <circle
        cx={WIDTH}
        cy={HEIGHT - PADDING_Y - (counts[DAYS - 1] / max) * (HEIGHT - 2 * PADDING_Y)}
        r="2"
        fill={hasActivity ? 'currentColor' : 'none'}
        stroke="none"
      />
    </svg>
  );
}
