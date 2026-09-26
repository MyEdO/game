import { describe, it, expect } from 'vitest';
import { targetedTrigger, isPsychImmune } from '../psychology';
import { encounterPsych } from '../encounterPsych';
import { parsePsychTraits } from '../psych/registry';
import { hasTalent } from '../magic';
import { careerTalentAdditions, traitGrantedTalents, effectiveTalents } from '../talentEffects';
import { groupsFor, hiddenGroupsOf } from '../groups';
import { makeRNG, hashSeed } from '../dice';
import { markMutationsAtSpawn } from './dispatch';
import { rollMutation } from '../../data/mutations';
import { statblockToCombatant } from '../../state/spawn';
import creatures from '../../data/creatures.json';
import type { Combatant } from '../types';

/** Câblage du Trait « Marque de Tzeentch » (EDOC 13 l.522-524, #568) — chaque canal RAW prouvé isolément.
 *  PLUS LÉGER que Marque de Khorne (#516) : ni Frénésie ni blocage d'incantation (non RAW pour Tzeentch). */

const bearer = (): Combatant => {
  const traits = [{ id: 'marque-de-tzeentch' }];
  return {
    id: 'bearer', name: 'Porteur', kind: 'enemy',
    traits, talents: [],
    ...parsePsychTraits(traits),
  } as unknown as Combatant;
};

describe('Marque de Tzeentch — câblage (#568)', () => {
  it('Savoir-vivre (Disciples de Tzeentch) : octroyé structurellement par le passif du Trait', () => {
    expect(traitGrantedTalents(bearer())).toEqual([{ id: 'savoir-vivre', spec: 'disciples-de-tzeentch' }]);
  });

  it('Savoir-vivre : POSSESSION effective et REQUÊTABLE — sur la fiche (`effectiveTalents`) et par `hasTalent`', () => {
    const talents = effectiveTalents(bearer());
    expect(talents).toContainEqual({ talentId: 'savoir-vivre', spec: 'disciples-de-tzeentch', times: 1 });
    expect(hasTalent(bearer(), 'Savoir-vivre')).toBe(true);
  });

  it('Animosité (Nurgle) : Cible FIXE dérivée du Trait (capabilities.psychCible)', () => {
    expect(bearer().psychTraits).toEqual([{ type: 'animosite', cible: 'nurgle' }]);
  });

  it('Animosité (Nurgle) : se déclenche au contact d’un disciple de Nurgle visible (targetedTrigger)', () => {
    const nurgleFollower = { id: 'foe', name: 'Disciple', kind: 'hero', groups: ['nurgle'] } as unknown as Combatant;
    const trig = targetedTrigger(bearer(), [nurgleFollower]);
    expect(trig).toEqual({ type: 'animosite', cible: 'nurgle', sourceId: 'foe', indice: undefined });
  });

  it('Groupe « tzeentch » : `capabilities.grantGroups` expose le porteur au ciblage', () => {
    expect(groupsFor({ traits: [{ id: 'marque-de-tzeentch' }] })).toContain('tzeentch');
  });

  it('Réciproque (EDOC 13 l.522-524) : un disciple de Nurgle éprouve Animosité envers le porteur VISIBLE', () => {
    const nurgleFollower = {
      id: 'nurgle-1', name: 'Porte-Peste', kind: 'enemy', groups: [],
      psychTraits: [{ type: 'animosite' as const, cible: 'tzeentch' }],
    } as unknown as Combatant;
    const marked = { id: 'tzeentch-1', name: 'Porteur', kind: 'hero', groups: groupsFor({ traits: [{ id: 'marque-de-tzeentch' }] }), traits: [{ id: 'marque-de-tzeentch' }] } as unknown as Combatant;
    const trig = targetedTrigger(nurgleFollower, [marked]);
    expect(trig).toEqual({ type: 'animosite', cible: 'tzeentch', sourceId: 'tzeentch-1', indice: undefined });
  });

  it('Réciproque : COUPÉE si la Marque est dissimulée (`hidden`, tant que la Marque de Tzeentch est visible)', () => {
    const nurgleFollower = {
      id: 'nurgle-1', name: 'Porte-Peste', kind: 'enemy', groups: [],
      psychTraits: [{ type: 'animosite' as const, cible: 'tzeentch' }],
    } as unknown as Combatant;
    const hiddenTraits = [{ id: 'marque-de-tzeentch', hidden: true }];
    const marked = { id: 'tzeentch-1', name: 'Porteur', kind: 'hero', groups: groupsFor({ traits: hiddenTraits }), traits: hiddenTraits } as unknown as Combatant;
    expect(hiddenGroupsOf(marked)).toEqual(['tzeentch']);
    expect(targetedTrigger(nurgleFollower, [marked])).toBeNull();
  });

  it('Réciproque : INERTE chez un disciple de Nurgle immunisé (`isPsychImmune` court-circuite `encounterPsych` avant `targetedTrigger`)', () => {
    const immuneNurgleFollower = {
      id: 'nurgle-1', name: 'Porte-Peste', kind: 'enemy', groups: [], psychImmune: true,
      psychTraits: [{ type: 'animosite' as const, cible: 'tzeentch' }],
    } as unknown as Combatant;
    const marked = { id: 'tzeentch-1', name: 'Porteur', kind: 'hero', groups: groupsFor({ traits: [{ id: 'marque-de-tzeentch' }] }), traits: [{ id: 'marque-de-tzeentch' }] } as unknown as Combatant;
    expect(isPsychImmune(immuneNurgleFollower)).toBe(true);
    expect(encounterPsych(immuneNurgleFollower, [marked])).toBeNull(); // Animosité posée mais jamais testée
  });

  it('Statblocks Nurgle : Animosité (Tzeentch) portée UNIQUEMENT là où elle peut se déclencher — retirée des porteurs d\'Immunité (Psychologie)', () => {
    const nurgleImmune = ['porte-peste-de-nurgle', 'heraut-de-nurgle', 'heraut-exalte-de-nurgle', 'grand-immonde-de-nurgle', 'grand-immonde-exalte-de-nurgle'];
    for (const id of nurgleImmune) {
      const c = (creatures as any[]).find((x) => x.id === id);
      expect(c.traits.some((t: any) => t.id === 'immunite-psychologique')).toBe(true);
      expect(c.traits.some((t: any) => t.id === 'animosite' && t.arg === 'tzeentch')).toBe(false);
    }
    const hough = (creatures as any[]).find((x) => x.id === 'fr-hough-mournbreath');
    expect(hough.traits.some((t: any) => t.id === 'immunite-psychologique')).toBe(false);
    expect(hough.traits.some((t: any) => t.id === 'animosite' && t.arg === 'tzeentch')).toBe(true);
  });

  it('Les 10 Talents achetables hors-Carrière au tarif normal (grantCareerTalent, étendu aux Traits)', () => {
    expect(careerTalentAdditions(bearer())).toEqual([
      // EDOC 13 l.524 : « Magie des Arcanes (n'importe laquelle) ».
      { id: 'magie-des-arcanes', choix: true },
      { id: 'diction-instinctive' },
      { id: 'harmonisation-aethyrique' },
      { id: 'magie-du-chaos', spec: 'tzeentch' },
      { id: 'mage-de-guerre' },
      { id: 'magie-mineure' },
      { id: 'mains-agiles' },
      { id: 'perception-de-la-magie' },
      { id: 'seconde-vue' },
      { id: 'sorcier' },
    ]);
  });

  it('Ni Frénésie ni blocage d’incantation (PLUS LÉGER que Marque de Khorne — non RAW pour Tzeentch)', () => {
    const traits = [{ id: 'marque-de-tzeentch' }];
    expect(parsePsychTraits(traits).psychTraits).toEqual([{ type: 'animosite', cible: 'nurgle' }]);
  });

  it('Mutations au spawn : ⌈1d10/3⌉ tirages ALTERNÉS mentale→physique sur les tables Tzeentch (EDOC 13 l.522-524)', () => {
    const spec = markMutationsAtSpawn([{ id: 'marque-de-tzeentch' }]);
    expect(spec).toEqual({ countDie: 10, countDivide: 3, first: 'mentale', mentalTable: 'edoc-mental-tzeentch', physTable: 'edoc-phys-tzeentch' });
  });

  it('Tirage DÉTERMINISTE par id (même id → mêmes mutations), count variable selon la graine', () => {
    const spec = markMutationsAtSpawn([{ id: 'marque-de-tzeentch' }])!;
    const draw = (seedId: string) => {
      const rng = makeRNG(hashSeed(`mut:${seedId}`));
      const count = Math.ceil(rng.int(1, spec.countDie) / spec.countDivide);
      const other = spec.first === 'mentale' ? 'physique' : 'mentale';
      const out: { kind: 'mentale' | 'physique'; id: string }[] = [];
      for (let i = 0; i < count; i++) {
        const kind = i % 2 === 0 ? spec.first : other;
        const m = rollMutation(kind === 'mentale' ? spec.mentalTable : spec.physTable, rng);
        out.push({ kind, id: m.id });
      }
      return out;
    };
    const a = draw('same-id');
    const b = draw('same-id');
    expect(a).toEqual(b); // même id -> mêmes mutations
    if (a.length) expect(a[0].kind).toBe('mentale'); // le RAW liste « mentales et physiques » : mentale d'abord
    const c = draw('other-id');
    expect(c).not.toEqual(a); // graine différente -> tirage différent (count et/ou mutations)
  });

  it('Spawn intégral (`statblockToCombatant`) : ⌈d10/3⌉ mutations depuis les tables Tzeentch, alternées mental→phys, déterministe par id', () => {
    const traits = [{ id: 'marque-de-tzeentch' }];
    const c1 = statblockToCombatant({ name: 'Élu', char: {}, traits } as any, 'tzeentch-elu-1', { x: 0, y: 0 });
    expect(c1.mutations?.length).toBeGreaterThan(0);
    expect(c1.mutations![0].kind).toBe('mentale'); // le RAW liste « mentales et physiques » : mentale d'abord
    if (c1.mutations!.length > 1) expect(c1.mutations![1].kind).toBe('physique');
    // Déterminisme : même id -> mêmes mutations.
    const c2 = statblockToCombatant({ name: 'Élu', char: {}, traits } as any, 'tzeentch-elu-1', { x: 0, y: 0 });
    expect(c2.mutations!.map((m) => m.label)).toEqual(c1.mutations!.map((m) => m.label));
  });
});
