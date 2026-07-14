import { isDatabaseConnected } from '@infrastructure/database/connection';

export interface HealthStatus {
  status: 'ok';
}

export interface DetailedHealthStatus extends HealthStatus {
  uptimeSeconds: number;
  timestamp: string;
  database: 'connected' | 'disconnected' | 'not_configured';
  environment: string;
}

/**
 * The one use-case shipped in Sprint 1 — proves the layer wiring
 * (presentation → application → infrastructure) end to end.
 */
export class GetHealthStatus {
  execute(): HealthStatus {
    return { status: 'ok' };
  }

  executeDetailed(environment: string, dbConfigured: boolean): DetailedHealthStatus {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbConfigured
        ? isDatabaseConnected()
          ? 'connected'
          : 'disconnected'
        : 'not_configured',
      environment,
    };
  }
}
