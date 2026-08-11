const INK = '#0f2233';
const PAPER = '#ffffff';

const channel = (value: number): number => {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const parseHex = (hex: string): [number, number, number] | null => {
  const clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length >= 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
};

const relativeLuminance = (rgb: [number, number, number]): number =>
  0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);

/**
 * Label colour that stays readable on an arbitrary fill. 모둠 colours are
 * user-visible data, so a bright one must not leave white text at 2:1.
 */
export const readableTextOn = (background: string): string => {
  const rgb = parseHex(background);
  if (!rgb) return PAPER;
  return relativeLuminance(rgb) > 0.42 ? INK : PAPER;
};

/** Translucent overlay that darkens or lightens a fill so nested labels read. */
export const nestedOverlayOn = (background: string): string => {
  const rgb = parseHex(background);
  if (!rgb) return 'rgba(0, 0, 0, 0.24)';
  return relativeLuminance(rgb) > 0.42 ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.26)';
};
