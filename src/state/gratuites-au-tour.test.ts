/** LDB 13 l.14 ; LDB 85 l.43 ; LDB 85 l.387 — #1765. */
import { describe, it, beforeEach, afterEach, vi, expect } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { maybeOpenDefense } from '../noyau/combatFlow';
import type { SuiteDeCoup } from '../noyau/pendings';

const g = useGame.getState;

/** Une créature Énorme au contact d'un héros Moyen, Avantage 3 : le Piétinement (LDB 85 l.387) lui est
 *  ouvert. `tourDe` pose le combattant actif ; la créature frappe ensuite une gratuite d'Arme (forme de
 *  `applyTalentFreeAttack`) dont la défense se résout par `defenseRoll` puis `defenseConfirm`.
 *  `fileEpuisee` : la file du tour déjà vidée, état que pose `aiCreatureFreeAttacks` en fin de file. */
function frappeGratuite(tourDe: 'heros' | 'creature', fileEpuisee = false) {
  const A = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
  useGame.setState({ party: [A] });
  g().seedRng(5);
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const b = g().battle!;
  const heros = b.combatants.find((c) => c.kind === 'hero')!;
  const [E] = b.combatants.filter((c) => c.kind === 'enemy');
  b.combatants.filter((c) => c.kind === 'enemy' && c.id !== E.id).forEach((e) => (e.dead = true));
  E.size = 'enorme'; E.advantage = 3; E.pendingFreeAttacks = fileEpuisee ? [] : undefined;
  E.pos = { x: 6, y: 10 }; heros.pos = { x: 7, y: 10 };
  heros.wounds = { current: 200, max: 200, base: 200 } as never;
  E.engagedWith = [heros.id]; heros.engagedWith = [E.id];
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(tourDe === 'heros' ? heros.id : E.id), acted: false } });
  const suite: SuiteDeCoup = { restitution: { prevActed: false }, manoeuvre: { kind: 'arme' }, enchainement: { mode: 'aucun' } };
  expect(maybeOpenDefense(g, useGame.setState, E, heros, E.weapons[0], suite), 'la fenêtre de la gratuite d’Arme s’ouvre').toBe(true);
  g().defenseRoll();
  g().defenseConfirm();
  const creature = g().battle!.combatants.find((c) => c.id === E.id)!;
  return { herosId: heros.id, creature };
}

describe('Gratuites de créature : à son tour seulement (LDB 13 l.14, LDB 85 l.43)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ pendingDisengage: null, pendingCascade: null, pendingFateSave: null, battle: null, pendingDefense: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('au tour du héros, `defenseConfirm` ne lance pas le Piétinement : file intacte, Avantage non dépensé', () => {
    const temoin = frappeGratuite('heros', true).creature.advantage;
    const { herosId, creature } = frappeGratuite('heros');
    expect(g().battle!.order[g().battle!.turn], 'le tour reste au héros').toBe(herosId);
    expect(g().pendingDefense, 'aucune fenêtre de Piétinement').toBeNull();
    expect(creature.pendingFreeAttacks, 'la file du tour de la créature n’est pas touchée').toBeUndefined();
    expect(creature.advantage, 'l’Avantage est celui du même coup, file épuisée').toBe(temoin);
  });

  it('au tour de la créature, `defenseConfirm` lance le Piétinement contre le héros', () => {
    const { herosId, creature } = frappeGratuite('creature');
    const pd = g().pendingDefense;
    expect(pd?.attackerId).toBe(creature.id);
    expect(pd?.defenderId).toBe(herosId);
    expect(pd?.suite.mode === 'machine' ? pd.suite.coup.manoeuvre?.kind : undefined, 'la gratuite est le Piétinement').toBe('pietinement');
    expect(creature.pendingFreeAttacks, 'la file est initialisée et consommée').toEqual([]);
  });
});
