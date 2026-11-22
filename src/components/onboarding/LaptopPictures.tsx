import {
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  LayoutGridIcon,
  MailIcon,
  PlusIcon,
  ReplyIcon,
  ShareIcon,
} from 'lucide-react';
import type { AIReadingStatusResponse } from '../../contracts/ai';
import { jobLabel } from '../../lib/aiReading';
import type { TourKey } from '../../lib/onboarding';
import { MAIL_TYPE_ICON } from '../mails/mailTypeIcons';
import { Logo } from '../layout/Logo';
import { AiIcon } from '../ui/ai-icon';
import { Button } from '../ui/button';
import { Ring } from '../ui/ring';
import { rowDelay, useTyped } from './motion';
import { AppIcon, Win } from './pictureParts';
import { SAMPLE_APPS, SAMPLE_FLOW, SAMPLE_INBOX, SAMPLE_REPLY } from './samples';

const APP_URL = 'app.northlist.site';

/** Welcome: mails come in and turn into one list of applications with their rings. */
export function WelcomePicture() {
  return (
    <div className="ob-pic">
      <div className="ob-flow">
        {SAMPLE_FLOW.map((mail, i) => (
          <div
            key={mail.from}
            className="fc"
            style={{ top: 30 + i * 84, animationDelay: `${i * 0.5}s` }}
          >
            <div className="k" style={{ background: `var(--ob-${mail.tint})` }}>
              <MailIcon aria-hidden="true" />
            </div>
            <div>
              <b>{mail.from}</b>
              <small>{mail.subject}</small>
            </div>
          </div>
        ))}
        <div
          className="fc"
          style={{ top: 300, animationDelay: '1.6s', padding: '10px 0', display: 'block' }}
        >
          {SAMPLE_APPS.slice(0, 3).map((app) => (
            <div key={app.company} className="ob-mrow" style={{ border: 0, padding: '6px 16px' }}>
              <Ring kind={app.ring} />
              <span className="who">{app.company}</span>
              <span className="s">{app.next}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The three numbers over the first mails; dashes until Gmail is connected. */
function readingNumbers(connected: boolean, reading: AIReadingStatusResponse | undefined) {
  if (!connected || !reading)
    return [
      ['Read', '—'],
      ['Job mails', '—'],
      ['Left', '—'],
    ];
  return [
    ['Read', String(reading.done)],
    ['Job mails', String(reading.jobMails.count)],
    ['Left', String(reading.notDone)],
  ];
}

/** The job mails found so far, or grey rows while there are none. */
function FoundRows({ found }: { found: AIReadingStatusResponse['jobMails']['newest'] }) {
  if (!found.length)
    return [0, 1, 2].map((i) => (
      <div key={i} className="ob-mrow">
        <span className="ob-sk" style={{ width: 18, height: 18, borderRadius: '50%' }} />
        <span className="ob-sk" style={{ height: 9, width: 120 - i * 20 }} />
        <span className="ob-sk" style={{ height: 9, width: 80, marginLeft: 'auto' }} />
      </div>
    ));
  return found.map((job, i) => {
    const Icon = job.category ? MAIL_TYPE_ICON[job.category] : MailIcon;
    return (
      <div key={job.emailId} className="ob-mrow ob-row-in" style={rowDelay(i)}>
        <Icon aria-hidden="true" />
        <span className="who truncate">{jobLabel(job)}</span>
      </div>
    );
  });
}

/** Connect Gmail: the user's own reading progress and the first job mails it found. */
export function GmailPicture({
  connected,
  reading,
}: {
  connected: boolean;
  reading: AIReadingStatusResponse | undefined;
}) {
  const total = connected ? (reading?.total ?? 0) : 0;
  const share = total ? ((reading?.done ?? 0) / total) * 100 : 0;
  return (
    <div className="ob-pic">
      <Win url={APP_URL} className="ob-popin">
        <div style={{ padding: 18 }}>
          <div style={{ fontWeight: 650, fontSize: 15 }}>
            {connected ? 'Reading your mails' : 'Your mails, after Gmail'}
          </div>
          <div style={{ fontSize: 12.5, margin: '4px 0 12px', color: 'var(--text-tertiary)' }}>
            {connected
              ? 'Last 7 days · only job mails are kept'
              : 'Only job mails are kept. Everything else is skipped.'}
          </div>
          <div className="ob-bar">
            <i style={{ width: `${share}%` }} />
          </div>
          <div className="ob-sum">
            {readingNumbers(connected, reading).map(([label, value]) => (
              <div key={label}>
                <b key={value} className={connected ? 'ob-swap' : undefined}>
                  {value}
                </b>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </div>
        <FoundRows found={connected ? (reading?.jobMails.newest ?? []) : []} />
      </Win>
    </div>
  );
}

/** Install on a computer: the window's install button, and the icon flying into the dock. */
export function InstallPicture({ installed }: { installed: boolean }) {
  return (
    <div className="ob-pic">
      <Win
        style={{ height: 330, marginTop: -60 }}
        url={
          <>
            {APP_URL}
            <span className="ob-inst">
              <DownloadIcon aria-hidden="true" />
            </span>
          </>
        }
      >
        <div style={{ padding: 16 }}>
          {SAMPLE_APPS.slice(0, 4).map((app) => (
            <div key={app.company} className="ob-mrow" style={{ padding: '9px 4px' }}>
              <Ring kind={app.ring} />
              <span className="who">{app.company}</span>
              <span className="s">{app.role}</span>
            </div>
          ))}
        </div>
      </Win>
      {installed && (
        <div className="ob-flyicon">
          <Logo size={28} />
        </div>
      )}
      <div className="ob-dock">
        <i />
        <i />
        <i />
        <i />
        {installed ? <AppIcon size={38} mark={24} className="ob-popin" /> : <i className="empty" />}
      </div>
    </div>
  );
}

/** Install on an iPad: Safari's Share sheet, and the icon on the home screen. */
export function SharePicture({ added }: { added: boolean }) {
  return (
    <div className="ob-pic" style={{ height: 440, flexDirection: 'column' }}>
      <div className="ob-share ob-popin">
        <div className="r">
          <CopyIcon aria-hidden="true" /> Copy link
        </div>
        <div className="r hl">
          <PlusIcon aria-hidden="true" /> Add to Home Screen
        </div>
        <div className="r">
          <ShareIcon aria-hidden="true" /> Share…
        </div>
      </div>
      <div className="ob-homescr">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <i key={i} />
        ))}
        <AppIcon size={52} mark={30} className={added ? 'ob-popin' : 'opacity-15'} />
      </div>
    </div>
  );
}

/** Alerts: a lock screen; with alerts on, two alerts slide in. */
export function AlertsPicture({ on }: { on: boolean }) {
  return (
    <div className="ob-pic">
      <div className="ob-lock">
        <div className="ob-clock">9:41</div>
        <div className="ob-date">Monday, 24 November</div>
        {on ? (
          <>
            <Notice
              title="NorthList · ARC Advisory"
              text="Interview invite: pick a time by Friday"
            />
            <Notice
              title="NorthList · Linear"
              text="Sara replied: she asks for your notice period"
              style={{ top: 282, animationDelay: '1.3s', opacity: 0.92 }}
            />
          </>
        ) : (
          <Notice title="NorthList" text="Alerts are off" off />
        )}
      </div>
    </div>
  );
}

export function Notice({
  title,
  text,
  off = false,
  style,
  small = false,
}: {
  title: string;
  text: string;
  off?: boolean;
  style?: React.CSSProperties;
  small?: boolean;
}) {
  return (
    <div className={off ? 'ob-nt off' : 'ob-nt ob-notif'} style={style}>
      <div className="ic" style={small ? { width: 26, height: 26 } : undefined}>
        <Logo size={small ? 16 : 20} />
      </div>
      <div>
        <b style={small ? { fontSize: 11 } : undefined}>{title}</b>
        <p style={small ? { fontSize: 11 } : undefined}>{text}</p>
      </div>
    </div>
  );
}

/** Theme: the app itself, in the theme the page now shows. */
export function ThemePicture({ label }: { label: string }) {
  const nav = [
    { Icon: LayoutGridIcon, name: 'Dashboard', on: true },
    { Icon: MailIcon, name: 'Mails', on: false },
    { Icon: FileTextIcon, name: 'Applications', on: false },
  ];
  return (
    <div className="ob-pic">
      <Win url={`${APP_URL} · ${label}`} className="ob-popin" style={{ width: 430 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', minHeight: 300 }}>
          <div
            style={{ borderRight: '1px solid var(--border-subtle)', padding: '12px 8px' }}
            className="grid content-start gap-1 text-[12.5px]"
          >
            {nav.map(({ Icon, name, on }) => (
              <div
                key={name}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={
                  on
                    ? { background: 'var(--surface-selected)' }
                    : { color: 'var(--text-secondary)' }
                }
              >
                <Icon aria-hidden="true" /> {name}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 0' }}>
            {SAMPLE_APPS.slice(0, 4).map((app) => (
              <div key={app.company} className="ob-mrow" style={{ padding: '9px 14px' }}>
                <Ring kind={app.ring} />
                <span className="who">{app.company}</span>
              </div>
            ))}
          </div>
        </div>
      </Win>
    </div>
  );
}

function TypedReply({ text }: { text: string }) {
  const { shown, typing } = useTyped(text);
  return <span className={typing ? 'ob-typing' : undefined}>{shown}</span>;
}

const TOUR_URL: Record<TourKey, { Icon: typeof MailIcon; name: string }> = {
  mails: { Icon: MailIcon, name: 'Mails' },
  applications: { Icon: FileTextIcon, name: 'Applications' },
  dashboard: { Icon: LayoutGridIcon, name: 'Dashboard' },
  reply: { Icon: ReplyIcon, name: 'Reply with AI' },
};

function TourInside({ tour }: { tour: TourKey }) {
  if (tour === 'mails')
    return SAMPLE_INBOX.map((mail, i) => (
      <div key={mail.from} className="ob-mrow ob-row-in" style={rowDelay(i)}>
        <span className="ob-dot" style={mail.unread ? undefined : { opacity: 0 }} />
        <span className="ob-avc">{mail.from[0]}</span>
        <div>
          <div className="who">{mail.from}</div>
          <div className="s">{mail.subject}</div>
        </div>
        <span className="tm">{mail.time}</span>
      </div>
    ));
  if (tour === 'applications')
    return SAMPLE_APPS.map((app, i) => (
      <div key={app.company} className="ob-mrow ob-row-in" style={rowDelay(i)}>
        <Ring kind={app.ring} />
        <div>
          <div className="who">{app.company}</div>
          <div className="s">{app.role}</div>
        </div>
        <span className="tm">{app.next}</span>
      </div>
    ));
  if (tour === 'dashboard') return <TourDashboard />;
  return <TourReply />;
}

function TourDashboard() {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontWeight: 650, marginBottom: 10 }}>Needs you today</div>
      {SAMPLE_APPS.filter((app) => app.ring !== 'applied')
        .slice(0, 3)
        .map((app, i) => (
          <div
            key={app.company}
            className="ob-mrow ob-row-in"
            style={{ ...rowDelay(i), padding: '8px 0' }}
          >
            <Ring kind={app.ring} />
            <span className="who">{app.company}</span>
            <span className="s">{app.next}</span>
          </div>
        ))}
      <div className="ob-sum">
        {[
          ['Applied', 24],
          ['Replies', 9],
          ['Interviews', 3],
        ].map(([label, value]) => (
          <div key={label} className="ob-row-in" style={rowDelay(3)}>
            <b>{value}</b>
            <small>{label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function TourReply() {
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{SAMPLE_REPLY.laptop.to}</div>
      <div
        style={{
          marginTop: 10,
          borderRadius: 12,
          boxShadow: 'inset 0 0 0 1px var(--border-default)',
          padding: 12,
          fontSize: 13,
          lineHeight: 1.55,
          minHeight: 120,
        }}
      >
        <TypedReply text={SAMPLE_REPLY.laptop.text} />
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Button variant="secondary" size="sm" tabIndex={-1}>
          <AiIcon aria-hidden="true" /> AI
        </Button>
        <Button size="sm" className="ml-auto" tabIndex={-1}>
          Send
        </Button>
      </div>
    </div>
  );
}

/** How it works: the real screen of the card chosen, moving. */
export function TourPicture({ tour }: { tour: TourKey }) {
  const { Icon, name } = TOUR_URL[tour];
  return (
    <div className="ob-pic">
      <Win
        key={tour}
        className="ob-popin"
        style={{ width: 430 }}
        url={
          <>
            <Icon aria-hidden="true" /> {name}
          </>
        }
      >
        <TourInside tour={tour} />
      </Win>
    </div>
  );
}

/** Your AI: the AI app's window, one more line for each step done. */
export function AIPicture({ done, email }: { done: number; email: string }) {
  const lines: [string, string][] = [
    ['p', '› paste setup prompt'],
    ['', 'Connecting NorthList Apply…'],
    ['g', '✓ northlist server added'],
    ['', 'Allow tool "northlist"? › Yes'],
    ['g', `✓ Connected to NorthList as ${email}`],
  ];
  const shown = lines.slice(0, Math.max(1, done + 1));
  return (
    <div className="ob-pic">
      <div className="ob-term ob-popin">
        {shown.map(([look, text], i) => (
          <div key={text} className={i === done ? `${look} ob-row-in` : look}>
            {text}
          </div>
        ))}
        {done < 4 && <span className="ob-typing" />}
      </div>
    </div>
  );
}

/** Done, with Gmail: the Dashboard filling in while the mails are read. */
export function DonePicture() {
  return (
    <div className="ob-pic">
      <Win
        className="ob-popin"
        style={{ width: 440 }}
        url={
          <>
            <LayoutGridIcon aria-hidden="true" /> Dashboard
          </>
        }
      >
        <div style={{ padding: 16, display: 'grid', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="ob-sk" style={{ height: 54, borderRadius: 10 }} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="ob-sk" style={{ height: 40, borderRadius: 8 }} />
            ))}
          </div>
          <div className="ob-sk" style={{ height: 90, borderRadius: 10 }} />
        </div>
      </Win>
    </div>
  );
}
