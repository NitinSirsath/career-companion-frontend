/**
 * How many companies answered what NorthList Apply sent (owner, 10 Nov 2026): "4 of 50 companies
 * replied", with a thin bar. A "we got your application" mail is not a reply.
 */
export function ReplyBar({ replied, total }: { replied: number; total: number }) {
  const percent = total > 0 ? Math.round((replied / total) * 100) : 0;
  return (
    <div className="max-w-[560px]">
      <div className="flex justify-between gap-4 text-sm text-text-secondary">
        <span>
          <span className="font-medium text-text-primary tabular-nums">
            {replied} of {total}
          </span>{' '}
          {total === 1 ? 'company' : 'companies'} replied
        </span>
        <span className="tabular-nums" aria-hidden>
          {percent}%
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-chart-track" aria-hidden>
        <div className="h-full bg-chart-1" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
