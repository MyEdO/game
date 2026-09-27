import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';

/**
 * Approche sous Peur (LDB 21 l.27) : « incapable de vous rapprocher … à moins de réussir un Test de
 * Calme Intermédiaire (+0) ». Le clic d'approche ouvre pendingApproach (jet GRATUIT) ; succès →
 * approches libres ce Tour (fearGate 'passed') et l'intention différée est relancée ; échec → aucune
 * approche ce Tour ('failed'). S'éloigner reste libre.
 */
describe('Approche sous Peur (store)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingApproach: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 15, y: 10 };
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    const turn = b.order.indexOf(H.id);
    // Clic-sol implicite : mode NEUTRE (action: null), portée dérivée (displayedReach).
    useGame.setState({
      battle: { ...b, turn, action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map([['11,10', 1], ['9,10', 1]]) },
    });
    return { H, E };
  }

  it('avancer VERS la source ouvre le Test de Calme (sans bouger) ; s’en éloigner reste libre', () => {
    const { H, E } = setup();
    // Vers la source (15,10) : 11,10 réduit la distance → modale d'approche, pas de déplacement.
    useGame.getState().battleClickTile({ x: 11, y: 10 }, { confirm: true });
    let st = useGame.getState();
    expect(st.pendingApproach).toMatchObject({ combatantId: H.id, sourceId: E.id, intent: { kind: 'tile', pt: { x: 11, y: 10 } } });
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    useGame.getState().approachCancel(); // renoncer avant le jet : aucune trace
    // S'éloigner (9,10) : aucun Test.
    useGame.getState().battleClickTile({ x: 9, y: 10 }, { confirm: true });
    st = useGame.getState();
    expect(st.pendingApproach).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 9, y: 10 });
  });

  it('Test réussi → l’intention est relancée (déplacé) et les approches du Tour sont libres', () => {
    const { H } = setup();
    useGame.getState().battleClickTile({ x: 11, y: 10 }, { confirm: true });
    useGame.setState({ pendingApproach: { ...useGame.getState().pendingApproach!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    useGame.getState().approachConfirm();
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 11, y: 10 }); // relancé
    expect(st.battle!.fearGate).toBe('passed');
    // Approche suivante du MÊME Tour : plus de modale.
    useGame.setState({ battle: { ...st.battle!, reachable: new Map([['12,10', 1]]) } });
    useGame.getState().battleClickTile({ x: 12, y: 10 }, { confirm: true });
    expect(useGame.getState().pendingApproach).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 12, y: 10 });
  });

  it('Test raté → pas de déplacement, et plus AUCUNE approche ce Tour (sans nouvelle modale)', () => {
    const { H } = setup();
    useGame.getState().battleClickTile({ x: 11, y: 10 }, { confirm: true });
    useGame.setState({ pendingApproach: { ...useGame.getState().pendingApproach!, result: { success: false, roll: 96, target: 50, sl: -4 } } });
    useGame.getState().approachConfirm();
    let st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    expect(st.battle!.fearGate).toBe('failed');
    // Re-clic d'approche : bloqué net, pas de nouvelle modale (une tentative par Tour).
    useGame.getState().battleClickTile({ x: 11, y: 10 }, { confirm: true });
    st = useGame.getState();
    expect(st.pendingApproach).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    // Mais s'éloigner reste possible.
    useGame.getState().battleClickTile({ x: 9, y: 10 }, { confirm: true });
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 9, y: 10 });
  });

  it('CHARGER la source de sa Peur passe aussi par le Test de Calme (intention entité relancée)', () => {
    const { H, E } = setup();
    E.pos = { x: 13, y: 10 }; // distance 3 ≤ 2M+1 (M4) → charge possible
    // Charge ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : le clic ne s'approche plus tout seul.
    useGame.getState().battleClickEntity(E.id, { confirm: true, approche: true });
    let st = useGame.getState();
    // Le verdict d'armement est CAPTURÉ dans le pending : la relance après le Test de Calme ne relit
    // pas l'intention (dissoute par ce clic), sans quoi le geste gagné serait refusé.
    expect(st.pendingApproach).toMatchObject({ combatantId: H.id, sourceId: E.id, intent: { kind: 'entity', id: E.id, approche: true } });
    expect(st.pendingAttack).toBeNull(); // la charge attend le Test
    useGame.setState({ pendingApproach: { ...st.pendingApproach!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    vi.clearAllTimers();
    useGame.getState().approachConfirm();
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) relancé → ouvre la frappe
    st = useGame.getState();
    expect(st.pendingAttack?.fromCharge).toBe(true); // charge relancée après le succès
    expect(st.battle!.fearGate).toBe('passed');
  });
});
