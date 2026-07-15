import { Apartment } from '@domain/business/Apartment';
import { Building, ParkingSpace, StorageUnit } from '@domain/business/Building';
import { Owner } from '@domain/business/Owner';
import { Resident } from '@domain/business/Resident';
import { PageRequest, PageResult } from '@shared/types';
import { ITenantRepository } from './ITenantRepository';

export interface IBuildingRepository extends ITenantRepository<Building> {
  /** Loads the building with its Floors hydrated (aggregate rehydration). */
  findByIdWithFloors(tenantId: string, id: string): Promise<Building | null>;
  existsByName(tenantId: string, name: string): Promise<boolean>;
  listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<Building>>;
}

export interface IApartmentRepository extends ITenantRepository<Apartment> {
  listByBuilding(
    tenantId: string,
    buildingId: string,
    page: PageRequest,
  ): Promise<PageResult<Apartment>>;
  existsByUnitNumber(tenantId: string, buildingId: string, unitNumber: string): Promise<boolean>;
  countByStatus(tenantId: string, buildingId: string): Promise<Record<string, number>>;
}

export interface IParkingSpaceRepository extends ITenantRepository<ParkingSpace> {
  listByBuilding(tenantId: string, buildingId: string): Promise<ParkingSpace[]>;
}

export interface IStorageUnitRepository extends ITenantRepository<StorageUnit> {
  listByBuilding(tenantId: string, buildingId: string): Promise<StorageUnit[]>;
}

export interface IOwnerRepository extends ITenantRepository<Owner> {
  findByUserId(tenantId: string, userId: string): Promise<Owner | null>;
  listByTenant(tenantId: string, page: PageRequest): Promise<PageResult<Owner>>;
}

export interface IResidentRepository extends ITenantRepository<Resident> {
  /** Currently-living residents of an apartment (MoveOutDate IS NULL). */
  listActiveByApartment(tenantId: string, apartmentId: string): Promise<Resident[]>;
  findByUserId(tenantId: string, userId: string): Promise<Resident | null>;
}
