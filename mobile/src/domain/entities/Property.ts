/** Mirrors the backend property DTOs (Sprint 4). All ids are GUIDs. */

export type BuildingStatus = 'Active' | 'UnderConstruction' | 'Inactive';
export type ApartmentStatus =
  'Available' | 'Leased' | 'OwnerOccupied' | 'UnderMaintenance' | 'Reserved';
export type OwnerType = 'Individual' | 'Company';

export interface Building {
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
  status: BuildingStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  floorNumber: number;
  name: string | null;
}

export interface BuildingDetail extends Building {
  floors: Floor[];
}

export interface Apartment {
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
  status: ApartmentStatus;
  ownerId: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Owner {
  id: string;
  tenantId: string;
  ownerType: OwnerType;
  userId: string | null;
  fullName: string;
  companyName: string | null;
  nationalIdOrRegistration: string | null;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface Paged<T> {
  data: T[];
  pagination: Pagination;
}

/* ------------------------ write payloads ----------------------- */

export interface CreateBuildingInput {
  name: string;
  address: string;
  city: string;
  district?: string | null;
  totalFloors: number;
  yearBuilt?: number | null;
  notes?: string | null;
}

export interface UpdateBuildingInput {
  name?: string;
  address?: string;
  city?: string;
  district?: string | null;
  notes?: string | null;
}

export interface CreateApartmentInput {
  buildingId: string;
  floorId: string;
  unitNumber: string;
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number | null;
  baseRentAmount?: number | null;
  description?: string | null;
}

export interface UpdateApartmentInput {
  bedrooms?: number;
  bathrooms?: number;
  areaSqm?: number | null;
  baseRentAmount?: number | null;
  description?: string | null;
  status?: ApartmentStatus;
  ownerId?: string;
}

export interface CreateOwnerInput {
  ownerType?: OwnerType;
  fullName: string;
  companyName?: string | null;
  nationalIdOrRegistration?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  address?: string | null;
}

export type UpdateOwnerInput = Partial<Omit<CreateOwnerInput, 'ownerType'>>;
