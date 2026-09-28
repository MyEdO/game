// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, afterEach } from 'vitest';
import { useGame, type BattleState } from '../../state/store';
import { openAttackCascade } from '../../state/combatFlow';
import { seedBattleRng } from '../../state/battleRng';
import { OPPOSED_FORCING_CANCELLED_NOTE } from '../../state/rollFlowSpecs';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant, Weapon } from '../../engine/types';
import { useDefenseJetProps } from './useDefenseJetProps';
import { RollShell } from '../RollShell';

/**
 * #1000 — quand les DEUX camps ont dépensé « Je ne faillirai pas ! », l'arbitrage APPLIQUÉ (les deux
 * garanties de victoire s'éteignent) est AFFICHÉ dans la fenêtre de celui qui vient de brûler son
 * Point. La sonde monte la fenêtre ENTIÈRE (`RollShell`) : l'arbitrage est une note d'ÉTAT, distincte
 * de l'ISSUE du jet (#1078) — un test qui ne regarderait qu'une zone raterait le déplacement de l'autre.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const chars = { 'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const sword: Weapon = { name: 'Épée', label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }): Combatant =>
  ({ id, name: id, label: id, kind, characteristics: { ...chars }, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [sword], advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, resilience: 1 } as unknown as Combatant);

/** Monte la fenêtre de Défense ENTIÈRE, telle que la rend `CascadeModal`. */
function Probe() {
  const props = useDefenseJetProps();
  return props ? <RollShell {...props} /> : null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null; host = null;
});

/** Joue l'opposition PILOTÉE jusqu'à la fenêtre de Défense, en forçant les camps demandés. */
function play(opts: { atk?: boolean; def?: boolean }): string {
  const enemy = mk('e', 'enemy', { x: 1, y: 0 });
  const hero = mk('h', 'hero', { x: 0, y: 0 });
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
  if (opts.atk) g().attackForceSuccess();
  g().attackConfirm();
  g().defenseRoll();
  if (opts.def) g().defenseForceSuccess();
  if (root) act(() => root!.unmount());
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root!.render(<Probe />));
  return host.textContent ?? '';
}

describe('#1000 — l’annulation mutuelle des Résiliences est AFFICHÉE', () => {
  it('les deux camps ont forcé → la fenêtre porte la ligne factuelle', () => {
    expect(play({ atk: true, def: true })).toContain(OPPOSED_FORCING_CANCELLED_NOTE);
  });

  it('un seul camp a forcé (ou aucun) → aucune ligne : la garantie tient, il n’y a rien à annoncer', () => {
    for (const opts of [{ atk: true }, { def: true }, {}]) {
      const html = play(opts);
      // TÉMOIN : la fenêtre a bien rendu son ISSUE (sinon l'absence de la note ne prouverait rien).
      expect(html, 'la fenêtre rend bien l’issue du jet').toContain(useGame.getState().pendingDefense!.result!.log);
      expect(html).not.toContain(OPPOSED_FORCING_CANCELLED_NOTE);
    }
  });
});
