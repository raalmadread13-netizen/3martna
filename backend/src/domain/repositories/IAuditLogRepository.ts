import { NewAuditLog } from '@domain/entities/AuditLog';

export interface IAuditLogRepository {
  /** Append-only. Implementations must never throw into business flows. */
  write(entry: NewAuditLog): Promise<void>;
}
