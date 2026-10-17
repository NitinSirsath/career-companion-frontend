import { analyzedBy } from '../../lib/aiLabels';

/**
 * Which provider and model produced an AI result, so differences between providers are visible.
 * `details`: the result holds a mail's details, so a fast model standing in is named as such.
 */
export function AnalyzedBy({
  provider,
  model,
  details = false,
}: {
  provider?: string | null;
  model?: string | null;
  details?: boolean;
}) {
  const label = analyzedBy(provider, model, details);
  return label ? <p className="text-xs text-text-tertiary">{label}</p> : null;
}
