import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { usePasswordLogin } from '../../api/auth';
import { PasswordLoginRequestSchema, type PasswordLoginRequest } from '../../contracts/auth';
import { EMAIL_PROBLEM, PASSWORD_MISSING, signInProblem } from '../../lib/signIn';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** Sign-in with email and password. `onSignedIn` runs once the session exists. */
export function PasswordSignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const login = usePasswordLogin();
  const form = useForm<PasswordLoginRequest>({
    resolver: zodResolver(PasswordLoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((input) => login.mutate(input, { onSuccess: onSignedIn }));

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Sign in" className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" autoComplete="username" {...form.register('email')} />
        {errors.email && <p className="text-sm text-status-error">{EMAIL_PROBLEM}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          type="password"
          autoComplete="current-password"
          {...form.register('password')}
        />
        {errors.password && <p className="text-sm text-status-error">{PASSWORD_MISSING}</p>}
      </div>
      {login.isError && (
        <p role="alert" className="text-sm text-status-error">
          {signInProblem(login.error)}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
