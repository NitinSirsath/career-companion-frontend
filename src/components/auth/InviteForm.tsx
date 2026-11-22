import { useState } from 'react';
import { useAskForInvite } from '../../api/invites';
import { isApiError } from '../../api/client';
import {
  INVITE_OTHER_SOURCE_MAX_LENGTH,
  InviteRequestSchema,
  type InviteSource,
} from '../../contracts/invites';
import { CONTACT_EMAIL } from '../../lib/productPage';
import { INVITE_SOURCES } from '../../lib/invites';
import { EMAIL_PROBLEM, signInProblem } from '../../lib/signIn';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { InlineNotification } from '../ui/notification';

/** Sizes: the laptop page, and the bigger fields of the phone's sheet (as the email sign-in). */
const SIZES = {
  page: {
    label: 'text-xs font-medium',
    field: 'h-10',
    pick: 'h-8 px-3 text-[13px]',
    button: 'h-10',
  },
  phone: {
    label: 'text-[15px] ml-1',
    field: 'h-12 px-[18px]',
    pick: 'h-10 px-4 text-[15px]',
    button: 'h-[50px] text-[17px] font-semibold',
  },
} as const;

/** The server's words, or the contact address when the list is full. */
function InviteProblem({ error }: { error: unknown }) {
  if (isApiError(error) && error.code === 'INVITE_LIST_FULL')
    return (
      <InlineNotification kind="error">
        {error.message}{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="text-link underline hover:text-link-hover">
          {CONTACT_EMAIL}
        </a>
      </InlineNotification>
    );
  if (isApiError(error) && error.code === 'TOO_MANY_REQUESTS')
    return <InlineNotification kind="error">{error.message}</InlineNotification>;
  return <InlineNotification kind="error">{signInProblem(error)}</InlineNotification>;
}

type Size = (typeof SIZES)[keyof typeof SIZES];

/** "Where did you hear about NorthList?": one tap; Other opens a short text field. */
function SourcePicker({
  size,
  idPrefix,
  source,
  onSource,
  otherSource,
  onOtherSource,
  problems,
}: {
  size: Size;
  idPrefix: string;
  source: InviteSource | null;
  onSource: (source: InviteSource) => void;
  otherSource: string;
  onOtherSource: (words: string) => void;
  problems: { source?: boolean; other?: boolean };
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cn('mb-2 text-text-secondary', size.label)}>
        Where did you hear about NorthList?
      </legend>
      <div
        role="radiogroup"
        aria-label="Where did you hear about NorthList?"
        className="flex flex-wrap gap-2"
      >
        {INVITE_SOURCES.map((option) => {
          const picked = source === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={picked}
              onClick={() => onSource(option.value)}
              className={cn(
                'cursor-pointer rounded-full border transition-colors duration-70 ease-standard focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus',
                size.pick,
                picked
                  ? 'border-text-primary bg-text-primary text-background'
                  : 'border-border-default text-text-primary hover:bg-layer-hover',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {problems.source && (
        <p className="text-xs text-status-error">Pick where you heard about NorthList.</p>
      )}
      {source === 'OTHER' && (
        <div className="mt-1 flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-other`} className="sr-only">
            Where?
          </Label>
          <Input
            id={`${idPrefix}-other`}
            placeholder="Where?"
            autoFocus
            maxLength={INVITE_OTHER_SOURCE_MAX_LENGTH}
            className={size.field}
            value={otherSource}
            aria-invalid={problems.other || undefined}
            onChange={(event) => onOtherSource(event.target.value)}
          />
          {problems.other && (
            <p className="text-xs text-status-error">Say where, in a few words.</p>
          )}
        </div>
      )}
    </fieldset>
  );
}

/**
 * "Get an invite" (owner, 22 Nov 2026): an email and where the person heard about NorthList, one
 * tap each. `onSaved` gets the email for the thank-you.
 */
export function InviteForm({
  phone = false,
  onSaved,
}: {
  phone?: boolean;
  onSaved: (email: string) => void;
}) {
  const size = SIZES[phone ? 'phone' : 'page'];
  const ask = useAskForInvite();
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<InviteSource | null>(null);
  const [otherSource, setOtherSource] = useState('');
  const [problems, setProblems] = useState<{ email?: boolean; source?: boolean; other?: boolean }>(
    {},
  );
  const idPrefix = phone ? 'invite-phone' : 'invite';

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = {
      email,
      source: source ?? undefined,
      otherSource: source === 'OTHER' ? otherSource : undefined,
    };
    const parsed = InviteRequestSchema.safeParse(input);
    if (!parsed.success) {
      const paths = new Set(parsed.error.issues.map((issue) => issue.path[0]));
      setProblems({
        email: paths.has('email'),
        source: paths.has('source'),
        other: paths.has('otherSource'),
      });
      return;
    }
    setProblems({});
    ask.mutate(parsed.data, { onSuccess: () => onSaved(parsed.data.email) });
  };

  return (
    <form onSubmit={submit} noValidate aria-label="Get an invite" className="flex flex-col gap-4">
      {ask.isError && <InviteProblem error={ask.error} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-email`} className={cn('text-text-secondary', size.label)}>
          Email
        </Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={size.field}
          value={email}
          aria-invalid={problems.email || undefined}
          onChange={(event) => setEmail(event.target.value)}
        />
        {problems.email && <p className="text-xs text-status-error">{EMAIL_PROBLEM}</p>}
      </div>
      <SourcePicker
        size={size}
        idPrefix={idPrefix}
        source={source}
        onSource={setSource}
        otherSource={otherSource}
        onOtherSource={setOtherSource}
        problems={problems}
      />
      <Button
        type="submit"
        className={cn('w-full justify-center', size.button)}
        loading={ask.isPending}
      >
        {ask.isPending ? 'Sending…' : 'Get an invite'}
      </Button>
      <p className="text-xs leading-[18px] text-text-tertiary">
        We keep only this email and your answer, to send the invite. Nothing else.
      </p>
    </form>
  );
}
