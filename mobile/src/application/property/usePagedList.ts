import { useCallback, useEffect, useRef, useState } from 'react';
import { Paged, Pagination } from '@/domain/entities/Property';
import { apiErrorMessage } from '@/infrastructure/api/client';

interface PagedListState<T> {
  items: T[];
  pagination: Pagination | null;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  reload: () => void;
  refresh: () => void;
  loadMore: () => void;
}

/**
 * Standard paged-list behavior for the module's list screens:
 * initial load, pull-to-refresh, incremental load-more and a
 * display-safe error message. The fetcher must be referentially
 * stable (wrap it in useCallback at the call site).
 */
export const usePagedList = <T>(
  fetcher: (page: number) => Promise<Paged<T>>,
): PagedListState<T> => {
  const [items, setItems] = useState<T[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' | 'more'): Promise<void> => {
      if (busy.current) return;
      busy.current = true;
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      if (mode === 'more') setLoadingMore(true);
      setError(null);
      try {
        const nextPage = mode === 'more' ? (pagination?.page ?? 0) + 1 : 1;
        const result = await fetcher(nextPage);
        setPagination(result.pagination);
        setItems((current) => (mode === 'more' ? [...current, ...result.data] : result.data));
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fetcher, pagination?.page],
  );

  // Reload from page 1 whenever the fetcher itself changes (e.g. new filter)
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void loadRef.current('initial');
  }, [fetcher]);

  const loadMore = useCallback((): void => {
    if (pagination && pagination.page < pagination.totalPages) void load('more');
  }, [pagination, load]);

  return {
    items,
    pagination,
    loading,
    refreshing,
    loadingMore,
    error,
    reload: () => void load('initial'),
    refresh: () => void load('refresh'),
    loadMore,
  };
};
