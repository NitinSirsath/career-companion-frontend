import { useDevMode } from '../../api/appMode';
import { openApp } from '../../lib/signIn';
import { useIsPhone } from '../layout/useIsPhone';
import { CreateTestUserForm } from './CreateTestUserForm';
import { GoogleSignIn, GoogleSignInProblem } from './GoogleSignIn';
import { PasswordSignInForm } from './PasswordSignInForm';
import { PhoneSignIn } from './PhoneSignIn';
import { SignInLayout } from './SignInLayout';
/** "or sign in with email" between Google and the password form. */
function OrDivider() {
  return (
    <div className="my-7 flex items-center gap-3 text-xs text-text-tertiary">
      <span className="h-px flex-1 bg-border-subtle" />
      or sign in with email
      <span className="h-px flex-1 bg-border-subtle" />
    </div>
  );
}

/**
 * Sign-in on tablets and laptops. Prod mode: Google first, then email and password. Dev mode has
 * no Google account, so it offers email and password and a form to create a test user.
 */
function WideSignIn({ error, next }: { error?: string; next: string | null }) {
  const devMode = useDevMode();
  return (
    <>
      <section aria-labelledby="sign-in-title" className="flex flex-col">
        <h1
          id="sign-in-title"
          className="text-[26px] leading-8 font-semibold tracking-[-0.03em] md:text-[30px] md:leading-9"
        >
          Sign in to NorthList
        </h1>
        <p className="mt-2 text-[15px] leading-[22px] text-text-secondary">
          {devMode
            ? 'Dev mode has no Google sign-in. Sign in with a test user, or create one.'
            : 'Every job mail, what it needs from you, and where each application stands.'}
        </p>
        {error && (
          <div className="mt-6">
            <GoogleSignInProblem error={error} />
          </div>
        )}
        <div className="mt-7">
          {!devMode && (
            <>
              <GoogleSignIn next={next} />
              <OrDivider />
            </>
          )}
          <PasswordSignInForm onSignedIn={() => openApp(next)} withGoogle={!devMode} />
        </div>
      </section>
      {devMode && (
        <section
          aria-labelledby="test-user-title"
          className="mt-10 flex flex-col gap-6 border-t border-border-subtle pt-8"
        >
          <h2 id="test-user-title" className="text-lg leading-7 font-medium">
            Create test user
          </h2>
          <CreateTestUserForm onSignedIn={() => openApp(next)} />
        </section>
      )}
    </>
  );
}

/** Sign-in, in the two-halves layout; phones get their own calm screen with the same choices. */
export function LoginPage({ error, next = null }: { error?: string; next?: string | null }) {
  const phone = useIsPhone();
  return (
    <SignInLayout>
      {phone ? <PhoneSignIn error={error} next={next} /> : <WideSignIn error={error} next={next} />}
  );
}
