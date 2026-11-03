/**
 * `intentionDuClicDeCase` (noyau) : ce que joue la case, lue par le commit du curseur ET le clic-sol
 * (`useStagePointer.performClick`) → ennemi → attaque, case libre → déplacement, allié → rien. Le curseur clavier et
 * manette se joue en `src/state/combatCursor.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { intentionDuClicDeCase } from './combatOrParty';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './monde/spawn';

/** Arène d'herbe minimale (intentionDuClicDeCase dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => {
  const w = 22, h = 16;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

describe('intentionDuClicDeCase — clic-sol et commit du curseur (mode-aware)', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });
  function makeState() {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 }); // adjacent au héros
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ battle: battle as never, scene: arena(), party: [hero, ally] });
    return { hero, ally, enemy };
  }

  it('curseur sur un ennemi → intention { entity }', () => {
    const { enemy } = makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 7, y: 10 })).toEqual({ kind: 'entity', id: enemy.id });
  });

  it('curseur sur une case libre → intention { tile }', () => {
    makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 12, y: 4 })).toEqual({ kind: 'tile', pt: { x: 12, y: 4 } });
  });

  it('curseur sur un allié non actionnable → null (no-op, jamais clic-case)', () => {
    makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 5, y: 10 })).toBeNull();
  });

  it('combat terminé → null ; une case libre d’étage garde son `z`', () => {
    makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 12, y: 4, z: 1 })).toEqual({ kind: 'tile', pt: { x: 12, y: 4, z: 1 } });
    banc.setState({ battle: { ...banc.getState().battle!, over: 'victory' } as never });
    expect(intentionDuClicDeCase(banc.getState, { x: 12, y: 4 })).toBeNull();
  });

  it('hors combat → null', () => {
    banc.setState({ battle: null });
    expect(intentionDuClicDeCase(banc.getState, { x: 1, y: 1 })).toBeNull();
  });
});
