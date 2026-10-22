import type { ReactNode } from 'react';
import type { User } from '../../api/auth';
import { StartupScreen } from './StartupScreen';
import { useSignInCheck } from './useSignInCheck';

/** Shows the start-up screen until the app knows who is signed in, then the app for that user. */
export function SignInGate({ children }: { children: (user: User | null) => ReactNode }) {
  const check = useSignInCheck();
  if (check.known) return children(check.user);
  return <StartupScreen stage={check.stage} waitedMs={check.waitedMs} onRetry={check.retry} />;
}
