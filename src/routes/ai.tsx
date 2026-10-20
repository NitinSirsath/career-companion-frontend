import { RouteErrorPage } from '../components/errors/RouteErrorPage';
import { PageHeader } from '../components/layout/PageHeader';
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { getCatalogProvider } from '../contracts/aiCatalog';
import { AIStatusPanel } from '../components/ai/AIStatusPanel';
import { ProviderPicker } from '../components/ai/ProviderPicker';
import { ProviderSetupForm } from '../components/ai/ProviderSetupForm';
import { saveNote } from '../lib/aiProviderPage';
import { InlineNotification } from '../components/ui/notification';
import { SectionError } from '../components/ui/section-error';
import { SkeletonList } from '../components/ui/skeleton';

export const Route = createFileRoute('/ai')({
  errorComponent: RouteErrorPage,
  component: AIProviderPage,
});

type View = { kind: 'status' } | { kind: 'choose' } | { kind: 'form'; providerId: string };

/** AI provider settings: Career Companion's second account, next to the Gmail connection. */
function AIProviderPage() {
  const [view, setView] = useState<View>({ kind: 'status' });
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const {
    data: settings,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['aiSettings'],
    queryFn: ({ signal }) => api.getAISettings({ signal }),
  });

  const otherProviders = settings?.offeredProviders.filter((id) => id !== settings.provider) ?? [];
  const formProvider = view.kind === 'form' ? getCatalogProvider(view.providerId) : undefined;
  const choose = (providerId: string) => {
    setSavedNote(null);
    setView({ kind: 'form', providerId });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="AI provider"
        description="Career Companion uses your own AI account to read job mails. Your key is stored encrypted and never shown again."
      />

      {isLoading && <SkeletonList rows={3} label="Loading AI settings" />}
      {error && <SectionError title="Could not load your AI settings" />}

      {savedNote && <InlineNotification kind="success">{savedNote}</InlineNotification>}

      {settings && formProvider && (
        <ProviderSetupForm
          key={formProvider.id}
          provider={formProvider}
          settings={settings}
          onDone={(saved) => {
            setSavedNote(saveNote(saved));
            setView({ kind: 'status' });
          }}
          onCancel={() => setView({ kind: 'status' })}
        />
      )}

      {settings && !settings.configured && view.kind !== 'form' && (
        <ProviderPicker
          providerIds={settings.offeredProviders}
          actionLabel={(provider) => `Set up ${provider.displayName}`}
          onChoose={choose}
        />
      )}

      {settings?.configured && view.kind === 'choose' && (
        <section aria-label="Switch provider" className="space-y-3">
          <p className="text-sm text-text-secondary">
            Your current setup keeps working until the new key is verified. Emails already processed
            are not sent to the new provider.
          </p>
          <ProviderPicker
            providerIds={otherProviders}
            actionLabel={(provider) => `Switch to ${provider.displayName}`}
            onChoose={choose}
          />
        </section>
      )}

      {settings?.configured && (
        <AIStatusPanel
          settings={settings}
          onUpdate={() => settings.provider && choose(settings.provider)}
          onSwitch={otherProviders.length ? () => setView({ kind: 'choose' }) : undefined}
        />
      )}
    </div>
  );
}
