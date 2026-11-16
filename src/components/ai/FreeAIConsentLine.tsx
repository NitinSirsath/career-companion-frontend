import { useState } from 'react';
import { FREE_AI_FACTS } from '../../lib/freeAI';
import { cn } from '../../lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';

/** "What is sent": the free AI's facts, read only. Pressing Connect Gmail is the agreement. */
function WhatIsSent({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What is sent</DialogTitle>
          <DialogDescription>
            NorthList&apos;s free AI reads your job mails. Free for you: NorthList pays for it.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-x-4 gap-y-2.5 pb-6 text-sm sm:grid-cols-[110px_1fr]">
          {FREE_AI_FACTS.map((fact) => (
            <div key={fact.term} className="contents">
              <dt className="text-text-secondary">{fact.term}</dt>
              <dd className="mb-2 sm:mb-0">{fact.text}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Under a "Connect Gmail" button that also turns on the free AI (owner, 15 Nov 2026): one grey line
 * saying the free AI reads the job mails, and "What is sent". Pressing the button agrees.
 */
export function FreeAIConsentLine({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <p className={cn('text-xs text-text-secondary', className)}>
        Your job mails are read by NorthList&apos;s free AI, through OpenRouter.{' '}
        <button
          type="button"
          className="cursor-pointer whitespace-nowrap text-link hover:underline"
          onClick={() => setOpen(true)}
        >
          What is sent
        </button>
      </p>
      <WhatIsSent open={open} onClose={() => setOpen(false)} />
    </>
  );
}
