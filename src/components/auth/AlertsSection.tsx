import type { AlertState } from '../../lib/alerts';
import { cn } from '../../lib/utils';
import { SettingsSection } from '../layout/SettingsSection';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { useAlertSwitch } from './useAlertSwitch';

const HELP =
  'Get an alert when something needs you, such as a reply to send. Alerts come up to about an hour after the mail.';

/** A small coloured dot before the state: green on, grey off, red blocked. */
function Dot({ tone }: { tone: 'on' | 'off' | 'blocked' }) {
  const colour = { on: 'bg-status-success', off: 'bg-border-strong', blocked: 'bg-status-error' };
  return <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', colour[tone])} />;
}

function Line({ tone, children }: { tone: 'on' | 'off' | 'blocked'; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm">
      <Dot tone={tone} />
      <span>{children}</span>
    </p>
  );
}

/**
 * "Alerts on this device" (owner, 30 Oct 2026; approved mock `PUSH-OFFLINE-mock.html`). One button
 * turns alerts on for this phone or computer; turning on sends a first alert to show it works.
 * Hidden while the server has no alert keys.
 */
export function AlertsSection() {
  const { state, busy, firstAlertSent, problem, turnOn, turnOff } = useAlertSwitch();
  if (!state) return null;

  return (
    <SettingsSection title="Alerts on this device" help={HELP}>
      <AlertBody
        state={state}
        busy={busy}
        firstAlertSent={firstAlertSent}
        onOn={() => void turnOn()}
        onOff={() => void turnOff()}
      />
      {problem && <InlineNotification kind="error">{problem}</InlineNotification>}
    </SettingsSection>
  );
}

function AlertBody({
  state,
  busy,
  firstAlertSent,
  onOn,
  onOff,
}: {
  state: AlertState;
  busy: boolean;
  firstAlertSent: boolean | null;
  onOn: () => void;
  onOff: () => void;
}) {
  if (state === 'on')
    return (
      <>
        <Line tone="on">
          On for this device.
          {firstAlertSent === true && ' You got a first alert to show it works.'}
          {firstAlertSent === false &&
            ' The first alert could not be sent just now; alerts still come.'}
        </Line>
        <Button variant="ghost" className="-ml-4 w-fit" loading={busy} onClick={onOff}>
          Turn off
        </Button>
      </>
    );
  if (state === 'blocked')
    return (
      <>
        <Line tone="blocked">
          Blocked: this browser was told not to show alerts from NorthList.
        </Line>
        <p className="text-sm text-text-secondary">
          To allow them, open the site settings for NorthList in your browser (the icon left of the
          address), set Notifications to Allow, then come back here.
        </p>
      </>
    );
  if (state === 'home-screen-first')
    return (
      <>
        <p className="text-sm">
          On iPhone and iPad, alerts work only in the NorthList app on your Home Screen:
        </p>
        <ol className="list-decimal pl-5 text-sm text-text-secondary">
          <li>Tap Share, then "Add to Home Screen".</li>
          <li>Open NorthList from the Home Screen.</li>
          <li>Come back here and turn alerts on.</li>
        </ol>
      </>
    );
  if (state === 'unsupported')
    return <p className="text-sm text-text-secondary">This browser cannot show alerts.</p>;
  return (
    <>
      <Line tone="off">Off on this device.</Line>
      <Button variant="tertiary" className="w-fit" loading={busy} onClick={onOn}>
        Turn on alerts
      </Button>
    </>
  );
}
