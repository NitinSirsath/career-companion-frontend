import { useId } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Link } from '@tanstack/react-router';
import {
  CheckmarkFilled,
  ChevronDown,
  ChevronUp,
  Email,
  InformationFilled,
  PauseFilled,
  WarningFilled,
} from '@carbon/icons-react';
import type { AIReadingStatusResponse } from '../../contracts/ai';
import { jobLabel, type ReadingIcon } from '../../lib/aiReading';
import { cn } from '../../lib/utils';
import { Collapse } from '../ui/collapse';
import { Reveal } from '../ui/reveal';
import { MAIL_TYPE_ICON } from '../mails/mailTypeIcons';
import { useFeedMinimized, useReadingView, type ReadingView } from './useReadingView';

const doneShare = (status: AIReadingStatusResponse) =>
  status.total ? status.done / status.total : 0;

/** A ring that fills with the share of mails done: the status where a bar does not fit. */
function ProgressRing({ share, size }: { share: number; size: number }) {
  const centre = size / 2;
  const radius = centre - 1.75;
  const length = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        strokeWidth="2"
        className="stroke-border-subtle"
      />
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        strokeWidth="2"
        strokeDasharray={`${share * length} ${length}`}
        transform={`rotate(-90 ${centre} ${centre})`}
        className="stroke-border-interactive transition-[stroke-dasharray] duration-400 ease-standard"
      />
    </svg>
  );
}

const ICONS = {
  paused: { Icon: PauseFilled, className: 'text-warning-icon' },
  problem: { Icon: WarningFilled, className: 'text-destructive' },
  setup: { Icon: InformationFilled, className: 'text-link' },
  done: { Icon: CheckmarkFilled, className: 'text-success' },
};

function StatusIcon({ icon, share, size }: { icon: ReadingIcon; share: number; size: number }) {
  if (icon === 'reading') return <ProgressRing share={share} size={size} />;
  const { Icon, className } = ICONS[icon];
  return <Icon size={size} aria-hidden="true" className={cn('shrink-0', className)} />;
}

/** One thin bar: the only moving part next to the words (owner: one loader only). */
function ProgressBar({ status, held }: { status: AIReadingStatusResponse; held: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label="New mails done"
      aria-valuemin={0}
      aria-valuemax={status.total}
      aria-valuenow={status.done}
      className="mt-2 h-1 bg-border-subtle"
    >
      <div
        className={cn(
          'h-full transition-[width] duration-400 ease-standard',
          held ? 'bg-text-tertiary' : 'bg-border-interactive',
        )}
        style={{ width: `${Math.round(doneShare(status) * 100)}%` }}
      />
    </div>
  );
}

/** The job mails found so far, newest first; a click opens the mail. */
function JobMails({ status, phone }: { status: AIReadingStatusResponse; phone: boolean }) {
  const { count, newest } = status.jobMails;
  if (!count) return null;
  const more = count - newest.length;
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="mb-1 text-xs text-text-secondary">Job mails found · {count}</p>
      {newest.map((job) => {
        const Icon = job.category ? MAIL_TYPE_ICON[job.category] : Email;
        return (
          <Link
            key={job.emailId}
            to="/mails/$key"
            params={{ key: job.emailId }}
            className={cn(
              'flex min-w-0 animate-open items-center gap-2 bg-tint px-2 text-tint-text hover:bg-layer-hover',
              phone ? 'min-h-10 py-2 text-sm' : 'min-h-8 py-1.5 text-[13px] leading-[18px]',
            )}
          >
            <Icon size={16} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{jobLabel(job)}</span>
          </Link>
        );
      })}
      {more > 0 && (
        <Link to="/mails" className="mt-1.5 text-xs text-link">
          {more} more on the Mails page
        </Link>
      )}
    </div>
  );
}

/** Under the bar: what the AI does now with each mail, and the job mails it found. */
function Feed({ view, phone }: { view: ReadingView; phone: boolean }) {
  const { step, status } = view;
  if (!step && !status.jobMails.count) return null;
  return (
    <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-border-subtle pt-3">
      {step && (
        <p key={step.key} className="flex min-w-0 animate-open flex-col gap-0.5">
          <span
            className={cn('truncate text-xs', step.job ? 'text-tint-text' : 'text-text-secondary')}
          >
            {step.model && `${step.model} · `}
            <span className={cn(step.working && 'ai-shimmer')}>{step.action}</span>
          </span>
          <span className={cn('truncate', phone ? 'text-sm' : 'text-[13px] leading-[18px]')}>
            “{step.subject}”
          </span>
        </p>
      )}
      <JobMails status={status} phone={phone} />
    </div>
  );
}

/** The status's words, and in the side menu the button that minimizes the live feed. */
function TitleRow({
  title,
  phone,
  feedOpen,
  feedId,
  onFeedToggle,
}: {
  title: string;
  phone: boolean;
  feedOpen: boolean;
  feedId: string;
  onFeedToggle?: () => void;
}) {
  const label = feedOpen ? 'Minimize' : 'Show what the AI is doing';
  return (
    <div className="flex items-start gap-2">
      {/* Its words change only with the state, so a screen reader hears no count. */}
      <p aria-live="polite" className={cn('min-w-0 flex-1', phone ? 'text-[15px]' : 'text-sm')}>
        {title}
      </p>
      {onFeedToggle && (
        <button
          type="button"
          onClick={onFeedToggle}
          aria-expanded={feedOpen}
          aria-controls={feedId}
          aria-label={label}
          title={label}
          className="-mt-0.5 -mr-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center text-text-secondary transition-colors duration-70 ease-standard hover:bg-layer-hover hover:text-text-primary"
        >
          {feedOpen ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronUp size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

/** The words, the bar, the live feed and the one link; shared by the side menu and the phone. */
function StatusBody({
  view,
  phone,
  feedOpen,
  onFeedToggle,
}: {
  view: ReadingView;
  phone: boolean;
  feedOpen: boolean;
  onFeedToggle?: () => void;
}) {
  const { words, status } = view;
  const hasFeed = !!view.step || status.jobMails.count > 0;
  const feedId = useId();
  return (
    <div className="flex items-start gap-3">
      {words.icon !== 'reading' && (
        <span className="mt-0.5 flex shrink-0">
          <StatusIcon icon={words.icon} share={doneShare(status)} size={phone ? 20 : 16} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <TitleRow
          title={words.title}
          phone={phone}
          feedOpen={feedOpen}
          feedId={feedId}
          onFeedToggle={hasFeed ? onFeedToggle : undefined}
        />
        {words.line && (
          <p className={cn('mt-0.5 text-text-secondary', phone ? 'text-[13px]' : 'text-xs')}>
            {words.line}
          </p>
        )}
        {words.bar && <ProgressBar status={status} held={words.bar === 'held'} />}
        <Collapse open={feedOpen} id={feedId}>
          <Feed view={view} phone={phone} />
        </Collapse>
        {words.link && (
          <Link to="/ai" className={cn('block text-link', phone ? 'mt-2 text-sm' : 'mt-1 text-xs')}>
            {words.link}
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * "AI is reading your mails" at the bottom of the side menu (owner, 24 Oct 2026): shown only while
 * mails wait or are read, then "done" for a moment. Collapsed, one icon whose hover says the words.
 */
export function ReadingStatus({ collapsed }: { collapsed: boolean }) {
  const view = useReadingView();
  const [minimized, setMinimized] = useFeedMinimized();
  if (!view) return null;
  const { words, status } = view;
  if (collapsed)
    return (
      <Reveal className="shrink-0">
        <div
          title={[words.title, words.line].filter(Boolean).join(' · ')}
          className="flex h-12 items-center justify-center border-t border-border-subtle"
        >
          <StatusIcon icon={words.icon} share={doneShare(status)} size={16} />
          <span aria-live="polite" className="sr-only">
            {words.title}
          </span>
        </div>
      </Reveal>
    );
  return (
    <Reveal className="shrink-0">
      <section
        aria-label="AI reading status"
        className="border-t border-border-subtle px-5 pt-3 pb-3.5"
      >
        <StatusBody
          view={view}
          phone={false}
          feedOpen={!minimized}
          onFeedToggle={() => setMinimized(!minimized)}
        />
      </section>
    </Reveal>
  );
}

/** On phones: one cell in the top bar; a tap opens the same status under the top bar. */
export function ReadingStatusCell() {
  const view = useReadingView();
  if (!view) return null;
  const { words, status } = view;
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={`AI reading status: ${words.title}`}
        className="flex w-12 shrink-0 cursor-pointer items-center justify-center border-l border-border-subtle text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover data-popup-open:bg-layer-hover"
      >
        <StatusIcon icon={words.icon} share={doneShare(status)} size={20} />
        <span aria-live="polite" className="sr-only">
          {words.title}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={0}
          collisionPadding={0}
          className="z-50 outline-none"
        >
          <Popover.Popup className="w-screen border-b border-border-subtle bg-menu p-4 text-text-primary shadow-popup outline-none transition-opacity duration-150 ease-entrance data-ending-style:opacity-0 data-starting-style:opacity-0">
            <Popover.Title className="sr-only">AI reading status</Popover.Title>
            <StatusBody view={view} phone feedOpen />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
