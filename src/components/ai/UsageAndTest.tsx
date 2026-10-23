import type { AISettingsResponse } from '../../contracts/ai';
import { providerName } from '../../lib/aiLabels';
import { SampleTestPanel } from './SampleTestPanel';

const CARD = 'flex flex-col gap-3 border border-border-subtle bg-surface px-6 py-5';
const HEADING = 'text-base leading-[22px] font-semibold';

/**
 * How much Career Companion used today against its own daily safeguard (for all providers
 * together), and the sample test on the active provider.
 */
export function UsageAndTest({ settings }: { settings: AISettingsResponse }) {
  const name = providerName(settings.provider);
  const { usageToday: usage } = settings;
  const limit = settings.safetyLimit.callsPerDay;
  const share = limit > 0 ? Math.min(100, (usage.calls / limit) * 100) : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="ai-use-heading" className={CARD}>
        <h2 id="ai-use-heading" className={HEADING}>
          Use today
        </h2>
        <div
          role="meter"
          aria-label="AI calls used today"
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={usage.calls}
          className="h-1 max-w-100 bg-layer-accent"
        >
          <div
            className="h-full bg-link transition-[width] duration-240"
            style={{ width: `${share}%` }}
          />
        </div>
        <p className="text-sm">
          {usage.calls} of {limit} AI calls today
        </p>
        <p className="text-xs text-text-secondary">
          {usage.inputTokens.toLocaleString()} input / {usage.outputTokens.toLocaleString()} output
          tokens. Career Companion&apos;s own count and daily safety limit, for all providers
          together. Not your {name} bill or quota.
        </p>
      </section>
      {settings.provider && (
        <section aria-labelledby="ai-try-heading" className={CARD}>
          <h2 id="ai-try-heading" className={HEADING}>
            Try it
          </h2>
          <SampleTestPanel providerId={settings.provider} providerName={name} />
        </section>
      )}
    </div>
  );
}
