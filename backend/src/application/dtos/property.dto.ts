/**
 * Read/write DTOs for the property aggregates.
 *
 * DTOs are the application layer's data contract: flat, framework-free,
 * serialization-ready. `*Dto` shapes are returned to callers; `Create*Dto`
 * / `Update*Dto` shapes are accepted from them. Entity ↔ DTO conversion
 * lives in the mapping profiles — never inside controllers.
 */

export interface BuildingDto {
  id: string;
  tenantId: string;
  name: string;
  address: string;
  city: string;
  district: string | null;
  latitude: number | null;
  longitude: number | null;
  totalFloors: number;
  yearBuilt: number | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FloorDto {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string | null;
}

export interface BuildingDetailDto extends BuildingDto {
  floors: FloorDto[];
}

export interface CreateBuildingDto {
  name: string;
  address: string;
  city: string;
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  totalFloors: number;
  yearBuilt?: number | null;
  notes?: string | null;
}

export interface UpdateBuildingDto {
  name?: string;
  address?: string;
  city?: string;
  district?: string | null;
  notes?: string | null;
}

export interface ApartmentDto {
  id: string;
  tenantId: string;
  buildingId: string;
  floorId: string;
  unitNumber: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number | null;
  baseRentAmount: number | null;
  currency: string;
  status: string;
  ownerId: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApartmentDto {
  buildingId: string;
  floorId: string;
  unitNumber: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number | null;
  baseRentAmount?: number | null;
  currency?: string;
  description?: string | null;
}

export interface OwnerDto {
  id: string;
  tenantId: string;
  ownerType: string;
  userId: string | null;
  fullName: string;
  companyName: string | null;
  nationalIdOrRegistration: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  createdAt: string;
}

export interface ResidentDto {
  id: string;
  tenantId: string;
  apartmentId: string;
  userId: string | null;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  residencyType: string;
  moveInDate: string;
  moveOutDate: string | null;
  isActive: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}
