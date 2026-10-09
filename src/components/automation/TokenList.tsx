import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import { api, isApiError } from '../../api/client';
import {
  INTEGRATION_TOKEN_EXPIRY_WARNING_DAYS,
  INTEGRATION_TOKEN_MAX_ACTIVE,
  type IntegrationToken,
} from '../../contracts/integrationToken';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Pagination } from '../ui/pagination';

const STATUS = {
  active: { label: 'Active', variant: 'success' },
  expired: { label: 'Expired', variant: 'outline' },
  revoked: { label: 'Revoked', variant: 'outline' },
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
    <li className="border border-border-default bg-surface p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-words">{token.name}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
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
          <p role="alert" className="text-xs text-status-error">
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
              variant="tertiary"
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
    <section aria-labelledby="tokens-heading" className="space-y-3">
      <h3 id="tokens-heading" className="text-lg font-semibold">
        Your tokens
      </h3>
      <p className="text-xs text-text-secondary">
        Up to {INTEGRATION_TOKEN_MAX_ACTIVE} active tokens. Revoked tokens stay listed.
      </p>
      {isLoading && <p role="status">Loading tokens…</p>}
      {error && <p role="alert">Could not load tokens: {error.message}</p>}
      {data && data.items.length === 0 && (
        <p className="text-sm text-text-secondary">
          {offset > 0 ? 'No tokens on this page.' : 'No tokens yet.'}
        </p>
      )}
      {data && data.items.length > 0 && (
        <ul className="space-y-2">
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
    </section>
  );
}
