/** Brand palette — luxury navy & gold. */
export const palette = {
  navy900: '#020617',
  navy800: '#0F172A',
  navy700: '#1E293B',
  navy600: '#334155',
  gold500: '#C8A24B',
  gold300: '#E3C983',
  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate900: '#0F172A',
  green600: '#16A34A',
  amber600: '#D97706',
  red600: '#DC2626',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export const lightColors: ThemeColors = {
  background: palette.slate50,
  surface: palette.white,
  surfaceMuted: palette.slate100,
  border: palette.slate200,
  text: palette.slate900,
  textMuted: palette.slate500,
  primary: palette.navy800,
  onPrimary: palette.white,
  accent: palette.gold500,
  success: palette.green600,
  warning: palette.amber600,
  danger: palette.red600,
};

export const darkColors: ThemeColors = {
  background: palette.navy900,
  surface: palette.navy800,
  surfaceMuted: palette.navy700,
  border: palette.navy600,
  text: palette.slate50,
  textMuted: palette.slate400,
  primary: palette.gold500,
  onPrimary: palette.navy900,
  accent: palette.gold300,
  success: palette.green600,
  warning: palette.amber600,
  danger: palette.red600,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 999,
} as const;
