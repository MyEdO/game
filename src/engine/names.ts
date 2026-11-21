/**
 * Génération de noms de personnage — pur, RNG injecté. Pools : `src/data/names.json` (`NamePool`).
 * LDB 05 l.621-633 ; NADJ 15 l.55-72 ; ADE II 02 l.325-334
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
 * Nom aléatoire pour l'espèce et le sexe — null si l'espèce n'a pas de banque.
 * `refChar` = `RaceKey` porté par `species.refChar` (l'appelant a l'objet species).
 */
export function generateName(refChar: RaceKey, sex: Sexe, rng: RNG, style?: 'humain'): string | null {
  const pool = poolOf(refChar === 'ogre' && style === 'humain' ? 'humain' : refChar);
  if (!pool) return null;
  if (pool.firstNamePrefixes && pool.firstNameSuffixes) {
    return `${pick(pool.firstNamePrefixes, rng)}${pick(pool.firstNameSuffixes, rng)}`;
  }
  const first = pick(sex === 'F' ? pool.femaleFirstNames : pool.maleFirstNames, rng);
  const suffixes = pool.lastNameSuffixes?.[sex];
  if (!pool.lastNames.length && suffixes?.length) {
    // LDB 05 l.627-633
    const parents = [...pool.maleFirstNames, ...pool.femaleFirstNames].filter((p) => !p.includes(' '));
    return `${first} ${pick(parents, rng)}${pick(suffixes, rng)}`;
  }
  return `${first} ${pick(pool.lastNames, rng)}`;
}
