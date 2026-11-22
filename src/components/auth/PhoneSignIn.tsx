import { useState, type ReactNode } from 'react';
import { MailIcon } from 'lucide-react';
import { useDevMode } from '../../api/appMode';
import { openApp } from '../../lib/signIn';
import { Sheet } from '../ui/sheet';
import { CreateTestUserForm } from './CreateTestUserForm';
import { GoogleSignIn, GoogleSignInProblem } from './GoogleSignIn';
import { PasswordSignInForm } from './PasswordSignInForm';

/** A big grey phone button that opens a sheet. */
function SheetButton({
  icon,
  onClick,
  children,
}: {
  icon?: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-full bg-layer-accent text-[17px] font-semibold text-text-primary transition-transform duration-450 ease-[cubic-bezier(0.25,1.6,0.4,1)] active:scale-[0.98]"
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * Sign-in on phones (owner, 15 Nov 2026, approved mock `SIGNIN-PHONE-mock/`): one main button,
 * Continue with Google, at the bottom where the thumb is. Email sign-in waits behind a grey button
 * in a sheet, so the screen stays calm and never scrolls. Dev mode has no Google: email sign-in
 * and a new test user, each in its own sheet.
 */
export function PhoneSignIn({ error, next }: { error?: string; next: string | null }) {
  const devMode = useDevMode();
  const [sheet, setSheet] = useState<'email' | 'test-user' | null>(null);
  const sheetProps = (name: 'email' | 'test-user') => ({
    open: sheet === name,
    onOpenChange: (open: boolean) => setSheet(open ? name : null),
  });
  return (
    <section aria-labelledby="sign-in-title" className="flex flex-col gap-3">
      <h1 id="sign-in-title" className="sr-only">
        Sign in to NorthList
      </h1>
      {error && (
        <div className="mb-1">
          <GoogleSignInProblem error={error} phone />
        </div>
      )}
      {!devMode && <GoogleSignIn next={next} phone />}
      <SheetButton
        icon={<MailIcon size={20} aria-hidden="true" />}
        onClick={() => setSheet('email')}
      >
        Sign in with email
      </SheetButton>
      {devMode && <SheetButton onClick={() => setSheet('test-user')}>Create test user</SheetButton>}
      <Sheet {...sheetProps('email')} title="Sign in with email">
        <PasswordSignInForm onSignedIn={() => openApp(next)} withGoogle={!devMode} phone />
      </Sheet>
      {devMode && (
        <Sheet {...sheetProps('test-user')} title="Create test user">
          <CreateTestUserForm onSignedIn={() => openApp(next)} />
        </Sheet>
      )}
    </section>
  );
}
