// WCAG contrast math that guards the palette: text needs 4.5:1 and graphical marks 3:1,
// however the theme is recolored.

export function parseHex(hex: string): [number, number, number] {
  const s = String(hex).trim().replace(/^#/, '');
  const full =
    s.length === 3
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex color: ${hex}`);
  }
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Relative luminance per WCAG 2.x.
export function luminance(hex: string): number {
  const chan = (c: number): number => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = parseHex(hex);
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

// From 1 (identical colors) to 21 (black on white).
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
