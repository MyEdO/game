/**
 * FAMILLES MÉCANIQUES (`mecaniqueDe`, `grammaire/mecanique.ts`) — le régime d'un champ à choix est un
 * paramètre de la grammaire, et sa PORTÉE est la racine du porteur (#1473, train 2a ; #1897, verdict
 * 2e-f1 : « `choix` s'ouvre sur opt-in, en une ligne, aux seuls porteurs d'EMPLACEMENT »).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { CHAMPS_A_CHOIX, CHAMPS_RESERVES, gameOpSchema, mecaniqueDe, OPS_NON_TYPEES } from './mecanique';
import { noeudDuChamp } from '../validate';

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

const plancher = { op: 'charMod', char: 'intelligence', mod: -40, min: 10 };
const sansPlancher = { op: 'charMod', char: 'intelligence', mod: -40 };
const effetPortant = (op: unknown) => [{ trigger: 'onDayStart', on: 'self', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [op] } } }];

describe('champ RÉSERVÉ au porteur — `charMod.min`, plancher de mutation (EDO 11 l.190 ; #1853)', () => {
  it('les champs réservés sont DÉRIVÉS des déclarations d’op ; `charMod` est typé', () => {
    expect([...CHAMPS_RESERVES]).toEqual(['charMod.min']);
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
    expect(noeud('stars.json', 'ops').safeParse([plancher]).success).toBe(false);
    expect(noeud('mutations.json', 'effects').safeParse(effetPortant(sansPlancher)).success).toBe(true);
    expect(noeud('mutations.json', 'effects').safeParse(effetPortant(plancher)).success).toBe(false);
  });

  it('un régime inconnu est nommé', () => {
    expect(() => mecaniqueDe({ 'charMod.max': 'admis' } as never)).toThrow(/charMod\.max/);
  });
});
