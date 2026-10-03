import { FollowUpEditor, SnoozeControl } from './FollowThrough';
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "../api/client";
import type { WorkspaceBucket } from "../contracts";
import { deadlineLabel } from "../lib/deadline";
import {
  browserTimeZone,
  coverageMessages,
  transitionDelay,
} from "../lib/workspace";
import { Button } from "./ui/button";
import { Pagination } from "./ui/pagination";
import { GmailLink } from "./ui/GmailLink";

const buckets: WorkspaceBucket[] = [
  "all",
  "overdue",
  "today",
  "later",
  "undated",
  "snoozed",
];
const labels = {
  all: "All",
  overdue: "Overdue",
  today: "Today",
  later: "Later",
  undated: "Undated",
  snoozed: "Snoozed",
};

export function DailyWorkspace() {
  const client = useQueryClient();
  const [selection, setSelection] = useState(() => ({
    bucket: "all" as WorkspaceBucket,
    timeZone: browserTimeZone(),
    offset: 0,
    limit: 20,
  }));
  const heading = useRef<HTMLHeadingElement>(null);
  const actions = useQuery({
    queryKey: ["workspace", "actions", selection],
    queryFn: ({ signal }) => api.getWorkspaceActions(selection, { signal }),
  });
  const review = useQuery({
    queryKey: ["workspace", "review"],
    queryFn: ({ signal }) => api.getWorkspaceReview({ signal }),
  });
  const gmail = useQuery({
    queryKey: ["gmailStatus"],
    queryFn: ({ signal }) => api.getGmailStatus({ signal }),
  });
  const ai = useQuery({
    queryKey: ["aiSettings"],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      setSelection((current) => ({
        ...current,
        timeZone: browserTimeZone(),
        offset: 0,
      }));
      void client.invalidateQueries({ queryKey: ["workspace"] });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (document.visibilityState === "hidden" || !actions.data) return;
      const delay = transitionDelay(
        actions.data,
        Math.max(0, Date.now() - actions.dataUpdatedAt),
      );
      if (delay !== null) timer = setTimeout(refresh, delay);
    };
    const resume = () => {
      if (document.visibilityState !== "hidden") refresh();
      schedule();
    };
    schedule();
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [client, actions.data, actions.dataUpdatedAt]);

  // Reset only this component's page as soon as the settled response proves it vanished.
  if (
    actions.data &&
    !actions.isFetching &&
    !actions.error &&
    !actions.data.items.length &&
    selection.offset > 0
  )
    setSelection({ ...selection, offset: 0 });

  const update = useMutation({
    retry: false,
    mutationFn: ({
      id,
      status, revision,
    }: {
      id: string;
      revision: number;
      status: "COMPLETED" | "DISMISSED";
    }) => api.updateAction(id, { status, expectedActionRevision: revision }),
    onSettled: async () => {
      setSelection((current) => ({ ...current, offset: 0 }));
      await Promise.all(
        [
          "workspace",
          "actions",
          "application",
          "applications",
          "application-actions",
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
      heading.current?.focus();
    },
  });

  const data = actions.data;
  const refresh = () => {
    setSelection((current) => ({ ...current, offset: 0 }));
    for (const key of ["workspace", "gmailStatus", "aiSettings"])
      void client.invalidateQueries({ queryKey: [key] });
  };
  return (
    <section aria-label="Daily workspace" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2">
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
            Action Center
          </h2>
          <p className="text-sm text-muted-foreground">
            Dates shown in {selection.timeZone}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          Refresh workspace
        </Button>
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Action buckets"
      >
        {buckets.map((bucket) => (
          <Button
            key={bucket}
            size="sm"
            variant={bucket === selection.bucket ? "primary" : "outline"}
            aria-pressed={bucket === selection.bucket}
            onClick={() =>
              setSelection((current) => ({ ...current, bucket, offset: 0 }))
            }
          >
            {labels[bucket]}
            {data && !actions.error
              ? ` (${bucket === "all" ? data.counts.totalPending - data.counts.snoozed : data.counts[bucket]})`
              : ""}
          </Button>
        ))}
      </div>
      {actions.isPending && <p role="status">Loading stored actions…</p>}
      {actions.error && (
        <p role="alert">
          Could not refresh stored actions. Counts are unavailable. Use Refresh
          workspace to try again.
        </p>
      )}
      {update.error && (
        <p role="alert">
          {!isApiError(update.error) || update.error.outcomeUncertain
            ? "The action update could not be confirmed. Check its current state before trying again."
            : update.error.message}
        </p>
      )}
      {!actions.error && data && (
        <>
          {!data.items.length && (
            <p>
              {data.counts.totalPending === 0
                ? "No stored pending actions."
                : `No actions in ${labels[selection.bucket].toLowerCase()} on this page.`}
            </p>
          )}
          <div className="space-y-3">
            {data.items.map((action) => (
              <article
                key={action.id}
                className="border border-border p-4 flex flex-col md:flex-row gap-4 justify-between"
              >
                <div className="min-w-0 space-y-2">
                  <p className="font-medium break-words">
                    {action.description || action.type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-text-secondary">{action.origin === 'USER' ? 'Personal follow-up' : action.emailId ? 'From email' : 'Source unknown'}</p>
                  {action.snoozedUntil && Date.parse(action.snoozedUntil) > Date.parse(data.generatedAt) && <p className="text-sm">Snoozed until {new Date(action.snoozedUntil).toLocaleString(undefined, { timeZone: selection.timeZone })}. Original deadline unchanged.</p>}
                  {action.deadline && (
                    <p className="text-sm">
                      Due: {deadlineLabel(action, false, selection.timeZone)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      to="/applications/$id"
                      params={{ id: action.applicationId }}
                      className="underline break-words"
                    >
                      {action.application.companyName}
                      {action.application.jobTitle
                        ? ` — ${action.application.jobTitle}`
                        : ""}
                    </Link>
                    {action.email?.threadId && (
                      <GmailLink
                        threadId={action.email.threadId}
                        subject={action.email.subject}
                      />
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  <Button
                    size="sm"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ id: action.id, status: "COMPLETED", revision: action.actionRevision })
                    }
                  >
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ id: action.id, status: "DISMISSED", revision: action.actionRevision })
                    }
                  >
                    Dismiss
                  </Button>
                  <SnoozeControl action={action}/>
                  {action.origin === 'USER' && <FollowUpEditor applicationId={action.applicationId} action={action}/>}
                </div>
              </article>
            ))}
          </div>
          {(selection.offset > 0 || data.metadata.nextOffset !== null) && (
            <Pagination
              offset={selection.offset}
              limit={20}
              hasNext={!actions.isFetching && data.metadata.nextOffset !== null}
              onPrevious={() =>
                setSelection((current) => ({
                  ...current,
                  offset: Math.max(0, current.offset - 20),
                }))
              }
              onNext={() =>
                data.metadata.nextOffset !== null &&
                setSelection((current) => ({
                  ...current,
                  offset: data.metadata.nextOffset!,
                }))
              }
            />
          )}
        </>
      )}
      <Link to="/agenda" className="inline-block underline text-sm">Review interviews and assessment dates</Link>
      <section aria-label="Review summary" className="space-y-2">
        <h3 className="font-semibold">Needs review</h3>
        {review.isPending && <p>Loading review counts…</p>}
        {review.error && <p role="alert">Review counts are unavailable.</p>}
        {!review.error && review.data && (
          <div className="flex flex-wrap gap-4 text-sm">
            <a className="underline" href="#unmatched-review">
              Unmatched emails ({review.data.unmatched})
            </a>
            <a className="underline" href="#ambiguous-review">
              Ambiguous emails ({review.data.ambiguous})
            </a>
            <a className="underline" href="#submission-review">
              Automation submissions ({review.data.pendingSubmissions})
            </a>
          </div>
        )}
      </section>
      <section
        aria-label="Input coverage"
        className="border border-border p-4 space-y-2 text-sm"
      >
        <h3 className="font-semibold">Input coverage</h3>
        {(gmail.error || ai.error) && (
          <p role="alert">Some coverage information could not be refreshed.</p>
        )}
        {coverageMessages(
          gmail.error ? undefined : gmail.data,
          ai.error ? undefined : ai.data,
        ).map((message) => (
          <p key={message}>{message}</p>
        ))}
        <div className="flex gap-4">
          <Link className="underline" to="/gmail">
            Gmail and processing
          </Link>
          <Link className="underline" to="/ai">
            AI settings
          </Link>
        </div>
      </section>
    </section>
  );
}
