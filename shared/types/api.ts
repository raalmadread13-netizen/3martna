/**
 * Canonical API contracts shared by backend and clients.
 * Mirrored in backend/src/shared/types — change here first.
 */

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

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
