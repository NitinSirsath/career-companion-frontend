import { useDevMode, useTestAccount } from '../../api/appMode';

/** Always visible in dev mode and for a test account, so neither is mistaken for real Gmail. */
export function DevModeBanner() {
  const devMode = useDevMode();
  const testAccount = useTestAccount();
  if (!devMode && !testAccount) return null;
  return (
    <div
      role="status"
      className="flex min-h-8 items-center justify-center bg-tag-yellow-bg px-4 text-center text-xs text-tag-yellow"
    >
      {devMode ? 'Dev mode' : 'Test account'} · Gmail is the mail sandbox. No real mail is sent.
    </div>
  );
}
