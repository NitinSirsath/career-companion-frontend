import { useEffect, useState } from 'react';
import type { AIReadingStep } from '../../contracts/ai';
import { stepView, timeLeftText, type StepView } from '../../lib/aiReading';
import { cn } from '../../lib/utils';
import { ProgressRing } from '../layout/ReadingStatus';

const TOTAL = 30;
const FIRST_DONE = 12;
/** About how long the made-up AI takes per mail, for the "left" time. */
const SECONDS_PER_MAIL = 7;
const SHOW_NEXT_EVERY_MS = 2_200;
const LINES = 3;

const step = (
  emailId: string,
  subject: string,
  kind: AIReadingStep['step'],
  found?: Pick<AIReadingStep, 'category' | 'companyName' | 'jobTitle'>,
): StepView =>
  stepView({
    emailId,
    subject,
    step: kind,
    provider: null,
    model: null,
    category: found?.category ?? null,
    companyName: found?.companyName ?? null,
    jobTitle: found?.jobTitle ?? null,
    at: '2026-10-31T09:40:00.000Z',
  });

/** Made-up steps, in the words of the app's own live feed: one other mail and two job mails. */
const STEPS: readonly StepView[] = [
  step('order', 'Your weekly order summary', 'SORTING'),
  step('order', 'Your weekly order summary', 'NOT_JOB'),
  step('interview', 'Interview invitation: Frontend Engineer', 'SORTING'),
  step('interview', 'Interview invitation: Frontend Engineer', 'READING_DETAILS'),
  step('interview', 'Interview invitation: Frontend Engineer', 'JOB', {
    category: 'INTERVIEW',
    companyName: 'Brightwave',
    jobTitle: 'Frontend Engineer',
  }),
  step('test', 'Your take-home test', 'SORTING'),
  step('test', 'Your take-home test', 'READING_DETAILS'),
  step('test', 'Your take-home test', 'JOB', {
    category: 'ASSESSMENT',
    companyName: 'Kestrel Labs',
    jobTitle: 'React Developer',
  }),
];

const mailOf = (view: StepView) => view.key.split(':')[0];

interface Playback {
  next: number;
  done: number;
  lines: StepView[];
}

/** The next step joins the feed: it replaces its own mail's line, else goes on top. */
function showNext({ next, done, lines }: Playback): Playback {
  const view = STEPS[next % STEPS.length];
  const others = lines.filter((line) => mailOf(line) !== mailOf(view));
  const finished = view.working ? done : done + 1;
  return {
    next: next + 1,
    done: finished >= TOTAL ? FIRST_DONE : finished,
    lines: [view, ...others].slice(0, LINES),
  };
}

const START: Playback = showNext(showNext(showNext({ next: 0, done: FIRST_DONE - 1, lines: [] })));

const stillMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A step every few seconds, unless the computer asks for less motion. */
function usePlayback() {
  const [playback, setPlayback] = useState(START);
  useEffect(() => {
    if (stillMotion()) return;
    const timer = setInterval(() => setPlayback(showNext), SHOW_NEXT_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return playback;
}

/**
 * A drawn example of "Reading your new mails", as the app shows it: flat, one thin bar, and the
 * step that runs now in grey shimmering words.
 */
export function ReadingPreview() {
  const { done, lines } = usePlayback();
  const share = done / TOTAL;
  return (
    <div
      role="img"
      aria-label="An example of NorthList's AI reading new mails, one at a time"
      className="w-full max-w-[520px] border border-border-subtle bg-background p-5 lg:max-w-none"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex shrink-0">
          <ProgressRing share={share} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p>Reading your new mails</p>
          <p className="text-xs text-text-secondary">
            {done} of {TOTAL} done · {timeLeftText((TOTAL - done) * SECONDS_PER_MAIL)}
          </p>
          <div className="mt-2 h-1 bg-border-subtle">
            <div
              className="h-full bg-border-interactive transition-[width] duration-400 ease-standard"
              style={{ width: `${share * 100}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-border-subtle pt-3">
        {lines.map((line) => (
          <p key={line.key} className="flex min-w-0 animate-open flex-col gap-0.5">
            <span
              className={cn(
                'truncate text-xs',
                line.job ? 'text-tint-text' : 'text-text-secondary',
              )}
            >
              <span className={cn(line.working && 'ai-shimmer')}>{line.action}</span>
            </span>
            <span className="truncate text-[13px] leading-[18px]">{line.subject}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
