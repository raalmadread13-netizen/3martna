/**
 * Base shape every persisted entity extends.
 * Business entities (User, Building, Apartment, ...) arrive in later
 * sprints and will live in this folder.
 */
export interface BaseEntity {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}
