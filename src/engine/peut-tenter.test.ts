import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { partyAssisted, partyBest, bestSkilledOption } from './skills';
import { crewRoleValue } from './crewMorale';
import { findCrewRoleById } from '../data';

/** Qui peut TENTER un Test actif (LDB 09 l.30, LDB 16 l.113) : la porte d'élection `partyBest` et le
 *  Soutien `soutienDetail` la lisent, ainsi que les consommateurs qui passent un groupe d'UN seul acteur. */
function hero(id: string, soc: number, opts: { ragot?: number; evaluation?: number; voile?: number; inconscient?: boolean } = {}): Combatant {
  const skills = [
    ...(opts.ragot != null ? [{ id: 'ragot', characteristic: 'sociabilite', advances: opts.ragot }] : []),
    ...(opts.evaluation != null ? [{ id: 'evaluation', characteristic: 'intelligence', advances: opts.evaluation }] : []),
    ...(opts.voile != null ? [{ id: 'voile', characteristic: 'agilite', advances: opts.voile }] : []),
  ];
  return {
    id, label: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: soc, 'force-mentale': 30, sociabilite: soc },
    wounds: { current: 10, max: 10 }, advantage: 0, movement: 4,
    conditions: opts.inconscient ? [{ id: 'inconscient', value: 1 }] : [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills, talents: [],
  } as unknown as Combatant;
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
    const debout = crewRoleValue(hero('m', 30, { voile: 20 }), mousse);
    expect(debout.value).toBeGreaterThan(0);
    expect(debout.refus).toBeUndefined();
    const ko = crewRoleValue(hero('m', 30, { voile: 20, inconscient: true }), mousse);
    expect(ko.value).toBeUndefined();
    expect(ko.refus).toBe('m ne peut pas tenter le Test de Voile.');
  });

  it('bestSkilledOption (skills) : un acteur Inconscient n\'obtient aucune option tentable', () => {
    const opts = [{ id: 'a', skills: [{ id: 'ragot' }] }];
    expect(bestSkilledOption(hero('h', 40, { ragot: 5 }), opts)?.value).toBeGreaterThan(0);
    expect(bestSkilledOption(hero('h', 40, { ragot: 5, inconscient: true }), opts)?.value).toBe(-Infinity);
  });
});
