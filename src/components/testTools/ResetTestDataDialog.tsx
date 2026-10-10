import { useState } from 'react';
import { useResetTestData, useTestToolsBusy } from '../../api/testTools';
import { failureNotice, resetSummary } from '../../lib/testInbox';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

interface ResetTestDataDialogProps {
  onReset: (notice: string) => void;
  onNotice: (notice: string) => void;
}

/** Deletes the user's test emails and applications, after an explicit confirmation. */
export function ResetTestDataDialog({ onReset, onNotice }: ResetTestDataDialogProps) {
  const reset = useResetTestData();
  const busy = useTestToolsBusy();
  const [open, setOpen] = useState(false);

  const confirmReset = () =>
    reset.mutate(undefined, {
      onSuccess: (result) => onReset(resetSummary(result)),
      onError: (err) => onNotice(failureNotice('reset', err)),
      onSettled: () => setOpen(false),
    });

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-4">
      <p className="text-sm text-muted-foreground">
        Reset deletes your test emails and applications. It keeps your login and AI settings.
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="danger" disabled={busy}>
            Reset my test data
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your test data?</DialogTitle>
          </DialogHeader>
          <p className="my-3 text-sm text-text-secondary">
            This deletes all your test emails and applications. It cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="tertiary" disabled={reset.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={reset.isPending} onClick={confirmReset}>
              {reset.isPending ? 'Resetting...' : 'Delete test data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
