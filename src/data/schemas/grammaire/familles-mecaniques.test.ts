/**
 * FAMILLES MÉCANIQUES (`mecaniqueDe`, `grammaire/mecanique.ts`) — le régime d'un champ à choix est un
 * paramètre de la grammaire, et sa PORTÉE est la racine du porteur (train 2a ; #1897, verdict
 * 2e-f1 : « `choix` s'ouvre sur opt-in, en une ligne, aux seuls porteurs d'EMPLACEMENT »).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { CHAMPS_A_CHOIX, CHAMPS_RESERVES, conditionSchema, gameOpSchema, mecaniqueDe, OPS_NON_TYPEES } from './mecanique';
import { noeudDuChamp } from '../validate';
import { rangee as signeAstrologique } from '../defs/stars';

/** Le tableau d'ops du champ `passive` de `talents.json`, tel que son def le déclare. */
const passiveDeTalent = (): z.ZodType => {
  const noeud = noeudDuChamp('talents.json', 'passive') as z.ZodType | undefined;
  if (!noeud) throw new Error('talents.json › passive introuvable');
  return noeud;
};

const carriereAChoix = { op: 'grantCareerSkill', skill: { id: 'art', choix: true } };

describe('familles mécaniques — régime des champs à choix, portée à la racine du porteur', () => {
  it('les champs à choix sont DÉRIVÉS des déclarations d’op', () => {
    expect([...CHAMPS_A_CHOIX].sort()).toEqual(['grantCareerSkill.skill', 'grantCareerTalent.talent', 'grantTalent.talent']);
  });

  it('`grantCareerSkill` à `choix` : REFUSÉ par la famille fermée, ADMIS à la racine de `talents.passive`', () => {
    expect(gameOpSchema.safeParse(carriereAChoix).success).toBe(false);
    expect(passiveDeTalent().safeParse([carriereAChoix]).success).toBe(true);
  });

  it('le même `grantCareerSkill` à `choix` IMBRIQUÉ sous `perRound` dans `talents.passive` est REFUSÉ', () => {
    expect(passiveDeTalent().safeParse([{ op: 'perRound', ops: [carriereAChoix] }]).success).toBe(false);
  });

  it('mémoïsée par la forme canonique : `specSeule` explicite rend la famille fermée', () => {
    expect(mecaniqueDe({ 'grantTalent.talent': 'specSeule' }).gameOp).toBe(gameOpSchema);
    expect(mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' })).toBe(mecaniqueDe({ 'grantTalent.talent': 'specOuChoixFacultatifs' }));
  });
});

/** Le nœud de schéma du champ `champ` de `file`, tel que son def le déclare. */
const noeud = (file: string, champ: string): z.ZodType => {
  const n = noeudDuChamp(file, champ) as z.ZodType | undefined;
  if (!n) throw new Error(`${file} › ${champ} introuvable`);
  return n;
};

const plancher = { op: 'charMod', characteristic: 'intelligence', mod: -40, min: 10 };
const sansPlancher = { op: 'charMod', characteristic: 'intelligence', mod: -40 };
const effetPortant = (op: unknown) => [{ trigger: 'onDayStart', on: 'soi', flow: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [op] } } }];

describe('champ RÉSERVÉ au porteur — `charMod.min`, plancher de mutation (EDO 11 l.190 ; #1853)', () => {
  it('les champs réservés sont DÉRIVÉS des déclarations d’op ; `charMod` est typé', () => {
    expect([...CHAMPS_RESERVES].sort()).toEqual(['charMod.min', 'endPsych.instance', 'grantPsychTrait.durationHours', 'grantPsychTrait.envers', 'grantPsychTrait.resistanceSiAmis']);
    expect(OPS_NON_TYPEES).not.toContain('charMod');
    expect(gameOpSchema.safeParse({ ...sansPlancher, champInvente: 1 }).success).toBe(false);
  });

  it('contrat positif : `min` ADMIS à la racine de `mutations.passive`', () => {
    expect(noeud('mutations.json', 'passive').safeParse([plancher]).success).toBe(true);
  });

  it('test opposé : `min` REFUSÉ par la famille fermée, les talents, les traits, les signes, et les `effects` de mutation', () => {
    expect(gameOpSchema.safeParse(plancher).success).toBe(false);
    expect(gameOpSchema.safeParse(sansPlancher).success).toBe(true);
    expect(noeud('talents.json', 'passive').safeParse([plancher]).success).toBe(false);
    expect(noeud('traits.json', 'passive').safeParse([plancher]).success).toBe(false);
    expect(signeAstrologique.shape.ops.safeParse([plancher]).success).toBe(false);
    expect(noeud('mutations.json', 'effects').safeParse(effetPortant(sansPlancher)).success).toBe(true);
    expect(noeud('mutations.json', 'effects').safeParse(effetPortant(plancher)).success).toBe(false);
  });

  it('un régime inconnu est nommé', () => {
    expect(() => mecaniqueDe({ 'charMod.max': 'admis' } as never)).toThrow(/charMod\.max/);
  });
});

const haine = { op: 'grantPsychTrait', psychType: { id: 'haine' } };
const envers = { ...haine, envers: 'personneChoisie' };
const duree = { ...haine, durationHours: 2 };
const resistance = { skill: { id: 'calme' }, difficulty: 'accessible' };
const effetDeSort = (op: unknown) => ({ kind: 'effet', effet: { type: 'ops', on: 'target', ops: [op] } });

describe('champs RÉSERVÉS aux Sorts — `grantPsychTrait` envers, résistance, durée (VDM 10 l.324-327 ; #1463)', () => {
  it('contrat positif : ADMIS dans les `effects` d’un Sort', () => {
    expect(noeud('spells.json', 'effects').safeParse(effetDeSort({ ...envers, resistanceSiAmis: resistance, durationHours: 2 })).success).toBe(true);
  });

  it('test opposé : REFUSÉS par la famille fermée, les Mutations et les Symptômes', () => {
    for (const op of [envers, duree]) {
      expect(gameOpSchema.safeParse(op).success).toBe(false);
      expect(noeud('mutations.json', 'passive').safeParse([op]).success).toBe(false);
      expect(noeud('symptoms.json', 'passive').safeParse([op]).success).toBe(false);
    }
    expect(noeud('mutations.json', 'passive').safeParse([haine]).success).toBe(true);
    expect(noeud('symptoms.json', 'passive').safeParse([haine]).success).toBe(true);
  });

  it('`envers` exclut une `cible`, exige une variante individuelle ; la résistance exige `envers`', () => {
    const sort = noeud('spells.json', 'effects');
    expect(sort.safeParse(effetDeSort({ ...envers, cible: { id: 'skaven' } })).success).toBe(false);
    expect(sort.safeParse(effetDeSort({ ...envers, psychType: { id: 'frenesie' } })).success).toBe(false);
    expect(sort.safeParse(effetDeSort({ ...haine, resistanceSiAmis: resistance })).success).toBe(false);
  });
});

describe('fin d’une affliction ciblée — `endPsych.instance` et Condition `cibleEnVue` réservées à `psychology.effects` (LDB 21 l.19, l.39, l.48)', () => {
  const finDInstance = { op: 'endPsych', instance: 'courante' };
  const siPlusEnVue = (cond: unknown, op: unknown = { op: 'endPsych', type: { id: 'haine' } }) =>
    [{ trigger: 'onRoundEnd', on: 'soi', flow: { kind: 'si', condition: { kind: 'not', of: cond }, alors: { kind: 'effet', effet: { type: 'ops', on: 'target', ops: [op] } } } }];

  it('contrat positif : ADMISES dans les `effects` d’un Trait psychologique', () => {
    const effets = noeud('psychology.json', 'effects');
    expect(effets.safeParse(siPlusEnVue({ kind: 'cibleEnVue' }, finDInstance)).success).toBe(true);
    expect(effets.safeParse(siPlusEnVue({ kind: 'cibleEnVue', hostiles: true })).success).toBe(true);
  });

  it('test opposé : REFUSÉES par la famille fermée et les `effects` de talent et de trait — elles y seraient fausses en silence', () => {
    expect(gameOpSchema.safeParse(finDInstance).success).toBe(false);
    expect(conditionSchema.safeParse({ kind: 'cibleEnVue' }).success).toBe(false);
    for (const file of ['talents.json', 'traits.json']) {
      expect(noeud(file, 'effects').safeParse(siPlusEnVue({ kind: 'cibleEnVue' })).success).toBe(false);
      expect(noeud(file, 'effects').safeParse(siPlusEnVue({ kind: 'foeInLoS' }, finDInstance)).success).toBe(false);
      expect(noeud(file, 'effects').safeParse(siPlusEnVue({ kind: 'foeInLoS' })).success).toBe(true);
    }
  });

  it('`endPsych` porte EXACTEMENT l’un de `type` et `instance`', () => {
    const effets = noeud('psychology.json', 'effects');
    expect(effets.safeParse(siPlusEnVue({ kind: 'cibleEnVue' }, { ...finDInstance, type: { id: 'haine' } })).success).toBe(false);
    expect(effets.safeParse(siPlusEnVue({ kind: 'cibleEnVue' }, { op: 'endPsych' })).success).toBe(false);
  });
});
