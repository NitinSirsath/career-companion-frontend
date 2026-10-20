import { Portfolio } from '@carbon/icons-react';
import { PasswordSignInForm } from './PasswordSignInForm';

/** A fresh page load, so the app starts again with the new session. */
const openApp = () => {
  window.location.href = '/';
};

/**
 * The test account sign-in. Not linked from the normal sign-in page: whoever hands out a test
 * account shares its address. Test accounts use the mail sandbox instead of Gmail.
 */
export function TestLoginPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-text-primary">
      <main className="mx-auto flex w-full max-w-4xl animate-fade-in flex-col items-center gap-8 px-4 py-16">
        <p className="flex items-center gap-3 text-sm font-semibold">
          <Portfolio size={20} aria-hidden="true" className="text-link" />
          Career Companion
        </p>
        <section
          aria-labelledby="test-sign-in-title"
          className="flex w-full max-w-sm flex-col gap-6 bg-surface p-8"
        >
          <div className="flex flex-col gap-2">
            <h1 id="test-sign-in-title" className="text-[28px] leading-9 font-normal">
              Test account sign-in
            </h1>
            <p className="text-sm text-text-secondary">
              For test accounts only. They use made-up mail in the mail sandbox and a real AI
              provider.
            </p>
          </div>
          <PasswordSignInForm onSignedIn={openApp} testAccount />
        </section>
      </main>
    </div>
  );
}
