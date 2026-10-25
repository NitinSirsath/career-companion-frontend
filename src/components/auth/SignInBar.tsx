import { DevModeBanner } from '../devMode/DevModeBanner';
import { Wordmark } from '../layout/Logo';

/** The top bar of the sign-in pages: the name, and the dev mode chip. */
export function SignInBar() {
  return (
    <header className="flex h-14 items-stretch border-b border-border-subtle">
      <span className="flex min-w-0 flex-1 items-center">
        <Wordmark className="px-5" />
      </span>
      <DevModeBanner />
    </header>
  );
}
