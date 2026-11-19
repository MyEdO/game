/**
 * Résolution de VARIANTES réglées (#563/#564 — doctrine user 2026-07-17 : « jamais 2 talents
 * différents », les règles optionnelles activent une variante de la MÊME entrée). `when.rule`
 * référence LE registre `OPTIONAL_RULES` (`src/engine/policy.ts`), lu par `rule(id)` — jamais un
 * booléen/flag parallèle (garde #564, `scripts/guards`).
 */
import type { z } from 'zod';
import type { variantWhenSchema } from '../data/schemas/grammaire/valeurs';
import { rule } from './policy';

/** Ce que toute variante réglée porte, quel que soit son dataset : sa garde (`variantWhenSchema`). */
export type VarianteReglee = { when: z.output<typeof variantWhenSchema> };

/** Première variante dont la règle `when.rule` est à l'état `when.equals` (défaut `true` — règle
 *  `kind:'flag'` activée). `undefined` si aucune variante n'est active (forme LDB de base). Deux
 *  variantes simultanément actives sur une même entrée sont un défaut de DONNÉE que ce `find` ne peut
 *  pas départager — gardé par `src/data/variants-integrity.test.ts`. */
export function activeVariant<V extends VarianteReglee>(variants: readonly V[] | undefined): V | undefined {
  if (!variants) return undefined;
  return variants.find((v) => rule(v.when.rule) === (v.when.equals ?? true));
}

/**
 * Entrée EFFECTIVE sous les règles optionnelles actives — PRIMITIVE UNIQUE de lecture d'une entrée à
 * variantes (mécanique comme affichage : aucun consommateur ne réimplémente la fusion). La variante
 * active est appliquée en REPLACE par champ DÉCLARÉ, au premier niveau : un champ absent de la
 * variante est hérité de l'entrée de base, un champ présent remplace celui de base EN ENTIER (le livre
 * republie l'entrée entière — aucune fusion profonde implicite). `when` n'apparaît jamais dans le
 * résultat. Sans variante active, l'entrée est renvoyée TELLE QUELLE (forme de base, byte-pour-byte).
 */
type AVariantes = { variants?: readonly VarianteReglee[] };
export function effectiveEntry<T extends AVariantes>(entry: T): T;
export function effectiveEntry<T extends AVariantes>(entry: T | undefined): T | undefined;
export function effectiveEntry<T extends AVariantes>(entry: T | undefined): T | undefined {
  if (!entry) return entry;
  const v = activeVariant(entry.variants);
  if (!v) return entry;
  const { when: _when, ...patch } = v;
  return { ...entry, ...patch };
}
