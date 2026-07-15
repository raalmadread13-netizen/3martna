import {
  Apartment,
  Building,
  BuildingDetail,
  CreateApartmentInput,
  CreateBuildingInput,
  CreateOwnerInput,
  Floor,
  Owner,
  Paged,
  UpdateApartmentInput,
  UpdateBuildingInput,
  UpdateOwnerInput,
} from '@/domain/entities/Property';
import { api } from './client';

interface Envelope<T> {
  data: T;
}

type PagedEnvelope<T> = Paged<T>; // list endpoints return { success, data: [], pagination }

const page = (p: number, pageSize = 20): string => `page=${p}&pageSize=${pageSize}`;

export const buildingsApi = {
  list: (p = 1, pageSize = 20) =>
    api.get<PagedEnvelope<Building>>(`/buildings?${page(p, pageSize)}`).then((r) => r.data),

  get: (id: string) =>
    api.get<Envelope<BuildingDetail>>(`/buildings/${id}`).then((r) => r.data.data),

  create: (body: CreateBuildingInput) =>
    api.post<Envelope<BuildingDetail>>('/buildings', body).then((r) => r.data.data),

  update: (id: string, body: UpdateBuildingInput) =>
    api.put<Envelope<Building>>(`/buildings/${id}`, body).then((r) => r.data.data),

  archive: (id: string) => api.delete(`/buildings/${id}`),

  listFloors: (id: string) =>
    api.get<Envelope<Floor[]>>(`/buildings/${id}/floors`).then((r) => r.data.data),

  addFloor: (id: string, body: { floorNumber: number; name?: string | null }) =>
    api.post<Envelope<Floor>>(`/buildings/${id}/floors`, body).then((r) => r.data.data),

  renameFloor: (id: string, floorId: string, name: string | null) =>
    api
      .put<Envelope<Floor>>(`/buildings/${id}/floors/${floorId}`, { name })
      .then((r) => r.data.data),
};

export const apartmentsApi = {
  list: (p = 1, pageSize = 20, buildingId?: string) =>
    api
      .get<PagedEnvelope<Apartment>>(
        `/apartments?${page(p, pageSize)}${buildingId ? `&buildingId=${buildingId}` : ''}`,
      )
      .then((r) => r.data),

  get: (id: string) => api.get<Envelope<Apartment>>(`/apartments/${id}`).then((r) => r.data.data),

  create: (body: CreateApartmentInput) =>
    api.post<Envelope<Apartment>>('/apartments', body).then((r) => r.data.data),

  update: (id: string, body: UpdateApartmentInput) =>
    api.put<Envelope<Apartment>>(`/apartments/${id}`, body).then((r) => r.data.data),

  archive: (id: string) => api.delete(`/apartments/${id}`),
};

export const ownersApi = {
  list: (p = 1, pageSize = 20) =>
    api.get<PagedEnvelope<Owner>>(`/owners?${page(p, pageSize)}`).then((r) => r.data),

  get: (id: string) => api.get<Envelope<Owner>>(`/owners/${id}`).then((r) => r.data.data),

  create: (body: CreateOwnerInput) =>
    api.post<Envelope<Owner>>('/owners', body).then((r) => r.data.data),

  update: (id: string, body: UpdateOwnerInput) =>
    api.put<Envelope<Owner>>(`/owners/${id}`, body).then((r) => r.data.data),
};
