/**
 * Trois modes de ciblage du registre (`targetingModes.ts`), lus par la surface du noyau : le réticule de la
 * Surincantation +Cible (`LDB 47 l.28`), les candidats de la Frappe Mortelle (`LDB 14 l.9`) et la case valide d'une pose
 * de zone (portée en cases, Ligne de vue : `LDB 46 l.121`).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { currentTargetingMode } from './targetingModes';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const arene = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

/** Le héros h1 en (6,6), un allié en (5,6) ; e1 et e2 à son contact, e3 loin. */
function combat() {
  const hero = tousLesHerosDeScenario(idsDeTest)[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
  const ally = tousLesHerosDeScenario(idsDeTest)[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
  const e1 = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 6 });
  const e2 = spawnEnemy({ ref: 'humain' }, 'e2', { x: 6, y: 7 });
  const e3 = spawnEnemy({ ref: 'humain' }, 'e3', { x: 12, y: 6 });
  const ids = ['h1', 'h2', 'e1', 'e2', 'e3'];
  const battle = {
    combatants: [hero, ally, e1, e2, e3], order: ids, baseOrder: ids,
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  banc.setState({ battle, mode: 'battle', scene: arene(), party: [hero, ally], pendingCleave: null, pendingDualStrike: null, pendingCast: null, pendingAttack: null, pendingSiegeAim: null, refus: null });
  return { hero, ally, e1, e2, e3 };
}

describe('Surincantation +Cible — LDB 47 l.28', () => {
  it('le réticule n’accroche que les cibles supplémentaires éligibles, jamais la cible principale ni un allié', () => {
    const { hero, ally, e1, e2 } = combat();
    banc.setState({ pendingCast: { casterId: 'h1', targetId: 'e1', spellId: 'carreau', missile: true, pickingTargets: true, result: { cast: true } } as never });
    const mode = currentTargetingMode(banc.getState);
    expect(mode.id).toBe('surincantation');
    const eligibles = mode.candidates!(banc.getState, hero).map((c) => c.id);
    expect(eligibles, 'fixture : e2 est une cible supplémentaire').toContain('e2');
    const vise = mode.affordance!(banc.getState, hero, e2);
    expect(vise.kind).toBe('ok');
    expect(mode.affordance!(banc.getState, hero, e1).kind).toBe('none');
    expect(mode.affordance!(banc.getState, hero, ally).kind).toBe('none');
  });
});

describe('Frappe Mortelle — LDB 14 l.9', () => {
  it('les candidats sont les adversaires au contact pas encore frappés par ce balayage', () => {
    const { hero } = combat();
    banc.setState({ pendingCleave: { attackerId: 'h1', hitIds: ['e1'], count: 1 } as never });
    const mode = currentTargetingMode(banc.getState);
    expect(mode.id).toBe('frappeMortelle');
    expect(mode.candidates!(banc.getState, hero).map((c) => c.id)).toEqual(['e2']);
  });

  it('sans balayage d’un attaquant présent, aucun candidat', () => {
    const { hero } = combat();
    banc.setState({ pendingCleave: { attackerId: 'absent', hitIds: [], count: 0 } as never });
    expect(currentTargetingMode(banc.getState).candidates!(banc.getState, hero)).toEqual([]);
  });
});

describe('pose de zone — portée et Ligne de vue (LDB 46 l.121)', () => {
  it('une case dans la portée est valide, une case au-delà ne l’est pas', () => {
    const { hero } = combat();
    banc.setState({ pendingSiegeAim: { gunnerId: 'h1', weaponUid: 'w', radius: 2, rangeTiles: 3 } as never });
    const mode = currentTargetingMode(banc.getState);
    expect(mode.id).toBe('poseDeLaZone');
    const valide = (pt: { x: number; y: number }) => (mode as { tileValidAt: (g: typeof banc.getState, a: typeof hero, p: typeof pt) => boolean }).tileValidAt(banc.getState, hero, pt);
    expect(valide({ x: 9, y: 6 })).toBe(true);
    expect(valide({ x: 10, y: 6 })).toBe(false);
  });
});
