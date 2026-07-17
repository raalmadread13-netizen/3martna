import { IEmailSender, ISmsSender } from '@application/interfaces/IMessageSenders';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { AppDependencies } from '@presentation/http/container';
import { InMemoryDashboardRepository } from '@infrastructure/memory/dashboard.memory';
import {
  InMemoryAuditLogRepository,
  InMemoryRefreshTokenRepository,
  InMemoryRoleRepository,
  InMemoryUserRepository,
  InMemoryVerificationCodeRepository,
} from '@infrastructure/memory/identity.memory';
import {
  InMemoryIdempotencyStore,
  InMemoryLeaseContractRepository,
  InMemoryOccupancyRepository,
  InMemoryResidentRepository,
} from '@infrastructure/memory/occupancy.memory';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from '@infrastructure/memory/property.memory';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { systemClock } from '@infrastructure/time/SystemClock';

/*
 * Test world assembly. The in-memory repository implementations live in
 * src/infrastructure/memory (shared with DEMO mode); this file re-exports
 * them and adds the test-only doubles (capturing senders, instant hasher).
 */

export {
  InMemoryAuditLogRepository,
  InMemoryRefreshTokenRepository,
  InMemoryRoleRepository,
  InMemoryUserRepository,
  InMemoryVerificationCodeRepository,
};

export class CapturingEmailSender implements IEmailSender {
  sent: Array<{ to: string; subject: string; body: string }> = [];
  async send(to: string, subject: string, body: string): Promise<void> {
    this.sent.push({ to, subject, body });
  }
}

export class CapturingSmsSender implements ISmsSender {
  sent: Array<{ to: string; message: string }> = [];
  async send(to: string, message: string): Promise<void> {
    this.sent.push({ to, message });
  }
}

/** Deterministic, instant hasher — bcrypt itself is covered in security.test.ts. */
export class FakePasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

/* ---------------- bundle ---------------- */

export interface TestWorld {
  deps: AppDependencies;
  users: InMemoryUserRepository;
  roles: InMemoryRoleRepository;
  refreshTokens: InMemoryRefreshTokenRepository;
  verificationCodes: InMemoryVerificationCodeRepository;
  auditLogs: InMemoryAuditLogRepository;
  email: CapturingEmailSender;
  sms: CapturingSmsSender;
  buildings: InMemoryBuildingRepository;
  apartments: InMemoryApartmentRepository;
  owners: InMemoryOwnerRepository;
  residents: InMemoryResidentRepository;
  leases: InMemoryLeaseContractRepository;
  occupancies: InMemoryOccupancyRepository;
  idempotency: InMemoryIdempotencyStore;
  dashboard: InMemoryDashboardRepository;
}

export const buildTestWorld = (): TestWorld => {
  const users = new InMemoryUserRepository();
  const roles = new InMemoryRoleRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const verificationCodes = new InMemoryVerificationCodeRepository();
  const auditLogs = new InMemoryAuditLogRepository();
  const email = new CapturingEmailSender();
  const sms = new CapturingSmsSender();
  const buildings = new InMemoryBuildingRepository();
  const apartments = new InMemoryApartmentRepository();
  const owners = new InMemoryOwnerRepository();
  const residents = new InMemoryResidentRepository();
  const leases = new InMemoryLeaseContractRepository();
  const occupancies = new InMemoryOccupancyRepository();
  const idempotency = new InMemoryIdempotencyStore();
  const dashboard = new InMemoryDashboardRepository(
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
  );
  return {
    users,
    roles,
    refreshTokens,
    verificationCodes,
    auditLogs,
    email,
    sms,
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
    idempotency,
    dashboard,
    deps: {
      users,
      roles,
      refreshTokens,
      verificationCodes,
      auditLogs,
      email,
      sms,
      hasher: new FakePasswordHasher(),
      tokens: tokenService,
      clock: systemClock,
      buildings,
      apartments,
      owners,
      residents,
      leases,
      occupancies,
      idempotency,
      dashboard,
    },
  };
};
