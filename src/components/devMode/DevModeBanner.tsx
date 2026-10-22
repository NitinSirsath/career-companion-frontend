import { useDevMode, useTestAccount } from '../../api/appMode';

/**
 * The chip in the top bar, always visible in dev mode and for a test account, so neither is
 * mistaken for real Gmail.
 */
export function DevModeBanner() {
  const devMode = useDevMode();
  const testAccount = useTestAccount();
  if (!devMode && !testAccount) return null;
  return (
    <div
      role="status"
      title="Gmail is the mail sandbox. No real mail is sent."
      className="flex shrink-0 items-center gap-2 border-l border-border-subtle px-3 text-xs whitespace-nowrap text-tag-yellow md:px-5"
    >
      <span aria-hidden="true" className="size-2 bg-tag-yellow" />
      {devMode ? 'Dev mode' : 'Test account'}{' '}
      <span className="hidden md:inline">· mail sandbox</span>
    </div>
  );
}
