import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Lease, Resident } from '@/domain/entities/Occupancy';
import type { Apartment, Building, Owner } from '@/domain/entities/Property';

/** Route params for the root stack. Extended per feature sprint. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- React Navigation requires a type alias (implicit index signature)
export type RootStackParamList = {
  // Guest stack
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { identifier?: string } | undefined;
  // Authenticated stack
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
  // Sprint 4 — Building & Apartment Management
  Buildings: undefined;
  BuildingDetails: { id: string };
  BuildingForm: { building?: Building };
  Apartments: { buildingId?: string } | undefined;
  ApartmentDetails: { id: string };
  ApartmentForm: { apartment?: Apartment; buildingId?: string };
  Owners: undefined;
  OwnerDetails: { id: string };
  OwnerForm: { owner?: Owner };
  // Sprint 6 — Admin Dashboard
  Dashboard: undefined;
  // Sprint 5 — Occupancy Management
  Residents: undefined;
  ResidentDetails: { id: string };
  ResidentForm: { resident?: Resident };
  Leases: undefined;
  LeaseDetails: { id: string };
  LeaseForm: { lease?: Lease; residentId?: string };
  MoveInWizard: { leaseId?: string };
  MoveOutWizard: { occupancyId?: string };
  OccupancyHistory: { apartmentId?: string; residentId?: string } | undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
