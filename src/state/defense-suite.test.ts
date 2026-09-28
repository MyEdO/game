import { describe, it, expect } from 'vitest';
import { useGame, type BattleState } from './store';
import { aiCreatureFreeAttacks, aiAvailableFreeAttack, autoCleave, doAttack, openAttackCascade } from './combatFlow';
import type { AttackResult } from '../engine/combat';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

/**
 * CE QUE LA FENÊTRE DE DÉFENSE FERA APRÈS LE COUP — la donnée portée par `pendingDefense.suite`,
 * jugée sur ses EFFETS observables à la fermeture (LDB 85 l.41-43 : chaque attaque gratuite est un
 * Test d'attaque COMPLET, sa fenêtre comprise). Patron mk()/setup() de `defense-surfacage.test.ts`.
 */
const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: { current: 200, max: 200 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);

/** `heros` = nombre de héros ADJACENTS à l'ennemi (le balayage a besoin de cibles suivantes) ;
 *  `gmSeat` pose un siège MJ, donc un attaquant PILOTÉ (chemin `openSurfacedDefense`). */
function setup(acted: boolean, heros = 1, gmSeat?: number) {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', { x: 1, y: 0 });
  enemy.size = 'enorme'; // Taille SUPÉRIEURE : l'Attaque caudale met à Terre (LDB 85 l.47), et le coup BALAIE
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
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat, ownership: {} },
  });
  return { enemy, hero: herosList[0], heros: herosList };
}
/** La suite portée par la fenêtre OUVERTE — l'unique donnée que la fermeture lira. */
const suiteDeLaFenetre = () => useGame.getState().pendingDefense!.suite;

describe('Fenêtre de défense — ce que la fermeture joue (#1858)', () => {
  // C1 — une gratuite de créature PASSÉE PAR LA FENÊTRE reste gratuite : ses effets RAW s'appliquent à
  // la fermeture, et l'Action retrouve exactement la valeur qu'elle avait avant la frappe.
  for (const acted of [false, true]) {
    it(`Attaque caudale du héros surfacé : À Terre à la fermeture, Action rendue (acted=${acted})`, () => {
      const { enemy, hero } = setup(acted);
      enemy.traits = [{ id: 'attaque-caudale', value: 14 }]; enemy.advantage = 1;
      expect(aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy), 'la frappe SUSPEND sur la fenêtre du héros').toBe(true);
      expect(useGame.getState().pendingDefense!.defenderId).toBe(hero.id);
      useGame.getState().defenseRoll();
      useGame.getState().defenseConfirm();
      const st = useGame.getState();
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
    expect(aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy)).toBe(true);
    expect(useGame.getState().pendingDefense!.defenderId).toBe(hero.id);
    useGame.getState().defenseRoll();
    useGame.getState().defenseConfirm();
    const st = useGame.getState();
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
    expect(doAttack(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(suiteDeLaFenetre()).toEqual({ mode: 'machine', coup: {} });
  });

  it('K1 maillon de balayage : la chaîne, telle que le coup précédent la lègue', () => {
    const { enemy, heros } = setup(false, 2);
    autoCleave(useGame.getState, useGame.setState, enemy, heros[0], toucheQuiBalaie());
    const suite = suiteDeLaFenetre();
    expect(useGame.getState().pendingDefense!.defenderId).toBe(heros[1].id);
    expect(suite.mode).toBe('machine');
    expect(suite.mode === 'machine' && suite.coup.enchainement)
      .toEqual({ mode: 'chaine', hitIds: [heros[0].id, heros[1].id], n: 1, bcc: 9, fm: false });
  });

  it('K1 gratuite de créature : sa nature et l’Action à rendre', () => {
    const { enemy } = setup(true);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy);
    expect(suiteDeLaFenetre()).toEqual({ mode: 'machine', coup: { freeAttack: { kind: 'morsure', prevActed: true } } });
  });

  it('K1 gratuite d’Arme (Frénésie LDB 21 l.33) : clé `arme`', () => {
    const { enemy } = setup(false);
    (enemy.psychState ??= []).push({ type: 'frenesie' });
    aiAvailableFreeAttack(useGame.getState, useGame.setState, enemy);
    expect(suiteDeLaFenetre()).toEqual({ mode: 'machine', coup: { freeAttack: { kind: 'arme', prevActed: false } } });
  });

  it('K1 attaque PILOTÉE : l’attaque figée, marquée défendue', () => {
    const { enemy, hero } = setup(false, 1, 0);
    const g = useGame.getState;
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    const suite = suiteDeLaFenetre();
    expect(suite.mode).toBe('pilotee');
    expect(suite.mode === 'pilotee' && suite.pa.defended).toBe(true);
    expect(suite.mode === 'pilotee' && suite.pa.attackerId).toBe(enemy.id);
  });

  // K4 — ISOLATION : une fenêtre ne porte QUE ce que sa frappe a déclaré.
  it('K4 la fenêtre d’une gratuite ne porte AUCUN balayage, celle d’un maillon AUCUNE gratuite', () => {
    const { enemy } = setup(false, 2);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy);
    const gratuite = suiteDeLaFenetre();
    expect(gratuite.mode === 'machine' && gratuite.coup.enchainement).toBeUndefined();
    const { enemy: e2, heros } = setup(false, 2);
    autoCleave(useGame.getState, useGame.setState, e2, heros[0], toucheQuiBalaie());
    const maillon = suiteDeLaFenetre();
    expect(maillon.mode === 'machine' && maillon.coup.freeAttack).toBeUndefined();
  });

  // K2 — la suite est FIGÉE à l'ouverture : les gestes de la fenêtre ne la touchent pas.
  it('K2 la suite ne bouge pas pendant la fenêtre (mode, arme de parade, jet, relance)', () => {
    const { enemy, heros } = setup(false, 2);
    heros[0].fortune = 2;
    autoCleave(useGame.getState, useGame.setState, enemy, heros[0], toucheQuiBalaie());
    const avant = JSON.stringify(suiteDeLaFenetre());
    useGame.getState().defenseSetMode('esquive');
    useGame.getState().defenseSetParryWeapon('sw');
    useGame.getState().defenseRoll();
    useGame.getState().defenseReroll();
    expect(JSON.stringify(suiteDeLaFenetre())).toBe(avant);
  });

  // K3 — la fenêtre voyage au siège invité par le snapshot coop : JSON PUR, les deux variantes.
  it('K3 les deux variantes survivent à l’aller-retour JSON du snapshot coop', () => {
    const { enemy } = setup(false);
    enemy.traits = [{ id: 'morsure', value: 14 }]; enemy.advantage = 1;
    aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy);
    const machine = suiteDeLaFenetre();
    expect(JSON.parse(JSON.stringify(machine))).toEqual(machine);
    const { enemy: e2, hero } = setup(false, 1, 0);
    const g = useGame.getState;
    openAttackCascade(g, useGame.setState, { attackerId: e2.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    const pilotee = suiteDeLaFenetre();
    expect(JSON.parse(JSON.stringify(pilotee))).toEqual(pilotee);
  });

  // K5 — la FERMETURE joue ce que la fenêtre porte : le balayage REPREND sa chaîne (mêmes cibles déjà
  // frappées, même compteur), il n'en redémarre pas une neuve.
  it('K5 la fermeture d’un maillon poursuit LA chaîne portée, sur la cible suivante', () => {
    const { enemy, heros } = setup(false, 3);
    autoCleave(useGame.getState, useGame.setState, enemy, heros[0], toucheQuiBalaie());
    expect(useGame.getState().pendingDefense!.defenderId).toBe(heros[1].id);
    useGame.getState().defenseRoll();
    useGame.getState().defenseConfirm();
    const suivante = useGame.getState().pendingDefense!;
    expect(suivante.defenderId, 'la chaîne enchaine sur la cible suivante').toBe(heros[2].id);
    expect(suivante.suite.mode === 'machine' && suivante.suite.coup.enchainement)
      .toEqual({ mode: 'chaine', hitIds: [heros[0].id, heros[1].id, heros[2].id], n: 2, bcc: 9, fm: false });
  });

  // K7 — ZÉRO PATCH APRÈS COUP : un balayage déclaré par-dessus une fenêtre VIVANTE n'écrit RIEN sur
  // elle. C'est la PORTE qui tranche (LDB 85 l.41-43 : la frappe précédente se résout entièrement,
  // fenêtre du défenseur comprise), et la suite portée par la fenêtre reste celle de SA frappe.
  it('K7 balayage lancé par-dessus une fenêtre vivante : la porte REFUSE, la suite de la fenêtre ne bouge pas', () => {
    const { enemy, heros } = setup(false, 3);
    expect(doAttack(useGame.getState, useGame.setState, enemy, heros[0])).toBe(true);
    const vivante = useGame.getState().pendingDefense!;
    const suiteAvant = JSON.parse(JSON.stringify(vivante.suite));
    expect(() => autoCleave(useGame.getState, useGame.setState, enemy, heros[0], toucheQuiBalaie())).toThrow(/défense/i);
    const apres = useGame.getState().pendingDefense!;
    expect(apres, 'le slot porte TOUJOURS la fenêtre de la frappe précédente').toBe(vivante);
    expect(apres.suite, 'aucun balayage ne s’est accroché à la fenêtre d’autrui').toEqual(suiteAvant);
  });

  // K6 — PILOTÉE : la fermeture rend l'attaque à `attackConfirm`, UNE fois ; et un pd piloté dont
  // l'attaquant a quitté le combat garde sa retombée (la fenêtre se ferme, le tour reprend).
  it('K6 pilotée : l’attaque est rendue au chemin d’application unique', () => {
    const { enemy, hero } = setup(false, 1, 0);
    const g = useGame.getState;
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    g().defenseRoll();
    g().defenseConfirm();
    const st = useGame.getState();
    expect(st.pendingDefense).toBeNull();
    expect(st.pendingAttack, 'l’attaque a été appliquée et rendue').toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === hero.id)!.wounds.current).toBeLessThan(200);
  });

  it('K6 pilotée dont l’attaquant a quitté le combat : la fenêtre se ferme sans appliquer', () => {
    const { enemy, hero } = setup(false, 1, 0);
    const g = useGame.getState;
    openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
    g().attackRoll();
    g().attackConfirm();
    g().defenseRoll();
    const b = g().battle!;
    useGame.setState({ battle: { ...b, combatants: b.combatants.filter((c) => c.id !== enemy.id) } });
    g().defenseConfirm();
    const st = useGame.getState();
    expect(st.pendingDefense).toBeNull();
    expect(st.battle!.combatants.find((c) => c.id === hero.id)!.wounds.current).toBe(200);
  });
});
