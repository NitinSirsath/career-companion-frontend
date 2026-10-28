import { Link } from '@tanstack/react-router';
import type { AIReadingStatusResponse } from '../../contracts/ai';
import { useSandboxMailbox } from '../../api/appMode';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { timeLeftText } from '../../lib/aiReading';
import { Skeleton } from '../ui/skeleton';

const STEPS = [
  {
    title: 'Connect Gmail',
    text: 'NorthList only reads. It never sends a mail unless you press Send.',
  },
  {
    title: 'The AI sorts your job mails',
    text: 'Each job mail is linked to its application, with its status.',
  },
  {
    title: 'Your numbers appear here',
    text: 'Replies, interviews, which sites work, and jobs that went quiet.',
  },
];

/** A new user with no Gmail yet: one clear start, and nothing else on the page. */
export function NoGmailYet({ status }: { status: string | null | undefined }) {
  const sandbox = useSandboxMailbox();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-2 border border-border-subtle px-6 py-12 text-center">
        <p className="text-base font-semibold">See your job search in numbers</p>
        <p className="max-w-115 text-sm text-text-secondary">
          Connect Gmail and NorthList reads your job mails: applications, replies, interviews and
          offers. This page then shows how your search is going.
        </p>
        <Link
          to="/gmail"
          className="mt-3 inline-flex h-10 items-center bg-action-primary px-4 text-sm text-text-inverse hover:bg-action-primary-hover"
        >
          {gmailConnectionCopy(sandbox, status).connect}
        </Link>
      </section>
      <ol className="grid border-t border-l border-border-subtle md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="flex flex-col gap-1.5 border-r border-b border-border-subtle p-4 md:p-6"
          >
            <span className="font-mono text-[12px] text-text-secondary">{i + 1}</span>
            <span className="text-sm font-semibold">{step.title}</span>
            <span className="text-xs text-text-secondary">{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Gmail is connected and the AI reads the first mails: progress, not empty charts. */
export function ReadingFirstMails({ reading }: { reading: AIReadingStatusResponse }) {
  const time = reading.secondsLeft === null ? '' : ` · ${timeLeftText(reading.secondsLeft)}`;
  const share = reading.total ? (reading.done / reading.total) * 100 : 0;
  return (
    <div className="flex flex-col gap-6">
      <section className="border border-border-subtle p-4 md:p-6" aria-live="polite">
        <p className="ai-shimmer text-sm font-semibold">The AI is reading your mails</p>
        <p className="mt-1 text-xs text-text-secondary">
          {reading.done} of {reading.total} done{time}. The numbers fill in as each mail is read.
        </p>
        <div className="mt-3 h-1 bg-chart-track" aria-hidden>
          <div
            className="h-full bg-link transition-[width] duration-240"
            style={{ width: `${share}%` }}
          />
        </div>
      </section>
      <DashboardSkeleton />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-36" />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
