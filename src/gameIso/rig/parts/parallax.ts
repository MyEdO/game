/**
 * PARALLAXE DE PROFIL — règle codifiée (2026-06-11 ; cas : corne droite et pointes d'épaule
 * droite invisibles de flanc sur le Guerrier du Chaos).
 *
 * RÈGLE : tout élément LATÉRAL PAIR (cornes, épaulières, oreilles, pointes…) dessiné en vue
 * de face existe en DEUX exemplaires — de PROFIL, l'exemplaire LOINTAIN reste visible :
 * décalé vers l'avant (+x, parallaxe), assombri (chaque jeton d'une clé de `DARKENED_KEYS` prend
 * l'ombre de sa gamme, `gammeDe(…, 'ombre')`), légèrement transparent, et peint AVANT
 * l'exemplaire proche (qui le chevauche).
 *
 * `farSide(svgProche)` fabrique cet exemplaire lointain automatiquement — l'auteur d'art ne
 * dessine que le côté proche et appelle le helper, au lieu de se souvenir de la règle.
 * Checklist complète : docs/qc-reconnaissabilite-sprites.md (« parité de profil »).
 */
import { replaceTokens } from '../palette';
import { baseDeGamme, gammeDe } from '../../../data/palette.types';

/** Clés dont l'exemplaire lointain prend l'ombre de gamme (#1903). */
const DARKENED_KEYS: ReadonlySet<string> = new Set(['corps', 'peau', 'vet1', 'vet2', 'cheveux', 'cuir', 'metal']);

export interface FarSideOpts {
  /** décalage de parallaxe vers l'avant (+x), défaut 5. */
  dx?: number;
  /** décalage vertical, défaut 0. */
  dy?: number;
  /** opacité de l'exemplaire lointain, défaut 0.85. */
  opacity?: number;
  /** échelle (l'élément lointain paraît un peu plus petit), défaut 0.94. */
  scale?: number;
}

/** Exemplaire LOINTAIN d'un élément latéral pair, à peindre AVANT l'exemplaire proche : la base et la
 *  lumière d'une clé de `DARKENED_KEYS` y prennent l'ombre de sa gamme (la profondeur se lit par la
 *  valeur, pas que par le décalage), l'ombre et tout autre jeton restent. */
export function farSide(svgProche: string, opts: FarSideOpts = {}): string {
  const { dx = 5, dy = 0, opacity = 0.85, scale = 0.94 } = opts;
  const art = replaceTokens(svgProche, (key) => `@${DARKENED_KEYS.has(baseDeGamme(key)) ? gammeDe(baseDeGamme(key), 'ombre') : key}`);
  return `<g transform="translate(${dx},${dy}) scale(${scale})" opacity="${opacity}">${art}</g>`;
}

/** Paire complète : lointain (auto) PUIS proche — l'appel d'une ligne qui évite l'oubli. */
export function lateralPair(svgProche: string, opts: FarSideOpts = {}): string {
  return farSide(svgProche, opts) + svgProche;
}
