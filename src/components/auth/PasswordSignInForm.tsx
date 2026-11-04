import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePasswordLogin } from '../../api/auth';
import { PasswordLoginRequestSchema, type PasswordLoginRequest } from '../../contracts/auth';
import { EMAIL_PROBLEM, PASSWORD_MISSING, signInProblem } from '../../lib/signIn';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { InlineNotification } from '../ui/notification';

/** The advice "Forgot password?" opens under the password field. */
function ForgotPasswordNote({ id, open }: { id: string; open: boolean }) {
  return (
    <div id={id} hidden={!open}>
      {open && (
        <InlineNotification kind="info" className="mt-1">
          Continue with Google, then set a new password on the Account page.
        </InlineNotification>
      )}
    </div>
  );
}

/**
 * Sign-in with email and password. `onSignedIn` runs once the session exists. `testAccount`: the
 * test sign-in, for test accounts only. `quiet`: an outlined button, where "Continue with Google"
 * is the main way in; it also offers "Forgot password?" by the Password label.
 */
export function PasswordSignInForm({
  onSignedIn,
  testAccount = false,
  quiet = false,
}: {
  onSignedIn: () => void;
  testAccount?: boolean;
  quiet?: boolean;
}) {
  const login = usePasswordLogin(testAccount);
  const form = useForm<PasswordLoginRequest>({
    resolver: zodResolver(PasswordLoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });
  const [forgotOpen, setForgotOpen] = useState(false);
  const forgotId = useId();
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((input) => login.mutate(input, { onSuccess: onSignedIn }));

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Sign in" className="flex flex-col gap-4">
      {login.isError && (
        <InlineNotification kind="error">{signInProblem(login.error)}</InlineNotification>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="signin-email" className="text-xs font-medium text-text-secondary">
          Email
        </Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          className="h-10"
          {...form.register('email')}
        />
        {errors.email && <p className="text-xs text-status-error">{EMAIL_PROBLEM}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="signin-password" className="text-xs font-medium text-text-secondary">
            Password
          </Label>
          {quiet && (
            <button
              type="button"
              aria-expanded={forgotOpen}
              aria-controls={forgotId}
              onClick={() => setForgotOpen((open) => !open)}
              className="cursor-pointer text-xs text-link hover:underline"
            >
              Forgot password?
            </button>
          )}
        </div>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          className="h-10"
          aria-invalid={login.isError || undefined}
          {...form.register('password')}
        />
        {errors.password && <p className="text-xs text-status-error">{PASSWORD_MISSING}</p>}
        <ForgotPasswordNote id={forgotId} open={forgotOpen} />
      </div>
      <Button
        type="submit"
        variant={quiet ? 'secondary' : 'primary'}
        className="mt-2 h-10 w-full justify-center"
        loading={login.isPending}
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
