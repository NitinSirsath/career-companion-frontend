import { useDevMode } from '../../api/appMode';
import { googleSignInProblem } from '../../lib/signIn';
import { DevModeBanner } from '../devMode/DevModeBanner';
import { Button } from '../ui/button';
import { CreateTestUserForm } from './CreateTestUserForm';
import { PasswordSignInForm } from './PasswordSignInForm';

/** A fresh page load, so the app starts again with the new session. */
const openApp = () => {
  window.location.href = '/';
};
const startGoogleSignIn = () => {
  window.location.href = '/api/auth/connect';
};

/**
 * Sign-in. Prod mode: email and password, or Google. Dev mode has no Google account, so it
 * offers email and password and a form to create a test user.
 */
export function LoginPage({ error }: { error?: string }) {
  const devMode = useDevMode();
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <DevModeBanner />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to Career Companion</h1>
          <p className="mt-2 text-muted-foreground">
            {devMode
              ? 'Dev mode has no Google sign-in. Sign in with a test user, or create one.'
              : 'Sign in to start tracking your job applications.'}
          </p>
        </div>
        {error && (
          <div
            role="alert"
            className="mx-auto max-w-md border border-border-default border-l-4 border-l-status-error bg-status-error-subtle p-4 text-center text-sm text-status-error"
          >
            {googleSignInProblem(error)}
          </div>
        )}
        <div className="flex flex-wrap items-start justify-center gap-6">
          <section className="w-full max-w-sm space-y-4 border border-border-default p-6">
            <PasswordSignInForm onSignedIn={openApp} />
            {!devMode && (
              <>
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <div className="h-px flex-1 bg-border-default" />
                  or
                  <div className="h-px flex-1 bg-border-default" />
                </div>
                <Button variant="tertiary" className="w-full" onClick={startGoogleSignIn}>
                  Sign in with Google
                </Button>
              </>
            )}
          </section>
          {devMode && (
            <section className="w-full max-w-sm border border-border-default bg-surface-subtle p-6">
              <h2 className="mb-4 text-lg font-medium">Create test user</h2>
              <CreateTestUserForm onSignedIn={openApp} />
            </section>
          )}
        </div>
        {!devMode && (
          <div className="mx-auto max-w-sm space-y-2 text-sm text-text-secondary">
            <p>
              <span className="font-semibold text-text-primary">New here?</span> Sign in with
              Google. That creates your account. You can set a password later on the Account page.
            </p>
            <p>
              <span className="font-semibold text-text-primary">Forgot your password?</span> Sign in
              with Google, then set a new one on the Account page.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
