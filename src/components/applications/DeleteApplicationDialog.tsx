import { useNavigate } from '@tanstack/react-router';
import { useDeleteApplication } from '../../api/removal';
import type { ApplicationResponse } from '../../contracts/application';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { InlineNotification } from '../ui/notification';
import { showToast } from '../ui/toast';

/**
 * Deletes an application from NorthList, after the user confirms. Its mails stay in Mails, no
 * longer linked; Archive is for a job that is finished.
 */
export function DeleteApplicationDialog({
  application,
  open,
  onClose,
}: {
  application: ApplicationResponse;
  open: boolean;
  onClose: () => void;
}) {
  const remove = useDeleteApplication(application.id);
  const navigate = useNavigate();
  const close = () => {
    if (remove.isPending) return;
    remove.reset();
    onClose();
  };
  const confirm = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        showToast(`Deleted ${application.companyName}.`);
        void navigate({ to: '/applications' });
      },
    });
  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {application.companyName}?</DialogTitle>
          <DialogDescription>
            This removes the application, its next steps and its history.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-text-secondary">
          Its mails stay in Mails, no longer linked. To finish a job search instead, use Archive.
        </p>
        {remove.isError && (
          <InlineNotification kind="error" className="mt-6">
            We could not confirm the delete. Close this and look at the application again.
          </InlineNotification>
        )}
        <DialogFooter>
          <Button variant="secondary" disabled={remove.isPending} onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" loading={remove.isPending} onClick={confirm}>
            Delete application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
