/**
 * BCAMS DataTable
 * 
 * Enterprise data table with search, sorting, pagination, row actions,
 * and optional multi-row selection.
 * Used across People, Sessions, Devices, Courses, etc.
 */
import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState, TableSkeleton } from '@/components/common/empty-error-states';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Table2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Pagination } from '@/components/common/pagination';

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
  pageSizeOptions?: number[];
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  headerActions?: React.ReactNode;
  keyField?: string;
  getRowId?: (item: T) => string;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
}

export function DataTable<T>({
  columns,
  data,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchFn,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  onRowClick,
  emptyTitle = 'No data',
  emptyDescription,
  emptyMessage,
  emptyAction,
  headerActions,
  keyField,
  getRowId,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const resolvedGetRowId = getRowId || ((item: any) => (keyField && item[keyField] ? String(item[keyField]) : item.id ? String(item.id) : String(item)));
  const resolvedEmptyDescription = emptyMessage || emptyDescription || 'No records to display.';
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);

  const activeSelectedIds = selectedIds ?? internalSelectedIds;
  const handleSelectionUpdate = (newSelected: string[]) => {
    if (onSelectionChange) {
      onSelectionChange(newSelected);
    } else {
      setInternalSelectedIds(newSelected);
    }
  };

  // Filter data (uses custom searchFn or smart recursive string check)
  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase().trim();

    if (searchFn) {
      return data.filter((item) => searchFn(item, query));
    }

    // Default smart search over object properties
    return data.filter((item) => {
      if (typeof item === 'object' && item !== null) {
        return Object.values(item).some((val) => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'string' || typeof val === 'number') {
            return String(val).toLowerCase().includes(query);
          }
          return false;
        });
      }
      return String(item).toLowerCase().includes(query);
    });
  }, [data, searchQuery, searchFn]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortFn) return filteredData;
    const sorted = [...filteredData].sort(column.sortFn);
    return sortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [filteredData, sortKey, sortDirection, columns]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / currentPageSize));
  const paginatedData = sortedData.slice(
    (currentPage - 1) * currentPageSize,
    currentPage * currentPageSize
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Selection handlers
  const allCurrentPageSelected =
    paginatedData.length > 0 &&
    paginatedData.every((item) => activeSelectedIds.includes(resolvedGetRowId(item)));

  const someCurrentPageSelected =
    paginatedData.some((item) => activeSelectedIds.includes(resolvedGetRowId(item))) &&
    !allCurrentPageSelected;

  const handleToggleSelectAll = () => {
    if (allCurrentPageSelected) {
      const pageIds = new Set(paginatedData.map((item) => resolvedGetRowId(item)));
      handleSelectionUpdate(activeSelectedIds.filter((id) => !pageIds.has(id)));
    } else {
      const newIds = new Set([
        ...activeSelectedIds,
        ...paginatedData.map((item) => resolvedGetRowId(item)),
      ]);
      handleSelectionUpdate(Array.from(newIds));
    }
  };

  const handleToggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeSelectedIds.includes(id)) {
      handleSelectionUpdate(activeSelectedIds.filter((i) => i !== id));
    } else {
      handleSelectionUpdate([...activeSelectedIds, id]);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {searchable && <div className="skeleton h-9 w-64 rounded-md" />}
        <TableSkeleton rows={pageSize} cols={columns.length + (selectable ? 1 : 0)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {searchable && (
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {selectable && activeSelectedIds.length > 0 && (
            <span className="text-xs font-medium text-primary px-2.5 py-1 rounded bg-primary-50 border border-primary-200">
              {activeSelectedIds.length} selected
            </span>
          )}
          {headerActions}
        </div>
      </div>

      {/* Table Content */}
      {paginatedData.length === 0 ? (
        <EmptyState
          icon={<Table2 className="h-8 w-8 text-muted-foreground" />}
          title={searchQuery ? 'No results found' : emptyTitle}
          description={
            searchQuery
              ? `No records match "${searchQuery}". Try a different search query.`
              : resolvedEmptyDescription
          }
          action={!searchQuery ? emptyAction : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="bcams-table w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {selectable && (
                    <th className="w-10 px-3 py-3 text-center">
                      <Checkbox
                        checked={allCurrentPageSelected}
                        indeterminate={someCurrentPageSelected}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all rows on current page"
                      />
                    </th>
                  )}
                  {columns.map((col) => {
                    const isSorted = sortKey === col.key;
                    return (
                      <th key={col.key} className={cn('text-xs font-semibold text-muted-foreground', col.className)}>
                        {col.sortable ? (
                          <button
                            onClick={() => handleSort(col.key)}
                            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors group focus:outline-none"
                            type="button"
                          >
                            <span>{col.header}</span>
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-primary stroke-[2.5]" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-primary stroke-[2.5]" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 text-muted-foreground/60 group-hover:text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedData.map((item, index) => {
                  const rowId = resolvedGetRowId(item) || String(index);
                  const isSelected = activeSelectedIds.includes(rowId);

                  return (
                    <tr
                      key={rowId}
                      onClick={() => onRowClick?.(item)}
                      className={cn(
                        'transition-colors hover:bg-muted/30',
                        onRowClick && 'cursor-pointer',
                        isSelected && 'bg-primary-50/50 hover:bg-primary-50'
                      )}
                      tabIndex={onRowClick ? 0 : undefined}
                      onKeyDown={(e) => {
                        if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          onRowClick(item);
                        }
                      }}
                    >
                      {selectable && (
                        <td
                          className="w-10 px-3 py-3 text-center"
                          onClick={(e) => handleToggleRow(rowId, e)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => {}}
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td key={col.key} className={cn('text-xs py-3', col.className)}>
                          {col.render(item)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enterprise Pagination Controls */}
      {sortedData.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={sortedData.length}
          pageSize={currentPageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setCurrentPageSize(newSize);
            setCurrentPage(1);
          }}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </div>
  );
}
