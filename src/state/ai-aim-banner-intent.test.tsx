// @vitest-environment jsdom
/**
 * Bandeau de combat × télégraphe d'intention de l'IA (#1143 volet B). Le bandeau projette `actorAim`
 * (« X attaque Y ») sinon la dernière ligne IMPORTANTE du journal. Tant que l'attaque ennemie n'est pas
 * RÉSOLUE (fenêtre de Défense ouverte, aucune entrée de journal produite), effacer `actorAim` renvoie le
 * bandeau sur la ligne de l'événement PRÉCÉDENT — le joueur défend contre une annonce périmée.
 * Sonde de bout en bout : vrai `runEnemyAI`, vrai store, `CombatBanner` MONTÉ (c'est l'écran qui juge).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from './store';
import { runEnemyAI } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { ev } from './combatLog';
import { testScene } from '../scenes/test-fixture';
import { CombatBanner } from '../ui/CombatBanner';
import type { Combatant, Weapon } from '../engine/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 20, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, label: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: label, label, kind, characteristics: { ...chars }, conditions: [], traumas: [], engagedWith: [], skills: [], talents: [], items: [],
     weapons: [{ ...sword, uid: `sw-${id}` }], advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, resilience: 1 } as unknown as Combatant);

const STALE = 'Gunnar frappe Rat géant';

let root: Root | null = null;
let host: HTMLDivElement | null = null;

beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  if (root) act(() => root!.unmount());
  host?.remove();
  root = null; host = null;
  vi.clearAllTimers(); vi.useRealTimers();
  useGame.setState({ battle: null, pendingDefense: null, pendingCascade: null, actorAim: null });
});

/** Ennemi au contact d'un héros SURFACÉ, journal portant une ligne d'un beat PRÉCÉDENT. */
function setup() {
  const enemy = mk('e', 'Rat géant', 'enemy', { x: 1, y: 0 });
  const hero = mk('h', 'Gunnar', 'hero', { x: 0, y: 0 });
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false,
    log: [ev('attack', STALE, hero.id, enemy.id)], over: null,
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), pendingDefense: null, pendingAttack: null, pendingCascade: null, actorAim: null,
    net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  });
  seedBattleRng(3);
  return { enemy, hero };
}

const banner = () => {
  act(() => root!.render(<CombatBanner />));
  return host!.textContent ?? '';
};

describe('#1143 — le bandeau annonce l’attaque EN COURS, jamais le beat précédent', () => {
  it('pendant la fenêtre de Défense ouverte par l’IA, le bandeau porte l’INTENTION de l’attaquant', () => {
    const { enemy } = setup();
    runEnemyAI(useGame.getState, useGame.setState, enemy.id);

    // Phase de télégraphe : l'intention est déjà à l'écran (acquis, témoin du câblage).
    expect(useGame.getState().actorAim).not.toBeNull();
    expect(banner()).toContain('Rat géant attaque Gunnar');

    // Échéance du télégraphe → l'attaque s'ouvre en fenêtre de Défense : RIEN n'est encore résolu.
    act(() => { vi.runOnlyPendingTimers(); });
    expect(useGame.getState().pendingDefense).not.toBeNull();
    expect(useGame.getState().battle!.log.map((e) => e.text)).toEqual([STALE]); // aucune ligne de résultat produite

    const txt = banner();
    expect(txt).toContain('Rat géant attaque Gunnar');
    expect(txt).not.toContain(STALE);

    // Défense jouée et APPLIQUÉE : l'issue est journalisée → elle prend le bandeau, le télégraphe s'efface.
    act(() => { useGame.getState().defenseRoll(); useGame.getState().defenseConfirm(); });
    expect(useGame.getState().actorAim).toBeNull();
    const after = banner();
    expect(after).not.toContain('Rat géant attaque Gunnar');
    expect(after).not.toContain(STALE);
  });

  it('l’attaque RÉSOLUE sans fenêtre (défenseur non surfacé) rend la main au journal — pas de télégraphe résiduel', () => {
    const { enemy, hero } = setup();
    hero.aiControlled = true; // plus aucun siège ne défend → résolution instantanée, journalisée
    runEnemyAI(useGame.getState, useGame.setState, enemy.id);
    act(() => { vi.runOnlyPendingTimers(); });

    expect(useGame.getState().pendingDefense).toBeNull();
    expect(useGame.getState().actorAim).toBeNull(); // télégraphe purgé À la résolution (pas de fuite)
    const txt = banner();
    expect(txt).not.toContain(STALE);
    expect(txt).not.toContain('Rat géant attaque Gunnar');
  });

  // Chemin RÉEL du défaut d'écran : une créature enchaîne une attaque GRATUITE (Morsure) après son attaque
  // principale. `defenseConfirm` sort alors par sa branche « une nouvelle fenêtre s'est ouverte » — aucune
  // reprise de tour ne passe. Le télégraphe doit tomber au SEAM de résolution (`applyAttackResult`), pas à
  // une sortie de geste énumérée : sinon le bandeau reste figé sur l'intention pendant que le journal
  // porte déjà l'issue de l'attaque principale.
  it('attaque principale RÉSOLUE puis attaque gratuite enchaînée : le bandeau passe à la LIGNE DE RÉSULTAT', () => {
    const { enemy, hero } = setup();
    enemy.traits = [{ id: 'morsure', value: 14 }];
    enemy.advantage = 5; // réserve couvrant le coût de l'attaque gratuite de Morsure
    // L'attaquant doit REMPORTER le Test opposé : perdre remet son Avantage à 0 et lui retirerait de quoi
    // payer la Morsure — l'enchaînement (le geste multi-attaques de l'écran) ne se produirait pas.
    enemy.characteristics['capacite-de-combat'] = 85;
    hero.characteristics['capacite-de-combat'] = 1;
    hero.characteristics.agilite = 1;
    runEnemyAI(useGame.getState, useGame.setState, enemy.id);
    act(() => { vi.runOnlyPendingTimers(); });
    expect(useGame.getState().pendingDefense).not.toBeNull();

    act(() => { useGame.getState().defenseRoll(); useGame.getState().defenseConfirm(); });

    // L'attaque principale est journalisée ; la Morsure a rouvert une fenêtre (tour toujours suspendu).
    const lines = useGame.getState().battle!.log.map((e) => e.text);
    expect(lines.length).toBeGreaterThan(1);
    expect(useGame.getState().pendingDefense).not.toBeNull();

    expect(useGame.getState().actorAim).toBeNull();
    const txt = banner();
    expect(txt).not.toContain('Rat géant attaque Gunnar');
    expect(txt).toContain(lines[lines.length - 1]);
  });
});
