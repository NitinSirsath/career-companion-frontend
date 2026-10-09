import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, isApiError } from '../../api/client';
import { INTEGRATION_TOKEN_DEFAULT_EXPIRY_DAYS } from '../../contracts/integrationToken';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';

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
      <section
        aria-label="Token created"
        className="border border-status-warning bg-status-warning-subtle p-4 space-y-3"
      >
        <p className="font-semibold">Copy your new token “{created.name}” now</p>
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
          <Button type="button" size="sm" variant="tertiary" onClick={() => setCreated(null)}>
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
    <form
      onSubmit={submit}
      aria-label="Create a token"
      className="border border-border-default bg-surface p-4 space-y-4"
    >
      <h3 className="text-lg font-semibold">Create a token</h3>
      <div className="grid gap-4 md:grid-cols-[1fr_200px]">
        <div className="space-y-1">
          <Label htmlFor="token-name">Name</Label>
          <Input
            id="token-name"
            value={name}
            maxLength={100}
            placeholder="e.g. Work laptop"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="token-expiry">Expires after</Label>
          <NativeSelect
            id="token-expiry"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {EXPIRY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {problem && (
        <p role="alert" className="text-sm text-status-error">
          {problem}
        </p>
      )}
      {uncertain && (
        <div
          role="alert"
          className="border border-status-warning bg-status-warning-subtle p-3 text-sm space-y-2"
        >
          <p className="font-semibold">Token creation outcome unknown</p>
          <p>
            We could not confirm whether the token was created. The list below has been refreshed.
            If a new token appears there, revoke it: its value cannot be shown again. Then create a
            new one.
          </p>
          <Button type="button" size="sm" variant="tertiary" onClick={() => setUncertain(false)}>
            I checked the list
          </Button>
        </div>
      )}
      <Button type="submit" disabled={pending || uncertain}>
        {pending ? 'Creating…' : 'Create token'}
      </Button>
    </form>
  );
}
