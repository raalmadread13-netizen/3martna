/**
 * Base shape of persisted identity records (GUID keys, ADR-0003).
 * Rich business entities extend `domain/common/Entity` instead.
 */
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}
