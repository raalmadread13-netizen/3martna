/** Standard success envelope returned by every endpoint. */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

/** Standard error envelope produced by the error middleware. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export * from './cursor';
