import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { cliquerSurLeCombattant } from './combatOrParty';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Approche sous Peur (LDB 21 l.27), Test `se-rapprocher` de la fiche `calme-d-approche`. Le clic d'approche ouvre pendingApproach (jet GRATUIT) ; succès →
 * approches libres ce Tour (fearGate 'passed') et l'intention différée est relancée ; échec → aucune
 * approche ce Tour ('failed'). S'éloigner reste libre.
 */
describe('Approche sous Peur (store)', () => {
  beforeEach(() => {
    banc.setState({ battle: null, pendingApproach: null });
  });

  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 15, y: 10 };
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 2, calmeDR: 0 }];
    const turn = b.order.indexOf(H.id);
    // Clic-sol implicite : mode NEUTRE (action: null), portée dérivée (displayedReach).
    banc.setState({
      battle: { ...b, turn, action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map([['11,10', 1], ['9,10', 1]]) },
    });
    return { H, E };
  }

  it('avancer VERS la source ouvre le Test de Calme (sans bouger) ; s’en éloigner reste libre', () => {
    const { H, E } = setup();
    // Vers la source (15,10) : 11,10 réduit la distance → modale d'approche, pas de déplacement.
    banc.getState().cliquerLaCase({ x: 11, y: 10 }, undefined, { confirm: true });
    let st = banc.getState();
    expect(st.pendingApproach).toMatchObject({ combatantId: H.id, sourceId: E.id, intent: { kind: 'tile', pt: { x: 11, y: 10 } } });
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    banc.getState().jetAnnuler('approche'); // renoncer avant le jet : aucune trace
    // S'éloigner (9,10) : aucun Test.
    banc.getState().cliquerLaCase({ x: 9, y: 10 }, undefined, { confirm: true });
    st = banc.getState();
    expect(st.pendingApproach).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 9, y: 10 });
  });

  it('Test réussi → l’intention est relancée (déplacé) et les approches du Tour sont libres', () => {
    const { H } = setup();
    banc.getState().cliquerLaCase({ x: 11, y: 10 }, undefined, { confirm: true });
    banc.setState({ pendingApproach: { ...banc.getState().pendingApproach!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    banc.getState().jetValider('approche');
    const st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 11, y: 10 }); // relancé
    expect(st.battle!.fearGate).toBe('passed');
    // Approche suivante du MÊME Tour : plus de modale.
    banc.setState({ battle: { ...st.battle!, reachable: new Map([['12,10', 1]]) } });
    banc.getState().cliquerLaCase({ x: 12, y: 10 }, undefined, { confirm: true });
    expect(banc.getState().pendingApproach).toBeNull();
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 12, y: 10 });
  });

  it('Test raté → pas de déplacement, et plus AUCUNE approche ce Tour (sans nouvelle modale)', () => {
    const { H } = setup();
    banc.getState().cliquerLaCase({ x: 11, y: 10 }, undefined, { confirm: true });
    banc.setState({ pendingApproach: { ...banc.getState().pendingApproach!, result: { success: false, roll: 96, target: 50, sl: -4 } } });
    banc.getState().jetValider('approche');
    let st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    expect(st.battle!.fearGate).toBe('failed');
    // Re-clic d'approche : bloqué net, pas de nouvelle modale (une tentative par Tour).
    banc.getState().cliquerLaCase({ x: 11, y: 10 }, undefined, { confirm: true });
    st = banc.getState();
    expect(st.pendingApproach).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 10, y: 10 });
    // Mais s'éloigner reste possible.
    banc.getState().cliquerLaCase({ x: 9, y: 10 }, undefined, { confirm: true });
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: 9, y: 10 });
  });

  it('CHARGER la source de sa Peur passe aussi par le Test de Calme (intention entité relancée)', () => {
    const { H, E } = setup();
    E.pos = { x: 13, y: 10 }; // distance 3 ≤ 2M+1 (M4) → charge possible
    // Charge ARMÉE (spec HUD § ARBITRAGE 2026-08-19) : le clic ne s'approche plus tout seul.
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true, intentionId: 'charge' });
    let st = banc.getState();
    // L'intention du clic est CAPTURÉE dans le pending : la relance après le Test `se-rapprocher` ne relit
    // pas l'intention (dissoute par ce clic), sans quoi le geste gagné serait refusé.
    expect(st.pendingApproach).toMatchObject({ combatantId: H.id, sourceId: E.id, intent: { kind: 'entity', id: E.id, intentionId: 'charge' } });
    expect(st.pendingAttack).toBeNull(); // la charge attend le Test
    banc.setState({ pendingApproach: { ...st.pendingApproach!, result: { success: true, roll: 5, target: 50, sl: 4 } } });
    banc.abandonner();
    banc.getState().jetValider('approche');
    banc.reprendreLesEnAttente(); // joue le glissé d'approche (charge) relancé → ouvre la frappe
    st = banc.getState();
    expect(st.pendingAttack?.fromCharge).toBe(true); // charge relancée après le succès
    expect(st.battle!.fearGate).toBe('passed');
  });
});
