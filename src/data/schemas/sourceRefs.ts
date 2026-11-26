/**
 * Accessors SOURCE UNIQUE pour l'emplacement d'une entrée multi-livres (#563, doctrine user
 * 2026-07-17 : « jamais 2 talents différents » — un même Talent/Trait/Qualité/objet peut être
 * réimprimé ailleurs). L'ANCRE (`source: SourceRef`) reste seule à porter la `desc` (règle stricte
 * 5) ; les emplacements SECONDAIRES vivent dans `alsoIn?: SecondaryRef[]` (`schemas/grammaire/valeurs.ts`).
 * Aucun futur lecteur ne doit inliner `alsoIn` — passer par `allLocations`/`sourceBooks`.
 */
import type { SourceRef, SecondaryRef } from './grammaire/valeurs';

/** Toute entrée porteuse d'une ancre + emplacements secondaires optionnels. */
export interface SourceLocated {
  source: SourceRef;
  alsoIn?: SecondaryRef[];
}

/** Tous les emplacements d'une entrée — l'ancre EN PREMIER, puis les secondaires dans l'ordre
 *  authoré. `refs[0]` reste l'ancre par CONSTRUCTION (champ nommé source), jamais par convention
 *  positionnelle côté donnée. */
export function allLocations(entry: SourceLocated): SourceRef[] {
  return entry.alsoIn && entry.alsoIn.length > 0 ? [entry.source, ...entry.alsoIn] : [entry.source];
}

/** Ids de livres (`books.json`) portant l'entrée, ancre + secondaires, dédupliqués en préservant
 *  l'ordre d'apparition. */
export function sourceBooks(entry: SourceLocated): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of allLocations(entry)) {
    if (!seen.has(ref.book)) {
      seen.add(ref.book);
      out.push(ref.book);
    }
  }
  return out;
}
