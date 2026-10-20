import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useRegisterTestUser } from '../../api/auth';
import { RegisterRequestSchema, type RegisterRequest } from '../../contracts/auth';
import { EMAIL_PROBLEM, PASSWORD_PROBLEM, signInProblem } from '../../lib/signIn';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** Dev mode only: a new test user with a password. In prod, Google sign-in creates the account. */
export function CreateTestUserForm({ onSignedIn }: { onSignedIn: () => void }) {
  const create = useRegisterTestUser();
  const form = useForm<RegisterRequest>({
    resolver: zodResolver(RegisterRequestSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((input) => create.mutate(input, { onSuccess: onSignedIn }));

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label="Create test user"
      className="flex flex-col gap-6"
    >
      <div className="space-y-2">
        <Label htmlFor="new-name">
          Name <span className="font-normal text-text-secondary">(optional)</span>
        </Label>
        <Input
          id="new-name"
          autoComplete="off"
          // An empty field means no name, not an empty one.
          {...form.register('name', { setValueAs: (value: string) => value.trim() || undefined })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-email">Email</Label>
        <Input id="new-email" type="email" autoComplete="off" {...form.register('email')} />
        {errors.email ? (
          <p className="text-sm text-status-error">{EMAIL_PROBLEM}</p>
        ) : (
          <p className="text-sm text-text-secondary">
            Any address. It becomes this user&apos;s sandbox mailbox.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-password">Password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
        <p className={`text-sm ${errors.password ? 'text-status-error' : 'text-text-secondary'}`}>
          {PASSWORD_PROBLEM}
        </p>
      </div>
      {create.isError && (
        <p role="alert" className="text-sm text-status-error">
          {signInProblem(create.error)}
        </p>
      )}
      <Button
        type="submit"
        variant="secondary"
        className="w-full justify-center"
        loading={create.isPending}
      >
        {create.isPending ? 'Creating…' : 'Create test user'}
      </Button>
      <p className="text-sm text-text-secondary">
        Only in dev mode. In prod an account is created by Google sign-in only.
      </p>
    </form>
  );
}
