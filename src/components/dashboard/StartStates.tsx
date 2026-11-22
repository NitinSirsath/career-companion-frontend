import type { AIReadingStatusResponse } from '../../contracts/ai';
import { useSandboxMailbox } from '../../api/appMode';
import { useFreeAIWithGmail } from '../../api/freeAI';
import { startGmailConnect } from '../../lib/afterGmailConnect';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { firstReadingLine } from '../../lib/aiReading';
import { FreeAIConsentLine } from '../ai/FreeAIConsentLine';
import { Button } from '../ui/button';
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

/**
 * A new user with no Gmail yet: one clear start, and nothing else on the page. One tap goes to
 * Google (owner, 15 Nov 2026); while the free AI comes with it, the line under the button says so.
 */
export function NoGmailYet({ status }: { status: string | null | undefined }) {
  const sandbox = useSandboxMailbox();
  const withFreeAI = useFreeAIWithGmail();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col items-center gap-2 panel px-6 py-12 text-center">
        <p className="text-base font-semibold">See your job search in numbers</p>
        <p className="max-w-115 text-sm text-text-secondary">
          Connect Gmail and NorthList reads your job mails: applications, replies, interviews and
          offers. This page then shows how your search is going.
        </p>
        <Button size="lg" className="mt-3" onClick={() => startGmailConnect(withFreeAI)}>
          {gmailConnectionCopy(sandbox, status).connect}
        </Button>
        {withFreeAI && <FreeAIConsentLine className="mt-1 max-w-115 md:max-w-none" />}
      </section>
      <ol className="grid gap-2 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-1.5 panel p-4 md:p-6">
            <span className="font-mono text-[12px] text-text-secondary">{i + 1}</span>
            <span className="text-sm font-semibold">{step.title}</span>
            <span className="text-xs text-text-secondary">{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Gmail is connected and the first mails come in: progress, not empty charts. With `reading`, the
 * AI reads them (and names the free AI when it is the one, owner 15 Nov 2026); without, the first
 * sync is still getting them from Gmail.
 */
export function ReadingFirstMails({ reading }: { reading: AIReadingStatusResponse | null }) {
  if (!reading)
    return (
      <div className="flex flex-col gap-6">
        <section className="panel p-4 md:p-6" aria-live="polite">
          <p className="ai-shimmer text-sm font-semibold">Getting your mails from Gmail</p>
          <p className="mt-1 text-xs text-text-secondary">
            The AI reads them next. The numbers fill in as each mail is read.
          </p>
        </section>
        <DashboardSkeleton />
      </div>
    );
  const share = reading.total ? (reading.done / reading.total) * 100 : 0;
  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-4 md:p-6" aria-live="polite">
        <p className="ai-shimmer text-sm font-semibold">The AI is reading your mails</p>
        <p className="mt-1 text-xs text-text-secondary">
          {firstReadingLine(reading)}. The numbers fill in as each mail is read.
        </p>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-chart-track" aria-hidden>
          <div
            className="h-full rounded-full bg-link transition-[width] duration-240"
            style={{ width: `${share}%` }}
          />
        </div>
      </section>
      <DashboardSkeleton />
    </div>
  );
}

/** The page's shape while the numbers load: three tiles, five numbers, a chart. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden>
      <div className="grid gap-2 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg md:h-40" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );
}
