import { useSearch } from '@tanstack/react-router';
import { openApp, safeNextPath } from '../../lib/signIn';
import { PasswordSignInForm } from './PasswordSignInForm';
import { SignInBar } from './SignInBar';

/**
 * The test account sign-in. Not linked from the normal sign-in page: whoever hands out a test
 * account shares its address. Test accounts use the mail sandbox instead of Gmail.
 */
export function TestLoginPage({ next = null }: { next?: string | null }) {
  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <SignInBar />
      <main className="mx-auto flex w-full max-w-4xl animate-fade-in flex-col items-center gap-8 px-4 py-16">
        <section
          aria-labelledby="test-sign-in-title"
          className="flex w-full max-w-sm flex-col gap-6 border border-border-subtle bg-surface p-8"
        >
          <div className="flex flex-col gap-2">
            <h1
              id="test-sign-in-title"
              className="text-[28px] leading-9 font-semibold tracking-[-0.02em]"
            >
              Test account sign-in
            </h1>
            <p className="text-sm text-text-secondary">
              For test accounts only. They use made-up mail in the mail sandbox and a real AI
              provider.
            </p>
          </div>
          <PasswordSignInForm onSignedIn={() => openApp(next)} testAccount />
        </section>
      </main>
    </div>
  );
}

/** The test sign-in as the router opens it, with the page to open afterwards. */
export function TestLoginRoute() {
  const { next } = useSearch({ from: '/test-login' });
  return <TestLoginPage next={safeNextPath(next)} />;
}
