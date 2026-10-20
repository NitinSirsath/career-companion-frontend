import { Portfolio } from '@carbon/icons-react';
import { useDevMode } from '../../api/appMode';
import { googleSignInProblem } from '../../lib/signIn';
import { DevModeBanner } from '../devMode/DevModeBanner';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { CreateTestUserForm } from './CreateTestUserForm';
import { PasswordSignInForm } from './PasswordSignInForm';

/** A fresh page load, so the app starts again with the new session. */
const openApp = () => {
  window.location.href = '/';
};
const startGoogleSignIn = () => {
  window.location.href = '/api/auth/connect';
};

/** Google sign-in under the password form, and what a new or forgetful user can do. */
function GoogleSignIn() {
  return (
    <>
      <div className="flex items-center gap-3 text-xs text-text-secondary">
        <span className="h-px flex-1 bg-border-subtle" />
        or
        <span className="h-px flex-1 bg-border-subtle" />
      </div>
      <Button variant="tertiary" className="w-full justify-center" onClick={startGoogleSignIn}>
        Sign in with Google
      </Button>
      <div className="flex flex-col gap-2 border-t border-border-subtle pt-4 text-xs text-text-secondary">
        <p>
          <span className="font-semibold text-text-primary">New here?</span> Sign in with Google.
          That creates your account. You can set a password later on the Account page.
        </p>
        <p>
          <span className="font-semibold text-text-primary">Forgot your password?</span> Sign in
          with Google, then set a new one on the Account page.
        </p>
      </div>
    </>
  );
}

/**
 * Sign-in: one card on the grey page. Prod mode: email and password, or Google. Dev mode has no
 * Google account, so it offers email and password and a form to create a test user.
 */
export function LoginPage({ error }: { error?: string }) {
  const devMode = useDevMode();
  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <DevModeBanner />
      <main className="mx-auto flex w-full max-w-4xl animate-fade-in flex-col items-center gap-8 px-4 py-16">
        <p className="flex items-center gap-3 text-sm font-semibold">
          <Portfolio size={20} aria-hidden="true" className="text-link" />
          Career Companion
        </p>
        <div className="flex w-full flex-wrap items-start justify-center gap-6">
          <section
            aria-labelledby="sign-in-title"
            className="flex w-full max-w-sm flex-col gap-6 bg-surface p-8"
          >
            <div className="flex flex-col gap-2">
              <h1 id="sign-in-title" className="text-[28px] leading-9 font-normal">
                Sign in
              </h1>
              <p className="text-sm text-text-secondary">
                {devMode
                  ? 'Dev mode has no Google sign-in. Sign in with a test user, or create one.'
                  : 'Sign in to start tracking your job applications.'}
              </p>
            </div>
            {error && (
              <InlineNotification kind="error">{googleSignInProblem(error)}</InlineNotification>
            )}
            <PasswordSignInForm onSignedIn={openApp} />
            {!devMode && <GoogleSignIn />}
          </section>
          {devMode && (
            <section
              aria-labelledby="test-user-title"
              className="flex w-full max-w-sm flex-col gap-6 bg-surface p-8"
            >
              <h2 id="test-user-title" className="text-xl leading-7 font-normal">
                Create test user
              </h2>
              <CreateTestUserForm onSignedIn={openApp} />
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
