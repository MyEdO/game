import type { Color } from 'three';
import type { EndState } from '../engine/conditions';

export interface EndStateAppearance {
  desaturation: number;
  sepia: number;
  opacity: number;
}

export const END_STATE_APPEARANCE: Record<EndState, EndStateAppearance> = {
  mort: { desaturation: 0.85, sepia: 0, opacity: 0.6 },
  inconscient: { desaturation: 0.85, sepia: 0, opacity: 0.6 },
  rendu: { desaturation: 0, sepia: 0, opacity: 0.85 },
  'hors-combat': { desaturation: 0.75, sepia: 0.25, opacity: 0.6 },
};

export function endStateFilter(state: EndState): string {
  const { desaturation, sepia } = END_STATE_APPEARANCE[state];
  return `grayscale(${desaturation}) sepia(${sepia})`;
}

/** La couleur d'instance est linéaire ; les filtres et l'atténuation se composent en sRGB. */
export function applyEndStateColor(color: Color, state: EndState): Color {
  const { desaturation, sepia, opacity } = END_STATE_APPEARANCE[state];
  color.convertLinearToSRGB();
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const r = color.r + (luminance - color.r) * desaturation;
  const g = color.g + (luminance - color.g) * desaturation;
  const b = color.b + (luminance - color.b) * desaturation;
  const clamp = (value: number) => Math.max(0, Math.min(1, value));
  color.r = clamp(r + (0.393 * r + 0.769 * g + 0.189 * b - r) * sepia) * opacity;
  color.g = clamp(g + (0.349 * r + 0.686 * g + 0.168 * b - g) * sepia) * opacity;
  color.b = clamp(b + (0.272 * r + 0.534 * g + 0.131 * b - b) * sepia) * opacity;
  return color.convertSRGBToLinear();
}
