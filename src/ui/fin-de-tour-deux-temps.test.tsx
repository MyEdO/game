// @vitest-environment jsdom
/**
 * GARDE-FOU « TOUR GÂCHÉ » (#1411 P2-A) — finir son tour avec l'Action INTACTE demande DEUX gestes,
 * et c'est la politique de l'ENTRÉE DE REGISTRE `end-turn` : le dispatcher (`battleEndTurn`) arme
 * puis passe la main. Les deux surfaces — la plaque de sortie de la console et la touche Espace —
 * franchissent la MÊME porte (`runAction('end-turn')`), donc le même garde-fou ; le libellé « Finir
 * quand même ? » se lit dans l'état du combat (`battle.endTurnArmed`), jamais dans un état d'écran.
 *
 * L'armement porte l'EMPREINTE de l'économie du tour : tout geste qui la change (un pas, l'Action,
 * le tour suivant) le périme sans remise à zéro dispersée. L'annulation d'un déplacement, elle, REND
 * l'économie d'avant le segment : elle désarme explicitement (`cancelMove`, inverse unique).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame, type BattleState } from '../state/store';
import { createHero } from '../engine/character';
import { runAction } from '../state/actionRegistry';
import { runBindingById } from '../state/keybindings';
import { endTurnArmed } from '../state/endTurnGuard';
import { emptyScene } from '../state/scene';
import type { Combatant } from '../engine/types';
import { CombatConsole } from './CombatConsole';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function combattant(id: string, label: string, kind: Combatant['kind'] = 'hero'): Combatant {
  const c = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 11 });
  c.id = id;
  c.kind = kind;
  c.pos = { x: 4, y: 4 };
  return c;
}

let host: HTMLDivElement;
let root: Root;

function combat() {
  const h = combattant('h1', 'Gunnar');
  const e = combattant('e1', 'Brigand', 'enemy');
  e.pos = { x: 9, y: 9 };
  act(() => {
    useGame.setState({
      party: [h], scene: emptyScene(), mode: 'battle',
      net: { ...useGame.getState().net, mode: 'local', mySeat: 0, ownership: {}, seatNames: {} },
      battle: {
        combatants: [h, e], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'], turn: 0, round: 1,
        action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, movedPreAction: false,
        acted: false, log: [], over: null,
      } as unknown as BattleState,
    });
  });
  return { h, e };
}

const battle = () => useGame.getState().battle!;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ battle: null, mode: 'exploration' });
});

describe('fin de tour — l’Action intacte demande deux gestes, quelle que soit la surface', () => {
  it('la TOUCHE seule : 1er appui = armement (le tour ne bascule pas), 2ᵉ = tour suivant', () => {
    combat();
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn, 'le tour a basculé sans confirmation, l’Action non dépensée').toBe(0);
    expect(endTurnArmed(battle()), 'rien n’est armé : le 2ᵉ appui n’aurait rien à confirmer').toBe(true);
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn, 'le 2ᵉ appui n’a pas passé la main').toBe(1);
  });

  it('après une ANNULATION DE DÉPLACEMENT, le garde-fou tient encore (économie du tour rendue)', () => {
    const { h } = combat();
    act(() => {
      useGame.setState({
        battle: { ...battle(), movementUsed: 3, moveSnapshot: { pos: { h1: { ...h.pos } }, facing: {}, movedPreAction: false } } as unknown as BattleState,
      });
    });
    runAction('undo-move', useGame.getState);
    expect(battle().movementUsed, 'l’annulation de déplacement n’a rien rendu').toBe(0);
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn, 'le tour a basculé juste après une annulation de déplacement').toBe(0);
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn).toBe(1);
  });

  it('ARMER puis un PAS puis ANNULER ce pas : l’armement ne RESSUSCITE pas (un seul appui ne bascule rien)', () => {
    combat();
    runBindingById('end-turn', useGame.getState); // 1er geste : armement sur l'économie « 0 pas »
    expect(endTurnArmed(battle()), 'le 1er geste n’a rien armé').toBe(true);
    act(() => { useGame.getState().battleClickTile({ x: 5, y: 4 }, { confirm: true }); }); // un VRAI pas
    expect(battle().movementUsed, 'le pas n’a rien coûté : rien à annuler ensuite').toBeGreaterThan(0);
    expect(endTurnArmed(battle()), 'le pas n’a pas périmé l’armement').toBe(false);
    runAction('undo-move', useGame.getState);
    expect(battle().movementUsed, 'l’annulation n’a rien rendu').toBe(0);
    expect(endTurnArmed(battle()), 'l’économie rendue a RESSUSCITÉ l’armement du 1er geste').toBe(false);
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn, 'un seul appui a fait basculer le tour, l’Action intacte').toBe(0);
    expect(endTurnArmed(battle()), 'cet appui n’a pas armé : le suivant n’aurait rien à confirmer').toBe(true);
  });

  it('l’Action DÉPENSÉE : un seul geste suffit (le garde-fou ne garde que ce qui se gâche)', () => {
    combat();
    act(() => { useGame.setState({ battle: { ...battle(), acted: true } as BattleState }); });
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn).toBe(1);
  });

  it('un PAS entre les deux gestes périme l’armement (l’économie du tour a changé)', () => {
    combat();
    runBindingById('end-turn', useGame.getState);
    expect(endTurnArmed(battle())).toBe(true);
    act(() => { useGame.setState({ battle: { ...battle(), movementUsed: 2 } as BattleState }); });
    expect(endTurnArmed(battle()), 'l’armement survit à une dépense de Mouvement').toBe(false);
    runBindingById('end-turn', useGame.getState);
    expect(battle().turn, 'le tour a basculé sur un armement périmé').toBe(0);
  });
});

describe('fin de tour — la plaque de la console et la touche passent par la MÊME porte', () => {
  it('le CLIC arme, la TOUCHE finit : un seul garde-fou pour les deux surfaces', () => {
    combat();
    act(() => { root.render(<CombatConsole />); });
    const plaque = host.querySelector<HTMLButtonElement>('[data-cell="end-turn"]');
    expect(plaque, 'la plaque de sortie n’est pas dessinée').not.toBeNull();
    act(() => { plaque!.click(); });
    expect(battle().turn, 'le clic a passé la main sans confirmation').toBe(0);
    expect(endTurnArmed(battle())).toBe(true);
    // L'armement se LIT à l'écran (il vit dans le combat, pas dans un état d'écran).
    expect(host.querySelector('[data-cell="end-turn"]')?.getAttribute('data-armed')).toBe('');
    expect(host.querySelector('[data-cell="end-turn"]')?.textContent).toContain('Finir quand même');
    // …et la TOUCHE consomme CET armement : aucune surface n'a son propre compteur de clics.
    act(() => { runBindingById('end-turn', useGame.getState); });
    expect(battle().turn, 'la touche a rouvert un 2ᵉ garde-fou pour son propre compte').toBe(1);
  });
});
