import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePasswordLogin } from '../../api/auth';
import { PasswordLoginRequestSchema, type PasswordLoginRequest } from '../../contracts/auth';
import { EMAIL_PROBLEM, PASSWORD_MISSING, signInProblem } from '../../lib/signIn';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { InlineNotification } from '../ui/notification';

/**
 * Sign-in with email and password. `onSignedIn` runs once the session exists. `testAccount`: the
 * test sign-in, for test accounts only.
 */
export function PasswordSignInForm({
  onSignedIn,
  testAccount = false,
}: {
  onSignedIn: () => void;
  testAccount?: boolean;
}) {
  const login = usePasswordLogin(testAccount);
  const form = useForm<PasswordLoginRequest>({
    resolver: zodResolver(PasswordLoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((input) => login.mutate(input, { onSuccess: onSignedIn }));

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Sign in" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="signin-email" className="text-xs text-text-secondary">
          Email
        </Label>
        <Input id="signin-email" type="email" autoComplete="username" {...form.register('email')} />
        {errors.email && <p className="text-xs text-status-error">{EMAIL_PROBLEM}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="signin-password" className="text-xs text-text-secondary">
          Password
        </Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
        />
        {errors.password && <p className="text-xs text-status-error">{PASSWORD_MISSING}</p>}
      </div>
      {login.isError && (
        <InlineNotification kind="error">{signInProblem(login.error)}</InlineNotification>
      )}
      <Button type="submit" className="w-full justify-center" loading={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
