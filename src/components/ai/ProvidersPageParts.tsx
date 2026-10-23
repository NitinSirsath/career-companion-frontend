import type { AISettingsResponse } from '../../contracts/ai';
import { activeConnection } from '../../lib/aiConnections';
import { InlineNotification } from '../ui/notification';
import { ActiveProviderCard, type ProviderActions } from './ActiveProviderCard';
import { ConnectProviderDialog } from './ConnectProviderDialog';
import { OtherProviders } from './OtherProviders';
import { MakeActiveDialog, RemoveProviderDialog, ReplaceKeyDialog } from './ProviderDialogs';
import { ProviderPicker } from './ProviderPicker';
import { UsageAndTest } from './UsageAndTest';

/** The dialog open on the page, and for which provider. */
export type OpenDialog =
  | { kind: 'connect'; start: string | null }
  | { kind: 'replace' | 'activate' | 'remove'; provider: string }
  | null;

/** The dialog for `open`, rendered only while open, so a typed key goes away with it. */
export function OpenProviderDialog({
  open,
  settings,
  onClose,
  onDone,
}: {
  open: Exclude<OpenDialog, null>;
  settings: AISettingsResponse;
  onClose: () => void;
  onDone: (note: string) => void;
}) {
  if (open.kind === 'connect')
    return (
      <ConnectProviderDialog
        settings={settings}
        start={open.start}
        onClose={onClose}
        onDone={onDone}
      />
    );
  const props = { settings, providerId: open.provider, onClose, onDone };
  if (open.kind === 'replace') return <ReplaceKeyDialog {...props} />;
  if (open.kind === 'activate') return <MakeActiveDialog {...props} />;
  return <RemoveProviderDialog {...props} />;
}

/** Nothing connected yet: one card per offered provider. */
export function FirstProvider({
  settings,
  onChoose,
}: {
  settings: AISettingsResponse;
  onChoose: (providerId: string) => void;
}) {
  return (
    <section aria-labelledby="ai-first-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="ai-first-heading" className="text-base leading-[22px] font-semibold">
          Connect your first provider
        </h2>
        <p className="text-sm text-text-secondary">New mails wait until a provider reads them.</p>
      </div>
      <ProviderPicker
        providerIds={settings.offeredProviders}
        actionLabel={(provider) => `Connect ${provider.displayName}`}
        onChoose={onChoose}
      />
    </section>
  );
}

/**
 * The page under its header: the first provider to connect, or the active provider, the others,
 * today's use and the sample test.
 */
export function ProvidersBody({
  settings,
  actions,
  onConnect,
  onConnectFirst,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
  onConnect: () => void;
  onConnectFirst: (providerId: string) => void;
}) {
  const active = activeConnection(settings);
  if (!settings.connections.length)
    return <FirstProvider settings={settings} onChoose={onConnectFirst} />;
  return (
    <>
      {active ? (
        <ActiveProviderCard settings={settings} connection={active} actions={actions} />
      ) : (
        <InlineNotification kind="error" title="No provider reads your mail.">
          New mails wait. Make a connected provider active, or connect a new one.
        </InlineNotification>
      )}
      <OtherProviders settings={settings} actions={actions} onConnect={onConnect} />
      {active && <UsageAndTest settings={settings} />}
    </>
  );
}
