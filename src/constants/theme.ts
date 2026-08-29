import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    textSecondary: '#64748B',
    background: '#F8FAFC',
    backgroundElement: '#EDF2F7',
    backgroundSelected: '#E2E8F0',
    card: '#FFFFFF',
    cardBorder: '#E2E8F0',
    primary: '#0284C7',
    primaryLight: '#E0F2FE',
    primaryDark: '#0369A1',
    accent: '#06B6D4',
    success: '#10B981',
    successLight: '#DCFCE7',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
    critical: '#881337',
    criticalLight: '#FFE4E6',
  },
  dark: {
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    background: '#090D16',
    backgroundElement: '#131B2A',
    backgroundSelected: '#1E293B',
    card: '#131C2E',
    cardBorder: '#1E293B',
    primary: '#38BDF8',
    primaryLight: '#082F49',
    primaryDark: '#0284C7',
    accent: '#22D3EE',
    success: '#34D399',
    successLight: '#064E3B',
    warning: '#FBBF24',
    warningLight: '#78350F',
    danger: '#F87171',
    dangerLight: '#7F1D1D',
    critical: '#FDA4AF',
    criticalLight: '#4C0519',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const SeverityColors = {
  low: {
    label: 'Leve',
    bg: '#E0F2FE',
    text: '#0369A1',
    border: '#BAE6FD',
    icon: 'water-outline',
  },
  moderate: {
    label: 'Moderado',
    bg: '#FEF3C7',
    text: '#B45309',
    border: '#FDE68A',
    icon: 'warning-outline',
  },
  high: {
    label: 'Grave',
    bg: '#FFEDD5',
    text: '#C2410C',
    border: '#FED7AA',
    icon: 'alert-circle-outline',
  },
  critical: {
    label: 'Crítico',
    bg: '#FEE2E2',
    text: '#B91C1C',
    border: '#FECACA',
    icon: 'flash-outline',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 60, android: 80 }) ?? 60;
export const MaxContentWidth = 850;
