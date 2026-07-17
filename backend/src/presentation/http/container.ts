import { IAuditLogRepository } from '@domain/repositories/IAuditLogRepository';
import { IRefreshTokenRepository } from '@domain/repositories/IRefreshTokenRepository';
import { IRoleRepository } from '@domain/repositories/IRoleRepository';
import { IUserRepository } from '@domain/repositories/IUserRepository';
import { IVerificationCodeRepository } from '@domain/repositories/IVerificationCodeRepository';
import { IDashboardRepository } from '@domain/repositories/business/dashboard.repositories';
import { ILeaseContractRepository } from '@domain/repositories/business/leasing.repositories';
import { IOccupancyRepository } from '@domain/repositories/business/occupancy.repositories';
import {
  IApartmentRepository,
  IBuildingRepository,
  IOwnerRepository,
  IResidentRepository,
} from '@domain/repositories/business/property.repositories';
import { IClock } from '@domain/common/time/IClock';
import { TokenIssuer } from '@application/auth/TokenIssuer';
import { IIdempotencyStore } from '@application/interfaces/IIdempotencyStore';
import { IEmailSender, ISmsSender } from '@application/interfaces/IMessageSenders';
import { IPasswordHasher } from '@application/interfaces/IPasswordHasher';
import { ITokenService } from '@application/interfaces/ITokenService';
import { ChangePassword } from '@application/use-cases/auth/ChangePassword';
import { ConfirmVerification } from '@application/use-cases/auth/ConfirmVerification';
import { ForgotPassword } from '@application/use-cases/auth/ForgotPassword';
import { GetCurrentUser } from '@application/use-cases/auth/GetCurrentUser';
import { LoginUser } from '@application/use-cases/auth/LoginUser';
import { LogoutUser } from '@application/use-cases/auth/LogoutUser';
import { RefreshSession } from '@application/use-cases/auth/RefreshSession';
import { RegisterUser } from '@application/use-cases/auth/RegisterUser';
import { RequestVerification } from '@application/use-cases/auth/RequestVerification';
import { ResetPassword } from '@application/use-cases/auth/ResetPassword';
import {
  ArchiveApartment,
  CreateApartment,
  GetApartment,
  ListApartments,
  UpdateApartment,
} from '@application/use-cases/property/ApartmentUseCases';
import {
  ArchiveBuilding,
  CreateBuilding,
  GetBuilding,
  ListBuildings,
  UpdateBuilding,
} from '@application/use-cases/property/BuildingUseCases';
import { AddFloor, ListFloors, UpdateFloor } from '@application/use-cases/property/FloorUseCases';
import {
  CreateOwner,
  GetOwner,
  ListOwners,
  UpdateOwner,
} from '@application/use-cases/property/OwnerUseCases';
import {
  CreateLease,
  GetLease,
  ListLeases,
  TerminateLease,
  UpdateLease,
} from '@application/use-cases/occupancy/LeaseUseCases';
import {
  GetOccupancy,
  ListOccupancyHistory,
  MoveIn,
  MoveOut,
} from '@application/use-cases/occupancy/OccupancyUseCases';
import {
  GetResident,
  ListResidents,
  RegisterResident,
  UpdateResident,
} from '@application/use-cases/occupancy/ResidentUseCases';
import {
  GetBuildingSummaries,
  GetDashboardSummary,
  GetLeaseAlerts,
  GetRecentActivity,
} from '@application/use-cases/dashboard/DashboardUseCases';
import { SqlApartmentRepository } from '@infrastructure/database/repositories/SqlApartmentRepository';
import { SqlAuditLogRepository } from '@infrastructure/database/repositories/SqlAuditLogRepository';
import { buildDemoRepositories, DemoRepositories, seedDemoData } from '@infrastructure/memory/demo';
import { SqlBuildingRepository } from '@infrastructure/database/repositories/SqlBuildingRepository';
import { SqlDashboardRepository } from '@infrastructure/database/repositories/SqlDashboardRepository';
import { SqlIdempotencyStore } from '@infrastructure/database/repositories/SqlIdempotencyStore';
import { SqlLeaseContractRepository } from '@infrastructure/database/repositories/SqlLeaseContractRepository';
import { SqlOccupancyRepository } from '@infrastructure/database/repositories/SqlOccupancyRepository';
import { SqlOwnerRepository } from '@infrastructure/database/repositories/SqlOwnerRepository';
import { SqlResidentRepository } from '@infrastructure/database/repositories/SqlResidentRepository';
import { SqlRefreshTokenRepository } from '@infrastructure/database/repositories/SqlRefreshTokenRepository';
import { SqlRoleRepository } from '@infrastructure/database/repositories/SqlRoleRepository';
import { SqlUserRepository } from '@infrastructure/database/repositories/SqlUserRepository';
import { SqlVerificationCodeRepository } from '@infrastructure/database/repositories/SqlVerificationCodeRepository';
import { ConsoleEmailSender, ConsoleSmsSender } from '@infrastructure/messaging/consoleSenders';
import { passwordHasher } from '@infrastructure/security/BcryptPasswordHasher';
import { tokenService } from '@infrastructure/security/JwtTokenService';
import { systemClock } from '@infrastructure/time/SystemClock';
import { env } from '@shared/config/env';

/** Everything the presentation layer needs, resolved once. */
export interface AppDependencies {
  users: IUserRepository;
  roles: IRoleRepository;
  refreshTokens: IRefreshTokenRepository;
  verificationCodes: IVerificationCodeRepository;
  auditLogs: IAuditLogRepository;
  email: IEmailSender;
  sms: ISmsSender;
  hasher: IPasswordHasher;
  tokens: ITokenService;
  clock: IClock;
  buildings: IBuildingRepository;
  apartments: IApartmentRepository;
  owners: IOwnerRepository;
  residents: IResidentRepository;
  leases: ILeaseContractRepository;
  occupancies: IOccupancyRepository;
  idempotency: IIdempotencyStore;
  dashboard: IDashboardRepository;
}

export interface AppContainer {
  registerUser: RegisterUser;
  loginUser: LoginUser;
  refreshSession: RefreshSession;
  logoutUser: LogoutUser;
  changePassword: ChangePassword;
  forgotPassword: ForgotPassword;
  resetPassword: ResetPassword;
  requestVerification: RequestVerification;
  confirmVerification: ConfirmVerification;
  getCurrentUser: GetCurrentUser;
  // Sprint 4 — Building & Apartment Management
  createBuilding: CreateBuilding;
  updateBuilding: UpdateBuilding;
  archiveBuilding: ArchiveBuilding;
  getBuilding: GetBuilding;
  listBuildings: ListBuildings;
  addFloor: AddFloor;
  updateFloor: UpdateFloor;
  listFloors: ListFloors;
  createApartment: CreateApartment;
  updateApartment: UpdateApartment;
  archiveApartment: ArchiveApartment;
  getApartment: GetApartment;
  listApartments: ListApartments;
  createOwner: CreateOwner;
  updateOwner: UpdateOwner;
  getOwner: GetOwner;
  listOwners: ListOwners;
  // Sprint 5 — Occupancy Management
  registerResident: RegisterResident;
  updateResident: UpdateResident;
  getResident: GetResident;
  listResidents: ListResidents;
  createLease: CreateLease;
  updateLease: UpdateLease;
  getLease: GetLease;
  listLeases: ListLeases;
  terminateLease: TerminateLease;
  moveIn: MoveIn;
  moveOut: MoveOut;
  getOccupancy: GetOccupancy;
  listOccupancyHistory: ListOccupancyHistory;
  /** Exposed for the Idempotency-Key middleware. */
  idempotencyStore: IIdempotencyStore;
  // Sprint 6 — Admin Dashboard report services
  getDashboardSummary: GetDashboardSummary;
  getBuildingSummaries: GetBuildingSummaries;
  getLeaseAlerts: GetLeaseAlerts;
  getRecentActivity: GetRecentActivity;
}

/** Composition root: wires use-cases to concrete dependencies. */
export const buildContainer = (deps: AppDependencies): AppContainer => {
  const issuer = new TokenIssuer(deps.tokens, deps.roles, deps.refreshTokens);
  const revealCodes = !env.isProduction;

  return {
    registerUser: new RegisterUser(deps.users, deps.roles, deps.hasher, issuer, deps.auditLogs),
    loginUser: new LoginUser(
      deps.users,
      deps.hasher,
      issuer,
      deps.auditLogs,
      {
        maxFailedLogins: env.auth.maxFailedLogins,
        lockoutMinutes: env.auth.lockoutMinutes,
      },
      deps.clock,
    ),
    refreshSession: new RefreshSession(
      deps.users,
      deps.roles,
      deps.refreshTokens,
      deps.tokens,
      deps.auditLogs,
      deps.clock,
    ),
    logoutUser: new LogoutUser(deps.refreshTokens, deps.tokens, deps.auditLogs),
    changePassword: new ChangePassword(deps.users, deps.hasher, deps.refreshTokens, deps.auditLogs),
    forgotPassword: new ForgotPassword(
      deps.users,
      deps.verificationCodes,
      deps.tokens,
      deps.email,
      deps.sms,
      deps.auditLogs,
      { resetTokenTtlMinutes: env.auth.resetTokenTtlMinutes, revealCodes },
      deps.clock,
    ),
    resetPassword: new ResetPassword(
      deps.users,
      deps.verificationCodes,
      deps.hasher,
      deps.tokens,
      deps.refreshTokens,
      deps.auditLogs,
    ),
    requestVerification: new RequestVerification(
      deps.users,
      deps.verificationCodes,
      deps.tokens,
      deps.email,
      deps.sms,
      deps.auditLogs,
      { codeTtlMinutes: env.auth.verificationCodeTtlMinutes, revealCodes },
      deps.clock,
    ),
    confirmVerification: new ConfirmVerification(
      deps.users,
      deps.verificationCodes,
      deps.tokens,
      deps.auditLogs,
    ),
    getCurrentUser: new GetCurrentUser(deps.users, deps.roles),
    // Sprint 4 — property module
    createBuilding: new CreateBuilding(deps.buildings, deps.auditLogs, deps.clock),
    updateBuilding: new UpdateBuilding(deps.buildings, deps.auditLogs, deps.clock),
    archiveBuilding: new ArchiveBuilding(
      deps.buildings,
      deps.apartments,
      deps.auditLogs,
      deps.clock,
    ),
    getBuilding: new GetBuilding(deps.buildings),
    listBuildings: new ListBuildings(deps.buildings),
    addFloor: new AddFloor(deps.buildings, deps.auditLogs, deps.clock),
    updateFloor: new UpdateFloor(deps.buildings, deps.auditLogs, deps.clock),
    listFloors: new ListFloors(deps.buildings),
    createApartment: new CreateApartment(
      deps.apartments,
      deps.buildings,
      deps.auditLogs,
      deps.clock,
    ),
    updateApartment: new UpdateApartment(deps.apartments, deps.owners, deps.auditLogs, deps.clock),
    archiveApartment: new ArchiveApartment(deps.apartments, deps.auditLogs, deps.clock),
    getApartment: new GetApartment(deps.apartments),
    listApartments: new ListApartments(deps.apartments),
    createOwner: new CreateOwner(deps.owners, deps.auditLogs, deps.clock),
    updateOwner: new UpdateOwner(deps.owners, deps.auditLogs, deps.clock),
    getOwner: new GetOwner(deps.owners),
    listOwners: new ListOwners(deps.owners),
    // Sprint 5 — occupancy module
    registerResident: new RegisterResident(deps.residents, deps.auditLogs, deps.clock),
    updateResident: new UpdateResident(deps.residents, deps.auditLogs, deps.clock),
    getResident: new GetResident(deps.residents),
    listResidents: new ListResidents(deps.residents),
    createLease: new CreateLease(
      deps.leases,
      deps.apartments,
      deps.residents,
      deps.auditLogs,
      deps.clock,
    ),
    updateLease: new UpdateLease(deps.leases, deps.auditLogs, deps.clock),
    getLease: new GetLease(deps.leases),
    listLeases: new ListLeases(deps.leases),
    terminateLease: new TerminateLease(
      deps.leases,
      deps.occupancies,
      deps.residents,
      deps.apartments,
      deps.auditLogs,
      deps.clock,
    ),
    moveIn: new MoveIn(
      deps.occupancies,
      deps.leases,
      deps.residents,
      deps.apartments,
      deps.auditLogs,
      deps.clock,
    ),
    moveOut: new MoveOut(
      deps.occupancies,
      deps.residents,
      deps.apartments,
      deps.auditLogs,
      deps.clock,
    ),
    getOccupancy: new GetOccupancy(deps.occupancies),
    listOccupancyHistory: new ListOccupancyHistory(deps.occupancies),
    idempotencyStore: deps.idempotency,
    // Sprint 6 — dashboard
    getDashboardSummary: new GetDashboardSummary(deps.dashboard, deps.clock),
    getBuildingSummaries: new GetBuildingSummaries(deps.dashboard),
    getLeaseAlerts: new GetLeaseAlerts(deps.leases, deps.clock),
    getRecentActivity: new GetRecentActivity(deps.dashboard),
  };
};

let demoRepos: DemoRepositories | null = null;

const defaultDependencies = (): AppDependencies => {
  if (env.demoMode) {
    // DEMO mode: in-memory persistence, everything else is the real stack
    demoRepos = buildDemoRepositories();
    return {
      ...demoRepos,
      email: new ConsoleEmailSender(),
      sms: new ConsoleSmsSender(),
      hasher: passwordHasher,
      tokens: tokenService,
      clock: systemClock,
    };
  }
  return {
    users: new SqlUserRepository(),
    roles: new SqlRoleRepository(),
    refreshTokens: new SqlRefreshTokenRepository(),
    verificationCodes: new SqlVerificationCodeRepository(),
    auditLogs: new SqlAuditLogRepository(),
    email: new ConsoleEmailSender(),
    sms: new ConsoleSmsSender(),
    hasher: passwordHasher,
    tokens: tokenService,
    clock: systemClock,
    buildings: new SqlBuildingRepository(),
    apartments: new SqlApartmentRepository(),
    owners: new SqlOwnerRepository(),
    residents: new SqlResidentRepository(),
    leases: new SqlLeaseContractRepository(),
    occupancies: new SqlOccupancyRepository(),
    idempotency: new SqlIdempotencyStore(),
    dashboard: new SqlDashboardRepository(),
  };
};

let instance: AppContainer | null = null;

export const getContainer = (): AppContainer => {
  instance ??= buildContainer(defaultDependencies());
  return instance;
};

/** DEMO mode bootstrap: seeds accounts + sample portfolio before listen. */
export const initDemoData = async (): Promise<void> => {
  if (!env.demoMode) return;
  getContainer(); // materialize the in-memory dependencies
  if (demoRepos) await seedDemoData(demoRepos);
};

/** Test seam: inject a container built on in-memory fakes. */
export const setContainer = (container: AppContainer): void => {
  instance = container;
};
