import { useId, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePasswordLogin } from '../../api/auth';
import { PasswordLoginRequestSchema, type PasswordLoginRequest } from '../../contracts/auth';
import { EMAIL_PROBLEM, PASSWORD_MISSING, signInProblem } from '../../lib/signIn';
import { cn } from '../../lib/utils';
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

/** Sizes: the page's form, and the bigger one in the phone's sign-in sheet (owner, 15 Nov 2026). */
const SIZES = {
  page: { label: 'text-xs font-medium', field: 'h-10', link: 'text-xs', button: 'mt-2 h-10' },
  phone: {
    label: 'text-[15px] ml-1',
    field: 'h-12 px-[18px]',
    // Taller than it looks: a 46px tap area that keeps the row's height.
    link: 'text-[15px] -my-3 py-3',
    button: 'mt-1 h-[50px] text-[17px] font-semibold',
  },
} as const;

/**
 * Sign-in with email and password. `onSignedIn` runs once the session exists. `testAccount`: the
 * test sign-in, for test accounts only. `withGoogle`: "Continue with Google" is offered too, so
 * "Forgot password?" by the Password label can point to it. `phone`: the bigger fields of the
 * phone's sign-in sheet.
 */
export function PasswordSignInForm({
  onSignedIn,
  testAccount = false,
  withGoogle = false,
  phone = false,
}: {
  onSignedIn: () => void;
  testAccount?: boolean;
  withGoogle?: boolean;
  phone?: boolean;
}) {
  const size = SIZES[phone ? 'phone' : 'page'];
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
        <Label htmlFor="signin-email" className={cn('text-text-secondary', size.label)}>
          Email
        </Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          className={size.field}
          {...form.register('email')}
        />
        {errors.email && <p className="text-xs text-status-error">{EMAIL_PROBLEM}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <Label htmlFor="signin-password" className={cn('text-text-secondary', size.label)}>
            Password
          </Label>
          {withGoogle && (
            <button
              type="button"
              aria-expanded={forgotOpen}
              aria-controls={forgotId}
              onClick={() => setForgotOpen((open) => !open)}
              className={cn('cursor-pointer text-link hover:underline', size.link)}
            >
              Forgot password?
            </button>
          )}
        </div>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          className={size.field}
          aria-invalid={login.isError || undefined}
          {...form.register('password')}
        />
        {errors.password && <p className="text-xs text-status-error">{PASSWORD_MISSING}</p>}
        <ForgotPasswordNote id={forgotId} open={forgotOpen} />
      </div>
      <Button
        type="submit"
        className={cn('w-full justify-center', size.button)}
        loading={login.isPending}
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
