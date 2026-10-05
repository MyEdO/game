#!/usr/bin/env -S npx tsx
/**
 * OUTIL DE DÉS de la table simulée (`.claude/workflows/table-simulee.js`, #1993) : le MJ agent tire
 * chaque jet par le MOTEUR, jamais « de tête ».
 *
 *   npx tsx scripts/ops/table-des.mts simple --seed <graine> --tirage <n> --valeur <v> --difficulte <id>
 *   npx tsx scripts/ops/table-des.mts oppose --seed <graine> --tirage <n> --valeur <v> --difficulte <id>
 *                                            --valeur-oppose <v> --difficulte-oppose <id>
 *
 * `valeur` = Compétence ou Caractéristique DÉJÀ calculée, posée aussi comme valeur nue de l'opposé
 * (`LDB 09 l.17`, `LDB 12 l.160`) ; elle peut atteindre 100 ou plus (`LDB 12 l.75`) : la cible
 * (valeur + Difficulté) est calée par la policy du moteur, écart rendu dans `clamped`.
 * `difficulte` = id de `DIFFICULTY_LADDER`.
 * L'aléa d'un `(seed, tirage)` est `makeRNG(hashSeed(…))` : même couple, même jet. Le calcul est
 * celui de `rollTest` / `opposedTest` (`src/engine/tests.ts`), rendu tel quel en JSON sur stdout.
 * Entrée invalide : `{ "erreur": … }` sur stderr, code de sortie 2.
 */
import { parseArgs } from 'node:util';
import { hashSeed, makeRNG, type RNG } from '../../src/engine/dice';
import { DIFFICULTY_LADDER, opposedTest, rollTest } from '../../src/engine/tests';
import type { Difficulty } from '../../src/engine/types';

/** L'aléa d'UN tirage : dérivé du seul couple `(seed, tirage)`, indépendant des tirages voisins. */
export function rngDuTirage(seed: string, tirage: number): RNG {
  return makeRNG(hashSeed(`${seed}#${tirage}`));
}

class EntreeInvalide extends Error {}

const difficulte = (nom: string, id: string | undefined): Difficulty => {
  if (!id || !(DIFFICULTY_LADDER as string[]).includes(id)) {
    throw new EntreeInvalide(`--${nom} « ${id ?? ''} » inconnue — ids : ${DIFFICULTY_LADDER.join(', ')}`);
  }
  return id as Difficulty;
};

/** Entier DÉCIMAL ≥ 0 écrit en chiffres seuls : `0x10`, `1e3`, `4.5` ou ` 7` sont refusés. */
const entier = (nom: string, brut: string | undefined): number => {
  const n = Number(brut);
  if (brut === undefined || !/^\d+$/.test(brut) || !Number.isSafeInteger(n)) {
    throw new EntreeInvalide(`--${nom} « ${brut ?? ''} » invalide — entier décimal ≥ 0 attendu`);
  }
  return n;
};

/** Résout la ligne de commande (sans le binaire ni le script). PUR hors de l'aléa qu'il dérive. */
export function tirer(argv: string[]): object {
  let lu;
  try {
    lu = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        seed: { type: 'string' }, tirage: { type: 'string' },
        valeur: { type: 'string' }, difficulte: { type: 'string' },
        'valeur-oppose': { type: 'string' }, 'difficulte-oppose': { type: 'string' },
      },
    });
  } catch (e) {
    throw new EntreeInvalide((e as Error).message);
  }
  const { values: v, positionals } = lu;
  const [test, ...reste] = positionals;
  if ((test !== 'simple' && test !== 'oppose') || reste.length) {
    throw new EntreeInvalide(`test « ${positionals.join(' ')} » — « simple » ou « oppose » attendu`);
  }
  if (!v.seed) throw new EntreeInvalide('--seed manquant');
  const seed = v.seed;
  const tirage = entier('tirage', v.tirage);
  const valeur = entier('valeur', v.valeur);
  const diff = difficulte('difficulte', v.difficulte);
  const rng = rngDuTirage(seed, tirage);
  if (test === 'simple') {
    if (v['valeur-oppose'] !== undefined || v['difficulte-oppose'] !== undefined) {
      throw new EntreeInvalide('--valeur-oppose / --difficulte-oppose réservés au test « oppose »');
    }
    return { test, seed, tirage, valeur, difficulte: diff, resultat: rollTest(valeur, diff, rng) };
  }
  const valeurOppose = entier('valeur-oppose', v['valeur-oppose']);
  const diffOppose = difficulte('difficulte-oppose', v['difficulte-oppose']);
  return {
    test, seed, tirage, valeur, difficulte: diff, valeurOppose, difficulteOppose: diffOppose,
    resultat: opposedTest(valeur, valeurOppose, rng, diff, diffOppose, { attacker: valeur, defender: valeurOppose }),
  };
}

if (import.meta.main) {
  try {
    process.stdout.write(`${JSON.stringify(tirer(process.argv.slice(2)))}\n`);
  } catch (e) {
    if (!(e instanceof EntreeInvalide)) throw e;
    process.stderr.write(`${JSON.stringify({ erreur: e.message })}\n`);
    process.exitCode = 2;
  }
}
