import { Apartment } from '@domain/business/Apartment';
import { Building, Floor } from '@domain/business/Building';
import { Owner } from '@domain/business/Owner';
import { Resident } from '@domain/business/Resident';
import {
  ApartmentDto,
  BuildingDetailDto,
  BuildingDto,
  FloorDto,
  OwnerDto,
  ResidentDto,
} from '@application/dtos/property.dto';
import { iso, isoRequired } from './common';

/**
 * Mapping profiles: pure entity → DTO functions. One direction only —
 * DTO → entity happens through the aggregates' factory methods, which
 * enforce invariants (never reconstruct an aggregate field-by-field here).
 */

export const toBuildingDto = (building: Building): BuildingDto => {
  const p = building.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    address: p.address,
    city: p.city,
    district: p.district,
    latitude: p.latitude,
    longitude: p.longitude,
    totalFloors: p.totalFloors,
    yearBuilt: p.yearBuilt,
    status: p.status,
    notes: p.notes,
    createdAt: isoRequired(p.createdAt),
    updatedAt: isoRequired(p.updatedAt),
  };
};

export const toFloorDto = (floor: Floor): FloorDto => {
  const p = floor.toProps();
  return { id: p.id, buildingId: p.buildingId, floorNumber: p.floorNumber, name: p.name };
};

export const toBuildingDetailDto = (building: Building): BuildingDetailDto => ({
  ...toBuildingDto(building),
  floors: building.floors.filter((floor) => !floor.isDeleted).map(toFloorDto),
});

export const toApartmentDto = (apartment: Apartment): ApartmentDto => {
  const p = apartment.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    buildingId: p.buildingId,
    floorId: p.floorId,
    unitNumber: p.unitNumber,
    bedrooms: p.bedrooms,
    bathrooms: p.bathrooms,
    areaSqm: p.areaSqm,
    baseRentAmount: p.baseRentAmount,
    currency: p.currency,
    status: p.status,
    ownerId: p.ownerId,
    description: p.description,
    createdAt: isoRequired(p.createdAt),
    updatedAt: isoRequired(p.updatedAt),
  };
};

export const toOwnerDto = (owner: Owner): OwnerDto => {
  const p = owner.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    ownerType: p.ownerType,
    userId: p.userId,
    fullName: p.fullName,
    companyName: p.companyName,
    nationalIdOrRegistration: p.nationalIdOrRegistration,
    email: p.email,
    phoneNumber: p.phoneNumber,
    address: p.address,
    createdAt: isoRequired(p.createdAt),
  };
};

export const toResidentDto = (resident: Resident): ResidentDto => {
  const p = resident.toProps();
  return {
    id: p.id,
    tenantId: p.tenantId,
    apartmentId: p.apartmentId,
    userId: p.userId,
    fullName: p.fullName,
    phoneNumber: p.phoneNumber,
    email: p.email,
    residencyType: p.residencyType,
    moveInDate: isoRequired(p.moveInDate),
    moveOutDate: iso(p.moveOutDate),
    isActive: resident.isActive,
    emergencyContactName: p.emergencyContactName,
    emergencyContactPhone: p.emergencyContactPhone,
  };
};
