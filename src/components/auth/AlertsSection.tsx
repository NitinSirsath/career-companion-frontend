import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useAlertKey } from '../../api/alerts';
import { isApiError } from '../../api/client';
import { alertState, turnOffHere, turnOnHere, type AlertState } from '../../lib/alerts';
import { OFFLINE_CHANGE } from '../../lib/offline';
import { cn } from '../../lib/utils';
import { SettingsSection } from '../layout/SettingsSection';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';

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

/** Why turning alerts on did not work, in the user's words. */
function problemText(error: unknown) {
  if (isApiError(error) && !error.outcomeUncertain) return error.message;
  return 'Alerts could not be turned on. Try again.';
}

/** The state of this device, read from the browser; undefined while it is read. */
function useAlertState(publicKey: string | null) {
  const [state, setState] = useState<AlertState | undefined>(undefined);
  useEffect(() => {
    if (!publicKey) return;
    let current = true;
    void alertState(publicKey)
      .catch((): AlertState => 'unsupported')
      .then((found) => {
        if (current) setState(found);
      });
    return () => {
      current = false;
    };
  }, [publicKey]);
  return [state, setState] as const;
}

/**
 * "Alerts on this device" (owner, 30 Oct 2026; approved mock `PUSH-OFFLINE-mock.html`). One button
 * turns alerts on for this phone or computer; turning on sends a first alert to show it works.
 * Hidden while the server has no alert keys.
 */
export function AlertsSection() {
  const key = useAlertKey();
  const publicKey = key.data?.available ? key.data.publicKey : null;
  const [state, setState] = useAlertState(publicKey);
  const [busy, setBusy] = useState(false);
  const [firstAlertSent, setFirstAlertSent] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  if (!publicKey || !state) return null;

  const act = async (work: () => Promise<void>) => {
    if (!onlineManager.isOnline()) {
      showToast(OFFLINE_CHANGE, { offline: true });
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  };
  const turnOn = () =>
    act(async () => {
      try {
        const result = await turnOnHere(publicKey);
        setState(result.state);
        setFirstAlertSent(result.state === 'on' ? result.firstAlertSent : null);
      } catch (error) {
        setProblem(problemText(error));
      }
    });
  const turnOff = () =>
    act(async () => {
      try {
        await turnOffHere();
        setState('off');
        setFirstAlertSent(null);
      } catch {
        setProblem('Alerts could not be turned off. Try again.');
      }
    });

  return (
    <SettingsSection title="Alerts on this device" help={HELP}>
      <AlertBody
        state={state}
        busy={busy}
        firstAlertSent={firstAlertSent}
        onOn={turnOn}
        onOff={turnOff}
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
