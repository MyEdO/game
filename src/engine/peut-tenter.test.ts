import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { partyAssisted, partyBest, bestSkilledOption, peutTenter } from './skills';
import { crewRoleValue } from './crewMorale';
import { findCrewRoleById } from '../data';
import { propulsionDuNavire } from './shipBuild';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/** Qui peut TENTER un Test actif (LDB 09 l.30, LDB 16 l.113) : la porte d'élection `partyBest` et le
 *  Soutien `soutienDetail` la lisent, ainsi que les consommateurs qui passent un groupe d'UN seul acteur. */
function hero(id: string, soc: number, opts: { ragot?: number; evaluation?: number; voile?: number; inconscient?: boolean } = {}): Combatant {
  const skills = [
    ...(opts.ragot != null ? [{ id: 'ragot', characteristic: 'sociabilite', advances: opts.ragot }] : []),
    ...(opts.evaluation != null ? [{ id: 'evaluation', characteristic: 'intelligence', advances: opts.evaluation }] : []),
    ...(opts.voile != null ? [{ id: 'voile', characteristic: 'agilite', advances: opts.voile }] : []),
  ];
  return blessuresSurLeProfil({
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: soc, 'force-mentale': 30, sociabilite: soc },
    wounds: blessuresDeBase(10), advantage: 0, movement: 4,
    conditions: opts.inconscient ? [{ id: 'inconscient', value: 1 }] : [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills, talents: [],
  }) as unknown as Combatant;
}

describe('peutTenter — l\'élection du meneur et le Soutien', () => {
  it('meneur Inconscient : le Test est mené par le suivant, et l\'Inconscient ne le soutient pas (LDB 16 l.113)', () => {
    const ko = hero('ko', 60, { ragot: 10, inconscient: true });
    const second = hero('second', 45, { ragot: 5 });
    const tiers = hero('tiers', 30, { ragot: 5 });
    const r = partyAssisted([ko, second, tiers], 'ragot');
    expect(r?.actor.id).toBe('second');
    expect(r?.support.ids).toEqual(['tiers']);
  });

  it('Compétence Avancée sans Augmentation : personne ne la tente (LDB 09 l.30)', () => {
    const fort = hero('fort', 70, { evaluation: 0 });
    const forme = hero('forme', 30, { evaluation: 5 });
    expect(partyBest([fort], 'evaluation')).toBeNull();
    expect(partyBest([fort, forme], 'evaluation')?.actor.id).toBe('forme');
  });
});

describe('peutTenter — consommateurs sur un groupe d\'UN seul acteur', () => {
  it('crewRoleValue (crewMorale) : un marin Inconscient à son poste ne fournit aucune valeur, il porte son refus nommé', () => {
    const mousse = findCrewRoleById('mousse')!;
    const debout = crewRoleValue(hero('m', 30, { voile: 20 }), mousse, NAVIGATION);
    expect(debout.value).toBeGreaterThan(0);
    expect(debout.refus).toBeUndefined();
    const ko = crewRoleValue(hero('m', 30, { voile: 20, inconscient: true }), mousse, NAVIGATION);
    expect(ko.value).toBeUndefined();
    expect(ko.refus).toBe('m ne peut pas tenter le Test de Voile (Cogue).');
  });

  it('bestSkilledOption (skills) : un acteur Inconscient n\'obtient aucune option tentable', () => {
    const opts = [{ id: 'a', skills: [{ id: 'ragot' }] }];
    expect(bestSkilledOption(hero('h', 40, { ragot: 5 }), opts)?.value).toBeGreaterThan(0);
    expect(bestSkilledOption(hero('h', 40, { ragot: 5, inconscient: true }), opts)).toBeNull();
  });
});

describe('peutTenter — Compétence groupée aux Spécialisations sœurs de Base (LDB 09 l.571)', () => {
  const avec = (h: Combatant, id: string, spec: string, advances: number): Combatant =>
    ({ ...h, skills: [...h.skills, { id, spec, characteristic: 'agilite', advances }] }) as Combatant;

  it('Voile (Caravelle) augmentée : Voile (Cogue) se tente, de Base — Caractéristique seule, sans les Augmentations de la sœur', () => {
    const marin = avec(hero('marin', 30), 'voile', 'caravelle', 15);
    expect(peutTenter(marin, 'voile', 'cogue')).toBe(true);
    expect(partyBest([marin], 'voile', undefined, undefined, 'cogue')).toEqual({ actor: marin, value: 30 });
    expect(partyBest([marin], 'voile', undefined, undefined, 'caravelle')?.value).toBe(45);
  });

  it('sans aucune Spécialisation de Voile augmentée, aucune ne se tente', () => {
    expect(peutTenter(hero('terrien', 30), 'voile', 'cogue')).toBe(false);
    expect(peutTenter(avec(hero('novice', 30), 'voile', 'caravelle', 0), 'voile', 'cogue')).toBe(false);
  });

  it('une Groupée Avancée SANS la clause garde ses Spécialisations étanches : Langue (Bretonnien) ne rend pas Langue (Bataille) tentable', () => {
    const polyglotte = avec(hero('polyglotte', 30), 'langue', 'bretonnien', 10);
    expect(peutTenter(polyglotte, 'langue', 'bretonnien')).toBe(true);
    expect(peutTenter(polyglotte, 'langue', 'bataille')).toBe(false);
  });
});
