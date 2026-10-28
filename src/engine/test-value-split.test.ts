import { describe, it, expect } from 'vitest';
import { testValue, skillBaseValue, testValueParts, testValueSplit } from './skills';
import { addCondition, COND } from './conditions';
import { ligneDe } from './modLine.testkit';
import { RULE_REF } from './ruleRefs';
import { refLabel } from '../data';
import type { Combatant, SkillInstance } from './types';

/**
 * GARDE du décomposeur d'AFFICHAGE (#1178) : `testValueSplit` est la porte unique par laquelle les
 * écrans hors combat rebasent une valeur de Test FONDUE sur le Niveau de Compétence nu
 * (`LDB 09 l.17`) en NOMMANT tout l'écart.
 *
 * Deux invariants, et rien d'autre :
 *  1. `base + Σ mods === value` — la CIBLE affichée ne bouge jamais d'un cheveu ;
 *  2. une valeur que la décomposition ne reconstruit pas EXACTEMENT ne reçoit AUCUNE chip
 *     (l'écran n'annonce pas une composante que le jet n'a pas subie).
 */
function hero(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero', speciesId: 'humains-reiklander',
    characteristics: { sociabilite: 40, intelligence: 40, agilite: 40, dexterite: 40 } as Combatant['characteristics'],
    skills: [{ id: 'marchandage', advances: 15 }] as SkillInstance[],
    talents: [], items: [], conditions: [], advantage: 0,
    ...over,
  } as unknown as Combatant;
}

function empoisonne(): Combatant {
  const c = hero();
  addCondition(c, COND.empoisonne);
  return c;
}

const SOUTIEN = { count: 2, bonus: 20, ids: ['h2', 'h3'] };
const EMPOISONNE = { category: 'etats', id: 'empoisonne' };

describe('#1178 — `testValueSplit` : la valeur fondue se lit en composantes NOMMÉES', () => {
  it('Soutien + État : base = Niveau de Compétence nu, chips = Soutien puis l’État, somme = valeur jetée', () => {
    const c = empoisonne();
    const value = testValue(c, 'marchandage') + SOUTIEN.bonus;
    const { base, mods } = testValueSplit(c, value, { support: SOUTIEN, skill: 'marchandage' });
    expect(base).toBe(skillBaseValue(c, 'marchandage'));
    expect(mods.map((m) => m.ref)).toEqual([RULE_REF.soutien, ...testValueParts(c, 'marchandage').map((p) => p.ref)]);
    expect(ligneDe(mods, EMPOISONNE)!.value).toBeLessThan(0);
    expect(base + mods.reduce((s, m) => s + m.value, 0)).toBe(value); // la CIBLE ne bouge pas
  });

  it('part déjà FONDUE et annoncée ailleurs (`fused`, malus psy social) : elle reste dans la base', () => {
    const c = empoisonne();
    const psych = -20;
    const value = testValue(c, 'marchandage') + psych;
    const { base, mods } = testValueSplit(c, value, { skill: 'marchandage', fused: psych });
    expect(base).toBe(skillBaseValue(c, 'marchandage') + psych);
    expect(ligneDe(mods, EMPOISONNE)).toBeDefined();
    expect(base + mods.reduce((s, m) => s + m.value, 0)).toBe(value);
  });

  it('sans État ni passif : AUCUNE chip nouvelle (contrôle négatif), base = valeur', () => {
    const c = hero();
    const value = testValue(c, 'marchandage');
    expect(testValueSplit(c, value, { skill: 'marchandage' })).toEqual({ base: value, mods: [], exact: true });
  });

  it('valeur d’une AUTRE formule (non reconstruite) : repli sur le seul Soutien, aucune chip inventée', () => {
    const c = empoisonne();
    // +7 arbitraire : la marque d'une valeur qui ne sort pas de `testValue` (valeur de combat, carac nue…).
    const value = testValue(c, 'marchandage') + SOUTIEN.bonus + 7;
    const { base, mods } = testValueSplit(c, value, { support: SOUTIEN, skill: 'marchandage' });
    expect(mods.map((m) => m.ref)).toEqual([RULE_REF.soutien]);
    expect(base).toBe(value - SOUTIEN.bonus);
  });

  it('acteur inconnu (soigneur PNJ tarifé) ou Test sans compétence ni caractéristique : affichage inchangé', () => {
    const value = 55;
    // `exact` : il n'y a RIEN à reconstruire (aucun acteur, aucun id de Test) — la valeur EST la base,
    // ce n'est pas un échec de décomposition (#1153).
    expect(testValueSplit(undefined, value, { support: SOUTIEN, skill: 'guerison' })).toEqual({
      base: value - SOUTIEN.bonus,
      mods: [{ label: refLabel('regles', RULE_REF.soutien), value: SOUTIEN.bonus, famille: 'jet', ref: RULE_REF.soutien, by: [{ id: 'h2' }, { id: 'h3' }] }],
      exact: true,
    });
    expect(testValueSplit(empoisonne(), value)).toEqual({ base: value, mods: [], exact: true });
  });
});
