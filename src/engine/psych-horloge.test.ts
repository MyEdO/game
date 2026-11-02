/**
 * TRAIT PSY ACCORDÉ À DURÉE (#1463 β2) : l'op `grantPsychTrait.durationHours` pose son Trait sous un effet
 * d'horloge qui le retire à l'échéance, même pendant une suspension. VDM 10 l.324-332 ; LDB 43 l.70.
 */
import { describe, it, expect } from 'vitest';
import { applyOps, type GameOp } from './ops';
import { removeActiveEffects } from './conditions';
import { combattantDeTest } from './combattantDeTest.testkit';
import { desDuTest } from './dice.testkit';
import { ciblePsy, refDeCible } from './psych/ciblage';

const SOURCE = { kind: 'spell', id: 'colerique' } as const;
const haineDuRival = (heures: number): GameOp => ({
  op: 'grantPsychTrait', psychType: { id: 'haine' }, cible: refDeCible(ciblePsy.individu('rival')), durationHours: heures,
});
const echu = (now: number) => (e: { duration: { scale: string; until?: number } }) => e.duration.scale === 'clock' && e.duration.until! <= now;
const haineDe = (c: { psychTraits?: { type: string }[] }) => (c.psychTraits ?? []).filter((p) => p.type === 'haine');

describe('grantPsychTrait.durationHours : le Trait vit sous un effet d’horloge (VDM 10 l.324)', () => {
  it('pose le Trait et un effet d’horloge à now + heures × 60', () => {
    const c = combattantDeTest();
    applyOps(c, [haineDuRival(3)], { rng: desDuTest, now: 100, label: 'Colérique', source: SOURCE });
    expect(haineDe(c)).toHaveLength(1);
    const porteur = c.activeEffects!.find((e) => e.grantedPsychTrait);
    expect(porteur?.duration).toEqual({ scale: 'clock', until: 100 + 3 * 60 });
    expect(porteur?.grantedPsychTrait).toEqual({ type: 'haine', cible: ciblePsy.individu('rival'), src: SOURCE });
  });

  it('sans durée, aucun effet porteur : le Trait est permanent', () => {
    const c = combattantDeTest();
    applyOps(c, [{ op: 'grantPsychTrait', psychType: { id: 'frenesie' } }], { rng: desDuTest, now: 0 });
    expect(c.activeEffects ?? []).toHaveLength(0);
    expect(c.psychTraits).toEqual([{ type: 'frenesie' }]);
  });

  it('l’échéance retire le Trait et désactive l’affliction qu’il portait (VDM 10 l.332)', () => {
    const c = combattantDeTest({ psychTraits: [{ type: 'haine', cible: ciblePsy.groupe('skaven') }] });
    applyOps(c, [haineDuRival(1)], { rng: desDuTest, now: 0, source: SOURCE });
    c.psychState = [{ type: 'haine', cible: ciblePsy.individu('rival'), active: true }, { type: 'haine', cible: ciblePsy.groupe('skaven'), active: true }];
    expect(removeActiveEffects(c, echu(59))).toHaveLength(0);
    expect(haineDe(c)).toHaveLength(2);
    removeActiveEffects(c, echu(60));
    expect(c.psychTraits, 'la Haine native reste').toEqual([{ type: 'haine', cible: ciblePsy.groupe('skaven') }]);
    expect(c.psychState, 'seule l’affliction du Trait échu cesse').toEqual([
      { type: 'haine', cible: ciblePsy.individu('rival'), active: false }, { type: 'haine', cible: ciblePsy.groupe('skaven'), active: true },
    ]);
  });

  it('échu pendant une suspension (Baume, LDB 43 l.70), le Trait n’est pas restitué', () => {
    const c = combattantDeTest({ psychTraits: [{ type: 'frenesie' }] });
    applyOps(c, [haineDuRival(1)], { rng: desDuTest, now: 0, source: SOURCE });
    applyOps(c, [{ op: 'suppressPsych' }], { rng: desDuTest, now: 0, defaultDurationRounds: 5 });
    expect(c.psychTraits ?? []).toHaveLength(0);
    removeActiveEffects(c, echu(60));
    removeActiveEffects(c, (e) => !!e.suppressedPsych);
    expect(c.psychTraits, 'la Frénésie revient, la Haine échue non').toEqual([{ type: 'frenesie' }]);
  });

  it('removePsychTrait retire aussi l’effet porteur : l’échéance ne retire plus rien', () => {
    const c = combattantDeTest();
    applyOps(c, [haineDuRival(1)], { rng: desDuTest, now: 0, source: SOURCE });
    applyOps(c, [{ op: 'removePsychTrait', psychType: { id: 'haine' } }], { rng: desDuTest });
    expect(c.activeEffects?.some((e) => e.grantedPsychTrait) ?? false).toBe(false);
    applyOps(c, [{ op: 'grantPsychTrait', psychType: { id: 'haine' }, cible: refDeCible(ciblePsy.individu('rival')) }], { rng: desDuTest, source: SOURCE });
    removeActiveEffects(c, echu(60));
    expect(haineDe(c), 'le Trait reposé sans durée survit').toHaveLength(1);
  });

  it('une op `envers` non résolue lève : la personne se désigne avant applyOps', () => {
    const c = combattantDeTest();
    expect(() => applyOps(c, [{ op: 'grantPsychTrait', psychType: { id: 'haine' }, envers: 'personneChoisie' }], { rng: desDuTest })).toThrow();
  });
});
