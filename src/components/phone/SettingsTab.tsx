import { useQuery } from '@tanstack/react-query';
import { Link, useRouteContext } from '@tanstack/react-router';
import { ChevronRightIcon } from 'lucide-react';
import { useAdminOverview, useFreeAIMoney } from '../../api/admin';
import { useDevMode, useSandboxMailbox, useTestAccount } from '../../api/appMode';
import { api } from '../../api/client';
import { useGmailStatus } from '../../api/gmail';
import { needsALook } from '../../lib/admin';
import { openInstall, useInstall } from '../../lib/install';
import { adminValue, aiValue, ALERT_WORDS, applyValue, gmailValue } from '../../lib/settingsTab';
import { THEME_CHOICES } from '../../lib/theme';
import { useAlertSwitch } from '../auth/useAlertSwitch';
import { logOutAndLeave } from '../layout/AccountMenu';
import { useTheme } from '../ThemeProvider';
import { Switch } from '../ui/switch';
import { PLAIN_ROW, PlainLinkRow, PlainRow, PlainSection } from './PlainList';
import { PhoneTitle } from './PhoneTitle';

/**
 * You, at the top (owner, 18 Nov 2026, mock `PHONE-LINEAR-mock/` screen 8): your name and email;
 * it opens the Account page.
 */
function YouRow() {
  const user = useRouteContext({ from: '__root__', select: (context) => context.user });
  if (!user) return null;
  const name = user.name?.trim() || user.email;
  return (
    <Link to="/account" aria-label={`Account, ${user.email}`} className={PLAIN_ROW}>
      <span
        aria-hidden="true"
        className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-accent text-base font-semibold text-on-accent"
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16.5px] leading-[22px] font-semibold">{name}</span>
        <span className="truncate text-[13.5px] leading-[18px] text-text-secondary">
          {user.email}
        </span>
      </span>
      <ChevronRightIcon size={18} aria-hidden="true" className="shrink-0 text-text-tertiary" />
    </Link>
  );
}

/** Gmail sync, AI providers, NorthList Apply and the mail sandbox: set up once, checked now and then. */
function SetupRows() {
  const gmail = useGmailStatus();
  const ai = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  const tokens = useQuery({
    queryKey: ['integrationTokens', { offset: 0, limit: 20 }],
    queryFn: ({ signal }) => api.listIntegrationTokens({ offset: 0, limit: 20 }, { signal }),
  });
  return (
    <PlainSection label="Set up">
      <PlainLinkRow to="/gmail" value={gmailValue(gmail.data)}>
        Gmail sync
      </PlainLinkRow>
      <PlainLinkRow to="/ai" value={aiValue(ai.data)}>
        AI providers
      </PlainLinkRow>
      <PlainLinkRow to="/automation" value={applyValue(tokens.data?.items)}>
        NorthList Apply
      </PlainLinkRow>
      <SandboxRow />
    </PlainSection>
  );
}

/** The mail sandbox, in dev mode and for test accounts only. */
function SandboxRow() {
  const sandbox = useSandboxMailbox();
  const devMode = useDevMode();
  if (!sandbox) return null;
  return (
    <PlainLinkRow to="/sandbox" value={devMode ? 'Dev mode' : 'Test account'}>
      Mail sandbox
    </PlainLinkRow>
  );
}

/** Alerts on this phone: a switch, or why it cannot be switched here (the Account page tells more). */
function AlertsRow() {
  const alerts = useAlertSwitch();
  if (!alerts.state) return null;
  const words = ALERT_WORDS[alerts.state];
  if (words)
    return (
      <PlainLinkRow to="/account" value={words}>
        Alerts
      </PlainLinkRow>
    );
  const on = alerts.state === 'on';
  return (
    <PlainRow
      end={
        <Switch
          label="Alerts on this phone"
          checked={on}
          disabled={alerts.busy}
          onCheckedChange={() => void (on ? alerts.turnOff() : alerts.turnOn())}
        />
      }
      detail={alerts.problem ?? undefined}
    >
      Alerts
    </PlainRow>
  );
}

/** Install app: only where the app can be installed and is not yet (owner, 18 Nov 2026). */
function InstallRow() {
  const { kind } = useInstall();
  if (!kind) return null;
  return (
    <PlainRow onClick={openInstall} value="Home Screen" chevron>
      Install app
    </PlainRow>
  );
}

/** How the app looks, alerts and installing: things that belong to this phone. */
function ThisPhoneRows() {
  const { theme } = useTheme();
  const look = THEME_CHOICES.find((choice) => choice.value === theme)?.label;
  return (
    <PlainSection label="This phone">
      <PlainLinkRow to="/settings/appearance" value={look}>
        Appearance
      </PlainLinkRow>
      <AlertsRow />
      <InstallRow />
    </PlainSection>
  );
}

/** "6 need a look": the Admin page's count, without its chart. */
function AdminRow() {
  const overview = useAdminOverview();
  const money = useFreeAIMoney();
  const items = overview.data ? needsALook(overview.data, money.data).length : undefined;
  return (
    <PlainLinkRow to="/admin" value={adminValue(items)}>
      Admin
    </PlainLinkRow>
  );
}

/** Owner › Admin, only for the emails in ADMIN_EMAILS (owner, 18 Nov 2026). */
function OwnerSection() {
  const admin = useRouteContext({ from: '__root__', select: (context) => !!context.user?.admin });
  if (!admin) return null;
  return (
    <PlainSection label="Owner">
      <AdminRow />
    </PlainSection>
  );
}

/** "Dev mode · mail sandbox" under the title, so neither is mistaken for real Gmail. */
function SandboxLine() {
  const devMode = useDevMode();
  const testAccount = useTestAccount();
  if (!devMode && !testAccount) return null;
  return (
    <p role="status" className="mt-0.5 text-[13.5px] leading-[18px] text-tag-yellow">
      {devMode ? 'Dev mode' : 'Test account'} · mail sandbox
    </p>
  );
}

/**
 * The phone's fourth tab (owner, 18 Nov 2026, approved mock `PHONE-LINEAR-mock/` screen 8): plain
 * rows like Linear's Settings, with no boxes and no icons. You at the top, then Set up, This phone,
 * Owner › Admin for the owner, and Sign out in red. It takes the place of the menu and the account
 * button on phones.
 */
export function SettingsTab() {
  return (
    <div className="pb-4">
      <div className="px-0.5 pt-0.5 pb-3">
        <PhoneTitle>Settings</PhoneTitle>
        <SandboxLine />
      </div>
      <PlainSection className="mt-1">
        <YouRow />
      </PlainSection>
      <SetupRows />
      <ThisPhoneRows />
      <OwnerSection />
      <div className="phone-bleed">
        <PlainRow onClick={() => void logOutAndLeave()} tone="red">
          Sign out
        </PlainRow>
      </div>
    </div>
  );
}
