/**
 * Combat monté (LDB 14) — la portée/adjacence de MÊLÉE se mesure depuis l'empreinte de la MONTURE
 * (« le couple partage la position et l'empreinte de la monture »), pas depuis le cavalier 1×1. Sinon un
 * cavalier sur un cheval Grand (2×2) ne peut pas frapper une cible collée à la croupe (distante de 2 du
 * cavalier mais de 1 de la monture) — et une Charge qui bouge par la monture puis refuse l'attaque par le
 * cavalier laisse une cascade d'attaque orpheline (soft-lock de fin de tour).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { mountUp } from './mount';
import { attackPlan, previewAttack, resolveAttack } from './combatFlow';
import { combatDistance } from './footprint';
import { testScene } from '../scenes/test-fixture';

function setup() {
  const hero = makePregens()[0];
  hero.weapons = [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }] as never; // Allonge 1
  const mount = spawnEnemy({ ref: 'cheval' }, 'mount-1', { x: 11, y: 9 });
  mount.size = 'grande'; // empreinte 2×2 → couvre (11,9)(12,9)(11,10)(12,10)
  mountUp(hero, mount); // appairage : hero.pos := (11,9), hero.mountId/mount.riderId
  const foe = spawnEnemy({ ref: 'brigand' }, 'foe', { x: 13, y: 10 }); // adjacent à la monture, à 2 du cavalier
  const battle = {
    combatants: [hero, mount, foe], order: [hero.id, 'mount-1', 'foe'], baseOrder: [hero.id, 'mount-1', 'foe'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  useGame.setState({ battle, scene: testScene, party: [] });
  return { hero, mount, foe };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [] });
  useGame.getState().seedRng(1);
});

describe('portée de mêlée d’un cavalier = empreinte de la monture', () => {
  it('prémisse : le cavalier est à distance 2 de la cible, la monture à 1', () => {
    const { hero, mount, foe } = setup();
    expect(combatDistance(hero, foe)).toBe(2); // cavalier 1×1 en (11,9)
    expect(combatDistance(mount, foe)).toBe(1); // monture 2×2 → croupe en (12,10) ↔ (13,10)
  });

  it('attackPlan : cible adjacente à la MONTURE → attaque directe (pas Charge ni blocage)', () => {
    const { hero, foe } = setup();
    const plan = attackPlan(() => useGame.getState(), hero, foe);
    expect(plan.kind).toBe('attack');
  });

  it('previewAttack : la cible est À PORTÉE de mêlée pour le cavalier monté', () => {
    const { hero, foe } = setup();
    const pv = previewAttack(() => useGame.getState(), hero, foe);
    expect(pv.kind).toBe('melee');
    expect(pv.inRange).toBe(true);
  });

  it('resolveAttack : un cavalier au contact PAR SA MONTURE résout l’attaque (≠ null → pas de cascade orpheline)', () => {
    const { hero, foe } = setup();
    // fromCharge=true (chemin de la charge montée) : sans le fix, dist cavalier 2 > Allonge 1 → null → soft-lock.
    const r = resolveAttack(() => useGame.getState(), hero, foe, undefined, true);
    expect(r).not.toBeNull();
    expect(r!.res).toBeTruthy();
  });
});
