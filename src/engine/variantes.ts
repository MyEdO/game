/**
 * Résolution PURE des VARIANTES réglées (#563/#564, #5069) : la valeur de chaque règle se lit par la lecture `lire`
 * que l'appelant passe ; `src/engine/variants.ts` la compose sur le registre vivant (`rule`).
 */
import type { z } from 'zod';
import type { variantWhenSchema } from '../data/schemas/grammaire/valeurs';
import type { RegleOptionnelleId, RuleValue } from './policy';

/** La valeur d'une règle optionnelle, sous un jeu de règles. */
export type LectureDeRegle = (id: RegleOptionnelleId) => RuleValue;

/** Ce que toute variante réglée porte, quel que soit son dataset : sa garde (`variantWhenSchema`). */
export type VarianteReglee = { when: z.output<typeof variantWhenSchema> };

/** Première variante dont la règle `when.rule` est à l'état `when.equals` (défaut `true` — règle
 *  `kind:'flag'` activée) sous `lire`. `undefined` si aucune variante n'est active (forme LDB de base). Deux
 *  variantes simultanément actives sur une même entrée sont un défaut de DONNÉE que ce `find` ne peut
 *  pas départager — gardé par `src/data/variants-integrity.test.ts`. */
export function varianteActive<V extends VarianteReglee>(variants: readonly V[] | undefined, lire: LectureDeRegle): V | undefined {
  if (!variants) return undefined;
  return variants.find((v) => lire(v.when.rule) === (v.when.equals ?? true));
}

/**
 * Entrée EFFECTIVE sous `lire` — PRIMITIVE UNIQUE de lecture d'une entrée à variantes (mécanique comme affichage :
 * aucun consommateur ne réimplémente la fusion). La variante active est appliquée en REPLACE par champ DÉCLARÉ, au
 * premier niveau : un champ absent de la variante est hérité de l'entrée de base, un champ présent remplace celui de
 * base EN ENTIER (le livre republie l'entrée entière — aucune fusion profonde implicite). `when` n'apparaît jamais
 * dans le résultat. Sans variante active, l'entrée est renvoyée TELLE QUELLE (forme de base, byte-pour-byte).
 */
export type AVariantes = { variants?: readonly VarianteReglee[] };
export function entreeEffective<T extends AVariantes>(entry: T, lire: LectureDeRegle): T;
export function entreeEffective<T extends AVariantes>(entry: T | undefined, lire: LectureDeRegle): T | undefined;
export function entreeEffective<T extends AVariantes>(entry: T | undefined, lire: LectureDeRegle): T | undefined {
  if (!entry) return entry;
  const v = varianteActive(entry.variants, lire);
  if (!v) return entry;
  const { when: _when, ...patch } = v;
  return { ...entry, ...patch };
}
