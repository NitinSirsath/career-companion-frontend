import { useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import type { AIRetryApprovalDetails } from '../../contracts/email';
import { onlyCareerCompanionText } from '../../lib/mailAIStatus';
import {
  getProcessingRefreshUntil,
  startProcessingRefresh,
  subscribeProcessingRefresh,
} from '../../lib/processingRefresh';
import { refusedUntil, retryProblem, retryRefusedUntil } from '../../lib/retryApproval';
import { MailAIStatus } from '../ai/MailAIStatus';
import { RetryAnywayDialog } from '../ai/RetryAnywayDialog';
import { DataTable } from '../ui/data-table';
import { EmptyState } from '../ui/empty-state';
import { InlineNotification } from '../ui/notification';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { Tabs } from '../ui/tabs';
import { processedColumns } from './processedColumns';

type Tab = 'job_related' | 'irrelevant';
const LIMIT = 20;

/**
 * Definitive retry answers get their own message; only uncertain outcomes say "could not be
 * confirmed". `onlyUs` is the row's own words when only Career Companion may retry the mail.
 */
function retryMessage(err: unknown, onlyUs: string | null): string {
  if (!isApiError(err) || err.outcomeUncertain)
    return 'Retry could not be confirmed. The list will refresh to show where the mail is now.';
  switch (err.code) {
    case 'AI_ACCESS_UNAVAILABLE':
      return 'Fix AI access on the AI provider page before retrying.';
    case 'AI_OPERATION_REQUIRES_REVIEW':
      return (
        onlyUs ?? 'Only Career Companion can retry this email. This is our problem, not yours.'
      );
    case 'RETRY_RECENTLY_QUEUED':
      return 'A retry was queued recently. Give it a few minutes.';
    case 'AI_OPERATION_CHANGED':
      return 'This email changed. The list will refresh.';
    default:
      return err.message;
  }
}

/** Retrying a mail the AI could not read, and the OK an uncertain earlier attempt needs. */
function useRetries() {
  const queryClient = useQueryClient();
  const [approval, setApproval] = useState<{
    emailId: string;
    details: AIRetryApprovalDetails;
  } | null>(null);
  // A retry the server took: the mail shows as stopped until the worker takes it.
  const [sent, setSent] = useState<string | null>(null);
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: ['gmailMessages'] });
    startProcessingRefresh();
  };
  const retry = useMutation({
    mutationFn: (emailId: string) => api.retryEmail(emailId),
    retry: false,
    onSuccess: (_, emailId) => setSent(emailId),
    onError: (err, emailId) => {
      // An uncertain earlier AI attempt: ask the user who pays before one more call.
      if (isApiError(err) && err.code === 'AI_RETRY_NEEDS_APPROVAL')
        setApproval({ emailId, details: err.details as AIRetryApprovalDetails });
    },
    onSettled: settle,
  });
  // Sent only after the user confirmed in the dialog; never resent automatically.
  const approve = useMutation({
    mutationFn: (emailId: string) =>
      api.retryEmail(emailId, { acceptPossibleDuplicateCharge: true }),
    retry: false,
    onSuccess: (_, emailId) => {
      setApproval(null);
      setSent(emailId);
    },
    // AI cannot be used until a time: the row shows it, so the dialog closes.
    onError: (err) => {
      if (refusedUntil(err) || (isApiError(err) && err.outcomeUncertain)) setApproval(null);
    },
    onSettled: settle,
  });
  return { retry, approve, approval, setApproval, sent, setSent };
}

/**
 * Whether mails wait for the user's AI access (that is not active reading), and the running
 * pauses of the models the setup uses.
 */
function useAiAccess() {
  const { data } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });
  return { aiWaiting: !!data && data.access.state !== 'READY', pauses: data?.access.pauses ?? [] };
}

/** The page of read mails, read again while some are being read or wait for a retry. */
function useReadMails(tab: Tab, offset: number, aiWaiting: boolean, sent: string | null) {
  const refreshUntil = useSyncExternalStore(subscribeProcessingRefresh, getProcessingRefreshUntil);
  return useQuery({
    queryKey: ['gmailMessages', { offset, limit: LIMIT, activeTab: tab }],
    queryFn: () => api.getMessages({ offset, limit: LIMIT, relevance: tab }),
    refetchInterval: (query) => {
      const items = query.state.data?.items || [];
      if (
        Date.now() < refreshUntil &&
        items.some(
          (m) =>
            m.processingState === 'PROCESSING' ||
            (m.processingState === 'PENDING' && !aiWaiting) ||
            (m.processingState === 'FAILED' && m.id === sent),
        )
      )
        return 2000;
      return items.some((m) => m.processingState === 'PROCESSING' && m.processingStuck === false)
        ? 15000
        : false;
    },
  });
}

/** What went wrong with a retry, and the dialog that asks for the OK. */
function RetryProblems({
  retries,
  onlyUs,
}: {
  retries: ReturnType<typeof useRetries>;
  onlyUs: (emailId: string | undefined) => string | null;
}) {
  const { retry, approve, approval, setApproval } = retries;
  return (
    <>
      {retryProblem(retry.error) && (
        <InlineNotification kind="error">
          {retryMessage(retry.error, onlyUs(retry.variables))}
        </InlineNotification>
      )}
      {!approval && retryProblem(approve.error) && (
        <InlineNotification kind="error">
          {retryMessage(approve.error, onlyUs(approve.variables))}
        </InlineNotification>
      )}
      <RetryAnywayDialog
        details={approval?.details ?? null}
        pending={approve.isPending}
        problem={
          approve.isError && approval
            ? retryMessage(approve.error, onlyUs(approve.variables))
            : null
        }
        onConfirm={() => approval && approve.mutate(approval.emailId)}
        onCancel={() => {
          setApproval(null);
          approve.reset();
        }}
      />
    </>
  );
}

function ReadMailsEmpty({ failed, tab }: { failed: boolean; tab: Tab }) {
  if (failed)
    return <SectionError className="my-4" title="Could not load the mails the app has read" />;
  return (
    <EmptyState title={tab === 'job_related' ? 'No job mails read yet' : 'No other mails read yet'}>
      Mails appear here after a sync reads them.
    </EmptyState>
  );
}

/** Every mail a sync read, job mails or not, with what the app and the AI made of it. */
export function ProcessedMails({
  devMode,
  offset,
  onOffset: setOffset,
}: {
  devMode: boolean;
  /** Kept by the page, which starts the list again after a sync or a disconnect. */
  offset: number;
  onOffset: (offset: number) => void;
}) {
  const [tab, setTab] = useState<Tab>('job_related');
  const { aiWaiting, pauses } = useAiAccess();
  const retries = useRetries();
  const { retry, approve, sent, setSent } = retries;

  const messages = useReadMails(tab, offset, aiWaiting, sent);
  const items = messages.data?.items ?? [];
  // The sent retry is on its row once the list shows the mail in another state.
  if (items.some((m) => m.id === sent && m.processingState !== 'FAILED')) setSent(null);
  // A refused retry in the words of the mail's row, as the list shows it now.
  const onlyUs = (emailId: string | undefined) =>
    onlyCareerCompanionText(items.find((m) => m.id === emailId));
  const nextOffset = messages.data?.metadata?.nextOffset ?? null;

  return (
    <section aria-labelledby="read-mails-heading" className="flex flex-col gap-4 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="read-mails-heading" className="text-base leading-[22px] font-semibold">
            Mails the app has read
          </h2>
          <p className="text-sm text-text-secondary">
            Check here when a job mail seems missing from Mails.
          </p>
        </div>
        <Tabs<Tab>
          label="Mails the app has read"
          value={tab}
          onValueChange={(next) => {
            setTab(next);
            setOffset(0);
          }}
          items={[
            { value: 'job_related', label: 'Job mails' },
            { value: 'irrelevant', label: 'Not job mails' },
          ]}
        />
      </div>
      <RetryProblems retries={retries} onlyUs={onlyUs} />
      <DataTable
        label="Mails the app has read"
        data={messages.error ? [] : items}
        columns={processedColumns({
          devMode,
          renderAI: (msg) => (
            <MailAIStatus
              message={msg}
              pauses={pauses}
              refusedUntil={retryRefusedUntil([retry, approve], msg.id)}
              retryDisabled={retry.isPending || approve.isPending}
              onRetry={() => retry.mutate(msg.id)}
            />
          ),
        })}
        getRowId={(msg) => msg.id}
        gridTemplate="minmax(220px,2.2fr) minmax(160px,1.4fr) 128px minmax(170px,1.4fr) minmax(170px,1.4fr) 112px"
        loading={messages.isLoading}
        empty={<ReadMailsEmpty failed={!!messages.error} tab={tab} />}
      />
      {(offset > 0 || nextOffset) && (
        <Pagination
          offset={offset}
          limit={LIMIT}
          hasNext={!!nextOffset}
          onPrevious={() => setOffset(Math.max(0, offset - LIMIT))}
          onNext={() => nextOffset && setOffset(nextOffset)}
        />
      )}
    </section>
  );
}
