/**
 * Le gabarit de ZdE peint le verdict du noyau (`noyau/combatFlow.ts:zoneSousLeCurseur`, #3059) : teinte de la pose
 * valide ou invalide, bloc de (2r+1)² cases au rayon rendu.
 */
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { herosDeScenario } from '../../scenes/test-scenarios/_heros';
import type { BattleState } from '../../noyau/etat';
import type { Dims } from '../../geometry/iso';
import { ZdeTemplate } from './ZdeTemplate';
import { ENEMY_CUE_TINT, INVALID_TINT } from '../highlightTints';

const dims: Dims = { w: 20, h: 8, rot: 0, view: 'iso' };

/** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0 (gabarit de `noyau/cast-los.hors-store.test.ts`). */
function wallScene() {
  const tiles: string[] = new Array(20 * 8).fill('herbe');
  for (let y = 1; y < 8; y++) tiles[y * 20 + 10] = 'mur';
  return { id: 's', dimensions: { w: 20, h: 8 }, layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
}

const vierge = useGame.getState();
afterEach(() => useGame.setState({ battle: vierge.battle, scene: vierge.scene, mode: vierge.mode, pendingSiegeAim: vierge.pendingSiegeAim, pendingCast: vierge.pendingCast }));

/** Un servant en (2,0) arme un pilonnage de rayon 1, sans cap de portée ; rend le gabarit peint sous `hover`. */
function peindre(hover: { x: number; y: number }): string {
  const w = herosDeScenario(idsDeTest, 'sorcier');
  w.pos = { x: 2, y: 0 };
  const battle = { combatants: [w], order: [w.id], baseOrder: [w.id], turn: 0, round: 1, action: null, reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState;
  const pendingSiegeAim = { gunnerId: w.id, weaponUid: 'canon', radius: 1, rangeTiles: null };
  useGame.setState({ mode: 'battle', scene: wallScene(), battle, pendingCast: null, pendingSiegeAim });
  return renderToStaticMarkup(<svg><ZdeTemplate battle={battle} hover={hover} pendingCast={null} pendingSiegeAim={pendingSiegeAim} dims={dims} /></svg>);
}

const cases = (html: string, teinte: string) => html.split(`fill="${teinte}"`).length - 1;

describe('ZdeTemplate — le gabarit peint le verdict du noyau', () => {
  it('pose en vue : neuf cases à la teinte valide', () => {
    const html = peindre({ x: 8, y: 2 });
    expect(cases(html, ENEMY_CUE_TINT)).toBe(9);
    expect(cases(html, INVALID_TINT)).toBe(0);
  });

  it('pose derrière le mur : neuf cases à la teinte invalide', () => {
    const html = peindre({ x: 16, y: 4 });
    expect(cases(html, INVALID_TINT)).toBe(9);
    expect(cases(html, ENEMY_CUE_TINT)).toBe(0);
  });
});
