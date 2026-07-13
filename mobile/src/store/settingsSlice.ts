import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'ar' | 'en';

export interface SettingsState {
  theme: ThemeMode;
  language: Language;
  biometricEnabled: boolean;
}

const initialState: SettingsState = {
  theme: 'system',
  language: 'ar',
  biometricEnabled: false,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    settingsLoaded(state, action: PayloadAction<Partial<SettingsState>>) {
      Object.assign(state, action.payload);
    },
    themeChanged(state, action: PayloadAction<ThemeMode>) {
      state.theme = action.payload;
    },
    languageChanged(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    },
    biometricToggled(state, action: PayloadAction<boolean>) {
      state.biometricEnabled = action.payload;
    },
  },
});

export const { settingsLoaded, themeChanged, languageChanged, biometricToggled } =
  settingsSlice.actions;
export const settingsReducer = settingsSlice.reducer;
