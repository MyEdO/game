/**
 * REPLI VISIBLE des catalogues de rendu (#877) — même doctrine que `orientedArtOr`/`MISSING_ART`
 * (#223, `rig/viewArt.ts`) : un id absent d'un registre ne prend JAMAIS l'identité d'une AUTRE entrée.
 * Il résout une entrée d'ERREUR ASSUMÉE, peinte au ton d'alarme (criard quelle que soit la scène),
 * doublée d'un `console.warn` en DEV qui nomme l'id fautif. Le rendu ne déguise plus l'échec, et rien
 * ne lève : une donnée fautive se voit, elle n'emporte pas la scène.
 */
import { MISSING_TONE, MISSING_TONE_DARK } from '../rig/viewArt';

export { MISSING_TONE, MISSING_TONE_DARK };

/** Id porté par toute entrée de repli visible. Hors de TOUT registre : aucune donnée ne le référence,
 *  et une garde de couverture (`structureAppearance-coverage.test.ts`) le distingue d'une entrée réelle. */
export const MISSING_ID = 'sans-entree-au-catalogue';

/** Libellé porté par toute entrée de repli visible — même doctrine que `MISSING_ID` : l'échec se NOMME
 *  à l'écran, il n'emprunte pas le nom d'une entrée réelle. */
export const MISSING_LABEL = 'Sans entrée au catalogue';

/** Avertit en DEV qu'un id est absent d'un catalogue de rendu (`kind` = famille affichée). */
export function warnMissing(kind: string, id: string): void {
  // `?.` : import.meta.env est absent hors Vite (scripts de galeries, tests headless).
  if (import.meta.env?.DEV) console.warn(`[${kind}] id « ${id} » absent du catalogue — repli VISIBLE, donnée à corriger.`);
}

/** Entrée d'un registre de catalogue par id ; à défaut l'entrée de REPLI VISIBLE + l'avertissement DEV.
 *  Le premier paramètre est une RÉSOLUTION, jamais un index : un catalogue dont la donnée se mute en
 *  place (les matières, `src/data/materials.json`) y passe sa lecture VIVANTE, un catalogue à index figé y
 *  passe son index (`(id) => MAP[id]`) — le repli visible reste le MÊME chemin pour les deux. */
export function catalogEntry<T>(trouve: (id: string) => T | undefined, id: string, kind: string, missing: T): T {
  const found = trouve(id);
  if (found) return found;
  warnMissing(kind, id);
  return missing;
}
