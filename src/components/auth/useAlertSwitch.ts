import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useAlertKey } from '../../api/alerts';
import { isApiError } from '../../api/client';
import { alertState, turnOffHere, turnOnHere, type AlertState } from '../../lib/alerts';
import { OFFLINE_CHANGE } from '../../lib/offline';
import { showToast } from '../ui/toast';

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
 * Alerts on this device: whether they are on, and the way to turn them on or off. `state` is
 * undefined while it is read, and while the server has no alert keys (alerts are then hidden).
 * Used by the Account page and by the phone's Settings tab.
 */
export function useAlertSwitch() {
  const key = useAlertKey();
  const publicKey = key.data?.available ? key.data.publicKey : null;
  const [state, setState] = useAlertState(publicKey);
  const [busy, setBusy] = useState(false);
  const [firstAlertSent, setFirstAlertSent] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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
      if (!publicKey) return;
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
  return { state: publicKey ? state : undefined, busy, firstAlertSent, problem, turnOn, turnOff };
}
