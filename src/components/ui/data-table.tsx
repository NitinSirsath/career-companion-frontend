import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from '@tanstack/react-table';
import { ArrowDown } from '@carbon/icons-react';
import { cn } from '../../lib/utils';
import { Skeleton } from './skeleton';

declare module '@tanstack/react-table' {
  // TanStack declares these type parameters; this table does not need them.
  // oxlint-disable-next-line no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** The server sort this column's header switches to. Lists sort on the server only. */
    sortKey?: string;
    /** Extra classes for this column's cells, such as right alignment. */
    className?: string;
    /** Lifts this cell above the row's link: for menus, buttons and other links. */
    interactive?: boolean;
    /** Names the value on phones, where rows stack and the header row is hidden. */
    phoneLabel?: string;
    /** Shows the number of rows on this page after this column's header: "Mail 5". */
    count?: boolean;
  }
}

interface DataTableProps<T> {
  label: string;
  data: readonly T[];
  columns: ColumnDef<T>[];
  getRowId: (row: T) => string;
  /** Column widths on laptops, as a CSS grid template. Phones stack each row's cells. */
  gridTemplate: string;
  /** The sort the server uses now, and how to ask for another. */
  sort?: { active: string; onSort: (key: string) => void };
  loading?: boolean;
  /** Shown instead of rows when there are none: an EmptyState or a SectionError. */
  empty?: React.ReactNode;
  /** A last row after the data rows, such as "+ Add application". */
  endRow?: React.ReactNode;
  /** Under the rows: the pager. */
  footer?: React.ReactNode;
  /** Shown above the header: the toolbar. */
  toolbar?: React.ReactNode;
}

const ROW_CLASS =
  'relative flex flex-col gap-2 border-b border-border-subtle p-4 transition-colors duration-70 ease-standard hover:bg-layer-hover md:grid md:items-start md:gap-x-4 md:gap-y-0 md:py-4';

/** The number after a header: small, mono, on grey. */
function CountTag({ count }: { count: number }) {
  return (
    <span className="bg-tag-gray-bg px-1.5 font-mono text-[11px] leading-4 tracking-normal text-tag-gray">
      {count}
    </span>
  );
}

/**
 * One table for every list, with no outer frame: a header row in small mono capitals over a
 * darker line, then rows split by thin lines. Sorting, filtering and paging stay on the server;
 * this draws the rows, the header that switches the server sort, skeleton rows while loading,
 * and the empty state. A cell can stretch a link over its row with `ROW_LINK_CLASS`.
 */
export function DataTable<T>({
  label,
  data,
  columns,
  getRowId,
  gridTemplate,
  sort,
  loading = false,
  empty,
  endRow,
  footer,
  toolbar,
}: DataTableProps<T>) {
  const table = useReactTable({
    data: data as T[],
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    // The server sorts and pages. Without these, a new list on every render makes TanStack reset
    // its page state on every render, which loops.
    manualSorting: true,
    manualPagination: true,
    autoResetAll: false,
  });
  const style = { gridTemplateColumns: gridTemplate } as React.CSSProperties;
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col">
      {toolbar && <div className="mb-6">{toolbar}</div>}
      <div role="table" aria-label={label} aria-busy={loading || undefined}>
        <div role="rowgroup" className="hidden md:block">
          {table.getHeaderGroups().map((group) => (
            <div
              key={group.id}
              role="row"
              className="grid h-12 items-center gap-x-4 border-b border-border-default px-4"
              style={style}
            >
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sortKey = meta?.sortKey;
                const content = flexRender(header.column.columnDef.header, header.getContext());
                const active = !!sort && sortKey === sort.active;
                return (
                  <div
                    key={header.id}
                    role="columnheader"
                    aria-sort={active ? 'descending' : undefined}
                    className={cn(
                      'flex items-center gap-2 font-mono text-[12px] leading-4 tracking-[0.08em] text-text-primary uppercase',
                      meta?.className,
                    )}
                  >
                    {sortKey && sort ? (
                      <button
                        type="button"
                        onClick={() => sort.onSort(sortKey)}
                        className="group inline-flex h-12 cursor-pointer items-center gap-2 uppercase"
                      >
                        {content}
                        <ArrowDown
                          size={14}
                          aria-hidden="true"
                          className={cn(
                            'transition-opacity duration-70 ease-standard',
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
                          )}
                        />
                      </button>
                    ) : (
                      content
                    )}
                    {meta?.count && !loading && rows.length > 0 && <CountTag count={rows.length} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* On phones the header row is hidden, so the first row draws the line above itself. */}
        <div role="rowgroup" className="border-t border-border-subtle md:border-t-0">
          {loading && (
            <span role="status" className="sr-only">
              Loading {label.toLowerCase()}
            </span>
          )}
          {loading &&
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} role="row" className={ROW_CLASS} style={style}>
                {columns.map((_, c) => (
                  <div key={c} role="cell" className="flex flex-col gap-2">
                    <Skeleton className={c === 1 ? 'w-4/5' : 'w-3/5'} />
                    {c === 1 && <Skeleton className="h-3 w-1/2" />}
                  </div>
                ))}
              </div>
            ))}
          {!loading &&
            rows.map((row) => (
              <div
                key={row.id}
                role="row"
                className={cn(ROW_CLASS, 'animate-fade-in')}
                style={style}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <div
                      key={cell.id}
                      role="cell"
                      className={cn(
                        'min-w-0 text-sm',
                        meta?.interactive && 'relative z-10',
                        meta?.className,
                      )}
                    >
                      {meta?.phoneLabel && (
                        <div className="mb-0.5 text-xs text-text-secondary md:hidden">
                          {meta.phoneLabel}
                        </div>
                      )}
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
      {!loading && rows.length === 0 && empty && (
        <div className="border-b border-border-subtle px-4">{empty}</div>
      )}
      {!loading && endRow}
      {footer}
    </div>
  );
}

/**
 * For a cell's main link, the row's name: 15/22, underlined with a light line. It covers the whole
 * row, so a click anywhere on the row opens it.
 */
export const ROW_LINK_CLASS =
  'text-[15px] leading-[22px] text-text-primary underline decoration-border-default underline-offset-[3px] transition-[text-decoration-color] duration-70 ease-standard after:absolute after:inset-0 after:content-[""] hover:text-text-primary hover:decoration-text-primary focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-border-focus';
