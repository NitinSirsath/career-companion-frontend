import { useProfile } from '../../api/auth';
import { Tag } from '../ui/tag';
import { SetPasswordForm } from './SetPasswordForm';

function SignInWay({
  name,
  on,
  onLabel,
  offLabel,
}: Record<'name' | 'onLabel' | 'offLabel', string> & { on: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle py-3 last:border-b-0">
      <span className="text-sm text-text-secondary">{name}</span>
      <Tag color={on ? 'green' : 'gray'}>{on ? onLabel : offLabel}</Tag>
    </div>
  );
}

/** The signed-in user's account: the ways they sign in, and their password. */
export function AccountPage() {
  const { data: profile, isLoading, isError } = useProfile();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      {isLoading && <p className="text-sm text-text-secondary">Loading your account…</p>}
      {isError && (
        <p role="alert" className="text-sm text-status-error">
          Your account could not be loaded. Reload the page.
        </p>
      )}
      {profile && (
        <>
          <section aria-label="How you sign in" className="border border-border-default p-6">
            <h2 className="mb-2 text-lg font-medium">How you sign in</h2>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle py-3">
              <span className="text-sm text-text-secondary">Email</span>
              <span className="text-sm font-semibold">{profile.email}</span>
            </div>
            <SignInWay
              name="Google"
              on={profile.hasGoogle}
              onLabel="Connected"
              offLabel="Not used"
            />
            <SignInWay name="Password" on={profile.hasPassword} onLabel="Set" offLabel="Not set" />
          </section>
          <section className="border border-border-default p-6">
            {/* A new form after the first password is saved: it then asks for the current one. */}
            <SetPasswordForm key={String(profile.hasPassword)} hasPassword={profile.hasPassword} />
          </section>
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Forgot your password?</span>{' '}
            {profile.hasGoogle
              ? 'Sign in with Google and set a new one here. The app sends no reset mail.'
              : 'The app sends no reset mail. In dev mode, create another test user.'}
          </p>
        </>
      )}
    </div>
  );
}
