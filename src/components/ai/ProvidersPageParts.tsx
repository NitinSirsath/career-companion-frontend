import type { AISettingsResponse } from '../../contracts/ai';
import { activeConnection } from '../../lib/aiConnections';
import { providerName } from '../../lib/aiLabels';
import { freeAIOffered, isFreeAI } from '../../lib/freeAI';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Tag } from '../ui/tag';
import { ActiveProviderCard, type ProviderActions } from './ActiveProviderCard';
import { ConnectProviderDialog } from './ConnectProviderDialog';
import { FreeAICard } from './FreeAICard';
import { FreeAIDialog } from './FreeAIDialog';
import { OtherProviders } from './OtherProviders';
import { MakeActiveDialog, RemoveProviderDialog, ReplaceKeyDialog } from './ProviderDialogs';
import { ProviderPicker } from './ProviderPicker';
import { UsageAndTest } from './UsageAndTest';

/** The dialog open on the page, and for which provider. */
export type OpenDialog =
  | { kind: 'connect'; start: string | null }
  | { kind: 'replace' | 'activate' | 'remove'; provider: string }
  | { kind: 'free'; backup: boolean }
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
  if (open.kind === 'free') {
    const active = open.backup ? activeConnection(settings) : null;
    return (
      <FreeAIDialog
        backupFor={active && providerName(active.provider)}
        onClose={onClose}
        onDone={onDone}
      />
    );
  }
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

/** One way to read the mail, for a user who has none yet. */
function ChoiceCard({
  tag,
  title,
  lead,
  points,
  action,
}: {
  tag: React.ReactNode;
  title: string;
  lead: string;
  points: string[];
  action: React.ReactNode;
}) {
  return (
    <li className="flex flex-col items-start gap-3 border border-border-subtle bg-surface px-6 py-5">
      {tag}
      <h3 className="text-lg leading-[26px]">{title}</h3>
      <p className="text-sm">{lead}</p>
      <ul className="flex list-disc flex-col gap-1 pl-[18px] text-sm text-text-secondary">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className="mt-auto pt-1">{action}</div>
    </li>
  );
}

/**
 * Nothing connected yet, with the free AI offered (owner, 24 Oct 2026): the user's own key,
 * recommended, or NorthList's free AI. Right after Gmail is connected, the page says so.
 */
function ChooseHowToRead({
  gmailConnected,
  onConnectOwn,
  onUseFreeAI,
}: {
  gmailConnected: boolean;
  onConnectOwn: () => void;
  onUseFreeAI: () => void;
}) {
  return (
    <>
      {gmailConnected && (
        <InlineNotification kind="success">
          Gmail is connected. One more step: choose how your mails are read.
        </InlineNotification>
      )}
      <section aria-labelledby="ai-first-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ai-first-heading" className="text-base leading-[22px] font-semibold">
            Choose how your mails are read
          </h2>
          <p className="text-sm text-text-secondary">
            New mails wait until one of these reads them. You can change this any time.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          <ChoiceCard
            tag={<Tag color="blue">Recommended</Tag>}
            title="Use your own AI key"
            lead="Fastest. Your mails go to your own OpenRouter account, and nobody else shares its limits."
            points={[
              'Takes about 5 minutes: make a key and add a few dollars of credit.',
              'About $0.10 for 1,000 mails with GPT-6 Luna.',
              'You can choose the models.',
            ]}
            action={<Button onClick={onConnectOwn}>Connect a provider</Button>}
          />
          <ChoiceCard
            tag={<Tag>Free</Tag>}
            title="NorthList free AI"
            lead="Free for you, runs on OpenRouter. Shared by everyone, so it can be slow sometimes."
            points={[
              'Ready in one click. No account or key needed.',
              'About 200 mails a day.',
              'Can pause for a few minutes when it is busy. Mails wait and are never lost.',
            ]}
            action={
              <Button variant="secondary" onClick={onUseFreeAI}>
                Connect
              </Button>
            }
          />
        </ul>
      </section>
    </>
  );
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
  gmailConnected,
  onConnect,
  onConnectFirst,
}: {
  settings: AISettingsResponse;
  actions: ProviderActions;
  gmailConnected: boolean;
  onConnect: () => void;
  onConnectFirst: (providerId: string) => void;
}) {
  const active = activeConnection(settings);
  if (!settings.connections.length)
    return freeAIOffered(settings) ? (
      <ChooseHowToRead
        gmailConnected={gmailConnected}
        onConnectOwn={onConnect}
        onUseFreeAI={actions.onUseFreeAI}
      />
    ) : (
      <FirstProvider settings={settings} onChoose={onConnectFirst} />
    );
  const free = !!active && isFreeAI(active.provider);
  return (
    <>
      {active && free && (
        <FreeAICard
          settings={settings}
          connection={active}
          actions={actions}
          onConnectOwn={onConnect}
        />
      )}
      {active && !free && (
        <ActiveProviderCard settings={settings} connection={active} actions={actions} />
      )}
      {!active && (
        <InlineNotification kind="error" title="No provider reads your mail.">
          New mails wait. Make a connected provider active, or connect a new one.
        </InlineNotification>
      )}
      <OtherProviders settings={settings} actions={actions} onConnect={onConnect} />
      {active && <UsageAndTest settings={settings} />}
    </>
  );
}
