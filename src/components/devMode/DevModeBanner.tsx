import { useDevMode } from '../../api/appMode';

/** Always visible in dev mode, so it is never mistaken for prod. */
export function DevModeBanner() {
  if (!useDevMode()) return null;
  return (
    <div
      role="status"
      className="flex min-h-8 items-center justify-center bg-tag-yellow-bg px-4 text-center text-xs tracking-[0.32px] text-tag-yellow"
    >
      Dev mode · Gmail is the mail sandbox. No real mail is sent.
    </div>
  );
}
