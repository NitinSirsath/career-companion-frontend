import { useState } from 'react';
import {
  BellIcon,
  CheckIcon,
  DownloadIcon,
  FileTextIcon,
  LayoutGridIcon,
  MailIcon,
  MonitorIcon,
  MoonIcon,
  ReplyIcon,
  ShareIcon,
  SunIcon,
} from 'lucide-react';
import { hideForNow, installNow, useInstall } from '../../lib/install';
import { TOUR, type TourKey } from '../../lib/onboarding';
import { THEME_CHOICES, resolveTheme, type ThemeChoice } from '../../lib/theme';
import { themeReveal, transition } from '../../lib/viewTransition';
import { useTheme } from '../ThemeProvider';
import { AiIcon } from '../ui/ai-icon';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import {
  AlertsPicture,
  InstallPicture,
  SharePicture,
  ThemePicture,
  TourPicture,
  WelcomePicture,
} from './LaptopPictures';
import { useFlow } from './flow';
import { Frame } from './OnboardingFrame';
import {
  PhoneApplications,
  PhoneHomeScreen,
  PhoneLockScreen,
  PhoneTour,
  PhoneWelcome,
} from './PhonePictures';
import { MiniApp } from './pictureParts';

/** A green tick in a circle that bursts once, and the words beside it. */
export function DoneLine({ title, line }: { title: string; line: string }) {
  return (
    <div className="ob-wait ob-popin">
      <span className="ob-okdot ob-burst">
        <CheckIcon size={12} strokeWidth={2.8} aria-hidden="true" />
      </span>
      <div>
        <b>{title}</b>
        <div className="faint">{line}</div>
      </div>
    </div>
  );
}

export function WelcomeStep() {
  return (
    <Frame
      title="Every job mail, sorted for you."
      sub="NorthList reads your job mails and keeps one list of every application: who replied, what they asked, what is due."
      picture={<WelcomePicture />}
      phonePicture={<PhoneWelcome />}
      main={{ label: 'Get started' }}
    >
      <div className="ob-lines">
        <div>
          <MailIcon aria-hidden="true" /> Connect Gmail, nothing to type
        </div>
        <div>
          <BellIcon aria-hidden="true" /> An alert when a company needs you
        </div>
        <div>
          <AiIcon aria-hidden="true" /> About 2 minutes
        </div>
      </div>
    </Frame>
  );
}

const IOS_STEPS = [
  { title: 'Tap Share', line: 'at the bottom of Safari', Icon: ShareIcon },
  {
    title: 'Tap “Add to Home Screen”',
    line: "Scroll down a little if you don't see it",
    Icon: null,
  },
  { title: 'Tap Add', line: 'NorthList appears on your Home Screen', Icon: null },
];

/** iPhone and iPad: Safari has no install box, so the three taps are shown. */
function IosInstallSteps() {
  return (
    <div className="ob-tl">
      {IOS_STEPS.map((step, i) => (
        <div key={step.title} className={i === 0 ? 'st cur' : 'st'}>
          <span className="n">{i + 1}</span>
          <div>
            <b>{step.title}</b>
            <small>
              {step.Icon && <step.Icon size={13} aria-label="Share" className="mr-1 inline" />}
              {step.line}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Install: the browser's own install box, or on iPhone the Share steps. Not shown elsewhere. */
export function InstallStep() {
  const { phone } = useFlow();
  const { kind } = useInstall();
  const [installed, setInstalled] = useState(false);
  const ios = kind === 'ios';
  const install = async () => setInstalled(await installNow());
  return (
    <Frame
      title={ios ? 'Put NorthList on your Home Screen' : 'Install NorthList'}
      sub={
        ios
          ? 'It opens like an app, and on iPhone it is needed for alerts.'
          : 'Its own window and icon, opens in one click, and alerts work even with the browser closed.'
      }
      picture={ios ? <SharePicture added={installed} /> : <InstallPicture installed={installed} />}
      phonePicture={<PhoneHomeScreen added={installed} />}
      skip={!installed}
      // Skipping is the install card's "Not now": it stays away for 30 days.
      onSkip={hideForNow}
    >
      {ios && <IosInstallSteps />}
      {!ios && installed && (
        <DoneLine
          title="Installed"
          line={phone ? 'Find it on your home screen' : 'Find it in your Dock or Start menu'}
        />
      )}
      {!ios && !installed && (
        <Button size="lg" className="w-fit" onClick={() => void install()}>
          <DownloadIcon aria-hidden="true" /> Install app
        </Button>
      )}
      {!ios && <p className="ob-consent">Free, no app store. Remove it any time like any app.</p>}
    </Frame>
  );
}

/** Alerts: one tap turns them on here; the browser asks once. Same parts as Settings. */
export function AlertsStep() {
  const { phone, alerts, steps, goTo } = useFlow();
  const device = phone ? 'phone' : 'laptop';
  const on = alerts.state === 'on';
  let body: React.ReactNode = null;
  if (on)
    body = (
      <DoneLine
        title="Alerts are on"
        line={
          alerts.firstAlertSent
            ? `On this ${device} · you got a first alert to show it works`
            : `On this ${device} · change in Settings`
        }
      />
    );
  else if (alerts.state === 'blocked')
    body = (
      <InlineNotification kind="warning">
        This browser was told not to show alerts from NorthList. To allow them, open the site
        settings for NorthList in your browser, set Notifications to Allow, then come back.
      </InlineNotification>
    );
  else if (alerts.state === 'home-screen-first')
    body = (
      <div className="ob-wait">
        <div>
          <b>Add NorthList to your Home Screen first</b>
          <div className="faint">
            On iPhone and iPad, alerts work only in the NorthList app on your Home Screen. Open it
            from there and turn alerts on in Settings.
          </div>
          {steps.includes('install') && (
            <Button variant="ghost" className="-ml-3 mt-1" onClick={() => goTo('install')}>
              Back to Install
            </Button>
          )}
        </div>
      </div>
    );
  else
    body = (
      <Button
        size="lg"
        className="w-fit"
        loading={alerts.busy}
        disabled={!alerts.state}
        onClick={() => void alerts.turnOn()}
      >
        <BellIcon aria-hidden="true" /> Turn on alerts
      </Button>
    );
  return (
    <Frame
      title="Know when a company replies"
      sub="One alert when a step needs you: an interview invite, a question, a deadline. Never for every mail."
      picture={<AlertsPicture on={on} />}
      phonePicture={<PhoneLockScreen on={on} />}
      skip={!on}
    >
      {body}
      {alerts.problem && <InlineNotification kind="error">{alerts.problem}</InlineNotification>}
      <p className="ob-consent">
        Your {phone ? 'phone' : 'browser'} asks once. Alerts show the company and the step, never
        the mail text.
      </p>
    </Frame>
  );
}

const THEME_ICON: Record<ThemeChoice, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

function ThemeCard({ choice, label }: { choice: ThemeChoice; label: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const Icon = THEME_ICON[choice];
  const chosen = theme === choice;
  const pick = (event: React.MouseEvent) => {
    const prefersDark =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (resolveTheme(choice, prefersDark) === resolvedTheme) setTheme(choice);
    else themeReveal(() => setTheme(choice), event.clientX, event.clientY);
  };
  return (
    <button type="button" className="ob-pick" aria-pressed={chosen} onClick={pick}>
      {choice === 'system' ? (
        <div className="ob-mini two">
          <MiniApp dark={false} />
          <MiniApp dark />
        </div>
      ) : (
        <MiniApp dark={choice === 'dark'} />
      )}
      <b>
        <Icon aria-hidden="true" /> {label}
      </b>
      {chosen && (
        <span className="ob-check ob-popin">
          <CheckIcon size={13} strokeWidth={2.6} aria-hidden="true" />
        </span>
      )}
    </button>
  );
}

/** Theme: the real setting; the whole screen switches, growing from the tap. */
export function ThemeStep() {
  const { theme, resolvedTheme } = useTheme();
  const label =
    theme === 'system'
      ? `System (${resolvedTheme})`
      : (THEME_CHOICES.find((t) => t.value === theme)?.label ?? '');
  return (
    <Frame
      title="Pick your look"
      sub="Switch any time in Settings › Appearance."
      picture={<ThemePicture label={label} />}
      phonePicture={<PhoneApplications />}
      skip
    >
      <div className="ob-themes" role="group" aria-label="Theme">
        {THEME_CHOICES.map((choice) => (
          <ThemeCard key={choice.value} choice={choice.value} label={choice.label} />
        ))}
      </div>
    </Frame>
  );
}

const TOUR_ICON: Record<TourKey, typeof MailIcon> = {
  mails: MailIcon,
  applications: FileTextIcon,
  dashboard: LayoutGridIcon,
  reply: ReplyIcon,
};

/** How it works: four cards; Next walks through them, each with its own moving picture. */
export function TourStep() {
  const [at, setAt] = useState(0);
  const show = (next: number) => transition(() => setAt(next), next > at ? 'forward' : 'backward');
  const last = at === TOUR.length - 1;
  return (
    <Frame
      title="How NorthList works"
      sub="Four things you will use every day."
      picture={<TourPicture tour={TOUR[at].key} />}
      phonePicture={<PhoneTour tour={TOUR[at].key} />}
      main={last ? undefined : { label: 'Next', onClick: () => show(at + 1) }}
      skip={!last}
    >
      <div className="ob-feat">
        {TOUR.map((card, i) => {
          const Icon = TOUR_ICON[card.key];
          return (
            <button
              key={card.key}
              type="button"
              className="ob-pick"
              aria-current={i === at}
              onClick={() => i !== at && show(i)}
            >
              <span className="ix" style={{ background: `var(--ob-${card.tint})` }}>
                <Icon aria-hidden="true" />
              </span>
              <div>
                <b>{card.title}</b>
                <small>{card.text}</small>
              </div>
            </button>
          );
        })}
      </div>
      <div className="ob-tour-dots" aria-hidden="true">
        {TOUR.map((card, i) => (
          <i key={card.key} className={i === at ? 'on' : undefined} />
        ))}
      </div>
    </Frame>
  );
}
