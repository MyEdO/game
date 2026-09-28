/**
 * Génération de noms de personnage — pur, RNG injecté. Pools : `src/data/names.json` (`NamePool`).
 * Nain : patronyme parent + suffixe (LDB 05 l.621-633, `NamePool.lastNameSuffixes`).
 */
import { names as POOLS, type NamePool } from '../data';
import type { Sexe, RaceKey } from '../data/schemas/grammaire/valeurs';
import type { RNG } from './dice';

/**
 * Pool de la banque ← `species.refChar` (`RaceKey`, #313) : le document de banque porte CE même id
 * (#1467 L1b V-FLIP-RECORD), la résolution est directe — aucune conversion
 * (cf. `names-species-keyspaces.test.ts`). Recherche SUR LE TABLEAU VIVANT à chaque appel : une Map
 * mémoïsée au chargement figerait un instantané et rendrait l'édition au Codex invisible en jeu.
 */
function poolOf(refChar: RaceKey): NamePool | null {
  return POOLS.find((n) => n.id === refChar) ?? null;
}

const pick = <T>(arr: T[], rng: RNG): T => arr[rng.int(0, arr.length - 1)];

/**
 * « Prénom Nom » aléatoire pour l'espèce et le sexe — null si l'espèce n'a pas de pool.
 * `refChar` = `RaceKey` porté par `species.refChar` (l'appelant a l'objet species).
 */
export function generateName(refChar: RaceKey, sex: Sexe, rng: RNG): string | null {
  const pool = poolOf(refChar);
  if (!pool) return null;
  const first = pick(sex === 'F' ? pool.femaleFirstNames : pool.maleFirstNames, rng);
  const suffixes = pool.lastNameSuffixes?.[sex];
  if (!pool.lastNames.length && suffixes?.length) {
    // Nain : patronyme « parent + suffixe sexué » (LDB 05 l.627-633, donnée). Parent mono-mot (lisibilité).
    const parents = [...pool.maleFirstNames, ...pool.femaleFirstNames].filter((p) => !p.includes(' '));
    return `${first} ${pick(parents, rng)}${pick(suffixes, rng)}`;
  }
  return `${first} ${pick(pool.lastNames, rng)}`;
}
