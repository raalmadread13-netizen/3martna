export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export const STORAGE_KEYS = {
  accessToken: 'martna.accessToken',
  refreshToken: 'martna.refreshToken',
  user: 'martna.user',
  language: 'martna.language',
  theme: 'martna.theme',
  biometric: 'martna.biometricEnabled',
  rememberMe: 'martna.rememberMe',
  deviceKey: 'martna.deviceKey',
} as const;

export const ROLES = {
  systemAdmin: 'SystemAdmin',
  buildingOwner: 'BuildingOwner',
  apartmentOwner: 'ApartmentOwner',
  tenant: 'Tenant',
  maintenance: 'MaintenanceEmployee',
  guard: 'SecurityGuard',
  cleaning: 'CleaningStaff',
  accountant: 'Accountant',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const CURRENCY = 'JOD';
