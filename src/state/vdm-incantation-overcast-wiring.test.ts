/**
 * Câblage RÉEL de « Puissance totale » révisée (`VDM 02 l.55`, option `magic-vdm-incantation`)
 * jusqu'au budget de Surincantation : le DR de l'Incantation Critique augmente du chiffre des
 * DIZAINES du lancer, et cette DR sert à allouer les pas. Passe par la VRAIE action de modale
 * (`castSetCritChoice` + `castAllocOvercast`) — aucun budget recalculé à la main dans le test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import type { CastResult } from '../engine/magic';

const RULE = 'magic-vdm-incantation';

/** Incantation CRITIQUE (double 44 réussi) à DR 8 = exactement le NI d'Allure démoniaque :
 *  budget LDB = floor((8 − 8) / 2) = 0 pas. Sous VDM, le DR devient 8 + 4 (dizaines de 44) = 12. */
const critRes: CastResult = { cast: true, roll: 44, target: 90, sl: 8, isCritical: true, isFumble: false, log: 'critique' };

function openCast() {
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
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(heroC.id), action: 'cast', selectedSpellId: 'allure-demoniaque', acted: false } });
  useGame.getState().battleClickEntity(heroC.id);
  useGame.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: critRes } }));
  useGame.getState().castSetCritChoice('puissance');
}

describe('Câblage — « Puissance totale » VDM : +dizaines au DR, donc des pas de Surincantation', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule(RULE); });

  it('option OFF (LDB 46 l.31) : DR 8 = NI 8 → aucun pas allouable', () => {
    openCast();
    useGame.getState().castAllocOvercast('duration', 1);
    expect(useGame.getState().pendingCast!.overcast ?? { duration: 0 }).toMatchObject({ duration: 0 });
  });

  it('option ON : le lancer 44 porte le DR à 12 → 4 DR dépensables sur la Durée (`VDM 02 l.196`)', () => {
    setRule(RULE, true);
    openCast();
    for (let i = 0; i < 5; i++) useGame.getState().castAllocOvercast('duration', 1); // le 5ᵉ est refusé : surplus épuisé
    expect(useGame.getState().pendingCast!.overcast).toEqual({ range: 0, zone: 0, duration: 4, targets: 0, damage: 0 });
  });

  it('option ON, effet Critique AUTRE que « Puissance totale » : le DR ne bouge pas', () => {
    setRule(RULE, true);
    openCast();
    useGame.getState().castSetCritChoice('ineluctable');
    useGame.getState().castAllocOvercast('duration', 1);
    expect(useGame.getState().pendingCast!.overcast ?? { duration: 0 }).toMatchObject({ duration: 0 });
  });
});
