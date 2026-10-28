import type { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { useBlockedSenders, useUnblockSender } from '../../api/removal';
import type { BlockedSender } from '../../contracts/blockedSender';
import { Button } from '../ui/button';
import { DataTable } from '../ui/data-table';
import { EmptyState } from '../ui/empty-state';
import { SectionError } from '../ui/section-error';
import { showToast } from '../ui/toast';

const HOW: Record<BlockedSender['source'], string> = {
  DELETE: 'When you deleted a conversation',
  MENU: "From a mail's menu",
};

function UnblockButton({ row }: { row: BlockedSender }) {
  const unblock = useUnblockSender();
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={unblock.isPending}
      onClick={() =>
        unblock.mutate(row.id, {
          onSuccess: () => showToast(`New mails from ${row.domain} come in again.`),
          onError: () => showToast('That did not go through. Try again.'),
        })
      }
    >
      Unblock
    </Button>
  );
}

const columns: ColumnDef<BlockedSender>[] = [
  {
    id: 'domain',
    header: () => 'Company domain',
    cell: ({ row }) => <span className="font-semibold break-all">{row.original.domain}</span>,
  },
  {
    id: 'blocked',
    header: () => 'Blocked',
    meta: { phoneLabel: 'Blocked' },
    cell: ({ row }) => format(new Date(row.original.createdAt), 'MMM d, yyyy'),
  },
  {
    id: 'how',
    header: () => 'How',
    meta: { phoneLabel: 'How' },
    cell: ({ row }) => HOW[row.original.source],
  },
  { id: 'unblock', header: () => '', cell: ({ row }) => <UnblockButton row={row.original} /> },
];

/** The Restricted tab: companies whose new mail the app does not read, with Unblock. */
export function RestrictedList() {
  const blocked = useBlockedSenders();
  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        NorthList does not read new mails from these companies. Unblock to let new mails in again.
        Mails that came while blocked are not fetched.
      </p>
      <DataTable
        label="Blocked companies"
        data={blocked.data?.items ?? []}
        columns={columns}
        getRowId={(row) => row.id}
        gridTemplate="minmax(180px,1.5fr) 140px minmax(200px,1.5fr) 120px"
        loading={blocked.isLoading}
        empty={
          blocked.error ? (
            <SectionError
              className="my-4"
              title="Could not load the blocked companies"
              onRetry={() => void blocked.refetch()}
            />
          ) : (
            <EmptyState title="No companies blocked">
              Block a company from a mail&apos;s menu, or when you delete a conversation.
            </EmptyState>
          )
        }
      />
    </section>
  );
}
