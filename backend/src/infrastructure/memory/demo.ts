import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Apartment } from '@domain/business/Apartment';
import { Building } from '@domain/business/Building';
import { LeaseContract } from '@domain/business/LeaseContract';
import { Occupancy } from '@domain/business/Occupancy';
import { Owner } from '@domain/business/Owner';
import { Resident } from '@domain/business/Resident';
import { User } from '@domain/entities/User';
import { logger } from '@infrastructure/logging/logger';
import { systemClock } from '@infrastructure/time/SystemClock';
import { InMemoryDashboardRepository } from './dashboard.memory';
import {
  InMemoryAuditLogRepository,
  InMemoryRefreshTokenRepository,
  InMemoryRoleRepository,
  InMemoryUserRepository,
  InMemoryVerificationCodeRepository,
} from './identity.memory';
import {
  InMemoryIdempotencyStore,
  InMemoryLeaseContractRepository,
  InMemoryOccupancyRepository,
  InMemoryResidentRepository,
} from './occupancy.memory';
import {
  InMemoryApartmentRepository,
  InMemoryBuildingRepository,
  InMemoryOwnerRepository,
} from './property.memory';

/**
 * DEMO mode (Sprint 6.5): a fully-populated in-memory backend so the MVP
 * runs end-to-end with zero external dependencies. Real bcrypt, real JWTs,
 * real business rules — only persistence is swapped, exactly like the
 * test suite. Data resets on every restart.
 */

export const DEMO_TENANT_ID = 'd0000000-0000-4000-8000-000000000001';

export const DEMO_ACCOUNTS = [
  {
    email: 'manager@demo.3martna.jo',
    phone: '+962790000100',
    password: 'Demo123!',
    role: 'BuildingManager',
  },
  {
    email: 'admin@demo.3martna.jo',
    phone: '+962790000101',
    password: 'Demo123!',
    role: 'SuperAdmin',
  },
] as const;

export interface DemoRepositories {
  users: InMemoryUserRepository;
  roles: InMemoryRoleRepository;
  refreshTokens: InMemoryRefreshTokenRepository;
  verificationCodes: InMemoryVerificationCodeRepository;
  auditLogs: InMemoryAuditLogRepository;
  buildings: InMemoryBuildingRepository;
  apartments: InMemoryApartmentRepository;
  owners: InMemoryOwnerRepository;
  residents: InMemoryResidentRepository;
  leases: InMemoryLeaseContractRepository;
  occupancies: InMemoryOccupancyRepository;
  idempotency: InMemoryIdempotencyStore;
  dashboard: InMemoryDashboardRepository;
}

export const buildDemoRepositories = (): DemoRepositories => {
  const buildings = new InMemoryBuildingRepository();
  const apartments = new InMemoryApartmentRepository();
  const owners = new InMemoryOwnerRepository();
  const residents = new InMemoryResidentRepository();
  const leases = new InMemoryLeaseContractRepository();
  const occupancies = new InMemoryOccupancyRepository();
  return {
    users: new InMemoryUserRepository(),
    roles: new InMemoryRoleRepository(),
    refreshTokens: new InMemoryRefreshTokenRepository(),
    verificationCodes: new InMemoryVerificationCodeRepository(),
    auditLogs: new InMemoryAuditLogRepository(),
    buildings,
    apartments,
    owners,
    residents,
    leases,
    occupancies,
    idempotency: new InMemoryIdempotencyStore(),
    dashboard: new InMemoryDashboardRepository(
      buildings,
      apartments,
      owners,
      residents,
      leases,
      occupancies,
    ),
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Seeds demo accounts + a small realistic portfolio. Idempotent per process. */
export const seedDemoData = async (repos: DemoRepositories): Promise<void> => {
  const clock = systemClock;
  const now = clock.now();
  const daysFromNow = (days: number): Date => new Date(now.getTime() + days * DAY_MS);

  /* ------------------------- accounts ------------------------ */
  const passwordHash = bcrypt.hashSync(DEMO_ACCOUNTS[0].password, 10);
  const [managerAccount, adminAccount] = DEMO_ACCOUNTS;
  const makeUser = (email: string, phone: string, firstName: string, lastName: string): User => ({
    id: crypto.randomUUID(),
    tenantId: DEMO_TENANT_ID,
    firstName,
    lastName,
    email,
    phoneNumber: phone,
    passwordHash,
    profileImageUrl: null,
    preferredLanguage: 'en',
    status: 'Active',
    emailVerified: true,
    phoneVerified: true,
    lastLoginAt: null,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  });

  const manager = makeUser(managerAccount.email, managerAccount.phone, 'Maha', 'Manager');
  const admin = makeUser(adminAccount.email, adminAccount.phone, 'Adel', 'Admin');
  repos.users.users.push(manager, admin);
  const managerRole = await repos.roles.findByName(managerAccount.role);
  const adminRole = await repos.roles.findByName(adminAccount.role);
  await repos.roles.assignRoleToUser(manager.id, managerRole!.id);
  await repos.roles.assignRoleToUser(admin.id, adminRole!.id);

  const actor = manager.id;

  /* ------------------------- portfolio ----------------------- */
  const heights = Building.create(
    DEMO_TENANT_ID,
    {
      name: 'Amman Heights',
      address: '12 Rainbow Street',
      city: 'Amman',
      district: 'Jabal Amman',
      totalFloors: 6,
      yearBuilt: 2018,
    },
    actor,
    clock,
  );
  const heightsGround = heights.addFloor(0, 'Ground', actor, clock);
  const heightsFirst = heights.addFloor(1, null, actor, clock);
  await repos.buildings.save(heights);

  const petra = Building.create(
    DEMO_TENANT_ID,
    {
      name: 'Petra Residence',
      address: '5 Wakalat Street',
      city: 'Amman',
      district: 'Sweifieh',
      totalFloors: 4,
      yearBuilt: 2021,
    },
    actor,
    clock,
  );
  const petraFirst = petra.addFloor(1, null, actor, clock);
  await repos.buildings.save(petra);

  const layla = Owner.create(
    DEMO_TENANT_ID,
    { fullName: 'Layla Haddad', email: 'layla@example.com', phoneNumber: '+962790000200' },
    actor,
    clock,
  );
  const acme = Owner.create(
    DEMO_TENANT_ID,
    { ownerType: 'Company', fullName: 'Kareem Odeh', companyName: 'ACME Real Estate' },
    actor,
    clock,
  );
  await repos.owners.save(layla);
  await repos.owners.save(acme);

  const makeApartment = async (
    building: Building,
    floorId: string,
    unitNumber: string,
    ownerId: string,
    rent: number,
  ): Promise<Apartment> => {
    const apartment = Apartment.create(
      DEMO_TENANT_ID,
      {
        buildingId: building.id,
        floorId,
        unitNumber,
        bedrooms: 2,
        bathrooms: 1,
        baseRentAmount: rent,
      },
      actor,
      clock,
    );
    apartment.assignOwner(ownerId, actor, clock);
    await repos.apartments.save(apartment);
    return apartment;
  };

  const unit101 = await makeApartment(heights, heightsGround.id, '101', layla.id, 450);
  const unit102 = await makeApartment(heights, heightsFirst.id, '102', layla.id, 480);
  await makeApartment(heights, heightsFirst.id, '103', acme.id, 520);
  const unit201 = await makeApartment(petra, petraFirst.id, '201', acme.id, 600);
  await makeApartment(petra, petraFirst.id, '202', acme.id, 580);

  /* ------------------------- residents ----------------------- */
  const sara = Resident.register(
    DEMO_TENANT_ID,
    { fullName: 'Sara Khalil', phoneNumber: '+962790000301', email: 'sara@example.com' },
    actor,
    clock,
  );
  const omar = Resident.register(
    DEMO_TENANT_ID,
    { fullName: 'Omar Nassar', phoneNumber: '+962790000302' },
    actor,
    clock,
  );
  const rania = Resident.register(
    DEMO_TENANT_ID,
    { fullName: 'Rania Aloul', phoneNumber: '+962790000303' },
    actor,
    clock,
  );
  const bilal = Resident.register(
    DEMO_TENANT_ID,
    { fullName: 'Bilal Odeh', phoneNumber: '+962790000304' },
    actor,
    clock,
  );

  /* -------- lease + current occupancy (unit 101, Sara) ------- */
  const saraLease = LeaseContract.draft(
    DEMO_TENANT_ID,
    {
      contractNumber: 'LC-DEMO-000101',
      apartmentId: unit101.id,
      ownerId: layla.id,
      residentId: sara.id,
      startDate: daysFromNow(-90),
      endDate: daysFromNow(275),
      monthlyRent: 450,
    },
    actor,
    clock,
  );
  saraLease.activate(actor, clock);
  await repos.leases.save(saraLease);
  const saraStay = Occupancy.open(
    DEMO_TENANT_ID,
    {
      apartmentId: unit101.id,
      residentId: sara.id,
      leaseContractId: saraLease.id,
      moveInDate: daysFromNow(-90),
    },
    actor,
    clock,
  );
  await repos.occupancies.save(saraStay);
  sara.occupy(unit101.id, daysFromNow(-90), actor, clock);
  unit101.markLeased(actor, clock);
  await repos.apartments.save(unit101);

  /* ------ expiring lease, not yet moved in (unit 102, Omar) --- */
  const omarLease = LeaseContract.draft(
    DEMO_TENANT_ID,
    {
      contractNumber: 'LC-DEMO-000102',
      apartmentId: unit102.id,
      ownerId: layla.id,
      residentId: omar.id,
      startDate: daysFromNow(-350),
      endDate: daysFromNow(12), // shows up in the 30-day expiring alert
      monthlyRent: 480,
    },
    actor,
    clock,
  );
  omarLease.activate(actor, clock);
  await repos.leases.save(omarLease);

  /* ------- historical stay: Bilal lived in 201, moved out ----- */
  const bilalLease = LeaseContract.draft(
    DEMO_TENANT_ID,
    {
      contractNumber: 'LC-DEMO-000201',
      apartmentId: unit201.id,
      ownerId: acme.id,
      residentId: bilal.id,
      startDate: daysFromNow(-400),
      endDate: daysFromNow(-35),
      monthlyRent: 600,
    },
    actor,
    clock,
  );
  bilalLease.activate(actor, clock);
  bilalLease.terminate('Tenant relocated abroad', actor, clock);
  await repos.leases.save(bilalLease);
  const bilalStay = Occupancy.open(
    DEMO_TENANT_ID,
    {
      apartmentId: unit201.id,
      residentId: bilal.id,
      leaseContractId: bilalLease.id,
      moveInDate: daysFromNow(-400),
    },
    actor,
    clock,
  );
  bilalStay.close(daysFromNow(-40), 'Lease terminated: tenant relocated', actor, clock);
  await repos.occupancies.save(bilalStay);
  bilal.occupy(unit201.id, daysFromNow(-400), actor, clock);
  bilal.moveOut(daysFromNow(-40), actor, clock);

  await repos.residents.save(sara);
  await repos.residents.save(omar);
  await repos.residents.save(rania);
  await repos.residents.save(bilal);

  logger.warn('DEMO MODE — in-memory data only; everything resets on restart');
  for (const account of DEMO_ACCOUNTS) {
    logger.info(`Demo login: ${account.email} / ${account.password} (${account.role})`);
  }
};
