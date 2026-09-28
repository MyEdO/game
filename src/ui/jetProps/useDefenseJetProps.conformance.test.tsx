// @vitest-environment jsdom
/**
 * Défense réactive — conformité Z1 du contrat d'affichage d'un jet (#1143, `docs/charte-ui.md` §Z0-Z15).
 * La fenêtre est montée ENTIÈRE (`RollShell` via le hook, comme la rend `CascadeModal`) : Z1 est le
 * sous-titre « Acteur — Action (Compétence) » composé par `composeRollLabel`, porté par l'acteur DU JET
 * (le défenseur) ; l'identité de l'attaquant reste à Z3 (`VsHeader`, `.rm-vs`). Le sous-titre SUIT le
 * mode choisi : Parade = Test de Corps à corps, Esquive = Compétence Esquive (`LDB 13 l.161-167`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame, type BattleState } from '../../state/store';
import { openAttackCascade, aiCreatureFreeAttacks } from '../../state/combatFlow';
import { seedBattleRng } from '../../state/battleRng';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant, Weapon } from '../../engine/types';
import { RollShell } from '../RollShell';
import { useDefenseJetProps } from './useDefenseJetProps';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, label: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: label, label, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, resilience: 1 } as unknown as Combatant);

function Probe() {
  const props = useDefenseJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null; host = null;
});

/** Ouvre la fenêtre de Défense d'un héros attaqué en mêlée, et la monte.
 *  `defenderWeapon` remplace l'arme (donc l'arme de parade par défaut) du défenseur. */
function openDefense(defenderWeapon?: Weapon): HTMLDivElement {
  const enemy = mk('e', 'Rat géant', 'enemy', { x: 1, y: 0 });
  const hero = mk('h', 'Gunnar', 'hero', { x: 0, y: 0 });
  if (defenderWeapon) hero.weapons = [defenderWeapon];
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  const g = useGame.getState;
  seedBattleRng(3);
  openAttackCascade(g, useGame.setState, { attackerId: enemy.id, targetId: hero.id, location: null, result: null, weaponUid: 'sw' }, 'Attaque', 'action/attack');
  g().attackRoll();
  g().attackConfirm();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

/** Ouvre la fenêtre de Défense d'un héros contre une attaque GRATUITE de créature (Morsure, LDB 85
 *  l.237) — chemin de la MACHINE : la frappe entre par `aiCreatureFreeAttacks`, et c'est elle qui dit
 *  à la fenêtre ce qu'elle annonce. Le héros encaisse sans tomber (la fin de combat clorait tout). */
function openBiteDefense(): HTMLDivElement {
  const enemy = mk('e', 'Rat géant', 'enemy', { x: 1, y: 0 });
  const hero = mk('h', 'Gunnar', 'hero', { x: 0, y: 0 });
  hero.wounds = { current: 200, max: 200 } as Combatant['wounds'];
  enemy.traits = [{ id: 'morsure', value: 14 }];
  enemy.advantage = 1;
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: 0, ownership: {} },
  });
  seedBattleRng(3);
  aiCreatureFreeAttacks(useGame.getState, useGame.setState, enemy);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host;
}

const subtitle = () => host!.querySelector('.rm-subtitle')?.textContent;
/** Libellé de la rangée TÉMOIN (l'attaque figée), rangée [0] du panneau. */
const attackRowText = () => host!.querySelectorAll('.rr-row')[0]?.textContent ?? '';

describe('Défense — Z1 « Acteur — Action (Compétence) »', () => {
  it('Parade : le sous-titre nomme le DÉFENSEUR et sa Compétence de parade', () => {
    const view = openDefense();
    expect(useGame.getState().pendingDefense!.mode).toBe('parade');
    expect(view.querySelector('h3')?.textContent).toBe('Défense');
    expect(subtitle()).toBe('Gunnar — Défense (Corps à corps)');
    // Z3 reste le SEUL A→B : le sous-titre ne redit pas l'attaquant.
    expect(view.querySelectorAll('.rm-vs')).toHaveLength(1);
    expect(subtitle()).not.toContain('Rat géant');
  });

  it('Esquive : basculer de mode change la Compétence du sous-titre', () => {
    openDefense();
    act(() => { useGame.getState().defenseSetMode('esquive'); });
    expect(subtitle()).toBe('Gunnar — Défense (Esquive)');
  });

  it('Parade avec une arme à résolution alternative (Bélier) : le sous-titre nomme la CARACTÉRISTIQUE', () => {
    // La base de la parade est celle de `defenseValue` (Force 35 ici, `combatValue` court-circuite CC 45) :
    // le sous-titre doit nommer la même Caractéristique, sinon il annonce un Test qui n'est pas celui joué.
    const belier = { name: 'Bélier', label: 'Bélier', type: 'melee', damage: { plusBF: true, flat: 10 }, uid: 'bl', qualities: [], resolveChar: 'force' } as unknown as Weapon;
    const view = openDefense(belier);
    // Parer d'un Bélier (Force 35) vaut moins qu'esquiver (Agilité 40) : le mode par défaut est l'Esquive,
    // le joueur choisit la parade — c'est ce choix que le sous-titre doit suivre.
    act(() => { useGame.getState().defenseSetMode('parade'); });
    expect(subtitle()).toBe('Gunnar — Défense (Force)');
    expect(view.textContent).not.toContain('Défense (Corps à corps)');
  });
});

/**
 * CE QUE LA FENÊTRE ANNONCE vient de la frappe qui l'a OUVERTE (#1858) — et le siège INVITÉ, qui ne
 * reçoit le pending que par le snapshot coop (JSON pur, `netSnapshot`), rend la MÊME fenêtre.
 */
describe('Défense — l’attaque annoncée, et son voyage jusqu’à l’invité', () => {
  it('Morsure gratuite : la rangée témoin annonce la MORSURE, pas une attaque générique', () => {
    openBiteDefense();
    expect(useGame.getState().pendingDefense!.defenderId).toBe('h');
    expect(attackRowText()).toContain('Morsure');
  });

  for (const [nom, ouvrir] of [['pilotée', openDefense], ['gratuite de la machine', openBiteDefense]] as const) {
    it(`chemin INVITÉ (${nom}) : la fenêtre rendue depuis le pending passé par JSON est la même`, () => {
      ouvrir();
      const attendu = attackRowText();
      const voyage = JSON.parse(JSON.stringify(useGame.getState().pendingDefense));
      act(() => { useGame.setState({ pendingDefense: voyage }); });
      expect(subtitle()).toBe('Gunnar — Défense (Corps à corps)');
      expect(attackRowText()).toBe(attendu);
    });
  }
});
