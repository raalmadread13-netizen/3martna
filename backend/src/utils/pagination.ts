import { Request } from 'express';
import { PaginatedResult, PaginationQuery } from '../types';

const MAX_PAGE_SIZE = 100;

export const getPagination = (req: Request): PaginationQuery => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 20));
  return { page, pageSize };
};

/**
 * List stored procedures return a TotalCount window column on every row;
 * strip it and build the pagination envelope.
 */
export const paginate = <T extends { TotalCount?: number }>(
  rows: T[],
  { page, pageSize }: PaginationQuery,
): PaginatedResult<Omit<T, 'TotalCount'>> => {
  const totalCount = rows.length > 0 ? Number(rows[0].TotalCount ?? rows.length) : 0;
  const data = rows.map(({ TotalCount: _ignored, ...rest }) => rest as Omit<T, 'TotalCount'>);
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    },
  };
};
