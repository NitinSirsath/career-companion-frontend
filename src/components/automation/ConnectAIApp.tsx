import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react';
import { AI_APPS, type AIAppKey } from '../../lib/onboarding';
import { buttonNote, openAppLink } from '../../lib/setupPrompt';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { InlineNotification } from '../ui/notification';
import { Textarea } from '../ui/textarea';
import type { SetupCode, useSetupCode } from './useSetupCode';

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Antigravity (recommended, picked first), Codex or Claude Code: words, not logos. */
export function AIAppChoice({
  chosen,
  onPick,
}: {
  chosen: AIAppKey;
  onPick: (key: AIAppKey) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Your AI app" className="grid gap-2.5 sm:grid-cols-3">
      {AI_APPS.map((a) => {
        const picked = a.key === chosen;
        return (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={picked}
            onClick={() => onPick(a.key)}
            className={cn(
              'relative flex cursor-pointer flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors duration-70 ease-standard focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-border-focus',
              picked
                ? 'border-text-primary bg-layer-accent'
                : 'border-border-default hover:bg-layer-hover',
            )}
          >
            <b className="text-sm font-semibold">{a.name}</b>
            <small className="text-xs text-text-secondary">{a.note}</small>
            {picked && (
              <CheckIcon
                size={15}
                strokeWidth={2.6}
                aria-hidden="true"
                className="absolute top-3 right-3"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The code made, its time left, the prompt and the buttons to open or copy it again. */
function CodeBox({
  app,
  setup,
  code,
}: {
  app: (typeof AI_APPS)[number];
  setup: ReturnType<typeof useSetupCode>;
  code: SetupCode;
}) {
  const link = openAppLink(app.key, code.prompt);
  const label = `Open in ${app.name}`;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-default p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-lg font-semibold tracking-wider">{code.code}</span>
        <span className="text-xs text-text-secondary tabular-nums" role="timer">
          Works once · {mmss(setup.secondsLeft)} left
        </span>
      </div>
      <Textarea
        readOnly
        rows={7}
        value={code.prompt}
        aria-label="Setup prompt"
        onFocus={(e) => e.currentTarget.select()}
        autoComplete="off"
        spellCheck={false}
        className="resize-none font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        {link ? (
          <a
            href={link}
            className="inline-flex h-8 items-center gap-2 rounded-full bg-action-primary px-3.5 text-sm font-medium text-on-accent hover:bg-action-primary-hover"
          >
            <ExternalLinkIcon size={16} aria-hidden="true" /> {label}
          </a>
        ) : (
          <Button size="sm" onClick={() => void setup.copy()}>
            <CopyIcon size={16} aria-hidden="true" /> Copy setup prompt
          </Button>
        )}
        {link && (
          <Button size="sm" variant="ghost" onClick={() => void setup.copy()}>
            Copy prompt instead
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          loading={setup.pending}
          onClick={() => void setup.start(app, true)}
        >
          New code
        </Button>
      </div>
      <p className="text-xs text-text-secondary">
        No token in the link: your AI app swaps this code for one, once. Never share it.
      </p>
    </div>
  );
}

/**
 * The one-click part (owner, 23 Nov 2026): one button for the picked app. It makes a setup code
 * (once, 10 minutes) and opens the app with the prompt, or copies it for Antigravity.
 */
export function SetupCodeButton({
  app,
  setup,
  withNote = true,
}: {
  app: (typeof AI_APPS)[number];
  setup: ReturnType<typeof useSetupCode>;
  /** False where the step already says what the button does. */
  withNote?: boolean;
}) {
  const hasLink = app.key !== 'antigravity';
  const label = hasLink ? `Open in ${app.name}` : 'Copy setup prompt';
  return (
    <div className="flex flex-col gap-3">
      {setup.made ? (
        <CodeBox app={app} setup={setup} code={setup.made} />
      ) : (
        <div className="flex flex-col items-start gap-2">
          <Button
            loading={setup.pending}
            disabled={!setup.ready}
            onClick={() => void setup.start(app)}
          >
            {hasLink ? (
              <ExternalLinkIcon size={16} aria-hidden="true" />
            ) : (
              <CopyIcon size={16} aria-hidden="true" />
            )}{' '}
            {label}
          </Button>
          {(withNote || setup.expired) && (
            <p className="text-xs text-text-secondary">
              {setup.expired
                ? 'That code is too old now. Make a new one with the button.'
                : buttonNote(app.key)}
            </p>
          )}
        </div>
      )}
      {setup.copied === 'yes' && (
        <p role="status" className="text-sm">
          Copied. Paste it into a new chat in {app.name}.
        </p>
      )}
      {setup.copied === 'failed' && (
        <p role="status" className="text-sm">
          Could not copy. Select the prompt and copy it yourself.
        </p>
      )}
      {setup.connected && (
        <p role="status" className="text-sm font-medium">
          Connected. Your applications will show up here.
        </p>
      )}
      {setup.problem && <InlineNotification kind="error">{setup.problem}</InlineNotification>}
    </div>
  );
}
