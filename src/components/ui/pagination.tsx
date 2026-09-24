
import { Button } from './button';

interface PaginationProps {
  offset: number;
  limit: number;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function Pagination({ offset, limit, hasNext, onPrevious, onNext }: PaginationProps) {
  const currentPage = Math.floor(offset / limit) + 1;
  const isFirstPage = offset === 0;

  return (
    <div className="flex items-center justify-between border-t border-border pt-4 mt-6">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onPrevious} 
        disabled={isFirstPage}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {currentPage}
      </span>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onNext} 
        disabled={!hasNext}
      >
        Next
      </Button>
    </div>
  );
}
