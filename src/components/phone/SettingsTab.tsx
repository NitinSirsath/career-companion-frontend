import { useQuery } from '@tanstack/react-query';
import { useRouteContext } from '@tanstack/react-router';
import {
  BellIcon,
  FlaskConicalIcon,
  RefreshCwIcon,
  SunMoonIcon,
  UserIcon,
  WorkflowIcon,
} from 'lucide-react';
import { useDevMode, useSandboxMailbox, useTestAccount } from '../../api/appMode';
import { api } from '../../api/client';
import { useGmailStatus } from '../../api/gmail';
import { aiValue, ALERT_WORDS, gmailValue } from '../../lib/settingsTab';
import { THEME_CHOICES } from '../../lib/theme';
import { useAlertSwitch } from '../auth/useAlertSwitch';
import { logOutAndLeave } from '../layout/AccountMenu';
import { useTheme } from '../ThemeProvider';
import { AiIcon } from '../ui/ai-icon';
import { Switch } from '../ui/switch';
import { Tag } from '../ui/tag';
import { PhoneGroup, PhoneLinkRow, PhoneRow, PhoneSection, RowIcon } from './PhoneList';
import { PhoneTitle } from './PhoneTitle';

const ICON = 19;

/** Gmail sync, AI providers and NorthList Apply: set up once, checked now and then. */
function SetupRows() {
  const gmail = useGmailStatus();
  const ai = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  return (
    <PhoneGroup icons>
      <PhoneLinkRow
        to="/gmail"
        icon={<RowIcon color="#0f62fe">{<RefreshCwIcon size={ICON} aria-hidden="true" />}</RowIcon>}
        value={gmailValue(gmail.data)}
      >
        Gmail sync
      </PhoneLinkRow>
      <PhoneLinkRow
        to="/ai"
        icon={<RowIcon color="#6929c4">{<AiIcon size={ICON} aria-hidden="true" />}</RowIcon>}
        value={aiValue(ai.data)}
      >
        AI providers
      </PhoneLinkRow>
      <PhoneLinkRow
        to="/automation"
        icon={<RowIcon color="#198038">{<WorkflowIcon size={ICON} aria-hidden="true" />}</RowIcon>}
      >
        NorthList Apply
      </PhoneLinkRow>
    </PhoneGroup>
  );
}

/** Alerts on this phone: a switch, or why it cannot be switched here (the Account page tells more). */
function AlertsRow() {
  const alerts = useAlertSwitch();
  const icon = <RowIcon color="#da1e28">{<BellIcon size={ICON} aria-hidden="true" />}</RowIcon>;
  if (!alerts.state) return null;
  const words = ALERT_WORDS[alerts.state];
  if (words)
    return (
      <PhoneLinkRow to="/account" icon={icon} value={words}>
        Alerts
      </PhoneLinkRow>
    );
  const on = alerts.state === 'on';
  return (
    <PhoneRow
      icon={icon}
      value={
        <Switch
          label="Alerts on this phone"
          checked={on}
          disabled={alerts.busy}
          onCheckedChange={() => void (on ? alerts.turnOff() : alerts.turnOn())}
        />
      }
      detail={alerts.problem ?? undefined}
    >
      Alerts on this phone
    </PhoneRow>
  );
}

/** Who is signed in, how the app looks, and alerts. */
function YouRows({ email }: { email?: string }) {
  const { theme } = useTheme();
  const look = THEME_CHOICES.find((choice) => choice.value === theme)?.label;
  return (
    <PhoneGroup icons>
      <PhoneLinkRow
        to="/account"
        icon={<RowIcon color="#6f6f78">{<UserIcon size={ICON} aria-hidden="true" />}</RowIcon>}
        detail={email}
      >
        Account
      </PhoneLinkRow>
      <PhoneLinkRow
        to="/settings/appearance"
        icon={<RowIcon color="#3d3d45">{<SunMoonIcon size={ICON} aria-hidden="true" />}</RowIcon>}
        value={look}
      >
        Appearance
      </PhoneLinkRow>
      <AlertsRow />
    </PhoneGroup>
  );
}

/** The mail sandbox, in dev mode and for test accounts only. */
function SandboxSection() {
  const sandbox = useSandboxMailbox();
  const devMode = useDevMode();
  if (!sandbox) return null;
  return (
    <PhoneSection note="A test mailbox for trying the app without real mail. No real mail is sent.">
      <PhoneGroup icons>
        <PhoneLinkRow
          to="/sandbox"
          icon={
            <RowIcon color="#b28600">{<FlaskConicalIcon size={ICON} aria-hidden="true" />}</RowIcon>
          }
          value={<Tag color="yellow">{devMode ? 'Dev' : 'Test'}</Tag>}
        >
          Mail sandbox
        </PhoneLinkRow>
      </PhoneGroup>
    </PhoneSection>
  );
}

/** "Dev mode · mail sandbox" under the title, so neither is mistaken for real Gmail. */
function SandboxLine() {
  const devMode = useDevMode();
  const testAccount = useTestAccount();
  if (!devMode && !testAccount) return null;
  return (
    <p role="status" className="mt-1 text-[15px] text-tag-yellow">
      {devMode ? 'Dev mode' : 'Test account'} · mail sandbox
    </p>
  );
}

/**
 * The phone's fourth tab (owner, 13 Nov 2026, approved mock `IOS-LOOK-mock/`): every page that is
 * set up once, the account, the look, alerts and sign out, as grouped rows. It takes the place of
 * the menu and the account button on phones.
 */
export function SettingsTab() {
  const email = useRouteContext({ from: '__root__', select: (context) => context.user?.email });
  return (
    <div className="pb-4">
      <div className="px-1 pt-0.5 pb-3">
        <PhoneTitle>Settings</PhoneTitle>
        <SandboxLine />
      </div>
      <PhoneSection className="mt-1">
        <SetupRows />
      </PhoneSection>
      <SandboxSection />
      <PhoneSection>
        <YouRows email={email} />
      </PhoneSection>
      <PhoneSection>
        <PhoneGroup>
          <PhoneRow onClick={() => void logOutAndLeave()} className="text-center text-danger-text">
            Sign out
          </PhoneRow>
        </PhoneGroup>
      </PhoneSection>
    </div>
  );
}
