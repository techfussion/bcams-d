/**
 * useDataFetch — Generic data fetching hook
 * 
 * Handles loading, error, and success states for async API calls.
 * Provides retry, refetch, and stale-while-revalidate patterns.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDataFetchOptions {
  /** Whether to fetch immediately on mount. Default: true */
  immediate?: boolean;
  /** Dependencies that trigger a refetch when changed */
  deps?: unknown[];
}

interface UseDataFetchResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDataFetch<T>(
  fetcher: () => Promise<T>,
  options: UseDataFetchOptions = {}
): UseDataFetchResult<T> {
  const { immediate = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mountedRef.current) {
        setData(result);
        setIsLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setIsLoading(false);
      }
    }
  }, []); // stable — uses ref internally

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      fetchData();
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, immediate, ...deps]);

  return { data, isLoading, error, refetch: fetchData };
}
