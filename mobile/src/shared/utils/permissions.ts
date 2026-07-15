import { User } from '@/domain/entities/User';

/** Permission check against the DB-driven codes carried by the profile. */
export const hasPermission = (user: User | null, code: string): boolean =>
  user?.permissions?.includes(code) ?? false;
