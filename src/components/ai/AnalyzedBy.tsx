import { analyzedBy } from '../../lib/aiLabels';

/** Which provider and model produced an AI result, so differences between providers are visible. */
export function AnalyzedBy({ provider, model }: { provider?: string | null; model?: string | null }) {
  const label = analyzedBy(provider, model);
  return label ? <p className="text-xs text-text-tertiary">{label}</p> : null;
}
