import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../api/client';
import type { ApplicationActionResponse } from '../contracts/application';
import type { CreateFollowUp } from '../contracts/action';
import { resolveTemporal } from '../contracts/temporal';
import { localDateTime } from '../lib/deadline';
import {
  focusLater,
  refreshFollowThrough,
  type DialogHandle,
  type TriggerOptions,
} from '../lib/dialogs';
import { browserTimeZone } from '../lib/workspace';
import { Field, TimeFields } from './TimeFields';
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
import { Textarea } from './ui/textarea';

const CLOCK_CHANGE =
  'If the clocks change at that time in this time zone, choose another time or the UTC zone.';

function manualDeadline(date: string, time: string, zone: string): CreateFollowUp['deadline'] {
  if (!date && !time) return null;
  const value = resolveTemporal({
    date: date || null,
    time: time || null,
    sourceTimeZone: zone || null,
  });
  if (value.precision === 'DATE') return { precision: 'DATE', value: value.date! };
  if (value.precision === 'DATETIME') return { precision: 'DATETIME', value: value.instant! };
  throw Error(`Enter a date, and a time zone with the time. ${CLOCK_CHANGE}`);
}

/** Adds or edits a personal follow-up: a to-do only for the user, with an optional due time. */
export function FollowUpEditor({
  applicationId,
  action,
  disabled = false,
  ref,
  trigger: showTrigger = true,
  triggerVariant = 'tertiary',
  triggerIcon,
  returnFocus,
}: {
  applicationId: string;
  action?: ApplicationActionResponse;
  disabled?: boolean;
  ref?: Ref<DialogHandle>;
} & TriggerOptions) {
  const client = useQueryClient(),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [description, setDescription] = useState(''),
    [date, setDate] = useState(''),
    [time, setTime] = useState(''),
    [zone, setZone] = useState(browserTimeZone);
  const [revision, setRevision] = useState(0),
    [requestId, setRequestId] = useState('');
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [frozen, setFrozen] = useState<CreateFollowUp | null>(null),
    [checkedAbsent, setCheckedAbsent] = useState(false),
    [editFailed, setEditFailed] = useState(false);
  const giveFocusBack = () => focusLater(showTrigger ? trigger : returnFocus);
  const close = () => {
    if (pending) return;
    setOpen(false);
    giveFocusBack();
  };
  const refresh = () => refreshFollowThrough(client);
  const begin = () => {
    if (!frozen) {
      const zone = browserTimeZone();
      const local =
        action?.deadline && action.deadlinePrecision === 'DATETIME'
          ? localDateTime(action.deadline, zone)
          : null;
      setDescription(action?.description ?? '');
      setDate(local?.date ?? (action?.deadline ? String(action.deadline).slice(0, 10) : ''));
      setTime(local?.time ?? '');
      setZone(zone);
      setRevision(action?.actionRevision ?? 0);
      setRequestId(crypto.randomUUID());
      setError('');
      setEditFailed(false);
    }
    setOpen(true);
  };
  useImperativeHandle(ref, () => ({ open: begin }));
  const save = async (retrySame = false) => {
    if (pending || editFailed || (frozen && !retrySame)) return;
    let draft: CreateFollowUp;
    try {
      draft = frozen ?? {
        clientRequestId: requestId,
        description: description.trim(),
        deadline: manualDeadline(date, time, zone),
      };
      if (!draft.description || draft.description.length > 500)
        throw Error('Write what to do, in 1 to 500 characters.');
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setPending(true);
    setError('');
    try {
      if (action)
        await api.editFollowUp(action.id, {
          description: draft.description,
          deadline: draft.deadline,
          expectedActionRevision: revision,
        });
      else await api.createFollowUp(applicationId, draft);
      setFrozen(null);
      setCheckedAbsent(false);
      setOpen(false);
      giveFocusBack();
    } catch (e) {
      if (!action && (!isApiError(e) || e.outcomeUncertain)) {
        setFrozen(draft);
        setCheckedAbsent(false);
        setError(
          'We could not confirm that it was saved. Check before you try again: your text is kept.',
        );
      } else {
        setEditFailed(Boolean(action));
        setError('Not saved. Close this and look at the follow-up again before another try.');
      }
    } finally {
      setPending(false);
      await refresh();
    }
  };
  const reconcile = async () => {
    if (!frozen || pending) return;
    setPending(true);
    try {
      await api.followUpByRequest(frozen.clientRequestId);
      setFrozen(null);
      setOpen(false);
      giveFocusBack();
    } catch (e) {
      setCheckedAbsent(isApiError(e) && e.status === 404);
      setError(
        isApiError(e) && e.status === 404
          ? 'It is not there yet; the first try may still be running. Check again, or send the same follow-up once more.'
          : 'We could not check it. Your text is kept: check again in a moment.',
      );
    } finally {
      setPending(false);
      await refresh();
    }
  };
  let triggerLabel = 'Add follow-up';
  if (action) triggerLabel = 'Edit follow-up';
  else if (frozen) triggerLabel = 'Resolve follow-up creation';
  return (
    <>
      {showTrigger && (
        <Button
          ref={trigger}
          size={triggerVariant === 'tertiary' ? 'sm' : 'default'}
          variant={triggerVariant}
          disabled={disabled}
          onClick={begin}
        >
          {triggerLabel}
          {triggerIcon}
        </Button>
      )}
      <Dialog
        open={open}
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
              <DialogTitle>{action ? 'Edit your follow-up' : 'Add a follow-up'}</DialogTitle>
              <DialogDescription>A to-do only for you. Nothing is sent.</DialogDescription>
            </DialogHeader>
            <fieldset disabled={pending || !!frozen || editFailed} className="flex flex-col gap-6">
              <Field label="Follow-up description">
                <Textarea
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </Field>
              <TimeFields
                {...{ date, time, zone, setDate, setTime, setZone }}
                timeLabel="Time (optional)"
              />
              <p className="-mt-3 text-xs text-text-secondary">
                Leave the date empty for a follow-up with no due date.
              </p>
            </fieldset>
            {error && (
              <InlineNotification kind="error" className="mt-6">
                {error}
              </InlineNotification>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" disabled={pending} onClick={close}>
                Close
              </Button>
              {frozen ? (
                <>
                  <Button type="button" disabled={pending} onClick={() => void reconcile()}>
                    Check saved follow-up
                  </Button>
                  {checkedAbsent && (
                    <Button type="button" disabled={pending} onClick={() => void save(true)}>
                      Retry same request
                    </Button>
                  )}
                </>
              ) : (
                <Button type="submit" disabled={pending || editFailed}>
                  Save follow-up
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
    } catch {
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
