/**
 * Câblage RÉEL du pas de Surincantation « Durée » jusqu'à `rollTable.extraRollsPerStep` (EDOC 13
 * l.270-276), pour la feuille `on:'target'` NON-missile (site `runCastFlow` ~combatFlow.ts l.4048) —
 * la 3ᵉ des trois occurrences de `runCastFlow` dans `applyCast`. Passe par le VRAI flux de commit
 * (`castAllocOvercast` + `castConfirm`, comme la modale) — AUCUN `extras`/`ctx` forgé à la main : si
 * le site d'appel omet `overcastDurationSteps`, ce test doit ÉCHOUER.
 *
 * Le jet sur le Tableau est DÉCLINABLE (l.276 « vous POUVEZ ») — `castSetChosenTableRolls` borne le
 * nombre de jets sans jamais raccourcir la prolongation de durée (couplage ASYMÉTRIQUE).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';

describe('Câblage — pas de Surincantation Durée → rollTable.extraRollsPerStep (feuille on:target, non-missile)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('2 pas alloués (modale/castAllocOvercast) → 3 octrois sur le Tableau ET durée ×3, « à la fois » (EDOC 13 l.276)', () => {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    W.talents = [...(W.talents ?? []), { talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 }];
    W.spells = ['allure-demoniaque'];
    W.characteristics.sociabilite = 40; // Bonus 4 → durée de base non nulle, la prolongation ×3 est mesurable
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(7);
    const b = useGame.getState().battle!;
    const heroC = b.combatants.find((c) => c.label === 'W')!;
    const turn = b.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...b, turn, action: 'cast', selectedSpellId: 'allure-demoniaque', acted: false } });
    useGame.getState().battleClickEntity(heroC.id); // cible = soi (spell.target.kind === 'self')
    expect(useGame.getState().pendingCast).not.toBeNull();
    // Résultat de Test FIGÉ (préconditions du scénario, PAS le câblage sous test) : DR 12 → budget
    // de Surincantation = floor((12 − NI 8) / 2) = 2 pas, alloués ci-dessous via la VRAIE action de
    // modale `castAllocOvercast` (jamais `pendingCast.result`/`extras` composé pour l'occasion).
    useGame.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: { cast: true, roll: 20, target: 90, sl: 12, isCritical: false, isFumble: false, log: 'ok' } as CastResult } }));
    useGame.getState().castAllocOvercast('duration', 1);
    useGame.getState().castAllocOvercast('duration', 1);
    expect(useGame.getState().pendingCast!.overcast).toEqual({ range: 0, zone: 0, duration: 2, targets: 0, damage: 0 });
    useGame.getState().castConfirm(); // « Appliquer » — VRAI applyCast → runCastFlow (site sous test)
    const heroAfter = useGame.getState().battle?.combatants.find((c) => c.id === heroC.id) ?? useGame.getState().party.find((h) => h.id === heroC.id)!;
    const octrois = (heroAfter.activeEffects ?? []).filter((e) => e.grantedTrait || e.grantedMutation);
    expect(octrois).toHaveLength(3); // 1 + 2 pas de Durée — PAS 1 (preuve du câblage)
    // « À la fois » (EDOC 13 l.276) : le MÊME pas prolonge aussi la durée (×(1+2)=×3), portée par
    // CHAQUE ActiveEffect posé par ce lancement.
    for (const e of octrois) expect(e.duration).toEqual({ scale: 'rounds', left: 12 }); // (Bonus Soc. 4) × 3
  });

  const setup = () => {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    W.talents = [...(W.talents ?? []), { talentId: 'magie-du-chaos', spec: 'nurgle', times: 1 }];
    W.spells = ['allure-demoniaque'];
    W.characteristics.sociabilite = 40;
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    useGame.getState().seedRng(7);
    const b = useGame.getState().battle!;
    const heroC = b.combatants.find((c) => c.label === 'W')!;
    const turn = b.order.indexOf(heroC.id);
    useGame.setState({ battle: { ...b, turn, action: 'cast', selectedSpellId: 'allure-demoniaque', acted: false } });
    useGame.getState().battleClickEntity(heroC.id);
    useGame.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: { cast: true, roll: 20, target: 90, sl: 12, isCritical: false, isFumble: false, log: 'ok' } as CastResult } }));
    useGame.getState().castAllocOvercast('duration', 1);
    useGame.getState().castAllocOvercast('duration', 1);
    return heroC.id;
  };

  it('2 pas alloués, 1 jet CHOISI (castSetChosenTableRolls) → 2 octrois ET durée toujours ×3 (déclinable, EDOC 13 l.276)', () => {
    const heroId = setup();
    useGame.getState().castSetChosenTableRolls(1);
    expect(useGame.getState().pendingCast!.chosenTableRolls).toBe(1);
    useGame.getState().castConfirm();
    const heroAfter = useGame.getState().battle?.combatants.find((c) => c.id === heroId) ?? useGame.getState().party.find((h) => h.id === heroId)!;
    const octrois = (heroAfter.activeEffects ?? []).filter((e) => e.grantedTrait || e.grantedMutation);
    expect(octrois).toHaveLength(2); // 1 + 1 jet choisi — PAS 3
    for (const e of octrois) expect(e.duration).toEqual({ scale: 'rounds', left: 12 }); // durée ×3 malgré le jet décliné
  });

  it('2 pas alloués, 0 jet CHOISI → 1 octroi ET durée toujours ×3', () => {
    const heroId = setup();
    useGame.getState().castSetChosenTableRolls(0);
    expect(useGame.getState().pendingCast!.chosenTableRolls).toBe(0);
    useGame.getState().castConfirm();
    const heroAfter = useGame.getState().battle?.combatants.find((c) => c.id === heroId) ?? useGame.getState().party.find((h) => h.id === heroId)!;
    const octrois = (heroAfter.activeEffects ?? []).filter((e) => e.grantedTrait || e.grantedMutation);
    expect(octrois).toHaveLength(1);
    for (const e of octrois) expect(e.duration).toEqual({ scale: 'rounds', left: 12 });
  });
});
