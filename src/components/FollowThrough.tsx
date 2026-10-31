import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ApplicationActionResponse } from '../contracts/application';
import { resolveTemporal } from '../contracts/temporal';
import {
  focusLater,
  refreshFollowThrough,
  type DialogHandle,
  type TriggerOptions,
} from '../lib/dialogs';
import { browserTimeZone } from '../lib/workspace';
import { TimeFields } from './TimeFields';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { InlineNotification } from './ui/notification';
import { OFFLINE_CHANGE, isOfflineError } from '../lib/offline';

const CLOCK_CHANGE =
  'If the clocks change at that time in this time zone, choose another time or the UTC zone.';

/** Hides an open to-do until a chosen time. Its due date stays as it is. */
export function SnoozeControl({
  action,
  disabled = false,
  ref,
  trigger: showTrigger = true,
  returnFocus,
}: {
  action: ApplicationActionResponse;
  disabled?: boolean;
  ref?: Ref<DialogHandle>;
} & TriggerOptions) {
  const client = useQueryClient(),
    trigger = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState<ApplicationActionResponse | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [failed, setFailed] = useState(false);
  const [date, setDate] = useState(''),
    [time, setTime] = useState(''),
    [zone, setZone] = useState(browserTimeZone);
  const snoozed = !!action.snoozedUntil;
  const giveFocusBack = () => focusLater(showTrigger ? trigger : returnFocus);
  const close = () => {
    if (!pending) {
      setSnapshot(null);
      giveFocusBack();
    }
  };
  const begin = () => {
    if (action.status !== 'PENDING') return;
    setSnapshot(action);
    setFailed(false);
    setError('');
    setDate('');
    setTime('');
    setZone(browserTimeZone());
  };
  useImperativeHandle(ref, () => ({ open: begin }));
  const save = async (unsnooze = false) => {
    if (!snapshot || pending || failed) return;
    const timing = resolveTemporal({
      date: date || null,
      time: time || null,
      sourceTimeZone: zone || null,
    });
    if (
      !unsnooze &&
      (timing.precision !== 'DATETIME' ||
        !timing.instant ||
        Date.parse(timing.instant) <= Date.now())
    ) {
      setError(`Choose a date and time in the future, and a time zone. ${CLOCK_CHANGE}`);
      return;
    }
    setPending(true);
    setError('');
    try {
      await api.snoozeAction(snapshot.id, {
        expectedActionRevision: snapshot.actionRevision,
        snoozedUntil: unsnooze ? null : timing.instant,
      });
      setSnapshot(null);
      giveFocusBack();
    } catch (problem) {
      // Offline nothing was sent, so the user may try again once back online.
      if (isOfflineError(problem)) return void setError(OFFLINE_CHANGE);
      setFailed(true);
      setError('We could not confirm the snooze. Close this and look at the to-do again.');
    } finally {
      setPending(false);
      await refreshFollowThrough(client);
    }
  };
  return (
    <>
      {showTrigger && (
        <Button
          ref={trigger}
          size="sm"
          variant="tertiary"
          disabled={disabled || action.status !== 'PENDING'}
          onClick={begin}
        >
          {snoozed ? 'Change snooze' : 'Snooze'}
        </Button>
      )}
      <Dialog
        open={!!snapshot}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <DialogHeader>
              <DialogTitle>Snooze this step</DialogTitle>
              <DialogDescription>
                It leaves your lists and comes back at this time. Its due date stays. No reminder is
                sent.
              </DialogDescription>
            </DialogHeader>
            <TimeFields {...{ date, time, zone, setDate, setTime, setZone }} timeLabel="Time" />
            {error && (
              <InlineNotification kind="error" className="mt-6">
                {error}
              </InlineNotification>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" disabled={pending} onClick={close}>
                Close
              </Button>
              {snapshot?.snoozedUntil && (
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={pending || failed}
                  onClick={() => void save(true)}
                >
                  Unsnooze
                </Button>
              )}
              <Button type="submit" disabled={pending || failed}>
                Save snooze
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
