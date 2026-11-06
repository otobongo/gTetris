/** The brick palette as data, for code that needs the values (canvas pal(): base, light, dark).
    Styles should use the CSS tokens (--brick-red, --brick-red-light, --brick-red-dark) instead. */
export const BRICK_COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange', 'pink', 'teal', 'white', 'black'] as const;
export type BrickColor = (typeof BRICK_COLORS)[number];

export const PALETTE: Record<BrickColor, { base: string; light: string; dark: string }> = {
  red: { base: '#f03a3a', light: '#ff7a6e', dark: '#b51f27' },
  yellow: { base: '#ffc21a', light: '#ffe266', dark: '#d48a00' },
  green: { base: '#1fb53c', light: '#5fe06e', dark: '#0f7a26' },
  blue: { base: '#2f8cff', light: '#7cc0ff', dark: '#1557c4' },
  purple: { base: '#9b4dff', light: '#c79bff', dark: '#6624c9' },
  orange: { base: '#ff7a1a', light: '#ffab5e', dark: '#c4500a' },
  pink: { base: '#ff5fb4', light: '#ff9fd4', dark: '#c72f84' },
  teal: { base: '#14c8c0', light: '#6aeee4', dark: '#0b8c87' },
  white: { base: '#f1eef7', light: '#ffffff', dark: '#b9b3c9' },
  black: { base: '#2e2e38', light: '#4d4d5c', dark: '#17171d' },
};
