import { DevModeBanner } from '../devMode/DevModeBanner';
import { Logo } from '../layout/Logo';

/** The top bar of the sign-in pages: the logo and name, and the dev mode chip. */
export function SignInBar() {
  return (
    <header className="flex h-14 items-stretch border-b border-border-subtle">
      <span className="flex size-14 shrink-0 items-center justify-center border-r border-border-subtle">
        <Logo />
      </span>
      <span className="flex min-w-0 flex-1 items-center px-4 font-medium">NorthList</span>
      <DevModeBanner />
    </header>
  );
}
