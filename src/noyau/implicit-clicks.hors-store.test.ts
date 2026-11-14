import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { movementRemaining } from './mount';
import { testDeRegle } from '../engine/reglesChiffrees';
import { computeMoveReach, computeRunReach, displayedReach } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveMovement } from '../engine/encumbrance';
import { chebyshev } from '../engine/grid';
import { cliquerSurLeCombattant } from './combatOrParty';
import { refusDeCharge } from './refusDuTour';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Modèle de clic IMPLICITE (spec 2026-06-10) : déplacement par défaut au clic-case, attaque au
 * clic-ennemi, tap 1 = aperçu (`battle.preview`) → tap 2 = commit. La portée de Marche est DÉRIVÉE
 * (computeMoveReach) ; le `battle.reachable` stocké ne sert qu'aux budgets spéciaux (Course,
 * post-Désengagement) et reste prioritaire (displayedReach).
 */

function setup() {
  const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero] });
  banc.getState().lancerLaScene(testScene());
  banc.getState().lancerLeCombat('enc-mutants');
  banc.getState().fenetreValider('debutDuRound');
  const b = banc.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  // Éloigne tous les ennemis pour libérer la grille autour du héros (couloir y=10 libre).
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'ennemi')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  banc.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false } });
  return { H };
}

describe('clic-sol implicite — tap 1 aperçu, tap 2 déplace', () => {
  it('1er clic = aperçu (pas de déplacement), 2e clic même case = déplacement', () => {
    const { H } = setup();
    const before = { ...banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const dest = { x: before.x + 2, y: before.y };
    banc.getState().cliquerLaCase(dest);
    let st = banc.getState();
    expect(st.battle!.preview).toMatchObject({ kind: 'deplacement', tile: dest });
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before); // pas bougé
    banc.getState().cliquerLaCase(dest);
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(st.battle!.movementUsed).toBe(2);
    expect(st.battle!.preview).toBeNull();
  });

  it('cliquer une AUTRE case remplace l’aperçu ; case hors de portée le purge', () => {
    const { H } = setup();
    const p = banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    banc.getState().cliquerLaCase({ x: p.x + 1, y: p.y });
    banc.getState().cliquerLaCase({ x: p.x + 2, y: p.y });
    expect(banc.getState().battle!.preview).toMatchObject({ kind: 'deplacement', tile: { x: p.x + 2, y: p.y } });
    banc.getState().cliquerLaCase({ x: p.x + 30, y: p.y }); // hors de portée
    expect(banc.getState().battle!.preview).toBeNull();
  });

  it('{ confirm: true } court-circuite l’aperçu (compat tests)', () => {
    const { H } = setup();
    const p = banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    banc.getState().cliquerLaCase({ x: p.x + 1, y: p.y }, undefined, { confirm: true });
    expect(banc.getState().battle!.movementUsed).toBe(1);
    void H;
  });

  it('Engagé : le clic-sol ouvre le Désengagement (pas de déplacement libre)', () => {
    const { H } = setup();
    const st0 = banc.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'ennemi')!;
    e.pos = { x: h.pos!.x + 1, y: h.pos!.y };
    h.engagedWith = [e.id]; e.engagedWith = [h.id];
    const at = { ...h.pos! };
    banc.getState().cliquerLaCase({ x: at.x - 1, y: at.y });
    const st = banc.getState();
    expect(st.pendingDisengage ?? null).not.toBeNull(); // menu A/B ouvert (Avantages égaux)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(at);
  });
});

describe('Course implicite — zone au-delà de la Marche, jet au commit (LDB 15 l.41)', () => {
  it('clic case au-delà de la Marche, COURSE ARMÉE : aperçu run, re-clic ouvre pendingRun avec destination', () => {
    const { H } = setup();
    const p = { ...banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + M + 2, y: p.y }; // hors Marche, dans la Course
    // Spec HUD § ARBITRAGE 2026-08-19 : au-delà de la Marche, le champ ne court pas tout seul — la
    // Course s'ARME, et son intention voyage avec le geste (`intentionId`), comme `confirm`.
    banc.getState().cliquerLaCase(dest, undefined, { intentionId: 'course' });
    expect(banc.getState().battle!.preview).toMatchObject({ kind: 'course', tile: dest });
    expect(banc.getState().pendingRun).toBeNull(); // pas encore de jet
    banc.getState().cliquerLaCase(dest, undefined, { intentionId: 'course' });
    const pr = banc.getState().pendingRun;
    expect(pr).toMatchObject({ combatantId: H.id, dest });
    expect(banc.getState().battle!.preview).toBeNull();
  });

  it('zone de Course : Mouvement entamé, elle reste (LDB 15 l.41, « vient en plus ») ; Action prise, elle tombe', () => {
    setup();
    const plusLoin = () => Math.max(...computeRunReach(banc.getState).values());
    const intacte = plusLoin();
    banc.setState({ battle: { ...banc.getState().battle!, movementUsed: 1 } });
    expect(computeRunReach(banc.getState).size).toBeGreaterThan(0);
    expect(plusLoin(), 'le Mouvement parcouru se retranche de la zone').toBe(intacte - 1);
    banc.setState({ battle: { ...banc.getState().battle!, movementUsed: 0, acted: true } });
    expect(computeRunReach(banc.getState).size).toBe(0);
  });

  it("zone de Course NOMINALE indisponible sous un mode-CASE (#198, résidus) : `battle.reachable` déjà "
    + "peuplé par Pousser/Téléportation/pose de zone ne doit pas se faire recouvrir par la Marche+Course "
    + "normales — sinon la grille 'course' (data-tile) ratisse toute la carte au lieu du seul ensemble du mode", () => {
    const { H } = setup();
    expect(computeRunReach(banc.getState).size).toBeGreaterThan(0); // témoin : hors mode-case, la Course normale s'affiche
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, action: 'teleportation', reachable: new Map([[`${H.pos!.x},${H.pos!.y}`, 0]]) } });
    expect(computeRunReach(banc.getState).size).toBe(0);
  });

  it('jetValider@course : jet généreux → arrive à destination, Action consommée', () => {
    const { H } = setup();
    const p = { ...banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + M + 2, y: p.y };
    banc.setState({ pendingRun: { combatantId: H.id, test: testDeRegle('course', 'courir'), dest, result: { success: true, roll: 10, target: 60, dr: 4, bonusCases: 2 * M } } });
    banc.getState().jetValider('course');
    const st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(st.battle!.acted).toBe(true);
    expect(st.pendingRun).toBeNull();
  });

  it('jet généreux : le reliquat de Course reste dépensable en segments après l’arrivée (l.80)', () => {
    const { H } = setup();
    const p = { ...banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + M + 2, y: p.y }; // coût M+2 ; budget M + 2M = 3M → reliquat 2M−2
    banc.setState({ pendingRun: { combatantId: H.id, test: testDeRegle('course', 'courir'), dest, result: { success: true, roll: 10, target: 60, dr: 4, bonusCases: 2 * M } } });
    banc.getState().jetValider('course');
    let st = banc.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.runBudget).toBe(3 * M);
    expect(movementRemaining(st.battle!, h)).toBe(2 * M - 2); // reliquat
    expect(computeMoveReach(banc.getState).size).toBeGreaterThan(0); // zone bleue rouverte
    banc.getState().cliquerLaCase({ x: dest.x + 2, y: dest.y }, undefined, { confirm: true }); // segment sur le reliquat
    st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: dest.x + 2, y: dest.y });
    expect(st.battle!.movementUsed).toBe(M + 4);
  });

  it('jet court : on s’arrête au dernier point ATTEIGNABLE du chemin vers la destination', () => {
    const { H } = setup();
    const p = { ...banc.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + 2 * M, y: p.y }; // demandé : 2M cases plein est
    // Jet désastreux : bonus de Course 1 seule case → budget total M+1.
    banc.setState({ pendingRun: { combatantId: H.id, test: testDeRegle('course', 'courir'), dest, result: { success: false, roll: 96, target: 60, dr: -3, bonusCases: 1 } } });
    banc.getState().jetValider('course');
    const st = banc.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.pos).toEqual({ x: p.x + M + 1, y: p.y }); // au max du possible le long du chemin
    expect(st.battle!.acted).toBe(true);
  });
});

describe('clic-ennemi implicite', () => {
  it('cible adjacente : tap 1 aperçu attack, tap 2 ouvre la modale (pas de Charge → pas d’Avantage)', () => {
    const { H } = setup();
    const st0 = banc.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'ennemi')!;
    e.pos = { x: h.pos!.x + 1, y: h.pos!.y };
    h.advantage = 0;
    cliquerSurLeCombattant(banc.getState, e.id);
    expect(banc.getState().battle!.preview).toMatchObject({ kind: 'attaque', targetId: e.id });
    expect(banc.getState().pendingAttack).toBeNull();
    cliquerSurLeCombattant(banc.getState, e.id);
    const st = banc.getState();
    expect(st.pendingAttack?.targetId).toBe(e.id);
    expect(st.pendingAttack?.fromCharge).toBeUndefined();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0);
  });

  it('cible à 2 cases, Mouvement intact : Charge implicite (+1 Av strict, M4 seuil 2)', () => {
    const { H } = setup();
    const st0 = banc.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'ennemi')!;
    e.pos = { x: h.pos!.x + 2, y: h.pos!.y };
    h.advantage = 0;
    // Spec HUD § ARBITRAGE 2026-08-19 : hors d'Allonge, l'approche se DEMANDE (Charge armée) — son
    // intention voyage avec le geste, y compris pour l'APERÇU (le survol dit déjà la même vérité).
    cliquerSurLeCombattant(banc.getState, e.id, { intentionId: 'charge' });
    expect(banc.getState().battle!.preview).toMatchObject({ kind: 'charge', targetId: e.id, adv: 1 });
    banc.abandonner();
    cliquerSurLeCombattant(banc.getState, e.id, { intentionId: 'charge' });
    banc.reprendreLesEnAttente(); // joue le glissé d'approche (charge) → ouvre la frappe
    const st = banc.getState();
    const hh = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(hh.advantage).toBe(1);
    expect(chebyshev(hh.pos!, e.pos!)).toBe(1); // au contact
    expect(st.pendingAttack?.fromCharge).toBe(true);
  });

  it('Mouvement entamé, Charge demandée : son offre est refusée (`refusDeCharge`) — le clic le dit, rien ne bouge', () => {
    const { H } = setup();
    banc.setState({ battle: { ...banc.getState().battle!, movementUsed: 1, movedPreAction: true } });
    const st0 = banc.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'ennemi')!;
    e.pos = { x: h.pos!.x + 2, y: h.pos!.y };
    const pos0 = { ...h.pos! };
    cliquerSurLeCombattant(banc.getState, e.id, { confirm: true, intentionId: 'charge' });
    banc.reprendreLesEnAttente();
    const st = banc.getState();
    expect(st.refus?.texte).toBe(refusDeCharge(st.battle!, st.battle!.combatants.find((c) => c.id === H.id)!));
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(pos0);
    expect(st.pendingAttack).toBeNull();
    expect(st.battle!.movementUsed).toBe(1);
  });

  it('hors de portée de Charge (> 2M+1) : message, pas d’aperçu', () => {
    const { H } = setup();
    const st0 = banc.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'ennemi')!;
    e.pos = { x: h.pos!.x + 12, y: h.pos!.y }; // M4 → 2M+1 = 9
    cliquerSurLeCombattant(banc.getState, e.id);
    const st = banc.getState();
    expect(st.battle!.preview ?? null).toBeNull();
    expect(st.pendingAttack).toBeNull();
    void H;
  });

  it('Action déjà prise (sans Frénésie) : le clic-ennemi est inerte', () => {
    const { H } = setup();
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } });
    const e = banc.getState().battle!.combatants.find((c) => c.kind === 'ennemi')!;
    cliquerSurLeCombattant(banc.getState, e.id);
    expect(banc.getState().pendingAttack).toBeNull();
    void H;
  });
});

describe('computeMoveReach / displayedReach — portée de Marche dérivée (mode neutre)', () => {
  it('dérive la Marche restante sans passer par un mode', () => {
    const { H } = setup();
    const reach = computeMoveReach(banc.getState);
    expect(reach.size).toBeGreaterThan(0);
    expect(Math.max(...reach.values())).toBe(effectiveMovement(H));
  });

  it('vide si Engagé, si M-A-M scellé, ou si Mouvement épuisé', () => {
    const { H } = setup();
    const h = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    h.engagedWith = ['x'];
    expect(computeMoveReach(banc.getState).size).toBe(0);
    h.engagedWith = [];
    banc.setState({ battle: { ...banc.getState().battle!, acted: true, movedPreAction: true } });
    expect(computeMoveReach(banc.getState).size).toBe(0);
    banc.setState({ battle: { ...banc.getState().battle!, acted: false, movedPreAction: false, movementUsed: effectiveMovement(H) } });
    expect(computeMoveReach(banc.getState).size).toBe(0);
  });

  it('displayedReach préfère le budget SPÉCIAL stocké (Course / post-Désengagement)', () => {
    setup();
    const special = new Map([['0,0', 1]]);
    banc.setState({ battle: { ...banc.getState().battle!, reachable: special } });
    expect(displayedReach(banc.getState)).toBe(special);
    banc.setState({ battle: { ...banc.getState().battle!, reachable: new Map() } });
    expect(displayedReach(banc.getState).size).toBeGreaterThan(0); // repli dérivé
  });
});
