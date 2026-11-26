/**
 * Résolution de VARIANTES réglées (#563/#564 — doctrine user 2026-07-17 : « jamais 2 talents
 * différents », les règles optionnelles activent une variante de la MÊME entrée). `when.rule`
 * référence LE registre `OPTIONAL_RULES` (`src/engine/policy.ts`), lu par `rule(id)` — jamais un
 * booléen/flag parallèle (garde #564, `scripts/guards`). Résolution pure : `src/engine/variantes.ts`.
 */
import { rule } from './policy';
import { entreeEffective, varianteActive, type AVariantes, type VarianteReglee } from './variantes';

/** `varianteActive` sous le registre vivant (`rule`). */
export function activeVariant<V extends VarianteReglee>(variants: readonly V[] | undefined): V | undefined {
  return varianteActive(variants, rule);
}

/** `entreeEffective` sous le registre vivant (`rule`). */
export function effectiveEntry<T extends AVariantes>(entry: T): T;
export function effectiveEntry<T extends AVariantes>(entry: T | undefined): T | undefined;
export function effectiveEntry<T extends AVariantes>(entry: T | undefined): T | undefined {
  return entreeEffective(entry, rule);
}
