import { AI_SUBSCRIPTION_NOTE, getCatalogProvider, type CatalogProvider } from '../../contracts/aiCatalog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

/** Curated provider choice (ADR-0001 decision 2): only providers the server offers. */
export function ProviderPicker({
  providerIds,
  actionLabel,
  onChoose,
}: {
  providerIds: string[];
  actionLabel: (provider: CatalogProvider) => string;
  onChoose: (providerId: string) => void;
}) {
  const providers = providerIds.flatMap((id) => {
    const provider = getCatalogProvider(id);
    return provider ? [provider] : [];
  });
  return (
    <section aria-label="Choose an AI provider" className="space-y-4">
      <ul className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <li key={provider.id} className="border border-border-default bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">{provider.displayName}</h3>
              <Badge variant={provider.costModel === 'FREE_TIER_AVAILABLE' ? 'success' : 'secondary'}>
                {provider.costModel === 'FREE_TIER_AVAILABLE' ? 'Free tier available' : 'Requires paid API billing'}
              </Badge>
            </div>
            <p className="text-sm text-text-secondary">{provider.recommendedNote}</p>
            <p className="text-sm text-text-secondary">{provider.disclosure.summary}</p>
            <div className="mt-auto">
              <Button onClick={() => onChoose(provider.id)}>{actionLabel(provider)}</Button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-sm text-text-secondary">{AI_SUBSCRIPTION_NOTE}</p>
    </section>
  );
}
