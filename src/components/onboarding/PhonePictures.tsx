import type { ReactNode } from 'react';
import { MailIcon } from 'lucide-react';
import type { AIReadingStatusResponse } from '../../contracts/ai';
import { firstReadingLine, jobLabel, statusWords } from '../../lib/aiReading';
import type { TourKey } from '../../lib/onboarding';
import { AiIcon } from '../ui/ai-icon';
import { Ring } from '../ui/ring';
import { MAIL_TYPE_ICON } from '../mails/mailTypeIcons';
import { Notice } from './LaptopPictures';
import { rowDelay, useTyped } from './motion';
import { AppIcon } from './pictureParts';
import { SAMPLE_APPS, SAMPLE_MAIL_ROWS, SAMPLE_REPLY } from './samples';

/** Side buttons of the small iPhone: side, top and height in px. */
const BUTTONS: ['l' | 'r', number, number][] = [
  ['l', 69, 18],
  ['l', 103, 34],
  ['l', 144, 34],
  ['r', 121, 54],
];

function StatusIcons() {
  return (
    <span className="ob-dv-icons">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
        <rect y="7.5" width="3" height="4.5" rx="1" />
        <rect x="5" y="5" width="3" height="7" rx="1" />
        <rect x="10" y="2.5" width="3" height="9.5" rx="1" />
        <rect x="15" width="3" height="12" rx="1" />
      </svg>
      <svg
        width="16"
        height="12"
        viewBox="0 0 16 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M1.6 4.6a9 9 0 0 1 12.8 0" />
        <path d="M4.4 7.4a5 5 0 0 1 7.2 0" />
        <circle cx="8" cy="10.2" r="1.3" fill="currentColor" stroke="none" />
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13">
        <rect
          x="0.5"
          y="0.5"
          width="23"
          height="12"
          rx="3.5"
          fill="none"
          stroke="currentColor"
          opacity="0.4"
        />
        <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" />
        <path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="currentColor" opacity="0.4" />
      </svg>
    </span>
  );
}

/**
 * The phone app inside a small real iPhone (the product site's frame), of which only the top
 * shows: the picture fades out below it.
 */
export function HalfPhone({
  children,
  back = false,
  screen,
}: {
  children: ReactNode;
  back?: boolean;
  screen?: string;
}) {
  return (
    <div className={back ? 'ob-hpw back' : 'ob-hpw'}>
      <div className="ob-device">
        {BUTTONS.map(([side, top, height]) => (
          <span key={top} className={`ob-dv-btn ${side}`} style={{ top, height }} />
        ))}
        <div className="ob-dv-body">
          <div className="ob-dv-screen" style={screen ? { background: screen } : undefined}>
            <div className="ob-dv-status">
              <span>9:41</span>
              <span />
              <StatusIcons />
            </div>
            <span className="ob-dv-cut" />
            <div className="ob-hp">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MailRows({ count = 3 }: { count?: number }) {
  return SAMPLE_MAIL_ROWS.slice(0, count).map((row, i) => (
    <div key={row.from} className="r ob-row-in" style={rowDelay(i)}>
      <span className="nd" />
      <div>
        <b>{row.from}</b>
        <span style={{ color: 'var(--text-secondary)' }}>{row.subject}</span>
        <span>{row.next}</span>
      </div>
    </div>
  ));
}

function AppRows() {
  return SAMPLE_APPS.slice(0, 4).map((app, i) => (
    <div key={app.company} className="r ob-row-in items-center" style={rowDelay(i)}>
      <Ring kind={app.ring} />
      <div>
        <b>{app.company}</b>
        <span>
          {app.role} · {app.next}
        </span>
      </div>
    </div>
  ));
}

export function PhoneWelcome() {
  return (
    <>
      <HalfPhone back>
        <h4>
          Job mails <small>⌄</small>
        </h4>
        <MailRows />
      </HalfPhone>
      <HalfPhone>
        <div className="ns">Brightwave · Frontend Engineer</div>
        <h4 style={{ fontSize: 17, lineHeight: 1.2 }}>Interview invitation: Frontend Engineer</h4>
        <div className="card">
          <div className="ns">Next step</div>
          <b style={{ fontSize: 12.5 }}>Choose an interview time</b>
          <div className="ns">Due Mon, Nov 3</div>
        </div>
      </HalfPhone>
    </>
  );
}

function ConnectGmailCard() {
  return (
    <div className="card">
      <b style={{ fontSize: 12.5 }}>Connect Gmail</b>
      <div className="ns" style={{ marginTop: 2 }}>
        NorthList only reads. It never sends a mail unless you press Send.
      </div>
    </div>
  );
}

/** Today with the user's own reading progress, or the Connect Gmail card before. */
export function PhoneToday({
  connected,
  reading,
}: {
  connected: boolean;
  reading: AIReadingStatusResponse | undefined;
}) {
  if (!connected)
    return (
      <HalfPhone>
        <h4>Today</h4>
        <ConnectGmailCard />
        <div className="ob-sk" style={{ height: 40, marginTop: 8, borderRadius: 10 }} />
        <div className="ob-sk" style={{ height: 40, marginTop: 8, borderRadius: 10 }} />
      </HalfPhone>
    );
  const reads = !!reading && reading.state === 'READING' && reading.total > 0;
  const share = reads ? (reading.done / reading.total) * 100 : 0;
  const started = !!reading && (reading.state !== 'NONE' || reading.jobMails.count > 0);
  const waiting = reads || !started;
  let title = 'Getting your mails from Gmail';
  let line = 'The AI reads them next';
  if (reads) {
    title = 'The AI is reading your mails';
    line = firstReadingLine(reading);
  } else if (started) {
    title = statusWords(reading)?.title ?? 'Done reading your mails';
    line = `${reading.jobMails.count} job mails found`;
  }
  return (
    <HalfPhone>
      <h4>Today</h4>
      <div className="card">
        <b className={waiting ? 'ob-reading' : undefined} style={{ fontSize: 12 }}>
          {title}
        </b>
        <div className="ns" style={{ margin: '2px 0 6px' }}>
          {line}
        </div>
        <div className="ob-bar" style={{ height: 4 }}>
          <i style={{ width: `${share}%` }} />
        </div>
      </div>
      {(reading?.jobMails.newest ?? []).map((job, i) => {
        const Icon = job.category ? MAIL_TYPE_ICON[job.category] : MailIcon;
        return (
          <div key={job.emailId} className="r ob-row-in items-center" style={rowDelay(i)}>
            <Icon size={13} aria-hidden="true" />
            <div>
              <b>{jobLabel(job)}</b>
            </div>
          </div>
        );
      })}
    </HalfPhone>
  );
}

export function PhoneHomeScreen({ added }: { added: boolean }) {
  return (
    <HalfPhone>
      <div className="mt-2.5 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <i key={i} className="h-10 rounded-[11px] bg-surface-subtle" />
        ))}
        <AppIcon size={40} mark={22} className={added ? 'ob-popin' : 'opacity-15'} />
      </div>
      <div className="ns mt-2 text-center">NorthList · Share › Add to Home Screen</div>
    </HalfPhone>
  );
}

export function PhoneLockScreen({ on }: { on: boolean }) {
  const place = { top: 128, left: 8, right: 8, padding: '9px 10px', borderRadius: 16 };
  return (
    <HalfPhone screen="linear-gradient(160deg, var(--ob-sand), var(--ob-lilac) 70%)">
      <div
        style={{
          textAlign: 'center',
          fontSize: 46,
          fontWeight: 300,
          marginTop: 6,
          lineHeight: 1.1,
        }}
      >
        9:41
      </div>
      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-secondary)' }}>
        Monday, 24 November
      </div>
      {on ? (
        <Notice
          small
          style={place}
          title="NorthList · ARC Advisory"
          text="Interview invite: pick a time by Friday"
        />
      ) : (
        <Notice small off style={place} title="NorthList" text="Alerts are off" />
      )}
    </HalfPhone>
  );
}

export function PhoneApplications({ title = 'Today' }: { title?: string }) {
  return (
    <HalfPhone>
      <h4>{title}</h4>
      <AppRows />
    </HalfPhone>
  );
}

function PhoneReply() {
  const { shown, typing } = useTyped(SAMPLE_REPLY.phone.text);
  return (
    <HalfPhone>
      <div className="ns">{SAMPLE_REPLY.phone.to}</div>
      <div className="card" style={{ minHeight: 96, fontSize: 11.5, lineHeight: 1.5 }}>
        <span className={typing ? 'ob-typing' : undefined}>{shown}</span>
      </div>
      <div className="mt-2 flex justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1">
          <AiIcon size={12} aria-hidden="true" /> AI
        </span>
        <span className="rounded-full bg-accent px-2.5 py-1 text-on-accent">Send</span>
      </div>
    </HalfPhone>
  );
}

export function PhoneTour({ tour }: { tour: TourKey }) {
  if (tour === 'mails')
    return (
      <HalfPhone key={tour}>
        <h4>
          Job mails <small>⌄</small>
        </h4>
        <MailRows />
      </HalfPhone>
    );
  if (tour === 'applications') return <PhoneApplications key={tour} title="Applications" />;
  if (tour === 'dashboard')
    return (
      <HalfPhone key={tour}>
        <h4>Today</h4>
        <div className="ns" style={{ marginBottom: 4 }}>
          Needs you
        </div>
        {SAMPLE_APPS.filter((app) => app.ring !== 'applied')
          .slice(0, 3)
          .map((app, i) => (
            <div key={app.company} className="r ob-row-in items-center" style={rowDelay(i)}>
              <Ring kind={app.ring} />
              <div>
                <b>{app.next}</b>
                <span>{app.company}</span>
              </div>
            </div>
          ))}
      </HalfPhone>
    );
  return <PhoneReply key={tour} />;
}

export function PhoneSettings() {
  const rows = [
    ['Gmail sync', 'Read-only, about once an hour'],
    ['AI providers', 'Free AI, or your own key'],
    ['NorthList Apply', 'Set up on your laptop · Antigravity'],
  ];
  return (
    <HalfPhone>
      <h4>Settings</h4>
      {rows.map(([title, line]) => (
        <div key={title} className="r">
          <div>
            <b>{title}</b>
            <span>{line}</span>
          </div>
        </div>
      ))}
    </HalfPhone>
  );
}
