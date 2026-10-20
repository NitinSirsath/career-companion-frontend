import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import { INTEGRATION_TOKEN_DEFAULT_EXPIRY_DAYS } from '../../contracts/integrationToken';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { InlineNotification } from '../ui/notification';
import { Select } from '../ui/select';

const EXPIRY_OPTIONS = [30, 90, 180, 365];

type Created = { plaintextToken: string; name: string };

/**
 * Creates an integration token and shows its plaintext once.
 *
 * The create API is called directly, not through a cached mutation, and the plaintext lives only in
 * this component's state: never in the query or mutation cache, the URL or browser storage. It is
 * dropped when the user confirms they saved it, and with the component on unmount.
 */
export function CreateTokenForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [days, setDays] = useState(INTEGRATION_TOKEN_DEFAULT_EXPIRY_DAYS);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The create request may have succeeded although its response was lost: never resent automatically.
  const [uncertain, setUncertain] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);

  const refreshList = () => queryClient.invalidateQueries({ queryKey: ['integrationTokens'] });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || uncertain || created) return;
    if (!name.trim()) {
      setProblem('Give the token a name, for example the computer it is used on.');
      return;
    }
    setPending(true);
    setProblem(null);
    try {
      const result = await api.createIntegrationToken({ name: name.trim(), expiresInDays: days });
      setCreated({ plaintextToken: result.plaintextToken, name: result.integrationToken.name });
      setCopied(null);
      setName('');
      void refreshList();
    } catch (err) {
      if (isApiError(err) && err.outcomeUncertain) {
        setUncertain(true);
        void refreshList();
      } else setProblem(isApiError(err) ? err.message : 'Creating the token failed. Try again.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.plaintextToken);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  }

  if (created)
    return (
      <section aria-label="Token created" className="flex flex-col gap-3 bg-notice-warning p-4">
        <p className="text-sm font-semibold">Copy your new token “{created.name}” now</p>
        <p className="text-sm">
          It will not be shown again. Anyone who has it can add submissions to your account until it
          expires or you revoke it. Keep it out of any repository.
        </p>
        <Label htmlFor="new-token" className="sr-only">
          New token
        </Label>
        <Input
          id="new-token"
          readOnly
          value={created.plaintextToken}
          onFocus={(e) => e.currentTarget.select()}
          autoComplete="off"
          spellCheck={false}
          data-1p-ignore
          data-lpignore="true"
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void copy()}>
            Copy token
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCreated(null)}>
            Done, I saved it
          </Button>
          {copied === 'yes' && (
            <span role="status" className="text-sm">
              Copied.
            </span>
          )}
          {copied === 'failed' && (
            <span role="status" className="text-sm">
              Could not copy. Select the token and copy it yourself.
            </span>
          )}
        </div>
      </section>
    );

  return (
    <form onSubmit={submit} aria-label="Create a token" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex max-w-80 min-w-56 flex-1 flex-col">
          <Label htmlFor="token-name" className="mb-2 text-xs text-text-secondary">
            Name
          </Label>
          <Input
            id="token-name"
            value={name}
            maxLength={100}
            placeholder="For example, Work laptop"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Select<string>
          id="token-expiry"
          label="Expires after"
          className="w-44"
          value={String(days)}
          options={EXPIRY_OPTIONS.map((d) => ({ value: String(d), label: `${d} days` }))}
          onValueChange={(next) => setDays(Number(next))}
        />
        <Button type="submit" disabled={uncertain} loading={pending}>
          {pending ? 'Creating…' : 'Create token'}
        </Button>
      </div>
      <p className="text-xs text-text-secondary">
        The token is shown once. Copy it before you leave the page.
      </p>
      {problem && <InlineNotification kind="error">{problem}</InlineNotification>}
      {uncertain && (
        <InlineNotification
          kind="warning"
          title="Token creation outcome unknown"
          action={
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="-my-1.5"
              onClick={() => setUncertain(false)}
            >
              I checked the list
            </Button>
          }
        >
          We could not confirm whether the token was created. The list below has been refreshed. If
          a new token appears there, revoke it: its value cannot be shown again. Then create a new
          one.
        </InlineNotification>
      )}
    </form>
  );
}
