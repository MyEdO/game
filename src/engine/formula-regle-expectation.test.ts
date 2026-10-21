/**
 * Terme `{rule}` d'une `Formula` : il est PUR et DÉTERMINISTE (une lecture du registre des règles
 * optionnelles, aucun dé), donc il se SCORE comme il se RÉSOUT. Les deux lecteurs du vocabulaire
 * doivent rendre la MÊME valeur — `resolveFormula` (runtime) et `formulaExpectation` (planning IA,
 * `engine/ops.ts`), sans quoi une magnitude authorée en règle vaudrait 0 au scoring et l'IA
 * ignorerait un effet qu'elle applique ensuite pour de bon.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { resolveFormula, formulaExpectation, type Formula } from './ops';
import { rule, setRule, resetRule } from './policy';
import type { Combatant } from './types';
import { desDuTest } from './dice.testkit';

/** Référent MINIMAL : aucune branche de `{rule}` ne lit le porteur (ni carac, ni dé). */
const ref = {} as unknown as Combatant;

/** Règle `param` NUMÉRIQUE réellement authorée (LDB 20 l.170, `reglesOptionnelles.json`). */
const REGLE = 'maladie-conscience-determination-minutes';

afterEach(() => { resetRule(REGLE); });

describe('Formula `{rule}` — le SCORING lit la même valeur que la RÉSOLUTION', () => {
  it('la valeur de la règle, à l’identique dans les deux lecteurs', () => {
    const attendu = rule(REGLE);
    expect(typeof attendu, 'la règle témoin n’est plus numérique').toBe('number');
    expect(resolveFormula({ rule: REGLE }, ref, desDuTest)).toBe(attendu);
    expect(formulaExpectation({ rule: REGLE }, ref)).toBe(attendu);
  });

  it('une SURCHARGE de la règle bouge les deux ensemble (jamais une constante figée)', () => {
    setRule(REGLE, 17);
    expect(resolveFormula({ rule: REGLE }, ref, desDuTest)).toBe(17);
    expect(formulaExpectation({ rule: REGLE }, ref)).toBe(17);
  });

  it('sous un `sum`, le terme compte pareil des deux côtés', () => {
    setRule(REGLE, 4);
    const f: Formula = { sum: [{ rule: REGLE }, 6] };
    expect(resolveFormula(f, ref, desDuTest)).toBe(10);
    expect(formulaExpectation(f, ref)).toBe(10);
  });

  it('une règle INCONNUE (ou non numérique) vaut 0 des deux côtés — jamais NaN', () => {
    expect(resolveFormula({ rule: 'regle-qui-nexiste-pas' }, ref, desDuTest)).toBe(0);
    expect(formulaExpectation({ rule: 'regle-qui-nexiste-pas' }, ref)).toBe(0);
  });
});
