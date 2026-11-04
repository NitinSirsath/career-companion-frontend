import { useSearch } from '@tanstack/react-router';
import { openApp, safeNextPath } from '../../lib/signIn';
import { PasswordSignInForm } from './PasswordSignInForm';
import { SignInLayout } from './SignInLayout';

/**
 * The test account sign-in. Not linked from the normal sign-in page: whoever hands out a test
 * account shares its address. Test accounts use the mail sandbox instead of Gmail.
 */
export function TestLoginPage({ next = null }: { next?: string | null }) {
  return (
    <SignInLayout>
      <section aria-labelledby="test-sign-in-title" className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1
            id="test-sign-in-title"
            className="text-[26px] leading-8 font-semibold tracking-[-0.03em] md:text-[30px] md:leading-9"
          >
            Test account sign-in
          </h1>
          <p className="text-[15px] leading-[22px] text-text-secondary">
            For test accounts only. They use made-up mail in the mail sandbox and a real AI
            provider.
          </p>
        </div>
        <PasswordSignInForm onSignedIn={() => openApp(next)} testAccount />
      </section>
    </SignInLayout>
  );
}

/** The test sign-in as the router opens it, with the page to open afterwards. */
export function TestLoginRoute() {
  const { next } = useSearch({ from: '/test-login' });
  return <TestLoginPage next={safeNextPath(next)} />;
}
