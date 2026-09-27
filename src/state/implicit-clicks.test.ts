import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame, movementRemaining } from './store';
import { computeMoveReach, computeRunReach, displayedReach } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { effectiveMovement } from '../engine/encumbrance';
import { chebyshev } from '../engine/grid';

/**
 * Modèle de clic IMPLICITE (spec 2026-06-10) : déplacement par défaut au clic-case, attaque au
 * clic-ennemi, tap 1 = aperçu (`battle.preview`) → tap 2 = commit. La portée de Marche est DÉRIVÉE
 * (computeMoveReach) ; le `battle.reachable` stocké ne sert qu'aux budgets spéciaux (Course,
 * post-Désengagement) et reste prioritaire (displayedReach).
 */

function setup() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  // Éloigne tous les ennemis pour libérer la grille autour du héros (couloir y=10 libre).
  let i = 0;
  for (const e of b.combatants.filter((c) => c.kind === 'enemy')) e.pos = { x: 20 + i++, y: 20 };
  H.pos = { x: 6, y: 10 };
  const turn = b.order.indexOf(H.id);
  useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false } });
  return { H };
}

describe('clic-sol implicite — tap 1 aperçu, tap 2 déplace', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingAttack: null, pendingDisengage: null }); });

  it('1er clic = aperçu (pas de déplacement), 2e clic même case = déplacement', () => {
    const { H } = setup();
    const before = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const dest = { x: before.x + 2, y: before.y };
    useGame.getState().battleClickTile(dest);
    let st = useGame.getState();
    expect(st.battle!.preview).toMatchObject({ kind: 'move', tile: dest });
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before); // pas bougé
    useGame.getState().battleClickTile(dest);
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(st.battle!.movementUsed).toBe(2);
    expect(st.battle!.preview).toBeNull();
  });

  it('cliquer une AUTRE case remplace l’aperçu ; case hors de portée le purge', () => {
    const { H } = setup();
    const p = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    useGame.getState().battleClickTile({ x: p.x + 1, y: p.y });
    useGame.getState().battleClickTile({ x: p.x + 2, y: p.y });
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'move', tile: { x: p.x + 2, y: p.y } });
    useGame.getState().battleClickTile({ x: p.x + 30, y: p.y }); // hors de portée
    expect(useGame.getState().battle!.preview).toBeNull();
  });

  it('{ confirm: true } court-circuite l’aperçu (compat tests)', () => {
    const { H } = setup();
    const p = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    useGame.getState().battleClickTile({ x: p.x + 1, y: p.y }, { confirm: true });
    expect(useGame.getState().battle!.movementUsed).toBe(1);
    void H;
  });

  it('Engagé : le clic-sol ouvre le Désengagement (pas de déplacement libre)', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 1, y: h.pos!.y };
    h.engagedWith = [e.id]; e.engagedWith = [h.id];
    const at = { ...h.pos! };
    useGame.getState().battleClickTile({ x: at.x - 1, y: at.y });
    const st = useGame.getState();
    expect(st.pendingDisengage ?? null).not.toBeNull(); // menu A/B ouvert (Avantages égaux)
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(at);
  });
});

describe('Course implicite — zone au-delà de la Marche, jet au commit (LDB 15 l.41)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingAttack: null, pendingRun: null }); });

  it('clic case au-delà de la Marche, COURSE ARMÉE : aperçu run, re-clic ouvre pendingRun avec destination', () => {
    const { H } = setup();
    const p = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + M + 2, y: p.y }; // hors Marche, dans la Course
    // Spec HUD § ARBITRAGE 2026-08-19 : au-delà de la Marche, le champ ne court plus tout seul — la
    // Course s'ARME, et son verdict voyage avec le geste (`courseArmee`), comme `confirm`.
    useGame.getState().battleClickTile(dest, { courseArmee: true });
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'run', tile: dest });
    expect(useGame.getState().pendingRun).toBeNull(); // pas encore de jet
    useGame.getState().battleClickTile(dest, { courseArmee: true });
    const pr = useGame.getState().pendingRun;
    expect(pr).toMatchObject({ combatantId: H.id, dest });
    expect(useGame.getState().battle!.preview).toBeNull();
  });

  it('zone de Course indisponible si Mouvement entamé ou Action prise', () => {
    const { H } = setup();
    const p = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    expect(computeRunReach(useGame.getState).size).toBeGreaterThan(0);
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1 } });
    expect(computeRunReach(useGame.getState).size).toBe(0);
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 0, acted: true } });
    expect(computeRunReach(useGame.getState).size).toBe(0);
    void p; void M;
  });

  it("zone de Course NOMINALE indisponible sous un mode-CASE (#198, résidus) : `battle.reachable` déjà "
    + "peuplé par Pousser/Téléportation/pose de zone ne doit pas se faire recouvrir par la Marche+Course "
    + "normales — sinon la grille 'run' (data-tile) ratisse toute la carte au lieu du seul ensemble du mode", () => {
    const { H } = setup();
    expect(computeRunReach(useGame.getState).size).toBeGreaterThan(0); // témoin : hors mode-case, la Course normale s'affiche
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, action: 'teleport', reachable: new Map([[`${H.pos!.x},${H.pos!.y}`, 0]]) } });
    expect(computeRunReach(useGame.getState).size).toBe(0);
  });

  it('runConfirm : jet généreux → arrive à destination, Action consommée', () => {
    const { H } = setup();
    const p = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + M + 2, y: p.y };
    useGame.setState({ pendingRun: { combatantId: H.id, dest, result: { success: true, roll: 10, target: 60, dr: 4, bonusCases: 2 * M } } });
    useGame.getState().runConfirm();
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(dest);
    expect(st.battle!.acted).toBe(true);
    expect(st.pendingRun).toBeNull();
  });

  it('jet généreux : le reliquat de Course reste dépensable en segments après l’arrivée (l.80)', () => {
    const { H } = setup();
    const p = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + M + 2, y: p.y }; // coût M+2 ; budget M + 2M = 3M → reliquat 2M−2
    useGame.setState({ pendingRun: { combatantId: H.id, dest, result: { success: true, roll: 10, target: 60, dr: 4, bonusCases: 2 * M } } });
    useGame.getState().runConfirm();
    let st = useGame.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(st.battle!.runBudget).toBe(3 * M);
    expect(movementRemaining(st.battle!, h)).toBe(2 * M - 2); // reliquat
    expect(computeMoveReach(useGame.getState).size).toBeGreaterThan(0); // zone bleue rouverte
    useGame.getState().battleClickTile({ x: dest.x + 2, y: dest.y }, { confirm: true }); // segment sur le reliquat
    st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: dest.x + 2, y: dest.y });
    expect(st.battle!.movementUsed).toBe(M + 4);
  });

  it('jet court : on s’arrête au dernier point ATTEIGNABLE du chemin vers la destination', () => {
    const { H } = setup();
    const p = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    const M = effectiveMovement(H);
    const dest = { x: p.x + 2 * M, y: p.y }; // demandé : 2M cases plein est
    // Jet désastreux : bonus de Course 1 seule case → budget total M+1.
    useGame.setState({ pendingRun: { combatantId: H.id, dest, result: { success: false, roll: 96, target: 60, dr: -3, bonusCases: 1 } } });
    useGame.getState().runConfirm();
    const st = useGame.getState();
    const h = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.pos).toEqual({ x: p.x + M + 1, y: p.y }); // au max du possible le long du chemin
    expect(st.battle!.acted).toBe(true);
  });
});

describe('clic-ennemi implicite', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null, pendingAttack: null, pendingDisengage: null }); });
  afterEach(() => { vi.useRealTimers(); });

  it('cible adjacente : tap 1 aperçu attack, tap 2 ouvre la modale (pas de Charge → pas d’Avantage)', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 1, y: h.pos!.y };
    h.advantage = 0;
    useGame.getState().battleClickEntity(e.id);
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'attack', targetId: e.id });
    expect(useGame.getState().pendingAttack).toBeNull();
    useGame.getState().battleClickEntity(e.id);
    const st = useGame.getState();
    expect(st.pendingAttack?.targetId).toBe(e.id);
    expect(st.pendingAttack?.fromCharge).toBeUndefined();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0);
  });

  it('cible à 2 cases, Mouvement intact : Charge implicite (+1 Av strict, M4 seuil 2)', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 2, y: h.pos!.y };
    h.advantage = 0;
    // Spec HUD § ARBITRAGE 2026-08-19 : hors d'Allonge, l'approche se DEMANDE (Charge armée) — son
    // verdict voyage avec le geste, y compris pour l'APERÇU (le survol dit déjà la même vérité).
    useGame.getState().battleClickEntity(e.id, { approche: true });
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'charge', targetId: e.id, adv: 1 });
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(e.id, { approche: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) → ouvre la frappe
    const st = useGame.getState();
    const hh = st.battle!.combatants.find((c) => c.id === H.id)!;
    expect(hh.advantage).toBe(1);
    expect(chebyshev(hh.pos!, e.pos!)).toBe(1); // au contact
    expect(st.pendingAttack?.fromCharge).toBe(true);
  });

  it('Mouvement entamé, approche ARMÉE : pas de Charge — rejoindre dans la Marche restante puis attaquer, sans bonus', () => {
    const { H } = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, movementUsed: 1, movedPreAction: true } });
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 2, y: h.pos!.y };
    h.advantage = 0;
    useGame.getState().battleClickEntity(e.id, { approche: true });
    expect(useGame.getState().battle!.preview).toMatchObject({ kind: 'moveAttack', targetId: e.id });
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(e.id, { approche: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche → ouvre la frappe
    const st = useGame.getState();
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.advantage).toBe(0);
    expect(st.pendingAttack?.targetId).toBe(e.id);
    expect(st.pendingAttack?.fromCharge).toBeUndefined();
    expect(st.battle!.movementUsed).toBe(2); // 1 (déjà fait) + 1 (rejoindre)
  });

  it('hors de portée de Charge (> 2M+1) : message, pas d’aperçu', () => {
    const { H } = setup();
    const st0 = useGame.getState();
    const h = st0.battle!.combatants.find((c) => c.id === H.id)!;
    const e = st0.battle!.combatants.find((c) => c.kind === 'enemy')!;
    e.pos = { x: h.pos!.x + 12, y: h.pos!.y }; // M4 → 2M+1 = 9
    useGame.getState().battleClickEntity(e.id);
    const st = useGame.getState();
    expect(st.battle!.preview ?? null).toBeNull();
    expect(st.pendingAttack).toBeNull();
    void H;
  });

  it('Action déjà prise (sans Frénésie) : le clic-ennemi est inerte', () => {
    const { H } = setup();
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    const e = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
    useGame.getState().battleClickEntity(e.id);
    expect(useGame.getState().pendingAttack).toBeNull();
    void H;
  });
});

describe('computeMoveReach / displayedReach — portée de Marche dérivée (mode neutre)', () => {
  beforeEach(() => { useGame.setState({ battle: null, pendingAttack: null }); });

  it('dérive la Marche restante sans passer par un mode', () => {
    const { H } = setup();
    const reach = computeMoveReach(useGame.getState);
    expect(reach.size).toBeGreaterThan(0);
    expect(Math.max(...reach.values())).toBe(effectiveMovement(H));
  });

  it('vide si Engagé, si M-A-M scellé, ou si Mouvement épuisé', () => {
    const { H } = setup();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    h.engagedWith = ['x'];
    expect(computeMoveReach(useGame.getState).size).toBe(0);
    h.engagedWith = [];
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true, movedPreAction: true } });
    expect(computeMoveReach(useGame.getState).size).toBe(0);
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false, movedPreAction: false, movementUsed: effectiveMovement(H) } });
    expect(computeMoveReach(useGame.getState).size).toBe(0);
  });

  it('displayedReach préfère le budget SPÉCIAL stocké (Course / post-Désengagement)', () => {
    setup();
    const special = new Map([['0,0', 1]]);
    useGame.setState({ battle: { ...useGame.getState().battle!, reachable: special } });
    expect(displayedReach(useGame.getState)).toBe(special);
    useGame.setState({ battle: { ...useGame.getState().battle!, reachable: new Map() } });
    expect(displayedReach(useGame.getState).size).toBeGreaterThan(0); // repli dérivé
  });
});
