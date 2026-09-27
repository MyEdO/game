/**
 * Câblage RÉEL de l'axe Dégâts de la Surincantation révisée (`VDM 02 l.198`, option
 * `magic-vdm-incantation`) jusqu'au CHEMIN DE PROD : Carreau (Projectile magique) lancé via le
 * store, DR alloués à l'axe Dégâts par la VRAIE action de modale (`castAllocOvercast`), appliqué
 * par la VRAIE `castConfirm` (→ `applyCast`) — aucun budget/damage recalculé à la main pour
 * l'occasion. Le jet est FIGÉ AVANT l'allocation (`evaluateMissile` à 0 pas, exactement ce que fait
 * `resolveMagicMissile`/`castRoll` — l'allocation intervient après le jet) ; seule
 * l'ALLOCATION et l'APPLICATION passent par les actions réelles du store. Si le fil
 * `pc.overcast.damage` → `applyCast` se débranche, ce test rougit (les deux volets rendraient le
 * MÊME delta de Blessures).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { setRule, resetRule } from '../engine/policy';
import { testScene } from '../scenes/test-fixture';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { findSpell } from '../data';

const RULE = 'magic-vdm-incantation';

function setup() {
  const w = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
  w.spells = ['carreau'];
  useGame.setState({ party: [w] });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  useGame.getState().seedRng(7);
  const b = useGame.getState().battle!;
  const heroC = b.combatants.find((c) => c.label === 'W')!;
  const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
  // Positions/mitigation FIXÉES : même PA/BE des deux côtés du test — seul l'axe Dégâts varie.
  heroC.pos = { x: 10, y: 10 };
  enemy.pos = { x: 12, y: 10 };
  enemy.armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };
  enemy.characteristics.endurance = 20;
  enemy.wounds = { current: 40, max: 40 };
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(heroC.id), action: 'cast', selectedSpellId: 'carreau', acted: false } });
  useGame.getState().battleClickEntity(enemy.id);
  // Jet FIGÉ (DR 10 pour NI 4 → surplus 6, budget VDM = 6 pas) — exactement ce que produit
  // `resolveMagicMissile` au ROLL, AVANT que l'allocation de Surincantation n'existe (0 pas).
  const frozen: CastResult = { cast: true, roll: 20, target: 90, sl: 10, isCritical: false, isFumble: false, log: 'jet' };
  const res = evaluateMissile(heroC, enemy, findSpell('Carreau')!, frozen);
  useGame.setState((s) => ({ pendingCast: { ...s.pendingCast!, result: res } }));
  return { heroC, enemy };
}

describe('Câblage — axe Dégâts de la Surincantation VDM, Carreau, chemin de prod (store)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); setRule(RULE, true); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule(RULE); });

  it('0 DR alloué à l’axe Dégâts (nerf sec) vs 3 DR alloués (palier 3, `castAllocOvercast` + `castConfirm` réels) : +3 Blessures', () => {
    const { enemy } = setup();
    const before = enemy.wounds.current;
    useGame.getState().castConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === enemy.id)!.wounds.current;
    const baseline = before - after;
    expect(baseline).toBeGreaterThan(0);

    const { enemy: enemy2 } = setup();
    const before2 = enemy2.wounds.current;
    useGame.getState().castAllocOvercast('damage', 1);
    useGame.getState().castAllocOvercast('damage', 1);
    useGame.getState().castAllocOvercast('damage', 1);
    expect(useGame.getState().pendingCast!.overcast).toEqual({ range: 0, zone: 0, duration: 0, targets: 0, damage: 3 });
    useGame.getState().castConfirm();
    const after2 = useGame.getState().battle!.combatants.find((c) => c.id === enemy2.id)!.wounds.current;
    // missileOvercastDamageBonus('arcane', 3) === 3 (palier 3 du Tableau, VDM 02 l.207-215).
    expect(before2 - after2).toBe(baseline + 3);
  });

  it('sort NON-missile : l’axe Dégâts est refusé par `castAllocOvercast` (aucun axe hors Projectile)', () => {
    const w = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W', seed: 3 });
    w.spells = ['armure-aethyrique'];
    useGame.setState({ party: [w] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const heroC = b.combatants.find((c) => c.label === 'W')!;
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(heroC.id), action: 'cast', selectedSpellId: 'armure-aethyrique', acted: false } });
    useGame.getState().battleClickEntity(heroC.id);
    useGame.setState((s) => ({
      pendingCast: { ...s.pendingCast!, result: { cast: true, roll: 20, target: 90, sl: 10, isCritical: false, isFumble: false, log: 'jet' } },
    }));
    useGame.getState().castAllocOvercast('damage', 1);
    expect(useGame.getState().pendingCast!.overcast).toBeUndefined();
  });

  it('option OFF : Carreau ne propose pas d’axe Dégâts (`castAllocOvercast` refuse le pas)', () => {
    resetRule(RULE); // option OFF pour ce cas
    const { enemy } = setup();
    useGame.getState().castAllocOvercast('damage', 1);
    expect(useGame.getState().pendingCast!.overcast).toBeUndefined();
    // Nettoyage : le jet reste applicable normalement (parité LDB).
    const before = enemy.wounds.current;
    useGame.getState().castConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === enemy.id)!.wounds.current;
    expect(before - after).toBeGreaterThan(0);
  });
});
