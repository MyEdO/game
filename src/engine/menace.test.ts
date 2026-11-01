import { describe, it, expect } from 'vitest';
import { availableResistance, markResistanceUsed, resistanceForcedSL, menaceIds, isMenaceId } from './menace';
import { findTalentById } from '../data';
import { restoreFortune } from './fortune';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/**
 * Talent « Résistance (Menace) » — LDB 10 l.1016-1020 : « Vous pouvez réussir automatiquement le
 * premier Test pour résister à la menace spécifiée […] à chaque séance de jeu. Si le DR requis est
 * important, utilisez votre Bonus d'Endurance comme DR pour le Test. » Moteur pur : disponibilité de
 * la spec, compteur « 1 par séance », DR = BE, remise à zéro par la couture de début de séance.
 */
const hero = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 43, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [],
    talents: [{ talentId: 'resistance', spec: 'maladie', times: 1 }],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 2, fortune: 0,
    ...p,
  }) as Combatant);

describe('Résistance (Menace) — disponibilité de la spec (LDB 10 l.1016-1020)', () => {
  it('spec couvrant la menace → disponible (comparaison stricte par id, plus de pont norm)', () => {
    // La spec du talent ET le tag `menace` sont désormais TOUS DEUX des ids stables ('maladie') —
    // `availableResistance` exige une égalité stricte (Phase 3 : plus de tag FR capitalisé résiduel).
    expect(availableResistance(hero(), 'maladie')).toBe('maladie');
  });

  it('menace non couverte / talent absent / spec absente → indisponible', () => {
    expect(availableResistance(hero(), 'poison')).toBeNull();
    expect(availableResistance(hero({ talents: [] }), 'maladie')).toBeNull();
    expect(availableResistance(hero({ talents: [{ talentId: 'resistance', times: 1 }] as never }), 'maladie')).toBeNull();
  });

  it('deux prises du talent (specs différentes) : chaque spec a SON usage', () => {
    const h = hero({ talents: [
      { talentId: 'resistance', spec: 'maladie', times: 1 },
      { talentId: 'resistance', spec: 'poison', times: 1 },
    ] });
    markResistanceUsed(h, 'maladie');
    expect(availableResistance(h, 'maladie')).toBeNull(); // consommée
    expect(availableResistance(h, 'poison')).toBe('poison'); // l'autre spec reste
  });

  it('« à chaque séance de jeu » : consommé cette séance → indisponible ; la couture de début de séance ré-arme', () => {
    const h = hero();
    markResistanceUsed(h, 'maladie');
    expect(availableResistance(h, 'maladie')).toBeNull();
    const [fresh] = restoreFortune([h]); // couture UNIQUE : Chance (LDB 17 l.41) + compteurs de séance
    expect(fresh.resistanceUsed).toBeUndefined();
    expect(availableResistance(fresh, 'maladie')).toBe('maladie');
    expect(fresh.fortune).toBe(2); // la Chance est bien restaurée par la MÊME couture
  });

  it('DR de l’auto-succès = Bonus d’Endurance (« utilisez votre Bonus d’Endurance comme DR »)', () => {
    expect(resistanceForcedSL(hero())).toBe(4); // E 43 → BE 4
  });

  it('les Menaces authorées SONT les specs du talent, lues au catalogue (source unique, liste OUVERTE — #1346)', () => {
    const specs = (findTalentById('resistance')?.specs ?? []).map((s) => s.id);
    expect(menaceIds()).toEqual(specs);
    expect(specs.length).toBeGreaterThan(0); // le corpus mesuré n'est pas vide
    expect(isMenaceId('maladie')).toBe(true);
    expect(isMenaceId('Maladie')).toBe(false); // id STABLE : la casse du libellé n'est pas un id
    expect(isMenaceId('exposition')).toBe(false); // hors catalogue
  });
});
