import { useCallback, useEffect, useRef, useState } from 'react';
import { CursorPage } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';

interface CursorListState<T> {
  items: T[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  reload: () => void;
  refresh: () => void;
  loadMore: () => void;
}

/**
 * Infinite scrolling over the Sprint 5 cursor endpoints: the first page
 * loads on mount (and whenever the fetcher identity changes — e.g. a new
 * search term or filter), loadMore follows nextCursor until exhausted.
 * Wrap the fetcher in useCallback at the call site.
 */
export const useCursorList = <T>(
  fetcher: (cursor?: string) => Promise<CursorPage<T>>,
): CursorListState<T> => {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
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
        const cursor = mode === 'more' ? (nextCursor ?? undefined) : undefined;
        const page = await fetcher(cursor);
        setNextCursor(page.nextCursor);
        setItems((current) => (mode === 'more' ? [...current, ...page.data] : page.data));
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [fetcher, nextCursor],
  );

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    void loadRef.current('initial');
  }, [fetcher]);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: nextCursor !== null,
    reload: () => void loadRef.current('initial'),
    refresh: () => void loadRef.current('refresh'),
    loadMore: () => {
      if (nextCursor) void loadRef.current('more');
    },
  };
};
