import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArchiveIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  InboxIcon,
  TagIcon,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../api/client';
import { useGmailSummary } from '../../api/gmail';
import type { GmailStatusResponse, GmailSummaryResponse } from '../../contracts/gmail';
import { PRIVACY_POLICY_FROM_APP } from '../../lib/productPage';
import { aiReaderText } from '../../lib/aiConnections';
import { cn } from '../../lib/utils';
import {
  mailReadingFacts,
  WRITE_WITH_AI_NOTE,
  type ReadingFact,
  type ReadingFactKey,
} from '../../lib/mailReading';
import { AiIcon } from '../ui/ai-icon';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';
import { usePhoneNav } from '../phone/phoneNav';
import { PlainLinkRow, PlainRow, PlainSection } from '../phone/PlainList';

const count = (n: number) => n.toLocaleString('en-US');
const mails = (n: number) => `${count(n)} ${n === 1 ? 'mail' : 'mails'}`;

const NUMBERS: readonly {
  key: 'checked' | 'jobMails' | 'notJobMails' | 'fakeOffers';
  label: string;
  note: string;
}[] = [
  { key: 'checked', label: 'Mails checked', note: 'New mails in your inbox' },
  { key: 'jobMails', label: 'Job mails', note: 'Kept and shown in Mails' },
  { key: 'notJobMails', label: 'Not job mails', note: "Only Gmail's id and date kept" },
  { key: 'fakeOffers', label: 'Fake offers caught', note: 'Kept with a warning' },
];

/** Mails still waiting for the AI, and how the days are counted. */
function waitingLine(summary: GmailSummaryResponse, phone: boolean): string {
  const waiting = summary.waiting
    ? `${mails(summary.waiting)} ${summary.waiting === 1 ? 'is' : 'are'} still waiting for the AI. `
    : '';
  return phone ? waiting.trim() : `${waiting}Counted by the day each mail arrived.`;
}

/** Only when the AI could not read some mails: Retry is on the list page. */
function FailedLine({ failed, phone }: { failed: number; phone: boolean }) {
  if (!failed) return null;
  return (
    <p
      className={
        phone
          ? 'mt-3 rounded-2xl bg-tag-yellow-bg px-4 py-3 text-[15px] leading-5 text-tag-yellow ring-1 ring-tag-yellow-ring ring-inset'
          : 'rounded-xl bg-tag-yellow-bg px-3.5 py-2.5 text-[13px] leading-5 text-tag-yellow ring-1 ring-tag-yellow-ring ring-inset'
      }
    >
      {mails(failed)} could not be read by the AI.{' '}
      <Link to="/gmail/mails" className="font-semibold underline underline-offset-2">
        See {failed === 1 ? 'it' : 'them'}
      </Link>
    </p>
  );
}

function Numbers({ summary }: { summary: GmailSummaryResponse }) {
  return (
    <dl className="grid grid-cols-2 panel md:grid-cols-4">
      {NUMBERS.map((number, index) => (
        <div
          key={number.key}
          className={cn(
            'flex flex-col gap-1.5 border-border-subtle px-6 pt-[18px] pb-5',
            index % 2 === 1 && 'border-l',
            index === 2 && 'md:border-l',
            index > 1 && 'max-md:border-t',
          )}
        >
          <dt className="text-xs text-text-secondary">{number.label}</dt>
          <dd className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em] tabular-nums">
            {count(summary[number.key])}
          </dd>
          <dd className="text-xs text-text-tertiary">{number.note}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The four numbers as plain rows on phones: the label, the count at the right. */
function PhoneNumbers({ summary }: { summary: GmailSummaryResponse }) {
  return NUMBERS.map((number) => (
    <PlainRow
      key={number.key}
      value={<span className="tabular-nums">{count(summary[number.key])}</span>}
    >
      {number.label}
    </PlainRow>
  ));
}

/**
 * "What the app has read", last 30 days (owner, 17 Nov 2026): four numbers, the mails still
 * waiting, and a yellow line when the AI could not read some mails.
 */
export function ReadNumbers() {
  const phone = !!usePhoneNav();
  const { data: summary, isLoading, error } = useGmailSummary(true);
  let body: ReactNode;
  if (isLoading) body = <SkeletonList rows={1} label="Loading what the app has read" />;
  else if (error || !summary) body = <SectionError title="Could not load what the app has read" />;
  else
    body = phone ? (
      <>
        <PhoneNumbers summary={summary} />
        {summary.waiting > 0 && (
          <p className="px-4 pt-[7px] text-[13px] leading-[18px] text-text-tertiary">
            {waitingLine(summary, true)}
          </p>
        )}
        <FailedLine failed={summary.failed} phone />
      </>
    ) : (
      <div className="flex flex-col gap-3">
        <Numbers summary={summary} />
        <p className="text-xs leading-[18px] text-text-tertiary">{waitingLine(summary, false)}</p>
        <FailedLine failed={summary.failed} phone={false} />
      </div>
    );
  if (phone)
    return (
      <PlainSection label={`What the app has read · Last ${summary?.days ?? 30} days`}>
        {body}
      </PlainSection>
    );
  return (
    <section aria-labelledby="read-numbers-heading" className="flex flex-col gap-3 pt-6">
      <div className="flex items-baseline gap-2.5">
        <h2 id="read-numbers-heading" className="text-base leading-[22px] font-semibold">
          What the app has read
        </h2>
        <span className="text-[13px] text-text-tertiary">Last {summary?.days ?? 30} days</span>
      </div>
      {body}
    </section>
  );
}

/** The way to the full list, where Retry and Change link are. */
export function EveryMailLink() {
  const phone = !!usePhoneNav();
  if (phone)
    return (
      <PlainSection>
        <PlainLinkRow to="/gmail/mails">Every mail it read</PlainLinkRow>
      </PlainSection>
    );
  return (
    <Link
      to="/gmail/mails"
      className="flex items-center justify-between gap-3 panel px-6 py-3.5 text-sm transition-colors duration-70 ease-standard hover:bg-layer-accent"
    >
      See every mail it read
      <ChevronRightIcon size={16} aria-hidden="true" className="text-text-secondary" />
    </Link>
  );
}

const FACT_ICON: Record<ReadingFactKey, LucideIcon | typeof AiIcon> = {
  access: EyeIcon,
  which: InboxIcon,
  sort: TagIcon,
  job: FileTextIcon,
  kept: ArchiveIcon,
  ai: AiIcon,
};

function PrivacyLink({ className }: { className?: string }) {
  return (
    <a
      href={PRIVACY_POLICY_FROM_APP}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 text-link', className)}
    >
      Privacy policy
      <ExternalLinkIcon size={12} aria-hidden="true" />
    </a>
  );
}

function PhoneFacts({ facts }: { facts: ReadingFact[] }) {
  return (
    <PlainSection
      label="How your mail is read"
      note={
        <>
          {WRITE_WITH_AI_NOTE} <PrivacyLink />
        </>
      }
    >
      {facts.map((fact) => (
        <PlainRow key={fact.key} className="items-start" detail={fact.text}>
          {fact.term}
        </PlainRow>
      ))}
    </PlainSection>
  );
}

function LaptopFacts({ facts }: { facts: ReadingFact[] }) {
  return (
    <section aria-labelledby="how-read-heading" className="flex flex-col gap-3 pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="how-read-heading" className="text-base leading-[22px] font-semibold">
          How your mail is read
        </h2>
        <PrivacyLink className="text-sm" />
      </div>
      <dl className="grid panel md:grid-cols-2">
        {facts.map((fact, index) => {
          const Icon = FACT_ICON[fact.key];
          return (
            <div
              key={fact.key}
              className={cn(
                'flex gap-3.5 border-border-subtle px-6 py-[18px]',
                index > 0 && 'max-md:border-t',
                index > 1 && 'md:border-t',
                index % 2 === 1 && 'md:border-l',
              )}
            >
              <Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-text-secondary" />
              <div className="flex flex-col gap-1">
                <dt className="text-sm font-semibold">{fact.term}</dt>
                <dd className="text-sm leading-5 text-text-secondary">
                  {fact.text}
                  {fact.key === 'ai' && (
                    <>
                      {' '}
                      <Link to="/ai" className="text-link">
                        AI providers
                      </Link>
                    </>
                  )}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
      <p className="text-xs leading-[18px] text-text-tertiary">{WRITE_WITH_AI_NOTE}</p>
    </section>
  );
}

/**
 * "How your mail is read" (owner, 17 Nov 2026): what Gmail lets the app do, which mail it reads,
 * what goes to the AI, what is kept and which AI reads it. The words live in `lib/mailReading.ts`.
 */
export function HowMailIsRead({ status }: { status: GmailStatusResponse }) {
  const phone = !!usePhoneNav();
  const { data: ai } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const facts = mailReadingFacts({ canSend: status.canSend, reader: aiReaderText(ai) });
  return phone ? <PhoneFacts facts={facts} /> : <LaptopFacts facts={facts} />;
}
