import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "../api/client";
import type {
  ApplicationActionResponse,
  ApplicationResponse,
} from "../contracts/application";
import type { CreateFollowUp } from "../contracts/action";
import { resolveTemporal } from "../contracts/temporal";
import { browserTimeZone } from "../lib/workspace";
import { applyAcknowledgedApplication } from "../lib/applicationCache";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

const keys = [
  "workspace",
  "actions",
  "application-actions",
  "application",
  "applications",
  "agenda",
];
const inputClass = "block border border-border bg-background p-2 w-full";
function TimeFields({
  date,
  time,
  zone,
  setDate,
  setTime,
  setZone,
}: {
  date: string;
  time: string;
  zone: string;
  setDate: (v: string) => void;
  setTime: (v: string) => void;
  setZone: (v: string) => void;
}) {
  return (
    <>
      <label className="block text-sm">
        Date
        <input
          className={inputClass}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Time (optional for deadline)
        <input
          className={inputClass}
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Timezone or UTC offset
        <input
          className={inputClass}
          value={zone}
          onChange={(e) => setZone(e.target.value)}
        />
      </label>
    </>
  );
}
function manualDeadline(
  date: string,
  time: string,
  zone: string,
): CreateFollowUp["deadline"] {
  if (!date && !time) return null;
  const value = resolveTemporal({
    date: date || null,
    time: time || null,
    sourceTimeZone: zone || null,
  });
  if (value.precision === "DATE")
    return { precision: "DATE", value: value.date! };
  if (value.precision === "DATETIME")
    return { precision: "DATETIME", value: value.instant! };
  throw Error(
    "Enter a valid date and explicit timezone. Ambiguous daylight-saving times need a UTC offset.",
  );
}
export function FollowUpEditor({
  applicationId,
  action,
  disabled = false,
}: {
  applicationId: string;
  action?: ApplicationActionResponse;
  disabled?: boolean;
}) {
  const client = useQueryClient(),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [description, setDescription] = useState(""),
    [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [zone, setZone] = useState(browserTimeZone);
  const [revision, setRevision] = useState(0),
    [requestId, setRequestId] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [frozen, setFrozen] = useState<CreateFollowUp | null>(null),
    [checkedAbsent, setCheckedAbsent] = useState(false),
    [editFailed, setEditFailed] = useState(false);
  const close = () => {
    if (pending) return;
    setOpen(false);
    queueMicrotask(() => trigger.current?.focus());
  };
  const refresh = () =>
    Promise.all(
      keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
  const begin = () => {
    if (!frozen) {
      setDescription(action?.description ?? "");
      setDate(action?.deadline ? String(action.deadline).slice(0, 10) : "");
      setTime(
        action?.deadlinePrecision === "DATETIME"
          ? new Date(action.deadline!).toISOString().slice(11, 16)
          : "",
      );
      setZone(
        action?.deadlinePrecision === "DATETIME" ? "UTC" : browserTimeZone(),
      );
      setRevision(action?.actionRevision ?? 0);
      setRequestId(crypto.randomUUID());
      setError("");
      setEditFailed(false);
    }
    setOpen(true);
  };
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
        throw Error("Enter 1–500 characters.");
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setPending(true);
    setError("");
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
      queueMicrotask(() => trigger.current?.focus());
    } catch (e) {
      if (!action && (!isApiError(e) || e.outcomeUncertain)) {
        setFrozen(draft);
        setCheckedAbsent(false);
        setError(
          "Creation is uncertain. Check the saved receipt before retrying. Your draft and request identity are retained.",
        );
      } else {
        setEditFailed(Boolean(action));
        setError(
          "Could not save. Review the refreshed state before another attempt.",
        );
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
      queueMicrotask(() => trigger.current?.focus());
    } catch (e) {
      setCheckedAbsent(isApiError(e) && e.status === 404);
      setError(
        isApiError(e) && e.status === 404
          ? "No receipt is visible yet; the earlier request may still be running. Check again or deliberately retry the same request."
          : "The receipt could not be checked. Keep this draft and try checking again.",
      );
    } finally {
      setPending(false);
      await refresh();
    }
  };
  return (
    <>
      <Button
        ref={trigger}
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={begin}
      >
        {action
          ? "Edit follow-up"
          : frozen
            ? "Resolve follow-up creation"
            : "Add follow-up"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <DialogTitle>
            {action ? "Edit personal follow-up" : "Add personal follow-up"}
          </DialogTitle>
          <p className="text-sm my-3">
            For your own tracking. This does not send an email or notification.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <fieldset
              disabled={pending || !!frozen || editFailed}
              className="space-y-4"
            >
              <label className="block text-sm">
                Follow-up description
                <textarea
                  className={inputClass}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </label>
              <p className="text-sm">
                Optional deadline; leave date and time empty for undated work.
              </p>
              <TimeFields
                {...{ date, time, zone, setDate, setTime, setZone }}
              />
            </fieldset>
            {error && <p role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={close}
              >
                Close
              </Button>
              {frozen ? (
                <>
                  <Button
                    type="button"
                    disabled={pending}
                    onClick={() => void reconcile()}
                  >
                    Check saved follow-up
                  </Button>
                  {checkedAbsent && (
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => void save(true)}
                    >
                      Retry same request
                    </Button>
                  )}
                </>
              ) : (
                <Button type="submit" disabled={pending || editFailed}>
                  Save follow-up
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function SnoozeControl({
  action,
  disabled = false,
}: {
  action: ApplicationActionResponse;
  disabled?: boolean;
}) {
  const client = useQueryClient(),
    trigger = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState<ApplicationActionResponse | null>(
      null,
    ),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [failed, setFailed] = useState(false);
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [zone, setZone] = useState(browserTimeZone);
  const snoozed =
    !!action.snoozedUntil;
  const close = () => {
    if (!pending) {
      setSnapshot(null);
      queueMicrotask(() => trigger.current?.focus());
    }
  };
  const save = async (unsnooze = false) => {
    if (!snapshot || pending || failed) return;
    const timing = resolveTemporal({
      date: date || null,
      time: time || null,
      sourceTimeZone: zone || null,
    });
    if (
      !unsnooze &&
      (timing.precision !== "DATETIME" ||
        !timing.instant ||
        Date.parse(timing.instant) <= Date.now())
    ) {
      setError(
        "Choose a future date, time and explicit timezone. Ambiguous times need a UTC offset.",
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      await api.snoozeAction(snapshot.id, {
        expectedActionRevision: snapshot.actionRevision,
        snoozedUntil: unsnooze ? null : timing.instant,
      });
      setSnapshot(null);
      queueMicrotask(() => trigger.current?.focus());
    } catch {
      setFailed(true);
      setError(
        "Save could not be confirmed. Close and review the refreshed action before retrying.",
      );
    } finally {
      setPending(false);
      await Promise.all(
        keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    }
  };
  return (
    <>
      <Button
        ref={trigger}
        size="sm"
        variant="outline"
        disabled={disabled || action.status !== "PENDING"}
        onClick={() => {
          setSnapshot(action);
          setFailed(false);
          setError("");
          setDate("");
          setTime("");
        }}
      >
        {snoozed ? "Change snooze" : "Snooze"}
      </Button>
      <Dialog
        open={!!snapshot}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <DialogTitle>Snooze action</DialogTitle>
          <p className="text-sm my-3">
            Hide this pending action until the chosen time. Its deadline stays
            unchanged. No reminder is sent.
          </p>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <TimeFields {...{ date, time, zone, setDate, setTime, setZone }} />
            {error && <p role="alert">{error}</p>}
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={close}
              >
                Close
              </Button>
              {snapshot?.snoozedUntil && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || failed}
                  onClick={() => void save(true)}
                >
                  Unsnooze
                </Button>
              )}
              <Button type="submit" disabled={pending || failed}>
                Save snooze
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function ArchiveControl({
  application,
  disabled = false,
}: {
  application: ApplicationResponse;
  disabled?: boolean;
}) {
  const client = useQueryClient(),
    trigger = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState<ApplicationResponse | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const close = () => {
    if (!pending) {
      setSnapshot(null);
      queueMicrotask(() => trigger.current?.focus());
    }
  };
  const save = async () => {
    if (!snapshot || pending || error) return;
    setPending(true);
    try {
      const saved = await api.archiveApplication(snapshot.id, {
        expectedArchiveRevision: snapshot.archiveRevision,
        archived: !snapshot.archivedAt,
      });
      applyAcknowledgedApplication(client, saved);
      setSnapshot(null);
      queueMicrotask(() => trigger.current?.focus());
    } catch {
      setError(
        "Save could not be confirmed. Close and review the refreshed application before retrying.",
      );
    } finally {
      setPending(false);
      await Promise.all(
        keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    }
  };
  return (
    <>
      <Button
        ref={trigger}
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => {
          setSnapshot(application);
          setError("");
        }}
      >
        {application.archivedAt ? "Restore application" : "Archive application"}
      </Button>
      <Dialog
        open={!!snapshot}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent>
          <DialogTitle>
            {snapshot?.archivedAt
              ? "Restore application"
              : "Archive application"}
          </DialogTitle>
          <p className="my-4 text-sm">
            {snapshot?.archivedAt
              ? "Return this application and its pending work to your active views. Prior notifications will not be replayed."
              : "Hide this application from active lists, work and agenda. Status, history and linked emails are preserved; linked mail continues to be tracked. Restore before adding or editing work."}
          </p>
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button disabled={pending} variant="outline" onClick={close}>
              Close
            </Button>
            <Button disabled={pending || !!error} onClick={() => void save()}>
              {snapshot?.archivedAt ? "Restore" : "Archive"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
