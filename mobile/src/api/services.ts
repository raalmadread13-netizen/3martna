import { api } from './client';
import {
  Announcement,
  Apartment,
  AppNotification,
  AuthTokens,
  Building,
  ChatThread,
  CommentItem,
  Complaint,
  Contract,
  DocumentItem,
  Invoice,
  MaintenanceRequest,
  Paginated,
  Payment,
  User,
  Visitor,
} from '../types';

type Query = Record<string, string | number | boolean | undefined>;

const clean = (params?: Query): Query | undefined => {
  if (!params) return undefined;
  const filtered: Query = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') filtered[key] = value;
  }
  return filtered;
};

/* ─────────── Auth ─────────── */
export const authApi = {
  login: (body: {
    identifier: string;
    password: string;
    deviceKey?: string;
    fcmToken?: string;
    platform?: string;
  }) =>
    api
      .post<{ data: { user: User; tokens: AuthTokens } }>('/auth/login', body)
      .then((response) => response.data.data),

  otpLogin: (body: { firebaseIdToken: string; deviceKey?: string; fcmToken?: string }) =>
    api
      .post<{ data: { user: User; tokens: AuthTokens } }>('/auth/otp-login', body)
      .then((response) => response.data.data),

  register: (body: {
    fullName: string;
    email?: string;
    phone: string;
    password: string;
    role?: string;
    preferredLanguage?: string;
    firebaseIdToken?: string;
  }) =>
    api
      .post<{ data: { user: User; tokens: AuthTokens } }>('/auth/register', body)
      .then((response) => response.data.data),

  logout: (refreshToken: string, deviceKey?: string) =>
    api.post('/auth/logout', { refreshToken, deviceKey }),

  forgotPassword: (identifier: string) =>
    api.post<{ data?: { resetToken?: string } }>('/auth/forgot-password', { identifier })
      .then((response) => response.data),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
};

/* ─────────── Users ─────────── */
export const usersApi = {
  me: () => api.get<{ data: User }>('/users/me').then((response) => response.data.data),
  updateMe: (body: Partial<Record<string, unknown>>) =>
    api.put<{ data: User }>('/users/me', body).then((response) => response.data.data),
  deleteMe: () => api.delete('/users/me'),
  settings: () => api.get<{ data: Record<string, unknown> }>('/users/me/settings').then((r) => r.data.data),
  updateSettings: (body: Record<string, unknown>) =>
    api.put<{ data: Record<string, unknown> }>('/users/me/settings', body).then((r) => r.data.data),
  registerDevice: (body: { deviceKey: string; fcmToken?: string; platform: string }) =>
    api.post('/users/me/devices', body),
  emergencyContacts: () =>
    api.get<{ data: { ContactId: number; Name: string; Phone: string; Relationship: string | null }[] }>(
      '/users/me/emergency-contacts',
    ).then((r) => r.data.data),
  addEmergencyContact: (body: { name: string; phone: string; relationship?: string }) =>
    api.post('/users/me/emergency-contacts', body),
  deleteEmergencyContact: (contactId: number) =>
    api.delete(`/users/me/emergency-contacts/${contactId}`),
};

/* ─────────── Dashboards ─────────── */
export const dashboardApi = {
  owner: () => api.get<{ data: { kpis: Record<string, number>; trend: unknown[]; occupancy: unknown[] } }>(
    '/dashboard/owner',
  ).then((r) => r.data.data),
  tenant: () =>
    api.get<{
      data: {
        residence: Record<string, unknown> | null;
        summary: Record<string, number>;
        upcomingInvoices: Invoice[];
      };
    }>('/dashboard/tenant').then((r) => r.data.data),
  staff: () =>
    api.get<{
      data: {
        kpis: Record<string, number>;
        activeTasks: MaintenanceRequest[];
        todaySchedule: Record<string, unknown>[];
      };
    }>('/dashboard/staff').then((r) => r.data.data),
};

/* ─────────── Property ─────────── */
export const buildingsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Building>>('/buildings', { params: clean(params) }).then((r) => r.data),
  get: (id: number) =>
    api.get<{ data: Building }>(`/buildings/${id}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: Building }>('/buildings', body).then((r) => r.data.data),
  update: (id: number, body: Record<string, unknown>) =>
    api.put<{ data: Building }>(`/buildings/${id}`, body).then((r) => r.data.data),
};

export const apartmentsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Apartment>>('/apartments', { params: clean(params) }).then((r) => r.data),
  get: (id: number) =>
    api.get<{ data: Apartment & Record<string, unknown> }>(`/apartments/${id}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: Apartment }>('/apartments', body).then((r) => r.data.data),
  update: (id: number, body: Record<string, unknown>) =>
    api.put<{ data: Apartment }>(`/apartments/${id}`, body).then((r) => r.data.data),
};

export const residentsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Record<string, unknown>>>('/residents', { params: clean(params) }).then((r) => r.data),
  moveIn: (body: Record<string, unknown>) => api.post('/residents', body),
  moveOut: (residentId: number) => api.post(`/residents/${residentId}/move-out`, {}),
};

export const contractsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Contract>>('/contracts', { params: clean(params) }).then((r) => r.data),
  get: (id: number) =>
    api.get<{ data: Contract & Record<string, unknown> }>(`/contracts/${id}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: Contract }>('/contracts', body).then((r) => r.data.data),
  activate: (id: number) => api.post(`/contracts/${id}/activate`, {}),
  terminate: (id: number, reason?: string) => api.post(`/contracts/${id}/terminate`, { reason }),
};

/* ─────────── Finance ─────────── */
export const invoicesApi = {
  list: (params?: Query) =>
    api.get<Paginated<Invoice>>('/invoices', { params: clean(params) }).then((r) => r.data),
  get: (id: number) =>
    api.get<{ data: Invoice }>(`/invoices/${id}`).then((r) => r.data.data),
};

export const paymentsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Payment>>('/payments', { params: clean(params) }).then((r) => r.data),
  create: (body: {
    invoiceId: number;
    amount: number;
    method: string;
    referenceNumber?: string;
    paidByUserId?: number;
  }) => api.post<{ data: Payment }>('/payments', body).then((r) => r.data.data),
  receiptUrl: (paymentId: number) => `/payments/${paymentId}/receipt`,
};

/* ─────────── Operations ─────────── */
export const maintenanceApi = {
  list: (params?: Query) =>
    api.get<Paginated<MaintenanceRequest>>('/maintenance', { params: clean(params) }).then((r) => r.data),
  get: (id: number) =>
    api.get<{ data: MaintenanceRequest }>(`/maintenance/${id}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: MaintenanceRequest }>('/maintenance', body).then((r) => r.data.data),
  assign: (id: number, assignedToUserId: number, scheduledAt?: string) =>
    api.post(`/maintenance/${id}/assign`, { assignedToUserId, scheduledAt }),
  updateStatus: (id: number, status: string, completionNotes?: string) =>
    api.patch(`/maintenance/${id}/status`, { status, completionNotes }),
  checkIn: (id: number, latitude: number, longitude: number) =>
    api.post(`/maintenance/${id}/check-in`, { latitude, longitude }),
  checkOut: (id: number) => api.post(`/maintenance/${id}/check-out`, {}),
  addAttachment: (id: number, fileUrl: string, stage: string, fileType = 'image') =>
    api.post(`/maintenance/${id}/attachments`, { fileUrl, stage, fileType }),
  addComment: (id: number, comment: string) =>
    api.post<{ data: CommentItem }>(`/maintenance/${id}/comments`, { comment }),
  rate: (id: number, rating: number, comment?: string) =>
    api.post(`/maintenance/${id}/rate`, { rating, comment }),
  schedules: (params?: Query) =>
    api.get<{ data: Record<string, unknown>[] }>('/maintenance/schedules/list', {
      params: clean(params),
    }).then((r) => r.data.data),
};

export const complaintsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Complaint>>('/complaints', { params: clean(params) }).then((r) => r.data),
  get: (id: number) =>
    api.get<{ data: Complaint }>(`/complaints/${id}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: Complaint }>('/complaints', body).then((r) => r.data.data),
  updateStatus: (id: number, status: string, resolution?: string) =>
    api.patch(`/complaints/${id}/status`, { status, resolution }),
  addComment: (id: number, comment: string) =>
    api.post<{ data: CommentItem }>(`/complaints/${id}/comments`, { comment }),
};

export const visitorsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Visitor>>('/visitors', { params: clean(params) }).then((r) => r.data),
  get: (id: number) => api.get<{ data: Visitor }>(`/visitors/${id}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: Visitor }>('/visitors', body).then((r) => r.data.data),
  updateStatus: (id: number, status: 'Approved' | 'Denied' | 'Cancelled') =>
    api.patch(`/visitors/${id}/status`, { status }),
  scan: (qrCode: string) =>
    api.post<{ data: Visitor }>('/visitors/scan', { qrCode }).then((r) => r.data.data),
  checkOut: (id: number) => api.post<{ data: Visitor }>(`/visitors/${id}/check-out`, {}),
};

export const announcementsApi = {
  list: (params?: Query) =>
    api.get<Paginated<Announcement>>('/announcements', { params: clean(params) }).then((r) => r.data),
  create: (body: Record<string, unknown>) => api.post('/announcements', body),
};

export const notificationsApi = {
  list: (params?: Query) =>
    api
      .get<Paginated<AppNotification> & { unreadCount: number }>('/notifications', {
        params: clean(params),
      })
      .then((r) => r.data),
  markRead: (id: number) => api.post(`/notifications/${id}/read`, {}),
  markAllRead: () => api.post('/notifications/read-all', {}),
};

export const documentsApi = {
  list: (params?: Query) =>
    api.get<Paginated<DocumentItem>>('/documents', { params: clean(params) }).then((r) => r.data),
  create: (body: Record<string, unknown>) => api.post('/documents', body),
  archive: (id: number) => api.delete(`/documents/${id}`),
};

export const chatApi = {
  threads: () => api.get<{ data: ChatThread[] }>('/chat/threads').then((r) => r.data.data),
  createThread: (body: { threadType: 'Private' | 'Group'; title?: string; memberIds: number[] }) =>
    api.post<{ data: ChatThread }>('/chat/threads', body).then((r) => r.data.data),
  notify: (threadId: number, preview: string) =>
    api.post(`/chat/threads/${threadId}/notify`, { preview }),
};

export const searchApi = {
  global: (q: string) =>
    api
      .get<{ data: Record<string, { Id: number; Title: string; Subtitle: string }[]> }>('/search', {
        params: { q },
      })
      .then((r) => r.data.data),
};

export const reportsApi = {
  financial: (fromDate: string, toDate: string, buildingId?: number) =>
    api
      .get<{ data: Record<string, Record<string, unknown>[]> }>('/reports/financial', {
        params: clean({ fromDate, toDate, buildingId }),
      })
      .then((r) => r.data.data),
  occupancy: () =>
    api.get<{ data: Record<string, Record<string, unknown>[]> }>('/reports/occupancy').then((r) => r.data.data),
};
