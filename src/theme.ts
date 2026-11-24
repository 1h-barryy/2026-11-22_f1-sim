// Little Life design tokens. Light mode only: playful but clean.

// Text colors meet WCAG AA (at least 4.5:1) for ordinary text on the light
// surfaces they're used on (surface, background, surfaceAlt and their own
// *Soft tint), and white (onPrimary) text on primary / expense / task / danger
// fills meets 4.5:1 too. Re-check contrast if you change any of these.
export const colors = {
  background: '#FFF9F2', // warm cream
  surface: '#FFFFFF',
  surfaceAlt: '#F6EEE4', // subtle chips / inputs
  border: '#EADFD2',
  text: '#2B2233',
  mutedText: '#73697A', // 5.2:1 on white, 4.5:1 on surfaceAlt
  primary: '#6541F0', // playful violet; white text 5.9:1
  primarySoft: '#EFEAFF',
  onPrimary: '#FFFFFF',
  expense: '#BF3F0B', // terracotta for money; white text 5.3:1
  expenseSoft: '#FFECE5',
  task: '#0F766E', // deep teal for to-dos; white text 5.5:1
  taskSoft: '#DDF5F1',
  success: '#34C26B', // decorative only (category dot), never text
  warning: '#A0560A', // amber; overdue dates 5.5:1 on white
  danger: '#C92A30', // error text 5.4:1 on white
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
  micro: 11, // tab bar labels
  caption: 13, // short labels only (counts, category tags); never sentences
  small: 15, // smallest size for explanatory / body text
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

export const lineHeight = {
  small: 20, // pairs with fontSize.small
  body: 22, // pairs with fontSize.body
  bodyLarge: 24, // pairs with fontSize.bodyLarge
} as const;

/** Letter spacing for small uppercase labels ("TRY ONE", "AMOUNT"). */
export const letterSpacing = {
  label: 0.6,
} as const;

export const iconSize = {
  sm: 18,
  md: 20,
  lg: 24,
} as const;

export const borderWidth = {
  thin: 1,
  medium: 1.5,
  thick: 2,
} as const;

/** Round icon buttons (send, mic). */
export const controlSize = 48;

export const theme = {
  colors,
  spacing,
  radius,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  iconSize,
  borderWidth,
  controlSize,
};
export type Theme = typeof theme;
