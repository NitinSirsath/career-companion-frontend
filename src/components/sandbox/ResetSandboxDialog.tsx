import { useState } from 'react';
import { useResetSandbox } from '../../api/sandbox';
import { sandboxProblem } from '../../lib/sandbox';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

/** Empties the sandbox mailbox and what the app made from it, after an explicit confirmation. */
export function ResetSandboxDialog() {
  const reset = useResetSandbox();
  const [open, setOpen] = useState(false);
  const confirm = () => reset.mutate(undefined, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="tertiary" className="text-status-error">
          Reset dev data
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your dev data?</DialogTitle>
        </DialogHeader>
        <p className="my-3 text-sm text-text-secondary">
          This deletes all your sandbox mail and everything the app made from it: mails,
          applications and their history. It keeps your login, your AI settings and the sandbox
          connection. It cannot be undone.
        </p>
        {reset.isError && (
          <p role="alert" className="mb-3 text-sm text-status-error">
            {sandboxProblem(reset.error)}
          </p>
        )}
        <DialogFooter>
          <Button variant="tertiary" disabled={reset.isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={reset.isPending} onClick={confirm}>
            {reset.isPending ? 'Resetting…' : 'Delete dev data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
