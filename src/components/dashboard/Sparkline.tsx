import { cn } from '../../lib/utils';

const WIDTH = 64;
const HEIGHT = 28;
const PAD = 3;

const pointsOf = (list: [number, number][]) => list.map(([x, y]) => `${x},${y}`).join(' ');

/**
 * A small trend line of weekly values: grey, with the weeks inside the period in blue and a dot
 * on the last one. It only adds to the number beside it, so screen readers skip it.
 */
export function Sparkline({
  values,
  highlight,
  className,
}: {
  values: number[];
  /** How many of the last points are in the period. */
  highlight: number;
  className?: string;
}) {
  const max = Math.max(1, ...values);
  const step = (WIDTH - PAD * 2) / Math.max(1, values.length - 1);
  const points = values.map((value, i): [number, number] => [
    PAD + i * step,
    HEIGHT - PAD - (value / max) * (HEIGHT - PAD * 2),
  ]);
  const split = Math.max(0, values.length - highlight);
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden
      className={cn('h-7 w-16 shrink-0 overflow-visible', className)}
    >
      {split > 0 && (
        <polyline
          points={pointsOf(points.slice(0, split + 1))}
          fill="none"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-chart-4"
        />
      )}
      <polyline
        points={pointsOf(points.slice(split))}
        fill="none"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-chart-1"
      />
      {last && (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={3}
          strokeWidth={2}
          className="fill-chart-1 stroke-surface-subtle"
        />
      )}
    </svg>
  );
}
