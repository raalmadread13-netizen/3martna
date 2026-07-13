import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Role } from '../config/constants';
import { User } from '../types';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isBootstrapping: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionRestored(state, action: PayloadAction<User | null>) {
      state.user = action.payload;
      state.isAuthenticated = Boolean(action.payload);
      state.isBootstrapping = false;
    },
    loggedIn(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isBootstrapping = false;
    },
    profileUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    loggedOut(state) {
      state.user = null;
      state.isAuthenticated = false;
      state.isBootstrapping = false;
    },
  },
});

export const { sessionRestored, loggedIn, profileUpdated, loggedOut } = authSlice.actions;
export const authReducer = authSlice.reducer;

/** Primary role decides which dashboard/tab set the user gets. */
export const primaryRole = (user: User | null): Role => {
  const roles = user?.Roles ?? [];
  const priority: Role[] = [
    'SystemAdmin',
    'BuildingOwner',
    'Accountant',
    'MaintenanceEmployee',
    'CleaningStaff',
    'SecurityGuard',
    'ApartmentOwner',
    'Tenant',
  ];
  return priority.find((role) => roles.includes(role)) ?? 'Tenant';
};
