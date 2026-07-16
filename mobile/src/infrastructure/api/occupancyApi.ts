import {
  CreateLeaseInput,
  CreateResidentInput,
  CursorPage,
  Lease,
  LeaseListParams,
  OccupancyListParams,
  OccupancyRecord,
  Resident,
  ResidentListParams,
  UpdateResidentInput,
} from '@/domain/entities/Occupancy';
import { newIdempotencyKey } from '@/shared/utils/idempotency';
import { api } from './client';

interface Envelope<T> {
  data: T;
}

/** Every POST carries a fresh Idempotency-Key — retries can never duplicate. */
const idem = (): { headers: Record<string, string> } => ({
  headers: { 'Idempotency-Key': newIdempotencyKey() },
});

const qs = (params: object): string => {
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  return entries.length
    ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
    : '';
};

export const residentsApi = {
  list: (params: ResidentListParams = {}) =>
    api.get<CursorPage<Resident>>(`/residents${qs(params)}`).then((r) => r.data),

  get: (id: string) => api.get<Envelope<Resident>>(`/residents/${id}`).then((r) => r.data.data),

  create: (body: CreateResidentInput) =>
    api.post<Envelope<Resident>>('/residents', body, idem()).then((r) => r.data.data),

  update: (id: string, body: UpdateResidentInput) =>
    api.put<Envelope<Resident>>(`/residents/${id}`, body).then((r) => r.data.data),
};

export const leasesApi = {
  list: (params: LeaseListParams = {}) =>
    api.get<CursorPage<Lease>>(`/leases${qs(params)}`).then((r) => r.data),

  get: (id: string) => api.get<Envelope<Lease>>(`/leases/${id}`).then((r) => r.data.data),

  create: (body: CreateLeaseInput) =>
    api.post<Envelope<Lease>>('/leases', body, idem()).then((r) => r.data.data),

  extend: (id: string, endDate: string) =>
    api.put<Envelope<Lease>>(`/leases/${id}`, { endDate }).then((r) => r.data.data),

  terminate: (id: string, reason: string) =>
    api
      .post<Envelope<Lease>>(`/leases/${id}/terminate`, { reason }, idem())
      .then((r) => r.data.data),
};

export const occupancyApi = {
  list: (params: OccupancyListParams = {}) =>
    api.get<CursorPage<OccupancyRecord>>(`/occupancy${qs(params)}`).then((r) => r.data),

  get: (id: string) =>
    api.get<Envelope<OccupancyRecord>>(`/occupancy/${id}`).then((r) => r.data.data),

  moveIn: (leaseId: string, moveInDate?: string) =>
    api
      .post<Envelope<OccupancyRecord>>('/occupancy/move-in', { leaseId, moveInDate }, idem())
      .then((r) => r.data.data),

  moveOut: (occupancyId: string, moveOutDate?: string, reason?: string) =>
    api
      .post<Envelope<OccupancyRecord>>(
        `/occupancy/${occupancyId}/move-out`,
        { moveOutDate, reason },
        idem(),
      )
      .then((r) => r.data.data),
};
