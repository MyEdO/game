import { describe, it, expect } from 'vitest';
import { addCondition, testStatePenalty, combatTestPenalty, endOfRound, hasCondition, bleedDeathRoll, recoveredStacks } from './conditions';
import { applyOps } from './ops';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import type { Combatant } from './types';
import { deFixe, desDuTest } from './dice.testkit';

const C = (over: Partial<Combatant>): Combatant =>
  ({ id: 'c', name: 'C', kind: 'hero', conditions: [], skills: [], characteristics: { endurance: 90 }, wounds: { current: 20, max: 20 }, advantage: 3, armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over } as unknown as Combatant);

describe('Finitions d\'États (LDB 16)', () => {
  it('subir un État quel qu\'il soit → perte de TOUT Avantage (l.15)', () => {
    const c = C({ advantage: 4 });
    addCondition(c, 'aveugle');
    expect(c.advantage).toBe(0);
  });

  it('testStatePenalty : À Terre −20 / Empêtré −10 sur un Test de déplacement (l.37 / l.85)', () => {
    expect(testStatePenalty(C({ conditions: [{ id: 'a-terre', value: 1 }] }), 'athletisme')).toBe(-20);
    expect(testStatePenalty(C({ conditions: [{ id: 'empetre', value: 1 }] }), 'esquive')).toBe(-10);
    expect(testStatePenalty(C({ conditions: [{ id: 'a-terre', value: 1 }] }), 'charme')).toBe(0); // Charme ≠ déplacement
  });

  it('testMod (Malédiction de malchance −10) : stacke par-dessus l\'État, hors non-cumul/ignoreState', () => {
    const c = C({ conditions: [] });
    applyOps(c, [{ op: 'testMod', amount: -10 }], { rng: desDuTest, label: 'Malédiction de malchance', defaultDurationRounds: 9999 });
    expect(testStatePenalty(c)).toBe(-10); // tests hors combat
    expect(combatTestPenalty(c)).toBe(-10); // tests de combat
    addCondition(c, 'sonne'); // État −10 → STACKE avec le −10 du Sort (sources distinctes)
    expect(combatTestPenalty(c)).toBe(-20);
    // « ne subit aucune pénalité d'État » (Endurance de l'anachorète) n'efface PAS le malus de Sort.
    c.activeEffects!.push({ label: 'Anachorète', bonus: 0, duration: { scale: 'permanent' }, ignoreStatePenalties: true });
    expect(combatTestPenalty(c)).toBe(-10); // l'État est effacé, le −10 du Sort demeure
  });

  it('Empoisonné : endOfRound NE touche plus le poison — dégâts ET Test de Résistance migrés en DONNÉES (l.66-72)', () => {
    const c = C({ conditions: [{ id: 'empoisonne', value: 1 }], wounds: { current: 20, max: 20 } });
    endOfRound(c, makeRNG(1)); // ni dégâts, ni Test de poison : tout est `effects: onRoundEnd` (etats.json), résolu par le dispatcher
    expect(hasCondition(c, 'empoisonne')).toBe(true); // endOfRound ne retire aucun pion de poison
    expect(c.wounds.current).toBe(20);                // ni dégât périodique (cf. state/round-upkeep-cascade.test pour la voie data-driven)
  });

  it('recoveredStacks : « 1 + DR » borné aux pions ; échec ⇒ 0 (l.61/77/107)', () => {
    expect(recoveredStacks(0, 3, true)).toBe(1);   // DR 0 → 1 pion
    expect(recoveredStacks(2, 3, true)).toBe(3);   // 1+2 = 3, borné à 3
    expect(recoveredStacks(5, 2, true)).toBe(2);   // borné au nombre de pions
    expect(recoveredStacks(-3, 3, true)).toBe(1);  // DR négatif clampé à 0 → 1
    expect(recoveredStacks(4, 3, false)).toBe(0);  // échec → rien
    expect(recoveredStacks(4, 0, true)).toBe(0);   // aucun pion → rien
  });

  it('Hémorragique : coagulation (double) du dernier État → 1 Exténué (l.109)', () => {
    const c = C({ conditions: [{ id: 'hemorragique', value: 1 }] });
    const dbl: RNG = deFixe(11); // jet 11 = double → coagule
    const out = bleedDeathRoll(c, dbl);
    expect(out.died).toBe(false);
    expect(hasCondition(c, 'hemorragique')).toBe(false);
    expect(hasCondition(c, 'extenue')).toBe(true);
  });
});
