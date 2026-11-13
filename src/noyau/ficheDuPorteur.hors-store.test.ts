/**
 * L'EN-TÊTE DE LA FICHE (#3975) : `enTeteDuPorteur` a le domaine de `ficheDuPorteur` (le porteur par `porteurParId`,
 * `null` sans lui ou pour une coque) et en rend les mêmes champs.
 */
import { describe, it, expect } from 'vitest';
import { enTeteDuPorteur, ficheDuPorteur, type Jeu } from './index';
import { nouvelEntete, ouvrirLaPartie } from '../hote/partie';

/** L'état du scénario `id` à son lancement. */
function auLancement<T>(id: string, faire: (etat: Jeu) => T): T {
  const { partie } = ouvrirLaPartie(nouvelEntete(id, { graine: 7 }), () => {});
  try {
    return faire(partie.etat());
  } finally {
    partie.fermer();
  }
}

/** Pour chaque porteur de `etat` (la bataille, le groupe, et un id sans porteur), l'en-tête et les mêmes champs de la fiche. */
const comparaisons = (etat: Jeu) =>
  [...new Set([...(etat.battle?.combatants ?? []), ...etat.party].map((c) => c.id)), 'sans-porteur'].map((id) => {
    const f = ficheDuPorteur(etat, id);
    return { id, enTete: enTeteDuPorteur(etat, id), fiche: f && { id: f.id, nom: f.nom, blessures: f.blessures, etats: f.etats, bourse: f.bourse } };
  });

describe('l’en-tête de la fiche est celui de la fiche (#3975)', () => {
  it.each([
    ['dome', 'combat : héros et créatures'],
    ['duel-naval', 'combat naval : coques comprises'],
    ['a-bord-de-la-caraque', 'hors combat : le groupe'],
  ])('%s (%s) : mêmes champs, et `null` où la fiche l’est', (scenario) => {
    const lus = auLancement(scenario, comparaisons);
    expect(lus.map(({ id, enTete }) => ({ id, enTete }))).toEqual(lus.map(({ id, fiche }) => ({ id, enTete: fiche })));
    expect(lus.some((l) => l.fiche !== null), `${scenario} : aucun porteur à fiche`).toBe(true);
  });

  it('une coque n’a ni fiche ni en-tête', () => {
    const coques = auLancement('duel-naval', (etat) => (etat.battle?.combatants ?? []).filter((c) => ficheDuPorteur(etat, c.id) === null).map((c) => enTeteDuPorteur(etat, c.id)));
    expect(coques.length, 'duel-naval : aucune coque en bataille').toBeGreaterThan(0);
    expect(coques.every((e) => e === null)).toBe(true);
  });
});
