import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { testDeRegle } from '../engine/reglesChiffrees';
import { draineCascade, cascadeDeTest } from './cascade.testkit';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { fleeReachable } from './monde/path';
import { emptyScene } from './monde/scene';
import { stacks, hasCondition, COND } from '../engine/conditions';
import { fleeBackstab, fleeTouche, fleeToucheDu } from './pendings';
import { intentAllowedFor } from './netOwnership';
import { modalOwnerOf } from './modalArbiter';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('fleeReachable — Fuite dans la direction OPPOSÉE à l’adversaire (LDB 15 l.68)', () => {
  const scene = emptyScene('scene-test', 14, 14);
  const has = (m: Map<string, number>, x: number, y: number) => m.has(`${x},${y}`);
  it('exclut les cases qui RAPPROCHENT de l’adversaire, garde celles qui s’en éloignent', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, { blocked: new Set() }); // adversaire au NORD (Tchebychev 2)
    expect(has(m, 6, 9)).toBe(true); // plein SUD : s'éloigne → permise
    expect(has(m, 6, 5)).toBe(false); // vers le NORD : rapproche → exclue
    expect(has(m, 6, 4)).toBe(false); // la case du foe : exclue
    expect(has(m, 8, 6)).toBe(true); // latérale à distance égale (Tchebychev 2) : ne rapproche pas → permise
  });
  it('bornée au range de Course passé', () => {
    const m = fleeReachable(scene, { x: 6, y: 6 }, { x: 6, y: 4 }, 4, { blocked: new Set() });
    expect(has(m, 6, 6)).toBe(true); // origine
    expect(has(m, 6, 12)).toBe(false); // 6 cases au sud > range 4 → hors de portée
  });
});

// Fuite (LDB 15 l.63-66) : le coup dans le dos du frappeur et le Test `fuite` du fuyard sont DEUX
// jets du flux `flee` ; la complétion de la fuite est DIFFÉRÉE jusqu'au « Appliquer ».
describe('Fuite intégrée à la modale (store)', () => {
  it('Fuir : coup dans le dos (témoin IA) + Test `fuite` DIFFÉRÉ (flux flee) ; fuite complétée au confirm, sans révélation', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    E.characteristics['capacite-de-combat'] = 90; // le coup dans le dos (+20) touche à coup sûr
    H.wounds = blessuresDeBase(40, 40, H);
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    banc.setState({
      battle: { ...b },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    banc.getState().disengageFlee();

    const pdf = banc.getState().pendingDisengage!;
    expect(pdf).toBeTruthy();
    expect(pdf.phase).toBe('fuir');
    const bs = fleeBackstab(pdf)!;
    expect(bs.interactive).toBe(false); // frappeur IA → rangée témoin, auto-roulée
    expect(bs.result!.hit).toBe(true); // CC 90 +20 → touche
    expect(bs.result!.woundsLost).toBeGreaterThan(0);
    expect(fleeTouche(pdf)!.jet).toBeNull(); // touché → Test `fuite` DIFFÉRÉ (jet influençable en attente)
    // Blessures NON encore appliquées, fuite NON complétée : tout attend le « Appliquer ».
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBe(40);
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([E.id]);

    // Le Test `fuite` passe par le flux `flee` (jet INFLUENÇABLE) : Lancer puis Appliquer.
    banc.getState().fleeRoll(H.id);
    expect(fleeTouche(banc.getState().pendingDisengage!)!.jet).toBeTruthy(); // Test `fuite` résolu
    banc.getState().fleeConfirm();

    // « Appliquer » applique le coup dans le dos puis complète la fuite (libération + Course).
    const after = banc.getState();
    expect(after.pendingDisengage).toBeNull();
    expect(after.battle!.combatants.find((c) => c.id === H.id)!.wounds.current).toBeLessThan(40);
    expect(after.battle!.combatants.find((c) => c.id === H.id)!.engagedWith).toEqual([]); // libéré de tous les Engagements
    expect(after.battle!.reachable.size).toBeGreaterThan(0); // budget de Course posé
  });

  it("Fuir — Chance « +1 DR » réduit le nombre d'États Brisés sans réécrire `success` (LDB 17 l.24 ; LDB 12 l.11)", () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    H.fortune = 2;
    H.wounds = blessuresDeBase(40, 40, H);
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    // Phase 'fuir' avec un coup dans le dos FIGÉ (4 PB) et un Test `fuite` RATÉ figé (DR -2 → 3 États Brisés).
    banc.setState({
      battle: { ...b },
      pendingDisengage: {
        moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'fuir', atk: null, def: null, result: null,
        fuir: {
          participants: [
            { id: E.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 30, netSL: 1, location: 'corps', damage: 4, woundsLost: 4, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: H.id, kind: 'touche', interactive: true, test: testDeRegle('fuite', 'touche-en-fuyant'), jet: { success: false, roll: 70, target: 50, sl: -2 } },
          ],
        },
      },
    });

    // Chance « +1 DR » : DR -2 → -1 ; l'échec NE bascule PAS en réussite (1 Point de Chance dépensé).
    banc.getState().fleeBonusSL(H.id);
    let st = banc.getState();
    expect(fleeTouche(st.pendingDisengage!)!.jet!.sl).toBe(-1);
    expect(fleeTouche(st.pendingDisengage!)!.jet!.success).toBe(false);
    expect(st.battle!.combatants.find((c) => c.id === H.id)!.fortune).toBe(1);

    // « Appliquer » : broken = 1 + max(0, 1) = 2 États Brisés (au lieu de 3 sans le +1 DR).
    banc.getState().fleeConfirm();
    st = banc.getState();
    expect(stacks(st.battle!.combatants.find((c) => c.id === H.id)!, COND.brise)).toBe(2);
    expect(st.pendingDisengage).toBeNull();
  });
});

// ── Fuir — le coup dans le dos passe par le FLUX canonique (#918 lot A) ──────────────────────────
// Le coup dans le dos est une attaque de Corps à corps complète : ses conséquences RAW passent par
// l'applicateur canonique d'attaque. LDB 13 l.183 (Critique sur double réussi) et LDB 13 l.161
// (Points de Blessure perdus > total de l'adversaire → Blessure critique + À Terre).
describe('Fuir — coup dans le dos : flux canonique à 2 slots (LDB 15 l.63-66)', () => {
  /** Deux héros ENGAGÉS l'un contre l'autre (allié sous Frénésie/charme) : le frappeur est alors
   *  piloté-humain, ce qui rend son coup dans le dos INFLUENÇABLE (slot interactif). */
  function duelHeros(seed = 3) {
    const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const B = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    banc.setState({ party: [A, B] });
    banc.getState().seedRng(seed);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    const b = banc.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const frappeur = heroes.find((c) => c.label === 'A')!;
    const fuyard = heroes.find((c) => c.label === 'B')!;
    frappeur.pos = { x: 6, y: 10 };
    fuyard.pos = { x: 7, y: 10 };
    frappeur.engagedWith = [fuyard.id];
    fuyard.engagedWith = [frappeur.id];
    fuyard.items = (fuyard.items ?? []).filter((i) => i.kind !== 'armor'); fuyard.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    banc.setState({
      battle: { ...b },
      pendingDisengage: { moverId: fuyard.id, foeId: frappeur.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    return { frappeur, fuyard };
  }

  const live = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!;

  it('DOUBLE réussi au coup dans le dos → Coup Critique appliqué au fuyard (LDB 13 l.183)', () => {
    const { frappeur, fuyard } = duelHeros(3);
    frappeur.characteristics['capacite-de-combat'] = 60;
    frappeur.resilience = 2;
    fuyard.wounds = blessuresDeBase(60, 60, fuyard); // survit au Critique
    banc.setState({ battle: { ...banc.getState().battle! } });

    banc.getState().disengageFlee();
    const pd = banc.getState().pendingDisengage!;
    expect(pd.phase).toBe('fuir');
    const bs = fleeBackstab(pd)!;
    expect(bs.interactive).toBe(true); // le frappeur est piloté-humain → SON jet lui revient

    // Dé 11 CHOISI (Résilience, LDB 17 l.68) = double → Coup Critique, exactement comme le Piétinement.
    banc.getState().fleeRoll(bs.id);
    banc.getState().fleeForceSuccess(bs.id);
    banc.getState().fleeSetForcedRoll(bs.id, 11);
    expect(fleeBackstab(banc.getState().pendingDisengage!)!.result!.critical).toBe(true);

    const critBefore = live(fuyard.id).criticalWounds ?? 0;
    const pdAfter = banc.getState().pendingDisengage!;
    if (fleeToucheDu(pdAfter)) banc.getState().fleeRoll(fleeTouche(pdAfter)!.id);
    banc.getState().fleeConfirm();
    draineCascade(banc.getState); // la sévérité du Critique se tire DANS la fenêtre (#1426)

    expect(live(fuyard.id).criticalWounds ?? 0).toBeGreaterThan(critBefore); // Blessure critique RAW appliquée
    expect(banc.getState().pendingDisengage).toBeNull();
  });

  it('DÉPASSEMENT (PB perdus > PB restants) → Blessure critique ET À Terre (LDB 13 l.161)', () => {
    const { frappeur, fuyard } = duelHeros(4);
    fuyard.wounds = blessuresDeBase(30, 3, fuyard);
    const pd = banc.getState().pendingDisengage!;
    // Coup dans le dos NON critique (pas de double) mais qui dépasse les PB courants : 5 > 3.
    banc.setState({
      battle: { ...banc.getState().battle! },
      pendingDisengage: {
        ...pd,
        phase: 'fuir',
        fuir: {
          participants: [
            { id: frappeur.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 40, netSL: 2, location: 'corps', damage: 5, woundsLost: 5, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: fuyard.id, kind: 'touche', interactive: true, test: testDeRegle('fuite', 'touche-en-fuyant'), jet: { success: true, roll: 10, target: 50, sl: 2 } },
          ],
        },
      },
    });

    const critBefore = live(fuyard.id).criticalWounds ?? 0;
    banc.getState().fleeConfirm();
    draineCascade(banc.getState); // la sévérité du dépassement se tire DANS la fenêtre (#1426)

    const f = live(fuyard.id);
    expect(f.wounds.current).toBeLessThanOrEqual(0);
    expect(f.criticalWounds ?? 0).toBeGreaterThan(critBefore); // dépassement → Blessure critique
    expect(hasCondition(f, COND.aTerre)).toBe(true); // …ET l'État À Terre
  });

  it('symétrie du surfaçage : le slot du coup dans le dos suit SON frappeur (humain → interactif, IA → témoin)', () => {
    // (a) frappeur HÉROS (piloté-humain) : son jet est interactif et N'EST PAS auto-roulé.
    const { fuyard } = duelHeros(5);
    banc.getState().disengageFlee();
    const bsA = fleeBackstab(banc.getState().pendingDisengage!)!;
    expect(bsA.interactive).toBe(true);
    expect(bsA.result).toBeNull(); // en attente du frappeur — aucun jet roulé en silence
    expect(fleeTouche(banc.getState().pendingDisengage!)!.interactive).toBe(true); // le fuyard est humain aussi

    // (b) frappeur ENNEMI (IA) : rangée TÉMOIN, jet auto-roulé à l'ouverture (le fuyard garde le sien).
    const b = banc.getState().battle!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    const H = live(fuyard.id);
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    E.pos = { x: 8, y: 10 };
    E.characteristics['capacite-de-combat'] = 90; // touche à coup sûr → le slot du Test `fuite` reste dû
    banc.setState({
      battle: { ...b },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    banc.getState().disengageFlee();
    const pdB = banc.getState().pendingDisengage!;
    expect(fleeBackstab(pdB)!.interactive).toBe(false);
    expect(fleeBackstab(pdB)!.result).toBeTruthy(); // témoin auto-roulé
    expect(fleeTouche(pdB)!.interactive).toBe(true);
  });

  it('100 % IA (ennemi qui fuit un ennemi) : résolution HEADLESS par le même flux, aucun pending qui traîne', () => {
    const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    banc.setState({ party: [A] });
    banc.getState().seedRng(6);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const [E1, E2] = b.combatants.filter((c) => c.kind === 'enemy');
    E1.pos = { x: 16, y: 11 };
    E2.pos = { x: 17, y: 11 };
    E1.engagedWith = [E2.id];
    E2.engagedWith = [E1.id];
    E2.characteristics['capacite-de-combat'] = 90; // le coup dans le dos (+20) touche à coup sûr
    banc.setState({
      battle: { ...b },
      pendingDisengage: { moverId: E1.id, foeId: E2.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    const before = live(E1.id).wounds.current;

    banc.getState().disengageFlee();

    expect(banc.getState().pendingDisengage).toBeNull(); // rien qui traîne
    expect(live(E1.id).wounds.current).toBeLessThan(before); // le coup dans le dos a bien été appliqué
    // …par l'applicateur CANONIQUE d'attaque (événement de journal 'attack'), pas par un chemin parallèle.
    expect(banc.getState().battle!.log.some((e) => e.kind === 'attack' && e.actorId === E2.id)).toBe(true);
    expect(live(E1.id).engagedWith).toEqual([]); // fuite complétée
    // Lancés et clos dans le même geste, aucune rangée ne les a montrés : le journal porte leurs dés.
    const textes = banc.getState().battle!.log.map((e) => e.text);
    expect(textes.some((l) => l.startsWith(`${E2.label} — Corps à corps (dans le dos) : `) && /\d+\/\d+ → .* \(DR [+-]\d+\)\.$/.test(l)), 'le coup dans le dos').toBe(true);
    expect(textes.some((l) => l.startsWith(`${E1.label} — `) && /\d+\/\d+ → .* \(DR [+-]\d+\)\.$/.test(l)), 'le Test `fuite`').toBe(true);
  });

  // LDB 14 l.9 ; LDB 85 l.362.
  it('coup dans le dos d’un héros plus grand : le balayage suit, l’Action rendue à sa fermeture', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const [E1, E2] = b.combatants.filter((c) => c.kind === 'enemy');
    b.combatants.filter((c) => c.kind === 'enemy').slice(2).forEach((e) => (e.dead = true));
    H.size = 'grande';
    H.characteristics['capacite-de-combat'] = 90;
    H.pos = { x: 6, y: 10 };
    E1.pos = { x: 7, y: 10 };
    E2.pos = { x: 5, y: 10 };
    for (const e of [E1, E2]) e.wounds = blessuresDeBase(60, 60, e);
    H.engagedWith = [E1.id, E2.id];
    E1.engagedWith = [H.id];
    E2.engagedWith = [H.id];
    banc.setState({
      battle: { ...b, turn: b.order.indexOf(E1.id), acted: false },
      pendingDisengage: { moverId: E1.id, foeId: H.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    let restitutions = 0;
    const unsub = banc.subscribe((st, prev) => { if (prev.battle?.acted === true && st.battle?.acted === false) restitutions++; });
    try {
      banc.getState().disengageFlee();
      const bs = fleeBackstab(banc.getState().pendingDisengage!)!;
      banc.getState().fleeRoll(bs.id);
      expect(fleeBackstab(banc.getState().pendingDisengage!)!.result!.hit, 'pré-requis : le coup dans le dos touche').toBe(true);
      banc.getState().fleeConfirm();
      const pc = banc.getState().pendingCleave;
      expect(pc?.attackerId, 'le balayage est offert').toBe(H.id);
      expect(pc?.hitIds).toEqual([E1.id]);
      expect(pc?.count, 'aucun enchaînement consommé').toBe(0);
      expect(restitutions, 'la chaîne porte l’Action jusqu’à sa fermeture').toBe(0);
      banc.getState().cleaveEnd();
      expect(banc.getState().battle!.acted, 'attaque GRATUITE : l’Action du fuyard retrouve sa valeur').toBe(false);
      expect(restitutions, 'l’Action est rendue UNE fois').toBe(1);
    } finally {
      unsub();
    }
  });

  // LDB 15 l.63 ; LDB 85 l.362.
  it('IA plus grande qui frappe dans le dos un héros en fuite : le balayage suit', () => {
    const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    const B = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'B', seed: 2 });
    banc.setState({ party: [A, B] });
    banc.getState().seedRng(2);
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    const b = banc.getState().battle!;
    const [fuyard, voisin] = b.combatants.filter((c) => c.kind === 'hero');
    const [E] = b.combatants.filter((c) => c.kind === 'enemy');
    b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
    E.size = 'enorme';
    E.characteristics['capacite-de-combat'] = 90;
    E.pos = { x: 6, y: 10 };
    fuyard.pos = { x: 7, y: 10 };
    voisin.pos = { x: 5, y: 10 };
    for (const h of [fuyard, voisin]) h.wounds = blessuresDeBase(60, 60, h);
    E.engagedWith = [fuyard.id, voisin.id];
    fuyard.engagedWith = [E.id];
    voisin.engagedWith = [E.id];
    banc.setState({
      battle: { ...b, turn: b.order.indexOf(fuyard.id), acted: false },
      pendingDisengage: { moverId: fuyard.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });
    banc.getState().disengageFlee();
    const pd = banc.getState().pendingDisengage!;
    expect(fleeBackstab(pd)!.interactive, 'pré-requis : le frappeur est conduit par l’IA').toBe(false);
    expect(fleeBackstab(pd)!.result!.cleave, 'pré-requis : la touche d’un plus grand pose le balayage').toBe(true);
    if (fleeToucheDu(pd)) banc.getState().fleeRoll(fleeTouche(pd)!.id);
    banc.getState().fleeConfirm();
    draineCascade(banc.getState);
    const pdef = banc.getState().pendingDefense;
    expect(pdef?.attackerId, 'le frappeur enchaîne : fenêtre de défense du voisin du fuyard').toBe(E.id);
    expect(pdef?.defenderId).toBe(voisin.id);
  });

  // Fuyard ARMURÉ : le Coup Critique du coup dans le dos lui OFFRE la Déviation (LDB 63 l.30) →
  // `applyAttackResult` SUSPEND. La fuite (Brisé + Course) ne se complète qu'APRÈS la résolution du
  // coup gratuit — LDB 15 l.68 verbatim : « Une fois que ce coup gratuit est résolu, vous pouvez vous
  // déplacer jusqu'à la limite de votre Mouvement de Course ».
  it('fuyard ARMURÉ : la Déviation Critique SUSPEND — la fuite (Brisé + Course) attend la résolution du coup', () => {
    const { frappeur, fuyard } = duelHeros(7);
    fuyard.armour = { tete: 2, corps: 2, brasG: 2, brasD: 2, jambeG: 2, jambeD: 2 } as never; // PA → Déviation offerte
    fuyard.wounds = blessuresDeBase(40, 40, fuyard);
    const pd = banc.getState().pendingDisengage!;
    banc.setState({
      battle: { ...banc.getState().battle! },
      pendingCascade: null,
      pendingDisengage: {
        ...pd,
        phase: 'fuir',
        fuir: {
          participants: [
            { id: frappeur.id, kind: 'backstab', interactive: false, result: { hit: true, attackerRoll: 33, netSL: 2, location: 'corps', critLocation: 'corps', damage: 6, woundsLost: 6, critical: true, advantageTo: 'attacker', defenderDefeated: false, log: 'dans le dos' } },
            { id: fuyard.id, kind: 'touche', interactive: true, test: testDeRegle('fuite', 'touche-en-fuyant'), jet: { success: false, roll: 70, target: 50, sl: -1 } },
          ],
        },
      },
    });

    banc.getState().fleeConfirm();

    // (1) SUSPENDU : le choix Dévier/Subir est posé, la fuite N'EST PAS complétée.
    const casc = banc.getState().pendingCascade!;
    expect(casc.participants.some((s) => s.kind === 'deviation')).toBe(true);
    expect(casc.participants.some((s) => s.kind === 'fleeMove')).toBe(true); // étape de REPRISE de la fuite
    expect(live(fuyard.id).engagedWith).toEqual([frappeur.id]); // toujours Engagé
    expect(stacks(live(fuyard.id), COND.brise)).toBe(0); // aucun État Brisé tant que le coup n'est pas résolu
    expect(banc.getState().battle!.reachable.size).toBe(0); // aucun budget de Course posé

    // (2) « Subir » : le Critique s'applique, PUIS la fuite se complète (Brisé + libération + Course).
    const devId = banc.getState().pendingCascade!.participants.find((s) => s.kind === 'deviation')!.id;
    banc.getState().cascadeTableRoll(devId); // le d100 de sévérité tombe DANS la MÊME fenêtre (#1426)
    banc.getState().cascadeChoose(devId, 'subir');
    draineCascade(banc.getState, 4);
    const f = live(fuyard.id);
    expect(f.criticalWounds ?? 0).toBeGreaterThan(0); // Blessure critique subie
    expect(stacks(f, COND.brise)).toBe(2); // Test `fuite` raté DR -1 → 1 + 1 États Brisés (LDB 15 l.66)
    expect(f.engagedWith).toEqual([]); // fuite complétée APRÈS le coup
    expect(banc.getState().battle!.reachable.size).toBeGreaterThan(0); // budget de Course posé
  });

  // LDB 15 l.63 : le coup dans le dos est un « Test de Corps à corps non opposé ». Un frappeur qui a
  // un ARC en main ne tire donc pas dans le dos : il frappe (arme de mêlée, mains nues à défaut).
  it('frappeur avec un ARC en main : le coup dans le dos reste un Test de CORPS À CORPS', () => {
    const { frappeur, fuyard } = duelHeros(10);
    frappeur.weapons = [{ name: 'Arc', label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 4 }, qualities: [], range: 60 }] as never;
    fuyard.wounds = blessuresDeBase(40, 40, fuyard);
    banc.setState({ battle: { ...banc.getState().battle! } });

    banc.getState().disengageFlee();
    const bs = fleeBackstab(banc.getState().pendingDisengage!)!;
    banc.getState().fleeRoll(bs.id);
    const res = fleeBackstab(banc.getState().pendingDisengage!)!.result!;
    expect(res.attackerDetail!.label).not.toMatch(/Projectiles/); // jet de CC, pas de CT
    const pdNow = banc.getState().pendingDisengage!;
    if (fleeToucheDu(pdNow)) banc.getState().fleeRoll(fleeTouche(pdNow)!.id);
    banc.getState().fleeConfirm();
    const log = banc.getState().battle!.log;
    expect(log.some((e) => e.kind === 'attack' && e.actorId === frappeur.id)).toBe(true);
    expect(log.some((e) => e.kind === 'shoot')).toBe(false); // jamais la branche TIR (munitions/dispersion)
  });

  // Coop : les DEUX slots sont joués par des SIÈGES différents (héros frénétique qui frappe le héros
  // d'un autre joueur). `interactive` suit l'acteur JOUÉ (jamais `pilotedByHuman`, évalué chez l'hôte) et
  // l'étape porte `groupOwner` → chacun voit la fenêtre et n'influence QUE son slot.
  it('coop : slots joués par deux sièges → étape de GROUPE, chaque siège ne pilote QUE son slot', () => {
    const { frappeur, fuyard } = duelHeros(8);
    banc.setState({
      net: { ...banc.getState().net, mode: 'host', mySeat: 0, ownership: { [frappeur.id]: 1 } },
      pendingCascade: cascadeDeTest([{ id: 'disengage', kind: 'disengageStep', jet: 'disengage', actorId: fuyard.id }], { title: 'Se désengager', icon: 'action/disengage', purpose: 'combat' }),
    });
    banc.getState().disengageFlee();
    const st = banc.getState();

    // Les deux rangées sont INTERACTIVES (acteurs joués), le coup dans le dos n'est PAS auto-roulé.
    expect(fleeBackstab(st.pendingDisengage!)!.interactive).toBe(true);
    expect(fleeBackstab(st.pendingDisengage!)!.result).toBeNull();
    expect(fleeTouche(st.pendingDisengage!)!.interactive).toBe(true);
    // La fenêtre est un moment PARTAGÉ ('*') : sinon le siège du frappeur ne la verrait jamais.
    expect(modalOwnerOf(st)).toBe('*');
    // Chaque siège ne lance QUE le jet de SON héros (routage par possession du 1ᵉʳ argument).
    expect(intentAllowedFor(st, 1, 'fleeRoll', [frappeur.id])).toBe(true);
    expect(intentAllowedFor(st, 0, 'fleeRoll', [frappeur.id])).toBe(false);
    expect(intentAllowedFor(st, 0, 'fleeRoll', [fuyard.id])).toBe(true);
    expect(intentAllowedFor(st, 1, 'fleeRoll', [fuyard.id])).toBe(false);
  });

  // Bac-à-sable MJ (`gmSeat`) : l'ennemi frappeur est piloté par un humain (le MJ) mais n'est PAS un
  // acteur JOUÉ → sa rangée reste TÉMOIN (auto-roulée). Sans cela : impasse — la fenêtre est chez le
  // fuyard (qui n'a pas le droit de lancer le jet de l'ennemi) et le MJ n'a pas la fenêtre.
  it('MJ (gmSeat) : le coup dans le dos d’un ENNEMI reste témoin auto-roulé — aucune impasse', () => {
    const { fuyard } = duelHeros(9);
    const b = banc.getState().battle!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    const H = live(fuyard.id);
    H.engagedWith = [E.id];
    E.engagedWith = [H.id];
    E.pos = { x: 8, y: 10 };
    E.characteristics['capacite-de-combat'] = 90;
    banc.setState({
      net: { ...banc.getState().net, mode: 'host', mySeat: 0, gmSeat: 0 },
      battle: { ...b },
      pendingDisengage: { moverId: H.id, foeId: E.id, canSacrifice: false, phase: 'choice', atk: null, def: null, result: null },
    });

    banc.getState().disengageFlee();

    const pdB = banc.getState().pendingDisengage!;
    expect(fleeBackstab(pdB)!.interactive).toBe(false);
    expect(fleeBackstab(pdB)!.result).toBeTruthy(); // résolu à l'ouverture : le fuyard n'attend personne
    expect(fleeTouche(pdB)!.interactive).toBe(true);
    // Le fuyard peut mener la fenêtre à son terme tout seul.
    banc.getState().fleeRoll(H.id);
    banc.getState().fleeConfirm();
    expect(banc.getState().pendingDisengage).toBeNull();
  });
});
