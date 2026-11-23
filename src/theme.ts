// Little Life design tokens. Light mode only: playful but clean.

export const colors = {
  background: '#FFF9F2', // warm cream
  surface: '#FFFFFF',
  surfaceAlt: '#F6EEE4', // subtle chips / inputs
  border: '#EADFD2',
  text: '#2B2233',
  mutedText: '#857A8C',
  primary: '#7C5CFF', // playful violet
  primarySoft: '#ECE6FF',
  onPrimary: '#FFFFFF',
  expense: '#FF7A59', // coral for money
  expenseSoft: '#FFE6DE',
  task: '#2EB5A5', // teal for to-dos
  taskSoft: '#D9F4F0',
  success: '#34C26B',
  warning: '#F5A623',
  danger: '#E5484D',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const fontSize = {
  caption: 13,
  small: 14,
  body: 16,
  bodyLarge: 18,
  title: 22,
  heading: 28,
  display: 36,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  heavy: '800',
} as const;

export const theme = { colors, spacing, radius, fontSize, fontWeight };
export type Theme = typeof theme;
