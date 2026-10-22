import { ChevronLeft, ChevronRight } from '@carbon/icons-react';

interface PaginationProps {
  offset: number;
  limit: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** Replaces "Page N", for example "Showing 21–40". */
  summary?: string;
}

const PAGE_BUTTON =
  'flex size-12 cursor-pointer items-center justify-center border-l border-border-subtle text-text-primary transition-colors duration-70 ease-standard hover:bg-layer-hover disabled:cursor-not-allowed disabled:text-text-disabled disabled:hover:bg-transparent';

/** The bar under a list: the page number, and buttons for the page before and after. */
export function Pagination({
  offset,
  limit,
  hasNext,
  onPrevious,
  onNext,
  summary,
}: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const isFirstPage = offset === 0;

  return (
    <div className="flex h-12 items-center justify-between border-t border-border-subtle bg-surface pl-4">
      <span role="status" className="text-xs text-text-primary">
        {summary ?? `Page ${currentPage}`}
      </span>
      <div className="flex">
        <button
          type="button"
          aria-label="Previous"
          className={PAGE_BUTTON}
          onClick={onPrevious}
          disabled={isFirstPage}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Next"
          className={PAGE_BUTTON}
          onClick={onNext}
          disabled={!hasNext}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
