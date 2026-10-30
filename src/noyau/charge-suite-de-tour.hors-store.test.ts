/**
 * UN TOUR D'IA DÉCIDÉ PART AU PLUS UNE FOIS (#3058, #1852) : pour une clé de tour, l'IA décide une fois et chaque
 * geste décidé (frappe, avancer, sort, zone, déplacer) part au plus une fois ; un tour suspendu après sa décision
 * se reprend par SA suite, jamais par un rejeu ni par un second armement.
 *
 * Cas canonique : un héros en Auto-combat charge un porteur de Frappe réactive (LDB 10 l.498), dont la riposte
 * ouvre sa fenêtre sur le chargeur pendant le télégraphe de la charge. Chaque test épingle sa
 * graine et AFFIRME le chemin qu'il prend.
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState, GesteDeSuite } from './etat';
import { advanceTurn, aiTurnLog, clearAiTurnLog, maybeRunEnemyTurn } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { startCascade } from './cascade';
import { avanceEtapeCascade } from './cascade.testkit';
import { cleDeFixture } from './noyau.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { bus, EVT } from './bus';
import { spawnEnemy } from './monde/spawn';
import { setCadence } from '../engine/cadence';
import { isOutOfAction } from '../engine/conditions';
import { blessuresDeBase } from '../engine/characteristics';
import { pregen, PREGEN } from '../data/pregens';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[] = [sword], pv = 40): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: pv, max: pv },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const CROSSBOW: Weapon = { label: 'Arbalète', type: 'ranged', damage: { plusBF: false, flat: 9 }, range: 60, reload: 1, qualities: [], uid: 'xb', loaded: false } as unknown as Weapon;

/** Pose un combat de Round 1 (ordre = ordre des combattants), en solo. */
function poser(banc: Banc, seed: number, combattants: Combatant[]): void {
  seedBattleRng(seed);
  const ids = combattants.map((c) => c.id);
  const battle = {
    combatants: combattants, order: ids, baseOrder: ids, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    battle, mode: 'battle', scene: testScene(), party: combattants.filter((c) => c.kind === 'hero'),
    pendingDefense: null, pendingAttack: null, pendingCascade: null, suspendedCascades: [],
    net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
}

/** Le héros `h` (Auto-combat), hors contact, charge `e`, porteur de Frappe réactive au Test d'Initiative quasi-garanti. */
function charge(banc: Banc, seed: number, autres: Combatant[] = [], pvDuChargeur = 40): void {
  const h = mk('h', 'hero', { x: 4, y: 0 }, [sword], pvDuChargeur);
  const e = mk('e', 'enemy', { x: 0, y: 0 });
  e.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
  e.characteristics.initiative = 99;
  poser(banc, seed, [h, e, ...autres]);
}

let banc: Banc;
const g = () => banc.getState();
const b = () => g().battle!;
const attaques = (de: string, sur?: string) => b().log.filter((l) => l.kind === 'attack' && l.actorId === de && (!sur || l.targetId === sur)).length;
const decisions = (id: string, round = 1) => aiTurnLog().filter((r) => r.id === id && r.round === round).length;
const suite = (): GesteDeSuite['kind'] | undefined => b().tourIA?.suite?.geste.kind;
const parquee = () => !!b().tourIA?.parquee;

/** Reprend les échéances une à une tant que `encore` tient (borne : un pilote qui ne progresse pas ÉCHOUE). */
function tantQue(encore: () => boolean, borne = 300): void {
  for (let i = 0; i < borne && encore(); i++) if (!banc.jusquALaProchaine()) return;
}
/** Le combat tient au premier tour du Round 1. */
const auPremierTour = () => b().turn === 0 && b().round === 1 && !b().over;

/** Joue la séquence ouverte comme le joueur jusqu'à sa clôture : une fenêtre de défense par Lancer → Appliquer,
 *  toute autre étape par le kit (`avanceEtapeCascade`). */
function jouerLaSequence(borne = 40): void {
  for (let i = 0; i < borne; i++) {
    if (g().pendingDefense) { g().defenseRoll(); g().defenseConfirm(); continue; }
    if (avanceEtapeCascade(g) === undefined) return;
  }
}

/** Une fenêtre NEUTRE (séquence d'affichage) qui tient la main du combat dans toute cadence : un choix sans défaut
 *  authoré attend le joueur (`combatAuto.ts`). */
function ouvrirUneFenetreNeutre(acteurId: string): void {
  startCascade(g, banc.setState, { title: 'T', purpose: 'combat', steps: [{ id: 'aff', kind: cleDeFixture('display'), actorId: acteurId, options: [{ key: 'ok', label: fixtureText('OK') }] }] });
}

/** Le joueur remet l'Auto-combat (effet de la préférence de cadence, `state/preferences.ts`). */
function remettreLAutoCombat(): void {
  setCadence('auto');
  g().resumeCadence();
}
/** Le joueur reprend la main (cadence manuelle). */
function passerEnManuel(): void {
  setCadence('manuel');
  g().resumeCadence();
}

describe('#3058 — la charge du héros en Auto-combat sur un porteur de Frappe réactive : UNE décision, UNE frappe', () => {
  it('A-avant (graine 3) : la fenêtre de la riposte se ferme AVANT la frappe — la suite attend, puis part une fois', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 3);
    maybeRunEnemyTurn(g, banc.setState);
    let fenetre = false;
    let preuve: { suite?: string; parquee: boolean; reticule?: string; attaques: number } | null = null;
    for (let i = 0; i < 300 && auPremierTour(); i++) {
      const avant = !!g().pendingDefense;
      if (!banc.jusquALaProchaine()) break;
      if (g().pendingDefense) fenetre = true;
      if (avant && !g().pendingDefense && !preuve) preuve = { suite: suite(), parquee: parquee(), reticule: g().actorAim?.fromId, attaques: attaques('h', 'e') };
    }
    expect(fenetre, 'chemin : la riposte ouvre SA fenêtre sur le chargeur').toBe(true);
    expect(preuve, 'preuve d’instance : à la fermeture, la frappe est la SUITE armée du tour, réticule tenu, rien frappé').toEqual({ suite: 'frappe', parquee: false, reticule: 'h', attaques: 0 });
    expect(attaques('h', 'e'), 'une frappe').toBe(1);
    expect(decisions('h'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('A-parquée (graine 3) : la frappe échoit PENDANT la fenêtre que le joueur tient — elle est parquée, puis part une fois', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 3);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !g().pendingDefense);
    expect(g().pendingDefense?.defenderId, 'chemin : le chargeur se défend de la riposte').toBe('h');
    const fenetreRiposte = g().pendingDefense;
    passerEnManuel(); // la fenêtre tient la main du joueur
    expect(() => banc.reprendreTout()).not.toThrow();
    expect(g().pendingDefense, 'la fenêtre de la riposte tient toujours la main').toBe(fenetreRiposte);
    expect([suite(), parquee(), attaques('h', 'e')], 'la frappe échue sur la main tenue est PARQUÉE, rien frappé').toEqual(['frappe', true, 0]);
    jouerLaSequence();
    remettreLAutoCombat();
    tantQue(auPremierTour);
    expect(attaques('h', 'e'), 'la frappe du chargeur n’est pas perdue : une').toBe(1);
    expect(decisions('h'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('E (graine 1) : la riposte met le chargeur hors de combat — aucune frappe, le tour avance', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 1, [mk('h2', 'hero', { x: 9, y: 9 })], 1);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(auPremierTour);
    expect(isOutOfAction(b().combatants.find((c) => c.id === 'h')!), 'chemin : la riposte a mis le chargeur hors de combat').toBe(true);
    expect(attaques('e', 'h'), 'la riposte a frappé').toBe(1);
    expect(attaques('h'), 'le chargeur ne frappe pas').toBe(0);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('E-fin (graine 1) : la riposte met le dernier héros hors de combat — le combat finit, sans télégraphe de son geste', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 1, [], 1);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !b().over);
    expect([b().over, attaques('e', 'h'), attaques('h')], 'chemin : la riposte a fini le combat avant la frappe du chargeur').toEqual(['defeat', 1, 0]);
    expect([g().actorAim, g().actorMove, g().actorAoe], 'aucun télégraphe ne survit au combat').toEqual([null, null, null]);
  });

  it('E-victoire (graine 1) : la riposte du héros met le dernier ennemi hors de combat — sous la séquence de fin, aucun télégraphe de son geste', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    const e = mk('e', 'enemy', { x: 4, y: 0 }, [sword], 1);
    e.traits = [{ id: 'corruption', arg: 'mineure' }] as never;
    const h = mk('h', 'hero', { x: 0, y: 0 });
    h.talents = [{ talentId: 'frappe-reactive', times: 1 }] as never;
    h.characteristics.initiative = 99;
    h.aiControlled = true; // riposte résolue par l'IA ; le héros manuel `h2` tient le Test de fin de combat
    poser(banc, 1, [e, h, mk('h2', 'hero', { x: 9, y: 9 })]);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !isOutOfAction(b().combatants[0]));
    expect([isOutOfAction(b().combatants[0]), attaques('h', 'e'), attaques('e')], 'chemin : la riposte a fini l’ennemi avant sa frappe').toEqual([true, 1, 0]);
    expect([g().pendingCascade?.purpose, b().over], 'chemin : la séquence de fin de combat tient la main, la victoire attend').toEqual(['combat', null]);
    expect([g().actorAim, g().actorMove, g().actorAoe], 'aucun télégraphe sous la séquence de fin').toEqual([null, null, null]);
    banc.reprendreTout();
    expect([g().actorAim, g().actorMove, g().actorAoe], 'ni après l’échéance de son geste').toEqual([null, null, null]);
  });

  it('H (graine 3) : bascule en manuel pendant la suite parquée, le joueur frappe à la main, puis remet l’Auto-combat — une frappe, le tour avance', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 3);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !g().pendingDefense);
    passerEnManuel();
    banc.reprendreTout();
    expect([suite(), parquee()], 'chemin : la frappe est parquée').toEqual(['frappe', true]);
    jouerLaSequence();
    g().battleClickEntity('e', { confirm: true });
    g().attackRoll();
    g().attackConfirm();
    jouerLaSequence();
    expect([attaques('h', 'e'), b().acted], 'le joueur a frappé à la main : son Action est dépensée').toEqual([1, true]);
    remettreLAutoCombat();
    expect([suite(), g().actorAim], 'la frappe parquée, Action dépensée, se réarme en « avancer », sans réticule').toEqual(['avancer', null]);
    tantQue(auPremierTour);
    expect(attaques('h', 'e'), 'une frappe au total').toBe(1);
    expect(decisions('h'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('H′ (graine 3) : bascule en manuel pendant la suite NON parquée, retour en Auto sans geste du joueur — la frappe part une fois', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 3);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !g().pendingDefense);
    tantQue(() => !!g().pendingDefense);
    expect([suite(), parquee(), attaques('h', 'e')], 'chemin : la fenêtre est close, la frappe attend son échéance').toEqual(['frappe', false, 0]);
    passerEnManuel();
    banc.reprendreTout();
    expect([suite(), parquee(), attaques('h', 'e')], 'la frappe échue sans le siège est parquée, pas jouée').toEqual(['frappe', true, 0]);
    remettreLAutoCombat();
    tantQue(auPremierTour);
    expect(attaques('h', 'e'), 'une frappe').toBe(1);
    expect(decisions('h'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('H″ (graine 3) : l’Action dépensée à la main avant l’échéance — la suite consommée finit le tour, sans frapper', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 3);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !g().pendingDefense);
    tantQue(() => !!g().pendingDefense);
    passerEnManuel();
    g().battleClickEntity('e', { confirm: true });
    g().attackRoll();
    g().attackConfirm();
    jouerLaSequence();
    expect([suite(), parquee(), attaques('h', 'e'), b().acted], 'chemin : la suite attend, l’Action est dépensée à la main').toEqual(['frappe', false, 1, true]);
    remettreLAutoCombat();
    tantQue(auPremierTour);
    expect(attaques('h', 'e'), 'aucune frappe de plus').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('Action dépensée ET fenêtre ouverte à l’échéance (graine 3) : la suite est parquée, puis le tour avance une fois', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    charge(banc, 3);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !g().pendingDefense);
    tantQue(() => !!g().pendingDefense);
    passerEnManuel();
    g().battleClickEntity('e', { confirm: true });
    g().attackRoll();
    g().attackConfirm();
    jouerLaSequence();
    remettreLAutoCombat();
    ouvrirUneFenetreNeutre('h');
    banc.reprendreTout();
    expect([suite(), parquee(), b().acted, b().turn], 'chemin : la suite échue sur la fenêtre est parquée, l’Action dépensée').toEqual(['frappe', true, true, 0]);
    g().cascadeFinish();
    tantQue(auPremierTour);
    expect(attaques('h', 'e'), 'aucune frappe de plus').toBe(1);
    expect(b().turn, 'le tour a avancé une fois').toBe(1);
  });
});

/** L'ennemi `e`, source de Peur du héros MANUEL `h` qui le craint, s'en approche (Peur à l'approche, LDB 21 l.27). */
function approche(banc: Banc, depart: { x: number; y: number }): void {
  const h = mk('h', 'hero', { x: 0, y: 0 });
  h.psychState = [{ type: 'peur', sourceId: 'e', indice: 2, calmeDR: 0 }];
  const e = mk('e', 'enemy', depart);
  e.movement = 2;
  poser(banc, 4, [e, h]);
}
const bandeOuverte = () => !!g().pendingCascade?.participants.some((s) => s.kind === 'triggeredBatchTest');

describe('#3058 — Peur à l’approche (LDB 21 l.27) : la bande tient la main pendant la suite du tour', () => {
  it('B (graine 1) : la frappe échoit sur la bande — parquée, puis UNE frappe à sa clôture', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    approche(banc, { x: 3, y: 0 });
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !bandeOuverte());
    expect(bandeOuverte(), 'chemin : l’approche ouvre la bande de Peur').toBe(true);
    banc.avancer(3000);
    expect([suite(), parquee(), attaques('e', 'h')], 'la frappe est parquée, rien frappé').toEqual(['frappe', true, 0]);
    g().cascadeBatchRoll('h');
    g().cascadeNext();
    tantQue(() => !g().pendingDefense);
    jouerLaSequence();
    banc.reprendreTout();
    expect(attaques('e', 'h'), 'une frappe').toBe(1);
    expect(decisions('e'), 'une décision').toBe(1);
  });

  it('B′ (graine 1) : déplacement sans contact — l’« avancer » échu sur la bande est parqué, puis le tour avance une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    approche(banc, { x: 7, y: 0 });
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !bandeOuverte());
    expect(bandeOuverte(), 'chemin : l’approche ouvre la bande de Peur').toBe(true);
    banc.avancer(3000);
    expect([suite(), parquee(), b().turn], 'l’« avancer » est parqué').toEqual(['avancer', true, 0]);
    g().cascadeBatchRoll('h');
    g().cascadeNext();
    banc.reprendreTout();
    expect(attaques('e'), 'aucune frappe').toBe(0);
    expect(decisions('e'), 'une décision').toBe(1);
    expect([b().round, b().turn], 'le tour a avancé une fois').toEqual([1, 1]);
  });

  it('C (graine 1) : la bande jouée AVANT l’échéance — la frappe part à son échéance, une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    approche(banc, { x: 3, y: 0 });
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !bandeOuverte());
    expect([bandeOuverte(), suite(), parquee()], 'chemin : la bande est ouverte, la frappe attend son échéance').toEqual([true, 'frappe', false]);
    g().cascadeBatchRoll('h');
    g().cascadeNext();
    tantQue(() => !g().pendingDefense);
    jouerLaSequence();
    banc.reprendreTout();
    expect(attaques('e', 'h'), 'une frappe').toBe(1);
    expect(decisions('e'), 'une décision').toBe(1);
  });
});

/** Un lanceur ennemi (Langue (Magick)) qui connaît `sort`, face aux héros MANUELS `heros`. */
function lanceur(banc: Banc, seed: number, sort: string, heros: Combatant[]): void {
  const e = spawnEnemy({ ref: 'humain' }, 'e', { x: 1, y: 1 });
  e.characteristics.intelligence = 60;
  e.characteristics['force-mentale'] = 60;
  e.skills = [{ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 } as never];
  e.spells = [sort];
  e.weapons = [];
  poser(banc, seed, [e, ...heros]);
}
const pretire = (id: string, pos: { x: number; y: number }): Combatant => {
  const h = pregen(PREGEN.soldat);
  h.id = id; h.label = id; h.pos = pos; h.wounds = blessuresDeBase(99);
  return h;
};
/** Compte les incantations ouvertes par `id`. */
function incantations(id: string): () => number {
  let n = 0;
  banc.subscribe((s, p) => { if (s.pendingCast?.casterId === id && p.pendingCast?.casterId !== id) n++; });
  return () => n;
}

describe('#3058 — fenêtre neutre à l’échéance d’un geste : il est parqué, puis exécuté UNE fois', () => {
  /** Laisse l'IA décider (le minuteur de tour échoit) et rend le geste qu'elle a différé. */
  const decider = (): GesteDeSuite['kind'] | undefined => { maybeRunEnemyTurn(g, banc.setState); tantQue(() => !b().tourIA); return suite(); };
  /** La fenêtre neutre tient la main à l'échéance, puis se clôt. */
  const tenirPuisClore = (acteurId: string) => {
    ouvrirUneFenetreNeutre(acteurId);
    banc.avancer(3000);
    const tenue = [suite(), parquee()];
    g().cascadeFinish();
    return tenue;
  };

  it('F-frappe (graine 1) : au contact du héros manuel, la frappe parquée part une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    poser(banc, 1, [mk('e', 'enemy', { x: 1, y: 0 }), mk('h', 'hero', { x: 0, y: 0 })]);
    expect(decider(), 'chemin : l’IA décide une frappe').toBe('frappe');
    expect(tenirPuisClore('e'), 'parquée sur la fenêtre').toEqual(['frappe', true]);
    tantQue(() => !g().pendingDefense);
    jouerLaSequence();
    banc.reprendreTout();
    expect(attaques('e', 'h'), 'une frappe').toBe(1);
    expect(decisions('e'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });

  it('F-avancer (graine 1) : la recharge finit le tour — l’« avancer » parqué avance une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    poser(banc, 1, [mk('e', 'enemy', { x: 9, y: 0 }, [{ ...CROSSBOW }]), mk('h', 'hero', { x: 0, y: 0 })]);
    expect(decider(), 'chemin : l’IA recharge, puis finit son tour').toBe('avancer');
    expect(tenirPuisClore('e'), 'parqué sur la fenêtre').toEqual(['avancer', true]);
    banc.reprendreTout();
    expect([b().round, b().turn], 'le tour a avancé une fois').toEqual([1, 1]);
    expect(decisions('e'), 'une décision').toBe(1);
  });

  it('M9 (graine 1) : un « avancer » réarmé ne part pas au minuteur qu’il remplace', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    poser(banc, 1, [mk('e', 'enemy', { x: 9, y: 0 }, [{ ...CROSSBOW }]), mk('h', 'hero', { x: 0, y: 0 })]);
    expect(decider(), 'chemin : l’IA recharge, puis finit son tour').toBe('avancer');
    const premier = b().tourIA?.suite?.n ?? 0;
    ouvrirUneFenetreNeutre('e');
    g().cascadeFinish(); // la clôture réarme l'« avancer » du tour
    expect(b().tourIA?.suite?.n, 'chemin : la suite est réarmée').toBe(premier + 1);
    banc.jusquALaProchaine(); // le minuteur du premier armement
    expect(b().turn, 'le minuteur remplacé n’avance pas le tour').toBe(0);
    banc.jusquALaProchaine();
    expect([b().round, b().turn], 'le réarmement avance le tour, une fois').toEqual([1, 1]);
  });

  it('F-sort (graine 1) : la Fléchette parquée s’incante une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    lanceur(banc, 1, 'flechette', [pretire('h', { x: 7, y: 7 })]);
    const n = incantations('e');
    expect(decider(), 'chemin : l’IA décide un sort').toBe('sort');
    expect(tenirPuisClore('e'), 'parqué sur la fenêtre').toEqual(['sort', true]);
    banc.reprendreTout();
    expect(n(), 'une incantation').toBe(1);
    expect(decisions('e'), 'une décision').toBe(1);
  });

  it('F-zone (graine 5) : le Vortex d’âmes parqué s’incante une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    lanceur(banc, 5, 'vortex-d-ames', [pretire('h0', { x: 5, y: 5 }), pretire('h1', { x: 6, y: 5 })]);
    const n = incantations('e');
    expect(decider(), 'chemin : l’IA décide une zone').toBe('zone');
    expect(g().actorAoe?.casterId, 'le télégraphe de zone est posé').toBe('e');
    expect(tenirPuisClore('e'), 'parquée sur la fenêtre').toEqual(['zone', true]);
    banc.reprendreTout();
    expect(n(), 'une incantation').toBe(1);
    expect(decisions('e'), 'une décision').toBe(1);
  });

  it('F-déplacer (graine 1) : le déplacement parqué se joue une fois', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    poser(banc, 1, [mk('e', 'enemy', { x: 9, y: 0 }), mk('h', 'hero', { x: 0, y: 0 })]);
    let glisses = 0;
    const off = bus.on(EVT.ANIM_MOVE, (p: { id: string }) => { if (p.id === 'e') glisses++; });
    try {
      expect(decider(), 'chemin : l’IA décide un déplacement').toBe('deplacer');
      expect(g().actorMove?.id, 'le télégraphe de déplacement est posé').toBe('e');
      expect(tenirPuisClore('e'), 'parqué sur la fenêtre').toEqual(['deplacer', true]);
      banc.reprendreTout();
    } finally { off(); }
    expect(glisses, 'un déplacement').toBe(1);
    expect(g().actorMove, 'le télégraphe est effacé par son auteur').toBeNull();
    expect(decisions('e'), 'une décision').toBe(1);
  });
});

describe('#3058 — un geste décidé par l’IA ne part pas par-dessus une Action humaine', () => {
  it('H-sort (graine 1) : sort parqué sur une fenêtre, bascule en manuel, le joueur incante, retour en Auto — une incantation, le tour avance', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    const h = pregen(PREGEN.sorcier);
    h.id = 'h'; h.label = 'h'; h.pos = { x: 1, y: 1 }; h.wounds = blessuresDeBase(99);
    h.characteristics.intelligence = 60;
    h.skills = [...h.skills.filter((sk) => sk.id !== 'langue'), { id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 60 } as never];
    h.spells = ['flechette'];
    h.weapons = [];
    poser(banc, 1, [h, pretire('e', { x: 7, y: 7 })]);
    b().combatants[1].kind = 'enemy';
    const n = incantations('h');
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !b().tourIA);
    expect(suite(), 'chemin : l’IA du héros décide un sort').toBe('sort');
    ouvrirUneFenetreNeutre('h');
    passerEnManuel();
    banc.reprendreTout();
    expect([suite(), parquee(), n()], 'chemin : le sort échu sur la fenêtre est parqué, rien incanté').toEqual(['sort', true, 0]);
    g().cascadeFinish();
    g().battleSelectSpell('flechette');
    g().battleClickEntity('e', { confirm: true });
    for (let i = 0; i < 6 && g().pendingCast; i++) { if (g().pendingCast!.result == null) g().castRoll(); else g().castConfirm(); }
    jouerLaSequence();
    expect([n(), b().acted], 'le joueur a incanté à la main : son Action est dépensée').toEqual([1, true]);
    remettreLAutoCombat();
    tantQue(auPremierTour);
    expect(n(), 'une incantation au total').toBe(1);
    expect(decisions('h'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });
});

describe('#3058 — un déplacement décidé par l’IA ne part pas par-dessus un Mouvement humain', () => {
  it('H-déplacer (graine 1) : déplacement parqué sur une fenêtre, bascule en manuel, le joueur se déplace, retour en Auto — un seul déplacement, le tour avance', () => {
    banc = ouvrirLeBanc({ cadence: 'auto' });
    clearAiTurnLog();
    poser(banc, 1, [mk('h', 'hero', { x: 9, y: 0 }), mk('e', 'enemy', { x: 0, y: 0 })]);
    let glisses = 0;
    const off = bus.on(EVT.ANIM_MOVE, (p: { id: string }) => { if (p.id === 'h') glisses++; });
    try {
      maybeRunEnemyTurn(g, banc.setState);
      tantQue(() => !b().tourIA);
      expect(suite(), 'chemin : l’IA du héros décide un déplacement').toBe('deplacer');
      ouvrirUneFenetreNeutre('h');
      passerEnManuel();
      banc.reprendreTout();
      expect([suite(), parquee(), glisses], 'chemin : le déplacement échu sur la fenêtre est parqué, rien joué').toEqual(['deplacer', true, 0]);
      g().cascadeFinish();
      g().battleClickTile({ x: 8, y: 0 }, { confirm: true });
      expect(b().movementUsed, 'le joueur s’est déplacé à la main').toBeGreaterThan(0);
      const apresLeJoueur = glisses;
      remettreLAutoCombat();
      tantQue(auPremierTour);
      expect(glisses, 'aucun déplacement de l’IA par-dessus le Mouvement du joueur').toBe(apresLeJoueur);
    } finally { off(); }
    expect(decisions('h'), 'une décision').toBe(1);
    expect(b().turn, 'le tour a avancé').toBe(1);
  });
});

describe('#3058 — un geste périmé ne touche pas au tour suivant', () => {
  it('I (graine 1) : l’échéance d’un acteur dont le tour est passé ne frappe pas, ni n’efface la suite et le réticule du suivant', () => {
    banc = ouvrirLeBanc();
    clearAiTurnLog();
    poser(banc, 1, [mk('e', 'enemy', { x: 1, y: 0 }), mk('e2', 'enemy', { x: 0, y: 1 }), mk('h', 'hero', { x: 0, y: 0 })]);
    maybeRunEnemyTurn(g, banc.setState);
    tantQue(() => !b().tourIA);
    expect([b().tourIA?.cle, suite()], 'chemin : `e` a armé sa frappe').toEqual(['1:0:e', 'frappe']);
    advanceTurn(g, banc.setState); // le tour passe avant l'échéance
    tantQue(() => b().tourIA?.cle !== '1:1:e2');
    const sienne = b().tourIA?.suite;
    expect([sienne?.geste.kind, g().actorAim?.fromId], 'chemin : `e2` a armé SA frappe, réticule posé').toEqual(['frappe', 'e2']);
    banc.jusquALaProchaine(); // l'échéance périmée de `e` (850 ms après son armement, avant celle de `e2`)
    expect([attaques('e'), attaques('e2')], 'la frappe périmée de `e` ne part pas, celle de `e2` attend').toEqual([0, 0]);
    expect(b().tourIA?.suite, 'la suite de `e2` tient').toBe(sienne);
    expect(g().actorAim?.fromId, 'le réticule de `e2` tient').toBe('e2');
  });
});

describe('#3058 — saut de tour sans talent (une séquence de conséquences ouverte par la frappe)', () => {
  for (const graine of [2, 19, 25]) {
    it(`G (graine ${graine}) : au contact, 400 PV, Auto-combat — chaque combattant décide une fois par Round`, () => {
      banc = ouvrirLeBanc({ cadence: 'auto' });
      clearAiTurnLog();
      poser(banc, graine, [mk('h', 'hero', { x: 1, y: 0 }, [sword], 400), mk('e', 'enemy', { x: 0, y: 0 }, [sword], 400)]);
      maybeRunEnemyTurn(g, banc.setState);
      let sequenceApresLaFrappe = false;
      for (let i = 0; i < 2000 && b().round <= 3 && !b().over; i++) {
        if (!banc.jusquALaProchaine()) break;
        if (b().acted && g().pendingCascade) sequenceApresLaFrappe = true;
      }
      expect(sequenceApresLaFrappe, 'chemin : une frappe a ouvert une séquence de conséquences').toBe(true);
      for (const r of [1, 2]) for (const id of ['h', 'e']) expect(decisions(id, r), `${id}, Round ${r}`).toBe(1);
    });
  }
});
