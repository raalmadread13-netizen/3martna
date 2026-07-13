export type RoleName =
  | 'SystemAdmin'
  | 'BuildingOwner'
  | 'ApartmentOwner'
  | 'Tenant'
  | 'MaintenanceEmployee'
  | 'SecurityGuard'
  | 'CleaningStaff'
  | 'Accountant';

export interface AuthUser {
  userId: number;
  fullName: string;
  roles: RoleName[];
}

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
