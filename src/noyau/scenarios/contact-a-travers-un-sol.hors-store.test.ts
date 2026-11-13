import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { MELEE, ouvrirLeDuel } from '../combatDeTest.testkit';
import { testScenarios } from '../../scenes/test-scenarios';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { distanceDeCombat, distanceDeContact, footprintChebyshev, footprintN } from '../monde/footprint';
import { positionPosee } from '../monde/spawn';
import { STEP_MAX_M } from '../monde/relief';
import { advanceTurn, aiAvailableFreeAttack, attackEnv, attackPlan, buildAiInput } from '../combatFlow';
import { cliquerSurLeCombattant } from '../combatOrParty';
import { hoverTargeting } from '../targeting';
import { effectifAuContact } from '../combat/surnombre';
import { ligneDeRegle, refDeRegle } from '../../engine/reglesChiffrees';
import { ligneDe } from '../../engine/modLine.testkit';
import { isInanimate } from '../../engine/structures';
import type { Combatant } from '../../engine/types';

/**
 * #4090 : deux combattants que sépare un sol plein ne sont pas au contact. LDB 13 l.114 ; LDB 15 l.12 ; LDB 14 l.67.
 * Scènes réelles chargées par le jeu (`lancerLaScene`, ponts des navires posés), combattants posés par `placeCombatant`.
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const duel = (scenarioId: string, encId: string, tiers?: 'heros' | 'ennemi') =>
  ouvrirLeDuel(banc, testScenarios.find((s) => s.id === scenarioId)!.construire(idsDeTest), encId, tiers);

/** Une mêlée offerte à `A` contre `B` qui se joue à travers un sol : l'attaque directe, ou une arrivée (Charge,
 *  déplacement puis attaque) d'où `A`, posé là, n'est pas au contact de `B`. */
const melee = (A: Combatant, B: Combatant): { offerte: boolean; aTraversLeSol: boolean } => {
  const plan = attackPlan(banc.getState, A, B);
  if (plan.kind === 'bloque') return { offerte: false, aTraversLeSol: false };
  if (plan.kind === 'attaque') return { offerte: true, aTraversLeSol: distanceDeContact(banc.getState().scene, A, B) > 1 };
  const arrivee = { ...A, pos: positionPosee(banc.getState().scene, footprintN(A), plan.dest) };
  return { offerte: true, aTraversLeSol: distanceDeContact(banc.getState().scene, arrivee, B) !== 1 };
};
const offert = (A: Combatant, B: Combatant) => melee(A, B).offerte;

describe('#4090 — la barge d’embuscade-fluviale : la cale et le pont', () => {
  it('cale (5,6,0) et pont (5,6,1) : ni mêlée offerte, ni Surnombre, ni attaque gratuite', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(E, { x: 5, y: 6, z: 0 });
    poser(H, { x: 5, y: 6, z: 1 });
    expect(E.pos!.plafond, 'la cale est sous le pont').toBeLessThanOrEqual(H.pos!.h ?? 0);
    expect(melee(H, E).aTraversLeSol).toBe(false);
    expect(attackPlan(banc.getState, E, H).kind, 'ni attaque ni charge de la cale vers le pont').toBe('bloque');
    expect(effectifAuContact(banc.getState().scene, banc.getState().battle!, E, 'heros')).toBe(0);
    E.aiControlled = true;
    (E.psychState ??= []).push({ type: 'frenesie' });
    expect(aiAvailableFreeAttack(banc.getState, banc.setState, E)).toBe(false);
    expect(banc.getState().pendingDefense).toBeFalsy();
  });

  it('colonne voisine sous le même pont : (3,8,0) et (4,8,1) séparés', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(E, { x: 3, y: 8, z: 0 });
    poser(H, { x: 4, y: 8, z: 1 });
    expect(footprintChebyshev(E.pos!, 1, H.pos!, 1)).toBe(1);
    expect(attackPlan(banc.getState, H, E).kind).not.toBe('attaque');
    expect(melee(H, E).aTraversLeSol).toBe(false);
    expect(melee(E, H).aTraversLeSol).toBe(false);
    expect(effectifAuContact(banc.getState().scene, banc.getState().battle!, E, 'heros')).toBe(0);
  });

  it('sous la trappe, la case (4,7) de la cale garde le contact avec le pont voisin (5,7,1)', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(E, { x: 4, y: 7, z: 0 });
    poser(H, { x: 5, y: 7, z: 1 });
    expect(offert(H, E)).toBe(true);
    expect(effectifAuContact(banc.getState().scene, banc.getState().battle!, E, 'heros')).toBe(1);
    E.aiControlled = true;
    (E.psychState ??= []).push({ type: 'frenesie' });
    expect(aiAvailableFreeAttack(banc.getState, banc.setState, E)).toBe(true);
  });

  it('l’attaque gratuite de la Frénésie va au héros légitime, pas à celui que le sol sépare et que la liste nomme d’abord', () => {
    const { H, E, T, poser } = duel('embuscade-fluviale', 'enc-fluvial', 'heros');
    const H2 = T!;
    const b = banc.getState().battle!;
    b.combatants = [H, ...b.combatants.filter((c) => c !== H)];
    poser(E, { x: 5, y: 6, z: 0 });
    poser(H, { x: 5, y: 6, z: 1 });
    poser(H2, { x: 4, y: 6, z: 0 });
    expect(distanceDeContact(banc.getState().scene, E, H)).toBe(Infinity);
    expect(distanceDeContact(banc.getState().scene, E, H2)).toBe(1);
    E.aiControlled = true;
    (E.psychState ??= []).push({ type: 'frenesie' });
    expect(aiAvailableFreeAttack(banc.getState, banc.setState, E)).toBe(true);
    expect(banc.getState().pendingDefense?.defenderId).toBe(H2.id);
  });

  it('la Charge réelle du joueur vers la cale pose sa position d’arrivée : sous le pont, hors de contact du pont, et aucun Engagement à travers lui', () => {
    const { H, E, T, poser } = duel('embuscade-fluviale', 'enc-fluvial', 'ennemi');
    const D = T!;
    poser(E, { x: 3, y: 9, z: 0 });
    poser(D, { x: 5, y: 9, z: 1 });
    poser(H, { x: 8, y: 9, z: 0 });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true, intentionId: 'charge' });
    banc.reprendreLesEnAttente();
    expect(banc.getState().pendingAttack?.fromCharge).toBe(true);
    expect(H.pos).toEqual(positionPosee(banc.getState().scene, 1, H.pos!));
    expect(H.pos!.plafond, 'arrivée sous le pont').toBeLessThanOrEqual(D.pos!.h ?? 0);
    expect(distanceDeContact(banc.getState().scene, H, D)).toBe(Infinity);
    expect(attackPlan(banc.getState, D, H).kind).toBe('bloque');
    banc.getState().jetLancer('attaque');
    banc.reprendreLesEnAttente();
    expect(D.engagedWith ?? []).not.toContain(H.id);
    expect(H.engagedWith ?? []).not.toContain(D.id);
  });

  it('la cale (5,6,0) sous le pont (5,6,1) : la Charge du joueur ne s’offre pas, aucune attaque ni Engagement', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(E, { x: 5, y: 6, z: 1 });
    poser(H, { x: 5, y: 6, z: 0 });
    cliquerSurLeCombattant(banc.getState, E.id, { confirm: true, intentionId: 'charge' });
    banc.reprendreLesEnAttente();
    expect(banc.getState().pendingAttack).toBeFalsy();
    expect(H.engagedWith ?? []).not.toContain(E.id);
    expect(E.engagedWith ?? []).not.toContain(H.id);
  });

  it('le soin de combat ne s’offre pas à l’allié blessé en cale sous le soigneur du pont, il s’offre à l’allié du même pont', () => {
    const { H, T, poser } = duel('embuscade-fluviale', 'enc-fluvial', 'heros');
    const H2 = T!;
    H2.wounds = { ...H2.wounds, current: 1 };
    banc.setState({ battle: { ...banc.getState().battle!, action: 'soins' } });
    poser(H, { x: 5, y: 6, z: 1 });
    poser(H2, { x: 5, y: 6, z: 0 });
    expect(distanceDeContact(banc.getState().scene, H, H2)).toBe(Infinity);
    expect(hoverTargeting(banc.getState, H, H2).kind, 'à travers le pont').toBe('none');
    poser(H2, { x: 5, y: 7, z: 1 });
    expect(distanceDeContact(banc.getState().scene, H, H2)).toBe(1);
    expect(hoverTargeting(banc.getState, H, H2).kind, 'au contact sur le pont').not.toBe('none');
  });

  it('la portée ne change pas : distanceDeCombat entre la cale et le pont reste la distance d’empreinte et de relief', () => {
    const { H, E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(E, { x: 3, y: 8, z: 0 });
    poser(H, { x: 4, y: 8, z: 1 });
    expect(distanceDeCombat(H, E)).toBe(Math.max(1, Math.abs((H.pos!.h ?? 0) - (E.pos!.h ?? 0)) / 2));
  });

  it('`pos.plafond` : absent à ciel ouvert, posé sous le pont, retiré quand le combattant en sort', () => {
    const { E, poser } = duel('embuscade-fluviale', 'enc-fluvial');
    poser(E, { x: 4, y: 8, z: 1 });
    expect(E.pos!.plafond ?? Infinity).toBeGreaterThan(E.pos!.h ?? 0);
    poser(E, { x: 0, y: 0, z: 0 });
    expect('plafond' in E.pos!).toBe(false);
    poser(E, { x: 5, y: 6, z: 0 });
    expect(E.pos!.plafond).toBeDefined();
    poser(E, { x: 0, y: 0, z: 0 });
    expect('plafond' in E.pos!).toBe(false);
  });
});

describe('#4090 — embuscade-fluviale : le Surnombre ne compte que des Personnages (LDB 14 l.110)', () => {
  /** Les coques rendues à la bataille (la « Barque des pirates », camp ennemi, et la barge des héros), un héros H
   *  au contact de la barque et d'un Pirate E, et, sur demande, un second Pirate D au contact de H ; c'est au tour
   *  de E, piloté par l'IA. */
  function abordage(second?: 'ennemi') {
    const { H, E, T: D, poser } = duel('embuscade-fluviale', 'enc-fluvial', second);
    const coques = banc.getState().battle!.combatants.filter((c) => isInanimate(c));
    for (const c of coques) delete c.dead;
    const B = coques.find((c) => c.kind === 'ennemi')!;
    poser(H, { x: 13, y: 6, z: 0 });
    poser(E, { x: 12, y: 6, z: 0 });
    if (D) poser(D, { x: 12, y: 7, z: 0 });
    E.aiControlled = true;
    banc.setState({ battle: { ...banc.getState().battle!, order: [H.id, E.id], turn: 0 }, pendingDefense: null });
    return { H, E, B };
  }
  /** La mêlée réelle de E sur H : la fin du tour de H rend la main à l'IA, dont l'attaque ouvre la défense de H. */
  const attaqueDeE = (H: Combatant, E: Combatant) => {
    advanceTurn(banc.getState, banc.setState);
    banc.avancer(2000);
    const def = banc.getState().pendingDefense;
    expect(def?.attackerId).toBe(E.id);
    expect(def?.defenderId).toBe(H.id);
    return ligneDe(def!.env, refDeRegle('superiorite-numerique'));
  };

  it('au contact de la barque et d’un seul Pirate, le héros n’est pas en infériorité : la mêlée du Pirate est sans Surnombre', () => {
    const { H, E, B } = abordage();
    expect(distanceDeContact(banc.getState().scene, B, H), 'la barque touche le héros').toBe(1);
    expect(distanceDeContact(banc.getState().scene, E, H)).toBe(1);
    expect(effectifAuContact(banc.getState().scene, banc.getState().battle!, H, 'ennemi')).toBe(1);
    expect(attaqueDeE(H, E)).toBeUndefined();
  });

  it('un second Pirate au contact donne le Surnombre à la même mêlée', () => {
    const { H, E } = abordage('ennemi');
    expect(effectifAuContact(banc.getState().scene, banc.getState().battle!, H, 'ennemi')).toBe(2);
    expect(attaqueDeE(H, E)).toEqual(ligneDeRegle('superiorite-numerique', 'deux-contre-un'));
  });

  it('l’escouade que l’IA reçoit du jeu porte la barque', () => {
    const { E, B } = abordage();
    expect(buildAiInput(E, banc.getState).squad).toContain(B);
  });
});

describe('#4090 — siege-enceinte : deux hauteurs que rien ne sépare', () => {
  it('pied de rampe (2,41,0) à 0 m et rampe (3,41,0) à 2 m : mêlée offerte, avec « En contrebas »', () => {
    const { H, E, poser } = duel('siege-enceinte', 'assaut');
    poser(H, { x: 2, y: 41, z: 0 });
    poser(E, { x: 3, y: 41, z: 0 });
    expect((E.pos!.h ?? 0) - (H.pos!.h ?? 0)).toBeGreaterThan(STEP_MAX_M);
    expect(offert(H, E)).toBe(true);
    expect(attackEnv(banc.getState, H, E, MELEE).env).toContainEqual(ligneDeRegle('cible-en-contrebas', 'en-contrebas'));
  });

  it('haut de rampe (3,39,0) et chemin de ronde (3,38,1), même hauteur : mêlée offerte', () => {
    const { H, E, poser } = duel('siege-enceinte', 'assaut');
    poser(H, { x: 3, y: 39, z: 0 });
    poser(E, { x: 3, y: 38, z: 1 });
    expect(offert(H, E)).toBe(true);
  });
});
