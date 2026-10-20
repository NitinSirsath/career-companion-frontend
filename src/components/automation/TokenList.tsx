import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import { api, isApiError } from '../../api/client';
import {
  INTEGRATION_TOKEN_EXPIRY_WARNING_DAYS,
  type IntegrationToken,
} from '../../contracts/integrationToken';
import { Tag } from '../ui/tag';
import { Button } from '../ui/button';
import { Pagination } from '../ui/pagination';
import { SectionError } from '../ui/section-error';
import { SkeletonList } from '../ui/skeleton';

const STATUS = {
  active: { label: 'Active', color: 'green' },
  expired: { label: 'Expired', color: 'outline' },
  revoked: { label: 'Revoked', color: 'outline' },
} as const;

const date = (value: string) => format(new Date(value), 'MMM d, yyyy');

/** An expired token makes the tool disappear from the MCP client without an error (MCP-00 finding 4). */
function ExpiryWarning({ token, now }: { token: IntegrationToken; now: Date }) {
  if (token.status !== 'active') return null;
  const days = differenceInCalendarDays(new Date(token.expiresAt), now);
  if (days > INTEGRATION_TOKEN_EXPIRY_WARNING_DAYS) return null;
  return (
    <p className="text-xs text-status-warning">
      Expires {days <= 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}. After that your
      automation stops syncing without an error: create a new token before then.
    </p>
  );
}

function TokenRow({ token, now }: { token: IntegrationToken; now: Date }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const revoke = useMutation({
    mutationFn: () => api.revokeIntegrationToken(token.id),
    retry: false,
    onSettled: () => {
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['integrationTokens'] });
    },
  });
  const status = STATUS[token.status];
  return (
    <li className="flex flex-col justify-between gap-3 border-t border-border-subtle py-3 first:border-t-0 first:pt-0 md:flex-row md:items-center">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm break-words">{token.name}</span>
          <Tag color={status.color}>{status.label}</Tag>
        </div>
        <p className="text-xs text-text-secondary">
          <span className="font-mono">{token.displayPrefix}…</span> · Created{' '}
          {date(token.createdAt)} ·{' '}
          {token.status === 'revoked' && token.revokedAt
            ? `Revoked ${date(token.revokedAt)}`
            : `${token.status === 'expired' ? 'Expired' : 'Expires'} ${date(token.expiresAt)}`}{' '}
          · {token.lastUsedAt ? `Last used ${date(token.lastUsedAt)}` : 'Never used'}
        </p>
        <ExpiryWarning token={token} now={now} />
        {revoke.isError && (
          <p role="alert" className="text-xs text-danger-text">
            {isApiError(revoke.error) && revoke.error.outcomeUncertain
              ? 'We could not confirm the revoke. The list has been refreshed: check the status before trying again.'
              : `Could not revoke: ${revoke.error.message}`}
          </p>
        )}
      </div>
      {token.status === 'active' && (
        <div className="flex flex-wrap gap-2 shrink-0">
          {confirming ? (
            <>
              <span className="text-sm self-center">Your automation stops syncing at once.</span>
              <Button
                size="sm"
                variant="danger"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate()}
              >
                Revoke now
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                disabled={revoke.isPending}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="danger-ghost"
              onClick={() => setConfirming(true)}
              aria-label={`Revoke ${token.name}`}
            >
              Revoke
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

export function TokenList() {
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const { data, isLoading, error } = useQuery({
    queryKey: ['integrationTokens', { offset, limit }],
    queryFn: ({ signal }) => api.listIntegrationTokens({ offset, limit }, { signal }),
  });
  const now = new Date();
  return (
    <div className="flex flex-col gap-3">
      {isLoading && <SkeletonList rows={2} label="Loading tokens" />}
      {error && <SectionError title="Could not load your tokens" />}
      {data && data.items.length === 0 && (
        <p className="text-sm text-text-secondary">
          {offset > 0 ? 'No tokens on this page.' : 'No tokens yet. Create one in step 1.'}
        </p>
      )}
      {data && data.items.length > 0 && (
        <ul className="flex flex-col">
          {data.items.map((token) => (
            <TokenRow key={token.id} token={token} now={now} />
          ))}
        </ul>
      )}
      {data && (offset > 0 || data.metadata.nextOffset != null) && (
        <Pagination
          offset={offset}
          limit={limit}
          hasNext={data.metadata.nextOffset != null}
          onPrevious={() => setOffset(Math.max(0, offset - limit))}
          onNext={() => data.metadata.nextOffset != null && setOffset(data.metadata.nextOffset)}
        />
      )}
    </div>
  );
}
