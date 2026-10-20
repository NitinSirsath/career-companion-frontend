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
import { InlineNotification } from '../ui/notification';

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
    <form
      onSubmit={onSubmit}
      noValidate
      aria-label={title}
      className="flex max-w-80 flex-col gap-6"
    >
      {!hasPassword && (
        <p className="text-sm text-text-secondary">
          With a password you can also sign in with your email, without Google.
        </p>
      )}
      {hasPassword && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password" className="text-xs text-text-secondary">
            Current password
          </Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password" className="text-xs text-text-secondary">
          New password
        </Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          {...form.register('newPassword')}
        />
        <p
          className={`text-xs ${errors.newPassword ? 'text-status-error' : 'text-text-secondary'}`}
        >
          {PASSWORD_PROBLEM}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="repeat-password" className="text-xs text-text-secondary">
          Repeat new password
        </Label>
        <Input
          id="repeat-password"
          type="password"
          autoComplete="new-password"
          {...form.register('repeatPassword')}
        />
        {errors.repeatPassword && (
          <p className="text-sm text-status-error">{errors.repeatPassword.message}</p>
        )}
      </div>
      {save.isError && (
        <InlineNotification kind="error">{signInProblem(save.error)}</InlineNotification>
      )}
      {save.isSuccess && (
        <p role="status" className="text-sm text-ok">
          Password saved.
        </p>
      )}
      <div>
        <Button type="submit" loading={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save password'}
        </Button>
      </div>
    </form>
  );
}
