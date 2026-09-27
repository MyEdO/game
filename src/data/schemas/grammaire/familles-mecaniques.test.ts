/**
 * FAMILLES MÉCANIQUES (`mecaniqueDe`, `grammaire/mecanique.ts`) — le régime d'un champ à choix est un
 * paramètre de la grammaire, et sa PORTÉE est la racine du porteur (#1473, train 2a ; #1897, verdict
 * 2e-f1 : « `choix` s'ouvre sur opt-in, en une ligne, aux seuls porteurs d'EMPLACEMENT »).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { CHAMPS_A_CHOIX, gameOpSchema, mecaniqueDe } from './mecanique';
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
