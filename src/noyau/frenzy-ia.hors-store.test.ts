/**
 * La Frénésie de l'IA (LDB 21 l.31-33 ; #5042, design jugé du 2026-11-27) : l'IA entre par le geste du joueur
 * (`entrerEnFrenesie`), son Test de Force Mentale prend l'Action, puis le tour continue — les gratuites d'abord, puis
 * le Mouvement seul, Charge comprise, dont la frappe est l'attaque gratuite (LDB 15 l.35). Elle entre quand P·S_A ≥
 * S_B. Fixtures sur le vrai `enc-mutants` : le héros du duel en (4,8), le Mutant frénétique à `distance` cases.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from './monde/ai';
import { emptyScene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { aiAvailableFreeAttack, buildAiInput } from './combatFlow';
import { isFrenzied } from '../engine/psychology';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';
import { heroFaceAUnEnnemi, reluDans } from './combatDeTest.testkit';
import { actionALaClotureDeLaFrenesie, deDeCombat, jouerLeTourDeLIA } from './ouvertureDuTour.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });
const g = () => banc.getState();

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function mk(id: string, kind: 'heros' | 'ennemi', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind, pos,
    wounds: blessuresDeBase(10),
    weapons: [MELEE],
    characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never,
    skills: [], talents: [], movement: 4,
    ...opts,
  }) as Combatant;
}

const scene = emptyScene('scene-test', 12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, env: { blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)) }, movement: enemy.movement, spells: [], ...extra };
}

describe('Frénésie IA — la cible imposée par la porte du joueur (chooseEnemyAction, pur, LDB 21 l.33)', () => {
  it('frenzied : vise la cible imposée (`cibleDeFrenesie`), pas le plus faible distant', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 }, { psychState: [{ type: 'frenesie' }], movement: 4 });
    const near = mk('near', 'heros', { x: 5, y: 6 }, { wounds: blessuresDeBase(10) }); // proche, costaud
    const far = mk('far', 'heros', { x: 5, y: 9 }, { wounds: blessuresDeBase(10, 2) }); // faible, atteignable MAIS plus loin
    const action = chooseEnemyAction(input(e, [near, far], { cibleDeFrenesie: near }));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('near');
  });

  it('non frenzied : conserve le ciblage du plus faible (régression)', () => {
    const e = mk('e', 'ennemi', { x: 5, y: 5 });
    const near = mk('near', 'heros', { x: 5, y: 6 }, { wounds: blessuresDeBase(10) });
    const far = mk('far', 'heros', { x: 5, y: 7 }, { wounds: blessuresDeBase(10, 2) }); // faible, atteignable
    const action = chooseEnemyAction(input(e, [near, far]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('far');
  });
});

/** Le duel du vrai `enc-mutants` : le héros en (4,8), le Mutant capable de Frénésie (trait `frenesie`) à Force
 *  Mentale `fm`, `distance` cases à l'est ; tous les dés de combat posés sur `de` ; le tour de l'IA joué. */
function tourDuFrenetique(distance: number, fm: number, de: number) {
  const { H, E } = heroFaceAUnEnnemi(banc, testScene());
  H.pos = { x: 4, y: 8 };
  E.pos = { x: 4 + distance, y: 8 };
  E.traits = [...(E.traits ?? []), { id: 'frenesie' }];
  E.characteristics = { ...E.characteristics, 'force-mentale': fm };
  banc.setState({ battle: { ...g().battle! } });
  deDeCombat(de);
  const actionALaCloture = actionALaClotureDeLaFrenesie(banc, () => jouerLeTourDeLIA(banc, H.id, E.id));
  const e = reluDans(g, E);
  const log = g().battle!.log.filter((l) => l.actorId === E.id);
  return {
    e,
    actionALaCloture,
    frenetique: isFrenzied(e),
    charge: log.some((l) => l.kind === 'charge'),
    frappe: g().pendingDefense?.attackerId === E.id,
    gratuite: g().pendingDefense?.attackerId === E.id && actionALaCloture === true,
    tourDeLIA: g().battle!.order[g().battle!.turn] === E.id,
  };
}

describe('Frénésie IA — entrée par le geste du joueur, puis le tour continue (LDB 21 l.31-33 ; LDB 15 l.35)', () => {
  it('(i) à 11 cases : entre en Frénésie, l’Action prise, puis Marche sans frappe', () => {
    const t = tourDuFrenetique(11, 99, 1);
    expect(t.actionALaCloture, 'le Test d’entrée a pris l’Action').toBe(true);
    expect(t.frenetique).toBe(true);
    expect(t.e.pos!.x, 'il a marché vers le héros').toBeLessThan(15);
    expect(t.charge, 'hors de portée de Charge').toBe(false);
    expect(t.frappe).toBe(false);
  });

  it('(ii) au contact, FM 99 : entre en Frénésie puis porte sa frappe gratuite', () => {
    const t = tourDuFrenetique(1, 99, 1);
    expect(t.frenetique).toBe(true);
    expect(t.gratuite, 'la frappe part après le Test, l’Action prise').toBe(true);
  });

  it('(ii) au contact, FM 25 : P·S_A < S_B, il frappe d’une attaque simple sans entrer', () => {
    const t = tourDuFrenetique(1, 25, 1);
    expect(t.actionALaCloture, 'aucun Test d’entrée').toBeUndefined();
    expect(t.frenetique).toBe(false);
    expect(t.frappe).toBe(true);
  });

  it.each([7, 4])('(iii, iv) à %i cases : entre en Frénésie puis Charge, la frappe gratuite', (distance) => {
    const t = tourDuFrenetique(distance, 99, 1);
    expect(t.frenetique).toBe(true);
    expect(t.charge, 'la Charge est déclarée').toBe(true);
    expect(t.gratuite, 'la frappe de Charge est l’attaque gratuite').toBe(true);
    expect(t.e.pos!.x, 'au contact').toBe(5);
  });

  it('(v) Test raté à 4 cases : l’Action prise, la Marche s’approche quand même, sans frappe', () => {
    const t = tourDuFrenetique(4, 99, 100);
    expect(t.actionALaCloture, 'le Test d’entrée a pris l’Action').toBe(true);
    expect(t.frenetique).toBe(false);
    expect(t.charge).toBe(false);
    expect(t.frappe).toBe(false);
    expect(t.e.pos!.x, 'il a marché vers le héros').toBeLessThan(8);
  });

  it('un sort décidé prime : le lanceur capable de Frénésie lance son sort sans entrer', () => {
    const { H, E } = heroFaceAUnEnnemi(banc, testScene());
    H.pos = { x: 4, y: 8 };
    E.pos = { x: 4, y: 5 };
    E.traits = [...(E.traits ?? []), { id: 'frenesie' }];
    E.characteristics = { ...E.characteristics, 'force-mentale': 99, intelligence: 60 };
    E.skills = [{ id: 'langue', spec: 'magick', advances: 40, characteristic: 'intelligence' } as never];
    E.spells = ['flechette'];
    E.weapons = [];
    banc.setState({ battle: { ...g().battle! } });
    expect(chooseEnemyAction(buildAiInput(reluDans(g, E), g)).kind, 'sa décision est un sort').toBe('incantation');
    deDeCombat(1);
    jouerLeTourDeLIA(banc, H.id, E.id);
    expect(isFrenzied(reluDans(g, E))).toBe(false);
    expect(g().pendingCast?.casterId, 'il lance son sort').toBe(E.id);
  });
});

describe('IA — la porte de Mouvement du joueur (`canMove`, LDB 13 l.14)', () => {
  it('l’Action prise après un Mouvement entamé : plus de Mouvement à décider', () => {
    const { E } = heroFaceAUnEnnemi(banc, testScene());
    E.pos = { x: 16, y: 10 };
    const b = g().battle!;
    banc.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true, movedPreAction: true, movementUsed: 1 } });
    expect(buildAiInput(reluDans(g, E), g).movement).toBe(0);
  });
});

describe('Frénésie IA — attaque libre', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setupBattle() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().lancerLaScene(testScene());
    banc.getState().lancerLeCombat('enc-mutants');
    banc.getState().fenetreValider('debutDuRound');
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'heros')!;
    const E = b.combatants.find((c) => c.kind === 'ennemi')!;
    b.combatants.filter((c) => c.kind === 'ennemi' && c.id !== E.id).forEach((e) => (e.dead = true));
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent + Ligne de Vue dégagée
    banc.setState({ battle: { ...b } });
    return { H, E };
  }

  it('aiAvailableFreeAttack : l’Action prise, la frappe LIBRE par le geste du joueur → la défense du héros s’ouvre, puis la gratuite est comptée', () => {
    banc.getState().ensemencerLeTirage(4);
    const { E, H } = setupBattle();
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.weapons = [MELEE];
    const b = banc.getState().battle!;
    banc.setState({ battle: { ...b, turn: b.order.indexOf(E.id), acted: true } });
    const logBefore = banc.getState().battle!.log.length;
    expect(aiAvailableFreeAttack(banc.getState, E)).toBe(true);
    // #989 : la défense du héros est SURFACÉE — l'attaque gratuite ne la roule plus en silence.
    expect(banc.getState().pendingDefense?.defenderId).toBe(H.id);
    banc.getState().jetLancer('defense');
    banc.getState().jetValider('defense');
    const st = banc.getState();
    expect(st.battle!.log.length).toBeGreaterThan(logBefore); // une attaque a bien été résolue
    expect(st.battle!.combatants.find((c) => c.id === E.id)!.freeAttacksThisTurn?.arme).toBe(1); // LDB 21 l.33
  });

  it('aiAvailableFreeAttack : aucun adversaire adjacent → no-op', () => {
    const { E } = setupBattle();
    (E.psychState ??= []).push({ type: 'frenesie' });
    E.pos = { x: 1, y: 1 }; // loin du héros (10,10)
    E.weapons = [MELEE];
    banc.setState({ battle: { ...banc.getState().battle!, acted: false } });
    const logBefore = banc.getState().battle!.log.length;
    aiAvailableFreeAttack(banc.getState, E);
    expect(banc.getState().battle!.log.length).toBe(logBefore);
  });
});
