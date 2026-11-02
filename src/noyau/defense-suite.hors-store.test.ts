import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { aiCreatureFreeAttacks, aiAvailableFreeAttack, autoCleave, doAttack, accorderLAttaqueGratuite, jouerLApresCoup, openAttackCascade } from './combatFlow';
import type { AttackResult } from '../engine/combat';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';
import { OPS_DIFFEREES } from './combatEffects';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * CE QUE LA FENÊTRE DE DÉFENSE FERA APRÈS LE COUP — la donnée portée par `pendingDefense.suite`,
 * jugée sur ses EFFETS observables à la fermeture (LDB 85 l.41-43 : chaque attaque gratuite est un
 * Test d'attaque COMPLET, sa fenêtre comprise). Patron mk()/setup() de `defense-surfacage.test.ts`.
 */
const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  (blessuresSurLeProfil({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: blessuresDeBase(200),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 }) as unknown as Combatant);

/** `heros` = nombre de héros ADJACENTS à l'ennemi (le balayage a besoin de cibles suivantes) ;
 *  `gmSeat` pose un siège MJ, donc un attaquant PILOTÉ (chemin `openSurfacedDefense`). */
function setup(acted: boolean, heros = 1, gmSeat?: number) {
  seedBattleRng(7);
  const enemy = blessuresSurLeProfil({ ...mk('e', 'enemy', { x: 1, y: 0 }), size: 'enorme' as const }); // Taille SUPÉRIEURE : l'Attaque caudale met à Terre (LDB 85 l.47), et le coup BALAIE
  enemy.characteristics['capacite-de-combat'] = 95;
  const herosList = Array.from({ length: heros }, (_, i) => {
    const h = mk(i === 0 ? 'h' : `h${i + 1}`, 'hero', { x: i === 0 ? 0 : 1, y: i === 0 ? 0 : i });
    h.characteristics['capacite-de-combat'] = 5; h.characteristics.agilite = 5; // la défense échoue
    return h;
  });
  const combatants = [enemy, ...herosList];
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat, ownership: {} },
  });
  return { enemy, hero: herosList[0], heros: herosList };
}
/** La suite portée par la fenêtre OUVERTE — l'unique donnée que la fermeture lira. */
const suiteDeLaFenetre = () => banc.getState().pendingDefense!.suite;

describe('Fenêtre de défense — ce que la fermeture joue (#1858)', () => {
  // C1 — une gratuite de créature PASSÉE PAR LA FENÊTRE reste gratuite : ses effets RAW s'appliquent à
  // la fermeture, et l'Action retrouve exactement la valeur qu'elle avait avant la frappe.
  for (const acted of [false, true]) {
    it(`Attaque caudale du héros surfacé : À Terre à la fermeture, Action rendue (acted=${acted})`, () => {
      const { enemy, hero } = setup(acted);
      enemy.traits = [{ id: 'attaque-caudale', value: 14 }]; enemy.advantage = 1;
      expect(aiCreatureFreeAttacks(banc.getState, banc.setState, enemy), 'la frappe SUSPEND sur la fenêtre du héros').toBe(true);
      expect(banc.getState().pendingDefense!.defenderId).toBe(hero.id);
      banc.getState().defenseRoll();
      banc.getState().defenseConfirm();
      const st = banc.getState();
      const h = st.battle!.combatants.find((c) => c.id === hero.id)!;
      expect(h.wounds.current).toBeLessThan(200); // la caudale a causé des Dégâts
      expect(h.conditions.some((c) => c.id === 'a-terre'), 'LDB 85 l.47 : cible de Taille inférieure → À Terre').toBe(true);
      expect(st.battle!.acted, 'attaque GRATUITE : l’Action retrouve sa valeur d’avant').toBe(acted);
    });
  }

  // C2 — la fermeture d'une fenêtre de GRATUITE ne réclame PAS les attaques d'Arme « disponibles »
  // (Frénésie, LDB 21 l.33) : elles ne suivent QUE l'Action.
  it('après une Morsure gratuite : aucune attaque d’Arme de Frénésie derrière elle', () => {
    const { enemy, hero } = setup(false);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 4;
    (enemy.psychState ??= []).push({ type: 'frenesie' }); // Frénésie : attaque d'Arme gratuite DISPONIBLE
    enemy.pendingFreeAttacks = ['morsure']; // file réduite à la Morsure : ce qui suit vient de la FERMETURE
    expect(aiCreatureFreeAttacks(banc.getState, banc.setState, enemy)).toBe(true);
    expect(banc.getState().pendingDefense!.defenderId).toBe(hero.id);
    banc.getState().defenseRoll();
    banc.getState().defenseConfirm();
    const st = banc.getState();
    expect(st.pendingDefense, 'aucune fenêtre d’Épée ne s’ouvre derrière la gratuite').toBeNull();
    const e = st.battle!.combatants.find((c) => c.id === enemy.id)!;
    expect(e.freeAttacksThisTurn?.arme ?? 0, 'aucune attaque d’Arme consommée').toBe(0);
  });
});

/** Touche qui BALAIE (LDB 85 l.362 : « Toutes les frappes réussies… ») — de quoi lancer `autoCleave`. */
const toucheQuiBalaie = (): AttackResult => ({ hit: true, cleave: true, attackerRoll: 10, netSL: 5, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '' } as unknown as AttackResult);

describe('Suite de la fenêtre de défense — UNE valeur, posée à l’ouverture (#1858)', () => {
  // K1 — chaque producteur déclare EXACTEMENT ce que la fenêtre porte.
  it('K1 attaque principale de la machine : coup NU', () => {
    const { enemy, hero } = setup(false);
    expect(doAttack(banc.getState, banc.setState, enemy, hero)).toBe(OPS_DIFFEREES);
    expect(suiteDeLaFenetre()).toEqual({ mode: 'machine', coup: {} });
  });

  it('K1 maillon de balayage : la chaîne, telle que le coup précédent la lègue', () => {
    const { enemy, heros } = setup(false, 2);
    autoCleave(banc.getState, banc.setState, enemy, heros[0], toucheQuiBalaie());
    const suite = suiteDeLaFenetre();
    expect(banc.getState().pendingDefense!.defenderId).toBe(heros[1].id);
    expect(suite.mode).toBe('machine');
    expect(suite.mode === 'machine' && suite.coup.enchainement)
      .toEqual({ mode: 'chaine', hitIds: [heros[0].id, heros[1].id], n: 1, bcc: 9, fm: false });
  });

  it('K1 gratuite de créature : sa nature et l’Action à rendre', () => {
    const { enemy } = setup(true);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    aiCreatureFreeAttacks(banc.getState, banc.setState, enemy);
    expect(suiteDeLaFenetre()).toEqual({ mode: 'machine', coup: { restitution: { prevActed: true }, manoeuvre: { kind: 'morsure' } } });
  });

  it('K1 gratuite d’Arme (Frénésie LDB 21 l.33) : clé `arme`', () => {
    const { enemy } = setup(false);
    (enemy.psychState ??= []).push({ type: 'frenesie' });
    aiAvailableFreeAttack(banc.getState, banc.setState, enemy);
    expect(suiteDeLaFenetre()).toEqual({ mode: 'machine', coup: { restitution: { prevActed: false }, manoeuvre: { kind: 'arme' }, enchainement: { mode: 'auto' } } });
  });

  it('K1 attaque PILOTÉE : l’attaque figée, marquée défendue', () => {
    const { enemy, hero } = setup(false, 1, 0);
    const g = banc.getState;
    openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    const suite = suiteDeLaFenetre();
    expect(suite.mode).toBe('pilotee');
    expect(suite.mode === 'pilotee' && suite.pa.defended).toBe(true);
    expect(suite.mode === 'pilotee' && suite.pa.attackerId).toBe(enemy.id);
  });

  // K4 — ISOLATION : une fenêtre ne porte QUE ce que sa frappe a déclaré.
  it('K4 la fenêtre d’une gratuite ne porte AUCUN balayage, celle d’un maillon d’Action AUCUNE gratuite', () => {
    const { enemy } = setup(false, 2);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    aiCreatureFreeAttacks(banc.getState, banc.setState, enemy);
    const gratuite = suiteDeLaFenetre();
    expect(gratuite.mode === 'machine' && gratuite.coup.enchainement).toBeUndefined();
    const { enemy: e2, heros } = setup(false, 2);
    autoCleave(banc.getState, banc.setState, e2, heros[0], toucheQuiBalaie());
    const maillon = suiteDeLaFenetre();
    expect(maillon.mode === 'machine' && maillon.coup.restitution).toBeUndefined();
    expect(maillon.mode === 'machine' && maillon.coup.manoeuvre).toBeUndefined();
  });

  // K4 — le maillon d'une GRATUITE (LDB 85 l.43) porte la restitution de SON Action, jamais les effets
  // de la manœuvre, propres au coup principal.
  it('K4 le maillon d’une gratuite porte la restitution et AUCUN effet de manœuvre', () => {
    const { enemy, heros } = setup(false, 2);
    heros[0].aiControlled = true; // la Morsure s'applique sans fenêtre ; le maillon s'ouvre sur h2
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    enemy.pendingFreeAttacks = ['morsure']; // file réduite à la Morsure : ce qui suit vient de SA chaîne
    expect(aiCreatureFreeAttacks(banc.getState, banc.setState, enemy), 'le maillon tient la main : la file s’arrête').toBe(true);
    expect(banc.getState().pendingDefense!.defenderId).toBe(heros[1].id);
    const maillon = suiteDeLaFenetre();
    expect(maillon.mode === 'machine' && maillon.coup.enchainement && maillon.coup.enchainement.mode).toBe('chaine');
    expect(maillon.mode === 'machine' && maillon.coup.restitution).toEqual({ prevActed: false });
    expect(maillon.mode === 'machine' && maillon.coup.manoeuvre).toBeUndefined();
  });

  // K2 — la suite est FIGÉE à l'ouverture : les gestes de la fenêtre ne la touchent pas.
  it('K2 la suite ne bouge pas pendant la fenêtre (mode, arme de parade, jet, relance)', () => {
    const { enemy, heros } = setup(false, 2);
    heros[0].fortune = 2;
    autoCleave(banc.getState, banc.setState, enemy, heros[0], toucheQuiBalaie());
    const avant = JSON.stringify(suiteDeLaFenetre());
    banc.getState().defenseSetMode('esquive');
    banc.getState().defenseSetParryWeapon('sw');
    banc.getState().defenseRoll();
    banc.getState().defenseReroll();
    expect(JSON.stringify(suiteDeLaFenetre())).toBe(avant);
  });

  // K3 — la fenêtre voyage au siège invité par le snapshot coop : JSON PUR, les deux variantes.
  it('K3 les deux variantes survivent à l’aller-retour JSON du snapshot coop', () => {
    const { enemy } = setup(false);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    aiCreatureFreeAttacks(banc.getState, banc.setState, enemy);
    const machine = suiteDeLaFenetre();
    expect(JSON.parse(JSON.stringify(machine))).toEqual(machine);
    const { enemy: e2, hero } = setup(false, 1, 0);
    const g = banc.getState;
    openAttackCascade(g, banc.setState, { attackerId: e2.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    const pilotee = suiteDeLaFenetre();
    expect(JSON.parse(JSON.stringify(pilotee))).toEqual(pilotee);
  });

  // K5 — la FERMETURE joue ce que la fenêtre porte : le balayage REPREND sa chaîne (mêmes cibles déjà
  // frappées, même compteur), il n'en redémarre pas une neuve.
  it('K5 la fermeture d’un maillon poursuit LA chaîne portée, sur la cible suivante', () => {
    const { enemy, heros } = setup(false, 3);
    autoCleave(banc.getState, banc.setState, enemy, heros[0], toucheQuiBalaie());
    expect(banc.getState().pendingDefense!.defenderId).toBe(heros[1].id);
    banc.getState().defenseRoll();
    banc.getState().defenseConfirm();
    const suivante = banc.getState().pendingDefense!;
    expect(suivante.defenderId, 'la chaîne enchaine sur la cible suivante').toBe(heros[2].id);
    expect(suivante.suite.mode === 'machine' && suivante.suite.coup.enchainement)
      .toEqual({ mode: 'chaine', hitIds: [heros[0].id, heros[1].id, heros[2].id], n: 2, bcc: 9, fm: false });
  });

  // K7 — ZÉRO PATCH APRÈS COUP : un balayage déclaré par-dessus une fenêtre VIVANTE n'écrit RIEN sur
  // elle. C'est la PORTE qui tranche (LDB 85 l.41-43 : la frappe précédente se résout entièrement,
  // fenêtre du défenseur comprise), et la suite portée par la fenêtre reste celle de SA frappe.
  it('K7 balayage lancé par-dessus une fenêtre vivante : la porte REFUSE, la suite de la fenêtre ne bouge pas', () => {
    const { enemy, heros } = setup(false, 3);
    expect(doAttack(banc.getState, banc.setState, enemy, heros[0])).toBe(OPS_DIFFEREES);
    const vivante = banc.getState().pendingDefense!;
    const suiteAvant = JSON.parse(JSON.stringify(vivante.suite));
    expect(() => autoCleave(banc.getState, banc.setState, enemy, heros[0], toucheQuiBalaie())).toThrow(/défense/i);
    const apres = banc.getState().pendingDefense!;
    expect(apres, 'le slot porte TOUJOURS la fenêtre de la frappe précédente').toBe(vivante);
    expect(apres.suite, 'aucun balayage ne s’est accroché à la fenêtre d’autrui').toEqual(suiteAvant);
  });

  // K6 — PILOTÉE : la fermeture rend l'attaque à `attackConfirm`, UNE fois ; et un pd piloté dont
  // l'attaquant a quitté le combat garde sa retombée (la fenêtre se ferme, le tour reprend).
  it('K6 pilotée : l’attaque est rendue au chemin d’application unique', () => {
    const { enemy, hero } = setup(false, 1, 0);
    const g = banc.getState;
    openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    g().defenseRoll();
    g().defenseConfirm();
    const st = banc.getState();
    expect(st.pendingDefense).toBeNull();
    expect(st.pendingAttack, 'l’attaque a été appliquée et rendue').toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === hero.id)!.wounds.current).toBeLessThan(200);
  });

  it('K6 pilotée dont l’attaquant a quitté le combat : la fenêtre se ferme sans appliquer', () => {
    const { enemy, hero } = setup(false, 1, 0);
    const g = banc.getState;
    openAttackCascade(g, banc.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    g().defenseRoll();
    const b = g().battle!;
    banc.setState({ battle: { ...b, combatants: b.combatants.filter((c) => c.id !== enemy.id) } });
    g().defenseConfirm();
    const st = banc.getState();
    expect(st.pendingDefense).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === hero.id)!.wounds.current).toBe(200);
  });
});

/** Une gratuite qui BALAIE (#1749) : l'Action d'avant la gratuite (LDB 85 l.43) est celle que la chaîne
 *  ENTIÈRE laisse — les maillons du balayage (LDB 85 l.362) appartiennent au même coup. */
describe('Gratuite qui balaie : l’Action d’origine au bout de la chaîne (#1749)', () => {
  it('chaîne sans fenêtre : l’Action est rendue après le dernier maillon', () => {
    const { enemy, heros } = setup(false, 2);
    for (const h of heros) h.aiControlled = true; // aucune fenêtre : la chaîne se joue d'un trait
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    enemy.pendingFreeAttacks = ['morsure']; // file réduite à la Morsure : ce qui suit vient de SA chaîne
    expect(aiCreatureFreeAttacks(banc.getState, banc.setState, enemy)).toBe(false);
    const st = banc.getState();
    expect(st.battle!.combatants.find((c) => c.id === heros[1].id)!.wounds.current, 'le maillon a frappé h2').toBeLessThan(200);
    expect(st.battle!.acted, 'gratuite : l’Action d’avant, maillons compris').toBe(false);
  });

  it('maillon suspendu sur une fenêtre de défense : l’Action est rendue à sa fermeture', () => {
    const { enemy, heros } = setup(false, 2);
    heros[0].aiControlled = true;
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    enemy.pendingFreeAttacks = ['morsure']; // file réduite à la Morsure : ce qui suit vient de SA chaîne
    expect(aiCreatureFreeAttacks(banc.getState, banc.setState, enemy)).toBe(true);
    expect(banc.getState().pendingDefense!.defenderId).toBe(heros[1].id);
    banc.getState().defenseRoll();
    banc.getState().defenseConfirm();
    const st = banc.getState();
    expect(st.pendingDefense).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === heros[1].id)!.wounds.current, 'le maillon a frappé h2').toBeLessThan(200);
    expect(st.battle!.acted, 'gratuite : l’Action d’avant, maillon suspendu compris').toBe(false);
  });
});

/** Un attaquant mis HORS DE COMBAT pendant son propre coup n'enchaîne rien : ni balayage (LDB 14
 *  l.9, LDB 85 l.362), ni 2ᵉ frappe (LDB 10 l.767-773). */
describe('Suite d’un coup dont l’attaquant est hors de combat', () => {
  const horsDeCombat = (enemy: Combatant) => { enemy.wounds.current = 0; (enemy as { dead?: boolean }).dead = true; };

  it('aucun maillon de balayage ne s’ouvre', () => {
    const { enemy, heros } = setup(false, 2);
    horsDeCombat(enemy);
    jouerLApresCoup(banc.getState, banc.setState, { attackerId: enemy.id, targetId: heros[0].id, weapon: sword, res: toucheQuiBalaie(), depuis: 'oupsAttaquant' });
    expect(banc.getState().pendingDefense, 'un mort n’ouvre aucun maillon').toBeNull();
  });

  it('aucune 2ᵉ frappe du Maniement de deux armes ne s’ouvre', () => {
    const { enemy, heros } = setup(false, 1);
    horsDeCombat(enemy);
    banc.setState({ pendingDualStrike: null });
    jouerLApresCoup(banc.getState, banc.setState, { attackerId: enemy.id, targetId: heros[0].id, weapon: sword, res: toucheQuiBalaie(),
      suite: { dualMain: { offWeaponUid: 'sw', mainRoll: 34 }, enchainement: { mode: 'aucun' } }, depuis: 'oupsAttaquant' });
    expect(banc.getState().pendingDualStrike, 'un mort n’ouvre aucune 2ᵉ frappe').toBeNull();
  });
});

/** La chaîne d'un HÉROS (`pendingCleave`, LDB 14 l.9 / LDB 85 l.362) : la gratuite qui l'ouvre (Frénésie,
 *  LDB 21 l.33) n'use pas l'Action de tour (LDB 85 l.43), maillons compris. */
describe('Héros qui balaie sur une gratuite : l’Action d’origine au bout de sa chaîne (#1749)', () => {
  const toucheDuHeros = (cleave: boolean): AttackResult => ({ ...toucheQuiBalaie(), cleave, damage: 1, woundsLost: 1 } as unknown as AttackResult);
  function setupHeros() {
    seedBattleRng(7);
    const h = mk('h', 'hero', { x: 1, y: 1 });
    (h as unknown as { psychState: unknown[] }).psychState = [{ type: 'frenesie' }];
    const e1 = mk('e1', 'enemy', { x: 2, y: 1 });
    const e2 = mk('e2', 'enemy', { x: 1, y: 2 });
    const combatants = [h, e1, e2];
    const battle = { combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState;
    banc.setState({ battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null, pendingCleave: null, pendingDualStrike: null,
      net: { ...banc.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} } });
    return { h, e1, e2 };
  }

  it('Frénésie qui balaie : la chaîne porte la restitution, l’Action est rendue après le maillon', () => {
    setupHeros();
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'e1', location: null, result: toucheDuHeros(true) } as never });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingCleave?.restitution, 'la chaîne ouverte emporte la restitution').toEqual({ prevActed: false });
    banc.getState().cleaveAttack('e2');
    const pa = banc.getState().pendingAttack!;
    banc.setState({ pendingAttack: { ...pa, result: toucheDuHeros(false) } as never });
    banc.getState().attackConfirm();
    const st = banc.getState();
    expect(st.pendingCleave, 'plus aucune cible : la chaîne est close').toBeNull();
    expect(st.battle!.acted, 'gratuite : l’Action d’avant, maillon compris').toBe(false);
  });

  it('Frénésie qui balaie puis renonce : `cleaveEnd` rend l’Action', () => {
    setupHeros();
    banc.setState({ pendingAttack: { attackerId: 'h', targetId: 'e1', location: null, result: toucheDuHeros(true) } as never });
    banc.getState().attackConfirm();
    expect(banc.getState().pendingCleave).not.toBeNull();
    banc.getState().cleaveEnd();
    expect(banc.getState().battle!.acted, 'gratuite : l’Action d’avant à la fermeture de la chaîne').toBe(false);
  });

  it('héros HORS DE COMBAT pendant un maillon : la chaîne se ferme et rend l’Action', () => {
    const { h, e2 } = setupHeros();
    banc.setState({ pendingCleave: { attackerId: 'h', hitIds: ['e1'], count: 0, fm: false, restitution: { prevActed: false } } });
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } });
    h.wounds.current = 0; (h as { dead?: boolean }).dead = true;
    jouerLApresCoup(banc.getState, banc.setState, { attackerId: 'h', targetId: e2.id, weapon: sword, res: toucheDuHeros(false),
      suite: { restitution: { prevActed: false }, enchainement: { mode: 'hero', wasChain: true } }, depuis: 'oupsAttaquant' });
    const st = banc.getState();
    expect(st.pendingCleave, 'un mort ne garde aucune chaîne ouverte').toBeNull();
    expect(st.battle!.acted).toBe(false);
  });

  // Assaut féroce (LDB 10 l.78) : la gratuite de TALENT d'un héros que l'IA ne conduit pas ouvre SA chaîne
  // (`pendingCleave`, LDB 85 l.362), et l'Action d'avant revient à sa fermeture (LDB 85 l.43).
  it('Assaut féroce qui balaie : la chaîne est offerte au héros, l’Action rendue à sa fermeture', () => {
    const { h, e1 } = setupHeros();
    h.size = 'enorme'; // Taille SUPÉRIEURE : la touche balaie
    h.characteristics['capacite-de-combat'] = 95; h.advantage = 1;
    e1.characteristics['capacite-de-combat'] = 5; e1.characteristics.agilite = 5;
    accorderLAttaqueGratuite(banc.getState, banc.setState, h,
      { op: 'grantFreeAttack', weapon: 'held', when: 'immediate', advantageOrMovement: true }, { targetId: e1.id, cap: 1, key: 'assaut-feroce' });
    expect(banc.getState().battle!.combatants.find((c) => c.id === e1.id)!.wounds.current, 'la gratuite a touché e1').toBeLessThan(200);
    expect(banc.getState().pendingCleave?.attackerId, 'la chaîne est offerte au héros').toBe('h');
    expect(banc.getState().pendingCleave?.restitution, 'la chaîne emporte la restitution de la gratuite').toEqual({ prevActed: false });
    banc.getState().cleaveAttack('e2');
    const pa = banc.getState().pendingAttack!;
    banc.setState({ pendingAttack: { ...pa, result: toucheDuHeros(false) } as never });
    banc.getState().attackConfirm();
    const st = banc.getState();
    expect(st.pendingCleave, 'plus aucune cible : la chaîne est close').toBeNull();
    expect(st.battle!.acted, 'gratuite : l’Action d’avant, maillon compris').toBe(false);
  });

  // La chaîne garde la restitution du coup qui l'a OUVERTE : une gratuite qui la rejoint en cours ne la
  // remplace pas par l'Action qu'elle trouve, déjà dépensée.
  it('Assaut féroce dans une chaîne déjà ouverte : la restitution d’origine est gardée', () => {
    const { h, e1 } = setupHeros();
    h.size = 'enorme';
    h.characteristics['capacite-de-combat'] = 95; h.advantage = 1;
    e1.characteristics['capacite-de-combat'] = 5; e1.characteristics.agilite = 5;
    banc.setState({ pendingCleave: { attackerId: 'h', hitIds: ['e1'], count: 0, fm: false, restitution: { prevActed: false } } });
    banc.setState({ battle: { ...banc.getState().battle!, acted: true } });
    accorderLAttaqueGratuite(banc.getState, banc.setState, h,
      { op: 'grantFreeAttack', weapon: 'held', when: 'immediate', advantageOrMovement: true }, { targetId: e1.id, cap: 1, key: 'assaut-feroce' });
    expect(banc.getState().battle!.combatants.find((c) => c.id === e1.id)!.wounds.current, 'la gratuite a touché e1').toBeLessThan(200);
    expect(banc.getState().pendingCleave?.restitution, 'la restitution d’ouverture reste celle de la chaîne').toEqual({ prevActed: false });
  });
});
