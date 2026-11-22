import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, CopyIcon, DownloadIcon, MonitorIcon } from 'lucide-react';
import { api, isApiError } from '../../api/client';
import { AI_APPS, aiProgress, type AIAppKey } from '../../lib/onboarding';
import { NORTHLIST_APPLY_CLONE, NORTHLIST_APPLY_ZIP_URL, setupPrompt } from '../../lib/setupPrompt';
import { cn } from '../../lib/utils';
import { useServerAddress } from '../automation/useServerAddress';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Textarea } from '../ui/textarea';
import { DoneLine } from './BasicSteps';
import { AIPicture } from './LaptopPictures';
import { Frame } from './OnboardingFrame';
import { PhoneSettings } from './PhonePictures';

/** A year, as on the Automation page, so the setup is rarely redone. */
const EXPIRY_DAYS = 365;
/** How often the step asks whether the AI app has used its new token. */
const USED_POLL_MS = 3000;

/** True once the AI app first used the token: it is connected. Asks until then. */
function useTokenUsed(tokenId: string | null) {
  const { data } = useQuery({
    queryKey: ['integrationTokens', 'first-use', tokenId],
    queryFn: async ({ signal }) => {
      const list = await api.listIntegrationTokens({ limit: 20 }, { signal });
      return list.items.some((token) => token.id === tokenId && token.lastUsedAt !== null);
    },
    enabled: tokenId !== null,
    refetchInterval: (query) => (query.state.data ? false : USED_POLL_MS),
  });
  return data === true;
}

/** Copies text; the text may still be on its way, so the tap's permission to copy is kept. */
async function copyText(text: Promise<string>) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = text.then((value) => new Blob([value], { type: 'text/plain' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': blob })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}

/** Why the setup prompt could not be made, in the user's words. */
function makeProblem(error: unknown): string {
  if (!isApiError(error)) return 'Making the setup prompt failed. Try again.';
  if (error.outcomeUncertain)
    return 'We could not confirm that the setup prompt was made. Check your tokens in Automation › Setup, revoke one you do not use, then try again.';
  return error.message;
}

type Made = { id: string; prompt: string; shown: string };

/**
 * The setup prompt, made on the first Copy: it holds a new token, which lives only in this
 * component's state (never in a cache, the address or browser storage), as on the Automation page.
 */
function useSetupPrompt(appName: string) {
  const serverAddress = useServerAddress();
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const make = async (address: string): Promise<string> => {
    if (made) return made.prompt;
    const result = await api.createIntegrationToken({ name: appName, expiresInDays: EXPIRY_DAYS });
    const prompt = setupPrompt(address, result.plaintextToken);
    setMade({
      id: result.integrationToken.id,
      prompt,
      shown: setupPrompt(address, `${result.integrationToken.displayPrefix}••••`),
    });
    return prompt;
  };

  const copy = async () => {
    if (!serverAddress || pending) return;
    setPending(true);
    setProblem(null);
    const prompt = make(serverAddress);
    prompt.catch(() => undefined);
    try {
      await copyText(prompt);
      setCopied('yes');
    } catch {
      try {
        await prompt;
        setCopied('failed');
      } catch (error) {
        setProblem(makeProblem(error));
      }
    } finally {
      setPending(false);
    }
  };

  const preview = serverAddress ? setupPrompt(serverAddress, 'ccmcp_••••••') : '';
  return {
    made,
    shown: made?.shown ?? preview,
    copied,
    pending,
    problem,
    copy,
    ready: !!serverAddress,
  };
}

function StepRow({
  index,
  progress,
  fresh,
  title,
  text,
  children,
}: {
  index: number;
  progress: number;
  fresh: boolean;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  const done = index < progress;
  const current = index === progress;
  return (
    <div className={cn('st', done && 'done', current && 'cur')}>
      <span className={cn('n', done && fresh && 'ob-burst')}>
        {done ? (
          <span className="ob-popin flex">
            <CheckIcon size={13} strokeWidth={2.8} aria-hidden="true" />
          </span>
        ) : (
          index + 1
        )}
      </span>
      <div className="min-w-0">
        <b>{title}</b>
        <small>{text}</small>
        {children && <div className="act">{children}</div>}
      </div>
    </div>
  );
}

/** Antigravity, Claude Code or Codex: words, not logos. Antigravity is chosen first. */
function AppPicker({ chosen, onPick }: { chosen: AIAppKey; onPick: (key: AIAppKey) => void }) {
  return (
    <div className="ob-ais" role="group" aria-label="Your AI app">
      {AI_APPS.map((a) => (
        <button
          key={a.key}
          type="button"
          className="ob-pick"
          aria-pressed={a.key === chosen}
          onClick={() => onPick(a.key)}
        >
          <div className="ob-glyph" aria-hidden="true">
            {a.short}
          </div>
          <b>{a.name}</b>
          <small className={a.key === 'antigravity' ? 'rec' : undefined}>{a.note}</small>
          {a.key === chosen && (
            <span className="ob-check ob-popin">
              <CheckIcon size={13} strokeWidth={2.6} aria-hidden="true" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Step 1's two ways to get the folder; either one ticks the step. */
function GetActions({ onGot }: { onGot: () => void }) {
  const [copied, setCopied] = useState(false);
  const copyClone = async () => {
    onGot();
    try {
      await navigator.clipboard.writeText(NORTHLIST_APPLY_CLONE);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          onGot();
          // GitHub sends the ZIP as a download: this page stays open.
          window.location.assign(NORTHLIST_APPLY_ZIP_URL);
        }}
      >
        <DownloadIcon aria-hidden="true" /> Download ZIP
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void copyClone()}>
        <CopyIcon aria-hidden="true" /> {copied ? 'Copied' : 'Copy clone command'}
      </Button>
    </>
  );
}

/** Step 3: the prompt (key hidden) and Copy; if copying failed, the whole prompt to select. */
function PromptActions({
  setup,
  open,
}: {
  setup: ReturnType<typeof useSetupPrompt>;
  open: boolean;
}) {
  return (
    <>
      {open && (
        <>
          <div className="ob-code">{setup.shown}</div>
          <Button
            size="sm"
            loading={setup.pending}
            disabled={!setup.ready}
            onClick={() => void setup.copy()}
          >
            <CopyIcon aria-hidden="true" /> Copy prompt
          </Button>
        </>
      )}
      {setup.copied === 'failed' && setup.made && (
        <div className="w-full">
          <p className="text-xs">Could not copy. Select the text and copy it yourself.</p>
          <Textarea
            readOnly
            rows={6}
            value={setup.made.prompt}
            aria-label="Setup prompt"
            onFocus={(event) => event.currentTarget.select()}
            autoComplete="off"
            spellCheck={false}
            data-1p-ignore
            data-lpignore="true"
            className="mt-1 resize-none font-mono text-xs"
          />
        </div>
      )}
    </>
  );
}

/** Under the steps: waiting for the AI app, or connected. */
function WaitLine({ progress, appName }: { progress: number; appName: string }) {
  if (progress >= 4)
    return (
      <div className="mt-2.5">
        <DoneLine
          title="Connected"
          line={`${appName} on this laptop · applications will show up here`}
        />
      </div>
    );
  return (
    <div className="ob-wait mt-2.5">
      <span className="ob-pulse" />
      <div>
        <span className="ob-reading">
          {progress < 2 ? 'Follow the steps above' : `Waiting for ${appName}…`}
        </span>
        <div className="faint">Ticks by itself as you go.</div>
      </div>
    </div>
  );
}

function LaptopAIStep({ email }: { email: string }) {
  const [appKey, setAppKey] = useState<AIAppKey>('antigravity');
  const app = AI_APPS.find((a) => a.key === appKey) ?? AI_APPS[0];
  const [got, setGot] = useState(false);
  const setup = useSetupPrompt(app.name);
  const used = useTokenUsed(setup.made?.id ?? null);
  const progress = aiProgress(got, setup.copied !== null, used);
  return (
    <Frame
      title="Apply to jobs with your AI"
      sub="Optional. NorthList Apply lets your AI app apply for you; each application shows up here by itself."
      picture={<AIPicture done={progress} email={email} />}
      phonePicture={null}
      main={{ label: progress >= 4 ? 'Continue' : 'Skip, do it later in Automation' }}
    >
      <AppPicker chosen={appKey} onPick={setAppKey} />
      <div className="ob-tl">
        <StepRow
          index={0}
          progress={progress}
          fresh={progress === 1}
          title="Get NorthList Apply"
          text="A small folder of instructions. Free, on GitHub."
        >
          {progress === 0 && <GetActions onGot={() => setGot(true)} />}
        </StepRow>
        <StepRow
          index={1}
          progress={progress}
          fresh={false}
          title={`Open the folder in ${app.name}`}
          text={app.open}
        />
        <StepRow
          index={2}
          progress={progress}
          fresh={progress === 3}
          title="Paste your setup prompt"
          text="It has your private key. It is made when you copy it and works for one year."
        >
          <PromptActions setup={setup} open={progress < 3} />
        </StepRow>
        <StepRow
          index={3}
          progress={progress}
          fresh={progress === 4}
          title={`Allow "northlist" when ${app.name} asks`}
          text={`One tap. It lets ${app.name} record your applications in NorthList and nothing else.`}
        />
      </div>
      {setup.problem && <InlineNotification kind="error">{setup.problem}</InlineNotification>}
      <WaitLine progress={progress} appName={app.name} />
    </Frame>
  );
}

/** Your AI: NorthList Apply, set up on a laptop; a phone says so. */
export function AIStep({ phone, email }: { phone: boolean; email: string }) {
  if (!phone) return <LaptopAIStep email={email} />;
  return (
    <Frame
      title="Apply to jobs with your AI"
      sub="Optional. NorthList Apply lets your AI app apply for you; each application shows up here by itself."
      picture={null}
      phonePicture={<PhoneSettings />}
    >
      <div className="ob-wait items-start">
        <MonitorIcon className="mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <b>Do this on your laptop</b>
          <div className="faint mt-0.5">
            NorthList Apply runs in an AI app on your laptop (Antigravity recommended). Set it up
            there any time from Automation › Setup.
          </div>
        </div>
      </div>
    </Frame>
  );
}
