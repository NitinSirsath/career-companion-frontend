import { useState } from 'react';
import { Checkmark, Copy } from '@carbon/icons-react';
import { cn } from '../../lib/utils';

/** One line of code to copy, such as a server address, with a copy button that says it worked. */
export function CodeSnippet({
  code,
  label,
  className,
}: {
  code: string;
  /** What is copied, for the button: "the server address". */
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied('yes');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex min-h-10 items-center justify-between gap-2 bg-layer-accent pl-4">
        <code className="min-w-0 py-2 font-mono text-xs break-all">{code}</code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={() => void copy()}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover"
        >
          {copied === 'yes' ? (
            <Checkmark size={16} aria-hidden="true" className="text-ok" />
          ) : (
            <Copy size={16} aria-hidden="true" />
          )}
        </button>
      </div>
      <span role="status" className="text-xs text-text-secondary empty:hidden">
        {copied === 'yes' && 'Copied.'}
        {copied === 'failed' && 'Could not copy. Select the text and copy it yourself.'}
      </span>
    </div>
  );
}
