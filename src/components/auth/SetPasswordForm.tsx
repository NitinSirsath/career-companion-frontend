import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useSetPassword } from '../../api/auth';
import {
  PASSWORD_PROBLEM,
  setPasswordFormSchema,
  signInProblem,
  type SetPasswordForm as FormValues,
} from '../../lib/signIn';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

/** Sets the first password, or changes it. A change also asks for the current password. */
export function SetPasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const save = useSetPassword();
  const form = useForm<FormValues>({
    resolver: zodResolver(setPasswordFormSchema(hasPassword)),
    defaultValues: { newPassword: '', repeatPassword: '' },
  });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit(({ currentPassword, newPassword }) =>
    save.mutate(
      { newPassword, ...(hasPassword ? { currentPassword } : {}) },
      { onSuccess: () => form.reset() },
    ),
  );
  const title = hasPassword ? 'Change password' : 'Set password';

  return (
    <form onSubmit={onSubmit} noValidate aria-label={title} className="space-y-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {!hasPassword && (
        <p className="text-sm text-text-secondary">
          With a password you can also sign in with your email, without Google.
        </p>
      )}
      {hasPassword && (
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            className="max-w-sm"
            // An empty field means it was not given.
            {...form.register('currentPassword', {
              setValueAs: (value: string) => value || undefined,
            })}
          />
          {errors.currentPassword && (
            <p className="text-sm text-status-error">{errors.currentPassword.message}</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          className="max-w-sm"
          {...form.register('newPassword')}
        />
        <p
          className={`text-sm ${errors.newPassword ? 'text-status-error' : 'text-text-secondary'}`}
        >
          {PASSWORD_PROBLEM}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="repeat-password">Repeat new password</Label>
        <Input
          id="repeat-password"
          type="password"
          autoComplete="new-password"
          className="max-w-sm"
          {...form.register('repeatPassword')}
        />
        {errors.repeatPassword && (
          <p className="text-sm text-status-error">{errors.repeatPassword.message}</p>
        )}
      </div>
      {save.isError && (
        <p role="alert" className="text-sm text-status-error">
          {signInProblem(save.error)}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-status-success">
          Password saved.
        </p>
      )}
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save password'}
      </Button>
    </form>
  );
}
