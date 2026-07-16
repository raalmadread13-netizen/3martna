/**
 * Cursor (keyset) pagination — Sprint 5 list endpoints.
 *
 * The cursor encodes the sort-key value and row id of the last item of the
 * previous page; the next page starts strictly after that (key, id) tuple.
 * Unlike page numbers, results stay stable while rows are inserted, and the
 * database never scans skipped rows. Sortable fields are whitelisted per
 * resource and must be non-nullable so tuple comparison is total.
 */

export type SortDirection = 'asc' | 'desc';

export interface CursorRequest {
  /** Opaque cursor from the previous response; omit for the first page. */
  cursor?: string;
  limit: number;
  sortBy: string;
  sortDir: SortDirection;
  /** Free-text search; fields are resource-specific. */
  search?: string;
}

export interface CursorResult<T> {
  data: T[];
  /** Cursor for the next page, or null when this is the last page. */
  nextCursor: string | null;
  limit: number;
}

/** Decoded cursor position: sort-key value + row id tiebreaker. */
export interface CursorPosition {
  k: string | number;
  id: string;
}

export const encodeCursor = (position: CursorPosition): string =>
  Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');

/** Returns null for missing/corrupt cursors — callers treat as first page. */
export const decodeCursor = (cursor: string | undefined): CursorPosition | null => {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPosition;
    if (typeof parsed.id !== 'string') return null;
    if (typeof parsed.k !== 'string' && typeof parsed.k !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

/**
 * In-memory keyset pagination over pre-filtered rows (used by the in-memory
 * repositories; the SQL implementations express the same semantics as
 * WHERE (key, id) > (@k, @id) ORDER BY key, id).
 */
export const paginateByCursor = <T>(
  rows: T[],
  request: CursorRequest,
  sortKey: (row: T) => string | number,
  rowId: (row: T) => string,
): { rows: T[]; nextCursor: string | null } => {
  const direction = request.sortDir === 'desc' ? -1 : 1;
  const compare = (a: T, b: T): number => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    if (ka < kb) return -1 * direction;
    if (ka > kb) return 1 * direction;
    return rowId(a) < rowId(b) ? -1 : rowId(a) > rowId(b) ? 1 : 0;
  };
  const sorted = [...rows].sort(compare);

  const position = decodeCursor(request.cursor);
  const startIndex = position
    ? sorted.findIndex((row) => {
        const key = sortKey(row);
        if (key === position.k) return rowId(row) > position.id;
        return direction === 1 ? key > position.k : key < position.k;
      })
    : 0;
  const window = startIndex === -1 ? [] : sorted.slice(startIndex, startIndex + request.limit);

  const last = window[window.length - 1];
  const hasMore = startIndex !== -1 && startIndex + request.limit < sorted.length;
  return {
    rows: window,
    nextCursor: hasMore && last ? encodeCursor({ k: sortKey(last), id: rowId(last) }) : null,
  };
};
