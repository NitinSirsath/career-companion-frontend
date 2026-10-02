import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { getCatalogProvider } from '../contracts/aiCatalog';
import { AIStatusPanel } from '../components/ai/AIStatusPanel';
import { ProviderPicker } from '../components/ai/ProviderPicker';
import { ProviderSetupForm } from '../components/ai/ProviderSetupForm';

export const Route = createFileRoute('/ai')({
  component: AIProviderPage,
});

type View = { kind: 'status' } | { kind: 'choose' } | { kind: 'form'; providerId: string };

const SAVED_NOTE = {
  VERIFIED: 'Connected. Waiting emails are being processed.',
  INCONCLUSIVE: 'Saved. The provider did not confirm right now; Career Companion will use it and show any problem here.',
} as const;

/** AI provider settings: Career Companion's second account, next to the Gmail connection. */
function AIProviderPage() {
  const [view, setView] = useState<View>({ kind: 'status' });
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const { data: settings, isLoading, error } = useQuery({
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
    <div className="max-w-4xl mx-auto space-y-6 px-4 md:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">AI provider</h2>
        <p className="text-sm text-text-secondary mt-1">
          Career Companion uses your own AI account to read job emails. Your key is stored encrypted and never shown
          again.
        </p>
      </div>

      {isLoading && <p>Loading AI settings…</p>}
      {error && <p role="alert">Could not load AI settings: {error.message}</p>}

      {savedNote && (
        <p role="status" className="border border-status-success bg-status-success-subtle p-3 text-sm">
          {savedNote}
        </p>
      )}

      {settings && formProvider && (
        <ProviderSetupForm
          key={formProvider.id}
          provider={formProvider}
          settings={settings}
          onDone={(verification, waitingEmails) => {
            const note = verification === 'VERIFIED'
              ? (waitingEmails > 0 ? SAVED_NOTE.VERIFIED : 'Connected.')
              : SAVED_NOTE.INCONCLUSIVE;
            setSavedNote(note);
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
            Your current setup keeps working until the new key is verified. Emails already processed are not sent to the
            new provider.
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
