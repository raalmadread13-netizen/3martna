import {
  BuildingSummary,
  DashboardSummary,
  LeaseAlerts,
  RecentActivity,
} from '@/domain/entities/Dashboard';
import { api } from './client';

interface Envelope<T> {
  data: T;
}

export const dashboardApi = {
  summary: () => api.get<Envelope<DashboardSummary>>('/dashboard/summary').then((r) => r.data.data),

  buildings: () =>
    api.get<Envelope<BuildingSummary[]>>('/dashboard/buildings').then((r) => r.data.data),

  leaseAlerts: () =>
    api.get<Envelope<LeaseAlerts>>('/dashboard/lease-alerts').then((r) => r.data.data),

  activity: (limit = 15) =>
    api
      .get<Envelope<RecentActivity[]>>(`/dashboard/activity?limit=${limit}`)
      .then((r) => r.data.data),
};
