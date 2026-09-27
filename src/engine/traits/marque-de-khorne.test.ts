import { describe, it, expect } from 'vitest';
import { isFrenzyCapable, targetedTrigger } from '../psychology';
import { parsePsychTraits } from '../psych/registry';
import { castBlockedBy, hasTalent } from '../magic';
import { careerTalentAdditions, traitGrantedTalents, effectiveTalents } from '../talentEffects';
import { groupsFor, hiddenGroupsOf } from '../groups';
import type { Combatant } from '../types';

/** Câblage du Trait « Marque de Khorne » (MDG 07 l.250-252, #516) — chaque canal RAW prouvé isolément.
 *  `psychTraits` est ici dérivé EXPLICITEMENT (`parsePsychTraits`, la même dérivation que `spawn.ts` au
 *  spawn d'une créature) — `effectivePsychTraits` ne fait que LIRE le champ déjà posé. */

const bearer = (): Combatant => {
  const traits = [{ id: 'marque-de-khorne' }];
  return {
    id: 'bearer', name: 'Porteur', kind: 'enemy',
    traits, talents: [],
    ...parsePsychTraits(traits),
  } as unknown as Combatant;
};

describe('Marque de Khorne — câblage (#516)', () => {
  it('Frénésie : le porteur peut entrer en Frénésie (capabilities.frenzyCapable, même canal que le Trait « Frénésie »)', () => {
    expect(isFrenzyCapable(bearer())).toBe(true);
  });

  it('Savoir-vivre (Suivants de Khorne) : octroyé structurellement par le passif du Trait', () => {
    expect(traitGrantedTalents(bearer())).toEqual([{ id: 'savoir-vivre', spec: 'suivants-de-khorne' }]);
  });

  it('Savoir-vivre : POSSESSION effective et REQUÊTABLE (#516, réfutation 1) — sur la fiche (`effectiveTalents`) et par `hasTalent`', () => {
    const talents = effectiveTalents(bearer());
    expect(talents).toContainEqual({ talentId: 'savoir-vivre', spec: 'suivants-de-khorne', times: 1 });
    expect(hasTalent(bearer(), 'savoir-vivre')).toBe(true);
  });

  it('Savoir-vivre : pas de double-comptage si le porteur possède AUSSI le talent en PROPRE (#516)', () => {
    const withOwn = { ...bearer(), talents: [{ talentId: 'savoir-vivre', spec: 'suivants-de-khorne', times: 2 }] } as Combatant;
    const talents = effectiveTalents(withOwn);
    expect(talents.filter((t) => t.talentId === 'savoir-vivre')).toHaveLength(1);
    expect(talents.find((t) => t.talentId === 'savoir-vivre')!.times).toBe(2); // l'entrée STRUCTURELLE (times réel) prime
  });

  it('Animosité (Slaanesh) : Cible FIXE dérivée du Trait (capabilities.psychCible), pas d’instance à authorer', () => {
    expect(bearer().psychTraits).toEqual([{ type: 'animosite', cible: 'slaanesh' }]);
  });

  it('Animosité (Slaanesh) : se déclenche au contact d’un suivant de Slaanesh visible (targetedTrigger)', () => {
    const slaaneshFollower = { id: 'foe', name: 'Suivant', kind: 'hero', groups: ['slaanesh'] } as unknown as Combatant;
    const trig = targetedTrigger(bearer(), [slaaneshFollower]);
    expect(trig).toEqual({ type: 'animosite', cible: 'slaanesh', sourceId: 'foe', indice: undefined });
  });

  it('Interdits Langue (Magick)/Focalisation : bloqués en PERMANENCE (jamais purgés)', () => {
    expect(castBlockedBy(bearer(), 'langue')).toBe('Marque de Khorne');
    expect(castBlockedBy(bearer(), 'focalisation')).toBe('Marque de Khorne');
    expect(castBlockedBy(bearer(), 'priere')).toBeNull(); // scope RAW : Langue/Focalisation seules
  });

  // Exemption dissipation (MDG 07 l.250) : STRUCTURELLE — `battleDispelSpell`/`oocDispelSpell` ne
  // consultent jamais `castBlockedBy` (magic.ts l.100-102) ; rien à poser en donnée, rien à tester ici.

  it('Groupe « khorne » : `capabilities.grantGroups` expose le porteur au ciblage (#516, réfutation 2a)', () => {
    expect(groupsFor({ traits: [{ id: 'marque-de-khorne' }] })).toContain('khorne');
  });

  it('Réciproque (MDG 07 l.250) : un suivant de Slaanesh éprouve Animosité envers le porteur VISIBLE (#516, réfutation 2b/2c)', () => {
    // Statbloc Slaanesh (Démonette, ouvertement suivante) portant l'Animosité réciproque en donnée.
    const slaaneshFollower = {
      id: 'slaanesh-1', name: 'Démonette', kind: 'enemy', groups: [],
      psychTraits: [{ type: 'animosite' as const, cible: 'khorne' }],
    } as unknown as Combatant;
    const marked = { id: 'khorne-1', name: 'Porteur', kind: 'hero', groups: groupsFor({ traits: [{ id: 'marque-de-khorne' }] }), traits: [{ id: 'marque-de-khorne' }] } as unknown as Combatant;
    const trig = targetedTrigger(slaaneshFollower, [marked]);
    expect(trig).toEqual({ type: 'animosite', cible: 'khorne', sourceId: 'khorne-1', indice: undefined });
  });

  it('Réciproque : COUPÉE si la Marque est dissimulée (`hidden`, arbitrage maison MDG 07 l.250)', () => {
    const slaaneshFollower = {
      id: 'slaanesh-1', name: 'Démonette', kind: 'enemy', groups: [],
      psychTraits: [{ type: 'animosite' as const, cible: 'khorne' }],
    } as unknown as Combatant;
    const hiddenTraits = [{ id: 'marque-de-khorne', hidden: true }];
    const marked = { id: 'khorne-1', name: 'Porteur', kind: 'hero', groups: groupsFor({ traits: hiddenTraits }), traits: hiddenTraits } as unknown as Combatant;
    expect(hiddenGroupsOf(marked)).toEqual(['khorne']);
    expect(targetedTrigger(slaaneshFollower, [marked])).toBeNull();
  });

  it('Les 10 Talents achetables hors-Carrière au tarif normal (grantCareerTalent, étendu aux Traits)', () => {
    expect(careerTalentAdditions(bearer())).toEqual([
      { id: 'assaut-feroce', spec: undefined },
      { id: 'charge-berserk', spec: undefined },
      { id: 'combat-instinctif', spec: undefined },
      { id: 'coup-puissant', spec: undefined },
      { id: 'determine', spec: undefined },
      { id: 'endurci', spec: undefined },
      { id: 'guerrier-ne', spec: undefined },
      { id: 'resistance', spec: 'magie' },
      { id: 'resistance-a-la-magie', spec: undefined },
      { id: 'vigilance', spec: undefined },
    ]);
  });
});
