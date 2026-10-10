import { useTestToolsEnabled } from '../../api/testTools';

/** Always visible in the test environment, so it is never mistaken for live. */
export function TestEnvironmentBanner() {
  if (!useTestToolsEnabled()) return null;
  return (
    <div
      role="status"
      className="border-b border-status-warning bg-status-warning-subtle px-4 py-2 text-center text-sm font-semibold text-status-warning"
    >
      TEST ENVIRONMENT
    </div>
  );
}
