import { differenceInCalendarDays, format } from 'date-fns';
import type { ApplicationResponse } from '../../contracts/application';
import { useNextSteps, type NextStep } from '../../api/nextSteps';
import { missedCount } from '../../lib/missed';
import { cn } from '../../lib/utils';

/** "Due Mon" within the week, else "Due Nov 24"; a date-only deadline is read as that day. */
function dueWords(step: NextStep, now = new Date()): string | null {
  if (!step.deadline) return null;
  const iso = step.deadline;
  const day =
    step.deadlinePrecision === 'DATE'
      ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
      : new Date(iso);
  const ahead = differenceInCalendarDays(day, now);
  if (ahead === 0) return 'Due today';
  return `Due ${ahead > 0 && ahead < 7 ? format(day, 'EEE') : format(day, 'MMM d')}`;
}

/**
 * The To do cell on laptops (laptop v2, owner 18 Nov 2026, `PHONE-LINEAR-mock/desktop.html`):
 * "1 to do" in plain words, the next step under it with its due day, all red only when past due.
 * With nothing open, a missed step shows as "1 missed" in grey.
 */
export function LaptopTodoCell({ app }: { app: ApplicationResponse }) {
  const { steps, missed } = useNextSteps();
  if (app.pendingActionCount === 0) {
    const count = missed?.get(app.id) ?? 0;
    return <span className="text-text-tertiary">{count > 0 ? missedCount(count) : 'None'}</span>;
  }
  const step = steps?.get(app.id);
  const due = step && !step.pastDue ? dueWords(step) : null;
  return (
    <div className="flex min-w-0 flex-col">
      <span className="font-medium">{app.pendingActionCount} to do</span>
      {step && (
        <span
          className={cn(
            'truncate text-xs',
            step.pastDue ? 'text-danger-text' : 'text-text-secondary',
          )}
          title={step.text}
        >
          {step.pastDue ? `Past due · ${step.text}` : [step.text, due].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  );
}
