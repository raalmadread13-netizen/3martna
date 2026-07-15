export interface Role {
  id: string;
  name: string;
  nameAr: string;
  description: string | null;
}

export interface Permission {
  id: string;
  /** Machine name checked by the authorization middleware, e.g. 'users.manage'. */
  code: string;
  name: string;
  category: string;
}

/** Resolved authorization set for one user (roles + effective permissions). */
export interface UserAuthorization {
  roles: string[];
  permissions: string[];
}
