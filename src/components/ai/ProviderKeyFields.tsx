import { useEffect, type RefObject } from 'react';
import { AI_DATA_SENT_SUMMARY, type CatalogProvider } from '../../contracts/aiCatalog';
import type { SaveProblem } from '../../lib/aiProviderPage';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Reveal } from '../ui/reveal';

/**
 * The API key box: a password field that is never prefilled. The key lives only in this
 * uncontrolled field and in one local variable while it is sent: never in React state, the query
 * or mutation cache, the URL or browser storage.
 */
export function ApiKeyField({
  id,
  label,
  placeholder,
  inputRef,
}: {
  id: string;
  label: string;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  // A typed key never outlives the form.
  useEffect(() => {
    const input = inputRef.current;
    return () => {
      if (input) input.value = '';
    };
  }, [inputRef]);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        type="password"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        data-1p-ignore
        data-lpignore="true"
        placeholder={placeholder}
      />
      <p className="text-xs text-text-secondary">
        Stored encrypted. Career Companion never shows it again.
      </p>
    </div>
  );
}

/** What is sent to the provider, its terms, and the box the user ticks to agree. */
export function DataUseConsent({
  provider,
  checked,
  onCheckedChange,
}: {
  provider: CatalogProvider;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const name = provider.displayName;
  return (
    <section aria-labelledby="ai-data-use" className="space-y-2 border-t border-border-subtle pt-4">
      <h3 id="ai-data-use" className="text-sm font-semibold">
        What is sent to {name}
      </h3>
      <p className="text-sm">{AI_DATA_SENT_SUMMARY}</p>
      <p className="text-sm text-text-secondary">{provider.disclosure.summary}</p>
      <p className="text-sm text-text-secondary">{provider.disclosure.training}</p>
      <p className="text-sm text-text-secondary">{provider.disclosure.residency}</p>
      <a
        className="text-sm underline text-action-primary"
        href={provider.links.dataUse}
        target="_blank"
        rel="noopener noreferrer"
      >
        Read {name}&apos;s terms
      </a>
      <CheckRow id="ai-consent" checked={checked} onCheckedChange={onCheckedChange}>
        I understand that these details of my emails are sent to {name} under my own account and its
        terms.
      </CheckRow>
    </section>
  );
}

/** A checkbox with its label beside it. */
export function CheckRow({
  id,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-border-focus"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <Label htmlFor={id} className="leading-snug">
        {children}
      </Label>
    </div>
  );
}

/** Why a save did not work, with its one fix. */
export function SaveProblemAlert({ problem }: { problem: SaveProblem }) {
  return (
    <Reveal>
      <div
        role="alert"
        className="space-y-1 border border-status-error bg-status-error-subtle p-3 text-sm"
      >
        <p>{problem.text}</p>
        {problem.link && (
          <a
            className="underline"
            href={problem.link.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {problem.link.label}
          </a>
        )}
      </div>
    </Reveal>
  );
}
