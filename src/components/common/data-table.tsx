/**
 * BCAMS DataTable
 * 
 * Enterprise data table with search, sorting, pagination, and row actions.
 * Used across People, Sessions, Devices, Courses, etc.
 */
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/common/empty-error-states';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
  className?: string;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFn?: (item: T, query: string) => boolean;
  pageSize?: number;
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  headerActions?: React.ReactNode;
  getRowId?: (item: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchFn,
  pageSize = 10,
  onRowClick,
  emptyTitle = 'No data',
  emptyDescription = 'No records to display.',
  emptyAction,
  headerActions,
  getRowId,
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchQuery || !searchFn) return data;
    return data.filter(item => searchFn(item, searchQuery.toLowerCase()));
  }, [data, searchQuery, searchFn]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const column = columns.find(c => c.key === sortKey);
    if (!column?.sortFn) return filteredData;
    const sorted = [...filteredData].sort(column.sortFn);
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [filteredData, sortKey, sortDirection, columns]);

  // Paginate
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {searchable && <div className="skeleton h-9 w-64" />}
        <TableSkeleton rows={pageSize} cols={columns.length} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        {searchable && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      {/* Table */}
      {paginatedData.length === 0 ? (
        <EmptyState
          icon={<Table2 className="h-8 w-8 text-muted-foreground" />}
          title={searchQuery ? 'No results found' : emptyTitle}
          description={searchQuery ? `No records match "${searchQuery}". Try a different search term.` : emptyDescription}
          action={!searchQuery ? emptyAction : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="bcams-table">
            <thead className="bg-muted/50">
              <tr>
                {columns.map(col => (
                  <th key={col.key} className={cn(col.className)}>
                    {col.sortable ? (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.header}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item, index) => (
                <tr
                  key={getRowId ? getRowId(item) : index}
                  onClick={() => onRowClick?.(item)}
                  className={cn(onRowClick && 'cursor-pointer')}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={e => {
                    if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onRowClick(item);
                    }
                  }}
                >
                  {columns.map(col => (
                    <td key={col.key} className={cn(col.className)}>
                      {col.render(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? 'default' : 'ghost'}
                  size="icon-sm"
                  onClick={() => setCurrentPage(page)}
                  className="text-xs"
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
