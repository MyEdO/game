/**
 * FAIL-CLOSED (#1463 LD.1, #2995) : les lecteurs et poseurs keyés par l'id d'une règle optionnelle
 * (`policy.ts`) ou d'un État (`conditions.ts`) LÈVENT sur un id hors du registre courant, au lieu de rendre
 * le défaut ou de poser un pion fantôme. Les ids CONNUS se lisent dans le registre lui-même : aucun id réel
 * n'est épinglé ici.
 */
import { describe, it, expect } from 'vitest';
import { OPTIONAL_RULES, rule, setRule, resetRule, loadRuleOverrides, refusDesSurcharges, ruleOverrides } from './policy';
import { addCondition, addTimedCondition, addClockCondition, removeCondition, hasCondition, stacks, derivedStacks, etatNonCumulable, soinDeDetermination, etatsPortesInconnus } from './conditions';
import { conditionIds } from '../data';
import { t } from '../i18n';
import type { Combatant } from './types';

const INCONNU = 'id-hors-registre';
const REGLE_INCONNUE = t('houseRules.refus.inconnue', { id: INCONNU });
const ETAT_INCONNU = t('etats.inconnu', { id: INCONNU });
const porteur = (conditions: { id: string; value: number }[] = []): Combatant => ({ id: 'c', label: 'C', advantage: 0, conditions } as unknown as Combatant);

describe('policy — un id de règle hors du registre lève', () => {
  const connue = OPTIONAL_RULES[0];

  it.each([
    ['rule', () => rule(INCONNU)],
    ['setRule', () => setRule(INCONNU, true)],
    ['resetRule', () => resetRule(INCONNU)],
  ])('%s', (_nom, appel) => {
    expect(appel).toThrow(REGLE_INCONNUE);
  });

  it('un id du registre se lit, se surcharge et revient au défaut', () => {
    setRule(connue.id, connue.default);
    expect(rule(connue.id)).toBe(connue.default);
    resetRule(connue.id);
    expect(ruleOverrides()).toEqual({});
  });

  it('loadRuleOverrides lève sur un jeu refusé, sans toucher aux surcharges en place', () => {
    setRule(connue.id, connue.default);
    expect(refusDesSurcharges({ [INCONNU]: true })).toEqual([{ id: INCONNU, raison: REGLE_INCONNUE }]);
    expect(() => loadRuleOverrides({ [INCONNU]: true })).toThrow(REGLE_INCONNUE);
    expect(ruleOverrides()).toEqual({ [connue.id]: connue.default });
  });

  it('refusDesSurcharges et setRule refusent une valeur non conforme à la forme de sa règle', () => {
    for (const r of OPTIONAL_RULES) {
      const nonConforme = r.kind === 'flag' ? 'texte' : r.kind === 'param' ? 'texte' : 42;
      const raison = t('houseRules.refus.valeur', { valeur: JSON.stringify(nonConforme), id: r.id });
      expect(refusDesSurcharges({ [r.id]: nonConforme }), r.id).toEqual([{ id: r.id, raison }]);
      expect(refusDesSurcharges({ [r.id]: r.default }), r.id).toEqual([]);
      expect(() => setRule(r.id, nonConforme as never), r.id).toThrow(raison);
      expect(ruleOverrides(), r.id).toEqual({});
    }
  });
});

describe('conditions — un id d’État hors du registre lève', () => {
  const connu = conditionIds()[0];

  it.each([
    ['addCondition', (c: Combatant) => addCondition(c, INCONNU)],
    ['addTimedCondition', (c: Combatant) => addTimedCondition(c, INCONNU, 1, 2)],
    ['addClockCondition', (c: Combatant) => addClockCondition(c, INCONNU, 1, 60)],
    ['removeCondition', (c: Combatant) => removeCondition(c, INCONNU)],
    ['hasCondition', (c: Combatant) => hasCondition(c, INCONNU)],
    ['stacks', (c: Combatant) => stacks(c, INCONNU)],
    ['derivedStacks', (c: Combatant) => derivedStacks(c, INCONNU)],
    ['etatNonCumulable', () => etatNonCumulable(INCONNU)],
    ['soinDeDetermination', (c: Combatant) => soinDeDetermination(c, INCONNU)],
  ])('%s, porteur sans État comme porteur d’un État', (_nom, appel) => {
    expect(() => appel(porteur())).toThrow(ETAT_INCONNU);
    expect(() => appel(porteur([{ id: connu, value: 1 }]))).toThrow(ETAT_INCONNU);
  });

  it('un id du registre se pose, se lit et se retire', () => {
    const c = porteur();
    addCondition(c, connu);
    expect(hasCondition(c, connu)).toBe(true);
    expect(stacks(c, connu)).toBe(1);
    removeCondition(c, connu);
    expect(hasCondition(c, connu)).toBe(false);
  });

  it('etatsPortesInconnus nomme les États persistés hors du registre, et rien d’autre', () => {
    expect(etatsPortesInconnus([porteur([{ id: connu, value: 1 }]), porteur([{ id: INCONNU, value: 1 }])])).toEqual([INCONNU]);
    expect(etatsPortesInconnus(undefined)).toEqual([]);
    expect(etatsPortesInconnus([null, {}])).toEqual([]);
  });
});
