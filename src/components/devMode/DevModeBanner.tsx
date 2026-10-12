import { useDevMode } from '../../api/appMode';

/** Always visible in dev mode, so it is never mistaken for prod. */
export function DevModeBanner() {
  if (!useDevMode()) return null;
  return (
    <div
      role="status"
      className="border-b border-status-warning bg-status-warning-subtle px-4 py-2 text-center text-sm font-semibold text-status-warning"
    >
      DEV MODE · Gmail is the mail sandbox. No real mail.
    </div>
  );
}
