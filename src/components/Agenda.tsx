import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "../api/client";
import type {
  AgendaItem,
  AgendaQuery,
  UpdateAgenda,
} from "../contracts/agenda";
import { browserTimeZone } from "../lib/workspace";
import { resolveTemporal } from "../contracts/temporal";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Pagination } from "./ui/pagination";
import { GmailLink } from "./ui/GmailLink";

function agendaWhen(item: AgendaItem, timeZone: string) {
  if (item.timing.precision === "DATE")
    return `${item.timing.date} · Time not specified`;
  if (item.timing.precision === "DATETIME" && item.timing.instant)
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(item.timing.instant));
  return "Timing needs confirmation";
}
const views = {
  upcoming: "Upcoming",
  review: "Needs review",
  past: "Past",
  history: "History",
} as const;
export function Agenda() {
  const client = useQueryClient();
  const heading = useRef<HTMLHeadingElement>(null);
  const [view, setView] = useState<AgendaQuery["view"]>("upcoming");
  const [archive, setArchive] = useState<"active" | "archived" | "all">(
    "active",
  );
  const [offset, setOffset] = useState(0);
  const [timeZone] = useState(browserTimeZone);
  const [selected, setSelected] = useState<AgendaItem | null>(null);
  const query = useQuery({
    queryKey: ["agenda", view, timeZone, offset, archive],
    queryFn: ({ signal }) =>
      api.getAgenda({ view, timeZone, offset, limit: 20, archive }, { signal }),
  });
  const close = () => {
    setSelected(null);
    queueMicrotask(() => heading.current?.focus());
  };
  if (
    query.data &&
    !query.isFetching &&
    !query.error &&
    !query.data.items.length &&
    offset > 0
  )
    setOffset(0);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">
            Agenda
          </h1>
          <p className="text-sm text-text-secondary">
            Interviews and assessment dates · {timeZone}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            void client.invalidateQueries({ queryKey: ["agenda"] })
          }
        >
          Refresh agenda
        </Button>
      </div>
      <p className="text-sm text-text-secondary">
        Suggestions need your confirmation. Earlier emails may have no agenda
        coverage.
      </p>
      {query.data && !query.data.extractionEnabled && (
        <p className="text-sm">
          New agenda suggestions are currently disabled. Existing items remain
          available.
        </p>
      )}
      <div className="flex flex-wrap gap-2" aria-label="Agenda views">
        {Object.entries(views).map(([key, label]) => (
          <Button
            key={key}
            variant={view === key ? "primary" : "outline"}
            aria-pressed={view === key}
            onClick={() => {
              setView(key as AgendaQuery["view"]);
              setOffset(0);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <label className="block text-sm">
        Application visibility
        <select
          className="ml-2 border border-border bg-background p-2"
          value={archive}
          onChange={(e) => {
            setArchive(e.target.value as typeof archive);
            setOffset(0);
          }}
        >
          <option value="active">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
      </label>
      {view === "history" && (
        <p className="text-sm">
          History is ordered by when suggestions were recorded, including
          retired links.
        </p>
      )}
      {query.isPending && <p role="status">Loading agenda…</p>}
      {query.error && (
        <p role="alert">
          Agenda could not be refreshed. Use Refresh agenda to try again.
        </p>
      )}
      {!query.error && query.data && (
        <>
          {!query.data.items.length && <p>No stored items in this view.</p>}
          {query.data.items.map((item) => (
            <article
              key={item.id}
              className="border border-border p-4 space-y-2 break-words"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h2 className="font-semibold">
                  {item.suggestion.kind === "INTERVIEW"
                    ? "Interview"
                    : "Assessment due"}{" "}
                  · {item.application.companyName}
                </h2>
                <span className="text-sm">
                  {item.retiredAt ? "Retired" : item.state.toLowerCase()}
                </span>
              </div>
              <p>{agendaWhen(item, timeZone)}</p>
              {item.suggestion.change !== "SCHEDULED" && (
                <p className="text-sm">
                  This email suggests a{" "}
                  {item.suggestion.change === "CANCELLED"
                    ? "cancellation"
                    : "reschedule"}
                  . Review related items separately; saving here does not change
                  another event.
                </p>
              )}
              <details>
                <summary className="cursor-pointer text-sm underline">
                  Original suggestion and source
                </summary>
                <div className="mt-2 space-y-2 text-sm">
                  <p>
                    {item.suggestion.rawWhen || "No clear timing in the source"}
                  </p>
                  <p>
                    {item.suggestion.evidence || "Evidence excerpt unavailable"}
                  </p>
                  <p>Source: {item.email.subject || "(No subject)"}</p>
                  {item.suggestion.sourceTimeZone && (
                    <p>Source timezone: {item.suggestion.sourceTimeZone}</p>
                  )}
                  {item.email.threadId && (
                    <GmailLink
                      threadId={item.email.threadId}
                      subject={item.email.subject}
                    />
                  )}
                </div>
              </details>
              {item.retiredAt && (
                <p className="text-sm">
                  Retired after the email link was{" "}
                  {item.retiredReason === "EMAIL_MOVED" ? "moved" : "removed"}.
                </p>
              )}
              <div className="flex flex-wrap gap-3 items-center">
                <Link
                  className="underline text-sm"
                  to="/applications/$id"
                  params={{ id: item.applicationId }}
                >
                  Application
                </Link>
                {item.applicationArchived && (
                  <p className="text-sm">
                    Archived application; restore it before editing.
                  </p>
                )}
                {!item.retiredAt && !item.applicationArchived && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelected(item)}
                  >
                    Review / edit
                  </Button>
                )}
              </div>
            </article>
          ))}
          {(offset > 0 || query.data.metadata.nextOffset !== null) && (
            <Pagination
              offset={offset}
              limit={20}
              hasNext={
                !query.isFetching && query.data.metadata.nextOffset !== null
              }
              onPrevious={() => setOffset(Math.max(0, offset - 20))}
              onNext={() => setOffset(query.data!.metadata.nextOffset!)}
            />
          )}
        </>
      )}
      {selected && <AgendaEditor item={selected} close={close} />}
    </section>
  );
}
function AgendaEditor({
  item,
  close,
}: {
  item: AgendaItem;
  close: () => void;
}) {
  const client = useQueryClient();
  const [date, setDate] = useState(
    item.timing.date ?? item.suggestion.date ?? "",
  );
  const [time, setTime] = useState(item.timing.time ?? "");
  const [zone, setZone] = useState(item.timing.sourceTimeZone ?? "");
  const [state, setState] = useState<NonNullable<UpdateAgenda["state"]>>(
    item.state === "TENTATIVE" ? "CONFIRMED" : item.state,
  );
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [settledFailure, setSettledFailure] = useState(false);
  const save = async () => {
    if (pending || settledFailure) return;
    const timing = {
      date: date || null,
      time: time || null,
      sourceTimeZone: zone || null,
    };
    if (
      state !== "CANCELLED" &&
      resolveTemporal(timing).precision === "UNRESOLVED"
    ) {
      setError(
        "Enter a valid date and, for a time, an explicit timezone or UTC offset. Ambiguous daylight-saving times need an explicit offset.",
      );
      return;
    }
    setPending(true);
    setError("");
    try {
      await api.updateAgenda(item.id, {
        expectedRevision: item.revision,
        state,
        ...(state === "CANCELLED" ? {} : { timing }),
      });
      close();
    } catch (error) {
      setSettledFailure(true);
      setError(
        isApiError(error) && !error.outcomeUncertain
          ? "The item changed or cannot be saved. Close and reopen it after reviewing the refreshed state."
          : "Save outcome is uncertain. The agenda was refreshed; close and review its current state before another attempt.",
      );
    } finally {
      setPending(false);
      await Promise.all(
        ["agenda", "workspace", "application", "applications"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <DialogContent>
        <DialogTitle>Review agenda item</DialogTitle>
        <p className="text-sm my-3">
          Original: {item.suggestion.rawWhen}. This saves only this item.
        </p>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block text-sm">
            Date
            <input
              className="block border border-border bg-background p-2 w-full"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Time (leave empty for date only)
            <input
              className="block border border-border bg-background p-2 w-full"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Source timezone or UTC offset
            <input
              className="block border border-border bg-background p-2 w-full"
              placeholder="Asia/Kolkata or +05:30"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Item state
            <select
              className="block border border-border bg-background p-2 w-full"
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
            >
              <option value="CONFIRMED">Confirmed</option>
              <option value="CANCELLED">Cancelled</option>
              {item.state !== "TENTATIVE" && (
                <option value="COMPLETED">Completed</option>
              )}
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={close}
            >
              Close
            </Button>
            <Button type="submit" disabled={pending || settledFailure}>
              {pending ? "Saving…" : "Save item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
