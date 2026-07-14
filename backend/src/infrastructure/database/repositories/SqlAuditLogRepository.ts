import { NewAuditLog } from '@domain/entities/AuditLog';
import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { execQuery } from '@infrastructure/database/connection';
import { logger } from '@infrastructure/logging/logger';

export class SqlAuditLogRepository implements IAuditLogRepository {
  /** Append-only; failures are logged, never propagated into business flows. */
  async write(entry: NewAuditLog): Promise<void> {
    try {
      await execQuery(
        `INSERT INTO dbo.AuditLogs (UserId, Action, EntityType, EntityId, Metadata, IpAddress, UserAgent, CreatedBy)
         VALUES (@userId, @action, @entityType, @entityId, @metadata, @ipAddress, @userAgent, @userId)`,
        {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata).slice(0, 4000) : null,
          ipAddress: entry.ipAddress?.slice(0, 45) ?? null,
          userAgent: entry.userAgent?.slice(0, 300) ?? null,
        },
      );
    } catch (error) {
      logger.warn('Audit write failed', { action: entry.action, error: (error as Error).message });
    }
  }
}
