import { CheckIcon, MailIcon } from 'lucide-react';
import { useAIReading } from '../../api/aiReading';
import { useSandboxMailbox } from '../../api/appMode';
import { useFreeAIWithGmail } from '../../api/freeAI';
import { useGmailStatus } from '../../api/gmail';
import type { AIReadingStatusResponse } from '../../contracts/ai';
import { gmailConnectUrl } from '../../lib/afterGmailConnect';
import { firstReadingLine, jobLabel, statusWords, stepView } from '../../lib/aiReading';
import { gmailConnectionCopy } from '../../lib/gmailConnection';
import { ONBOARDING_PATH } from '../../lib/onboarding';
import { cn } from '../../lib/utils';
import { FreeAIConsentLine } from '../ai/FreeAIConsentLine';
import { MAIL_TYPE_ICON } from '../mails/mailTypeIcons';
import { Button } from '../ui/button';
import { DoneLine } from './BasicSteps';
import { DonePicture, GmailPicture, WelcomePicture } from './LaptopPictures';
import { useFlow } from './flow';
import { Frame } from './OnboardingFrame';
import { PhoneToday } from './PhonePictures';

/** Connecting leaves for Google (or the sandbox) and comes back to this step. */
function useConnect() {
  const sandbox = useSandboxMailbox();
  const freeAI = useFreeAIWithGmail();
  const gmail = useGmailStatus();
  return {
    label: gmailConnectionCopy(sandbox, gmail.data?.status).connect,
    freeAI,
    connect: () => {
      window.location.href = gmailConnectUrl(ONBOARDING_PATH, freeAI);
    },
  };
}

const reads = (reading: AIReadingStatusResponse | undefined) =>
  reading?.state === 'READING' && reading.total > 0;

/** "Connected": the mailbox, and how far the first mails are. */
function Connected({
  email,
  reading,
  syncing,
}: {
  email: string;
  reading: AIReadingStatusResponse | undefined;
  syncing: boolean;
}) {
  if (reads(reading) || syncing)
    return (
      <div className="ob-wait">
        <span className="ob-okdot">
          <CheckIcon size={12} strokeWidth={2.8} aria-hidden="true" />
        </span>
        <div>
          <b>{email}</b>
          <div className="faint">
            <span className="ob-reading">
              {syncing ? 'Connected · getting your mails…' : 'Connected · reading your mails…'}
            </span>
          </div>
        </div>
      </div>
    );
  const found = reading?.jobMails.count ?? 0;
  return (
    <DoneLine
      title={email}
      line={`Connected · ${found} job ${found === 1 ? 'mail' : 'mails'} found`}
    />
  );
}

/** Connect Gmail: optional, but it is what fills NorthList. The first sync starts at once. */
export function GmailStep() {
  const gmail = useGmailStatus();
  const reading = useAIReading();
  const { label, freeAI, connect } = useConnect();
  const sandbox = useSandboxMailbox();
  const connected = !!gmail.data?.connected;
  const syncing = connected && gmail.data?.syncStatus === 'SYNCING' && !gmail.data.lastSyncedAt;
  return (
    <Frame
      title="Connect your Gmail"
      sub="Optional, but it is what fills NorthList. We read only job mails from the last 7 days, then new ones each hour. Nothing is sent without you."
      picture={<GmailPicture connected={connected} reading={reading.data} />}
      phonePicture={<PhoneToday connected={connected} reading={reading.data} />}
      main={{ label: 'Continue', disabled: !connected }}
      skip={!connected}
    >
      {connected ? (
        <Connected
          email={gmail.data?.gmailEmail ?? (sandbox ? 'Sandbox mailbox' : 'Gmail')}
          reading={reading.data}
          syncing={!!syncing}
        />
      ) : (
        <Button size="lg" className="w-fit" disabled={gmail.isPending} onClick={connect}>
          <MailIcon aria-hidden="true" /> {label}
        </Button>
      )}
      <div>
        {!connected && freeAI && <FreeAIConsentLine className="mt-3" />}
        <p className="ob-consent">You can connect later from Today.</p>
      </div>
    </Frame>
  );
}

/** One line of the live list: the mail, and what the AI made of it. */
function FeedRow({ step }: { step: AIReadingStatusResponse['steps'][number] }) {
  const view = stepView(step);
  const skipped = step.step === 'NOT_JOB';
  return (
    <div className={cn('ob-frow ob-row-in', skipped && 'skip')}>
      <span className="fi">
        {skipped ? (
          <CheckIcon size={15} aria-hidden="true" />
        ) : (
          <MailIcon size={15} aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0">
        <b className="block truncate">{view.subject}</b>
        <span className={view.working ? 'ob-reading' : undefined}>
          {skipped ? 'Not a job mail · skipped' : view.action}
        </span>
      </div>
    </div>
  );
}

/** Once reading is over: the newest job mails it found. */
function FoundJobMails({ jobs }: { jobs: AIReadingStatusResponse['jobMails']['newest'] }) {
  if (!jobs.length) return null;
  return (
    <div className="ob-feed">
      {jobs.map((job) => {
        const Icon = job.category ? MAIL_TYPE_ICON[job.category] : MailIcon;
        return (
          <div key={job.emailId} className="ob-frow ob-row-in">
            <span className="fi">
              <Icon size={15} aria-hidden="true" />
            </span>
            <b className="min-w-0 truncate">{jobLabel(job)}</b>
          </div>
        );
      })}
    </div>
  );
}

/** The AI at work: the same words as the Dashboard's reading card, and its live list of mails. */
/** The card's two lines: the Dashboard's reading words, or what is left when nothing waits. */
function cardWords(status: AIReadingStatusResponse, syncing: boolean) {
  if (status.state === 'READING')
    return { title: 'The AI is reading your mails', line: firstReadingLine(status) };
  const words = statusWords(status);
  if (words) return { title: words.title, line: words.line ?? '' };
  // Same words as the Dashboard's card while the first sync runs.
  if (syncing) return { title: 'Getting your mails from Gmail', line: 'The AI reads them next.' };
  const found = status.jobMails.count;
  if (!found)
    return {
      title: 'No job mails in the last 7 days',
      line: 'New ones show up here as they come in.',
    };
  return {
    title: 'Done reading your mails',
    line: `${found} job ${found === 1 ? 'mail' : 'mails'} found`,
  };
}

function ReadingCard({
  status,
  syncing,
  onSetUp,
}: {
  status: AIReadingStatusResponse;
  syncing: boolean;
  onSetUp: () => void;
}) {
  const reading = status.state === 'READING';
  const words = statusWords(status);
  const share = status.total ? (status.done / status.total) * 100 : 0;
  const { title, line } = cardWords(status, syncing);
  const steps = [...status.steps].reverse().slice(0, 6);
  return (
    <div className="ob-card" aria-live="polite">
      <p className={cn('text-sm font-semibold', (reading || syncing) && 'ob-reading')}>{title}</p>
      <p className="mt-0.5 mb-2.5 text-xs text-text-tertiary">{line}</p>
      {(reading || share > 0) && (
        <div className="ob-bar">
          <i style={{ width: `${share}%` }} />
        </div>
      )}
      {words?.link && (
        <Button variant="ghost" className="-ml-3 mt-1" onClick={onSetUp}>
          {words.link}
        </Button>
      )}
      {steps.length > 0 && (
        <div className="ob-feed">
          {steps.map((step) => (
            <FeedRow key={`${step.emailId}:${step.step}`} step={step} />
          ))}
        </div>
      )}
      {!steps.length && <FoundJobMails jobs={status.jobMails.newest} />}
    </div>
  );
}

/** Done: with Gmail, the AI is shown reading; without, one more chance to connect it. */
export function DoneStep() {
  const { leave } = useFlow();
  const gmail = useGmailStatus();
  const reading = useAIReading();
  const { label, freeAI, connect } = useConnect();
  const open = { label: 'Open Dashboard', onClick: () => leave('/dashboard') };
  if (!gmail.data?.connected)
    return (
      <Frame
        title="You are all set."
        sub="Connect Gmail whenever you are ready: NorthList then reads your job mails and fills itself in."
        picture={<WelcomePicture />}
        phonePicture={<PhoneToday connected={false} reading={undefined} />}
        main={open}
      >
        <Button size="lg" className="w-fit" disabled={gmail.isPending} onClick={connect}>
          <MailIcon aria-hidden="true" /> {label} now
        </Button>
        <div>
          {freeAI && <FreeAIConsentLine className="mt-3" />}
          <p className="ob-consent">Or later from Today. Nothing is read until you do.</p>
        </div>
      </Frame>
    );
  return (
    <Frame
      title="You are all set."
      sub={
        reads(reading.data)
          ? 'The AI is reading your mails right now. Your Dashboard fills in as each one is read; you can start using NorthList meanwhile.'
          : 'Your Dashboard shows what needs you today and how your search is going.'
      }
      picture={<DonePicture />}
      phonePicture={<PhoneToday connected reading={reading.data} />}
      main={open}
    >
      {reading.data && (
        <ReadingCard
          status={reading.data}
          syncing={gmail.data.syncStatus === 'SYNCING' && !gmail.data.lastSyncedAt}
          onSetUp={() => leave('/ai')}
        />
      )}
    </Frame>
  );
}
