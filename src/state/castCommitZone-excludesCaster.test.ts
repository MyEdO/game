/**
 * `castCommitZone` (src/noyau/combatFlow.ts:3499) — le lanceur au sein de sa propre Zone d'Effet
 * (SpellTarget kind:'area', src/engine/spellRange.ts:34) :
 *  - PAR DÉFAUT il est touché comme tout autre combattant (LDB 47 l.28, « Les Sorts marqués ZdE
 *    affectent tous les individus à l'intérieur de ce diamètre ») ;
 *  - `excludesCaster: true` l'exclut de la ZdE (Vents de Magie 11 l.418 « Ce Sort ne vous affecte pas »,
 *    Vents de Magie 07 l.422 « hormis vous »).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castCommitZone } from '../noyau/combatFlow';
import { pregen, PREGEN } from '../data/pregens';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

const okCast = (): CastResult => ({ cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' });

function caster(x: number, y: number, spellId: string, id = 'caster'): Combatant {
  const h = pregen(PREGEN.sorcier);
  h.id = id; h.label = id; h.pos = { x, y, z: 0 };
  h.wounds = blessuresDeBase(99, 99, h);
  const sk = h.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 40);
  else h.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 40 } as never);
  h.spells = [spellId, ...(h.spells ?? [])];
  return h;
}

const mk = (id: string, kind: 'hero' | 'enemy', x: number, y: number, wounds = 40): Combatant =>
  (blessuresSurLeProfil({ id, label: id, name: id, kind, pos: { x, y, z: 0 }, wounds: blessuresDeBase(wounds), advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, conditions: [], traits: [], talents: [], skills: [], weapons: [] })) as unknown as Combatant;
const ally = (id: string, x: number, y: number, wounds = 40): Combatant => mk(id, 'hero', x, y, wounds);
// Ennemi hors ZdE, présent pour que le combat reste actif (une Victoire immédiate purgerait les
// `activeEffects` de fin de combat, faussant la mesure).
const distantFoe = (): Combatant => mk('FOE', 'enemy', 40, 40, 40);

function setupBattle(c: Combatant, others: Combatant[], spellId: string, missile: boolean) {
  const battle = {
    combatants: [c, ...others], order: [c.id, ...others.map((o) => o.id)], baseOrder: [c.id, ...others.map((o) => o.id)],
    turn: 0, round: 1, action: 'cast', selectedSpellId: spellId, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  } as never;
  useGame.setState({ battle, scene: undefined, party: [] });
  useGame.setState({
    pendingCast: {
      casterId: c.id, targetId: c.id, spellId, missile, focused: false,
      result: okCast() as never,
      zone: { center: null, radius: 3, r0m: 3, placing: true },
    } as never,
  });
}

const combatant = (id: string) => useGame.getState().battle!.combatants.find((cc) => cc.id === id)!;

describe("castCommitZone — le lanceur dans sa propre Zone d'Effet", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null, pendingLogQueue: [] });
    useGame.getState().seedRng(17);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("sans excludesCaster : une ZdE de dégâts touche le lanceur ET un allié à son côté (LDB 47 l.28)", () => {
    const c = caster(5, 5, 'explosion');
    const a = ally('ALLIE', 6, 5);
    setupBattle(c, [a, distantFoe()], 'explosion', true);
    castCommitZone(useGame.getState, useGame.setState, { x: 5, y: 5 });
    expect(combatant('caster').wounds.current).toBeLessThan(99);
    expect(combatant('ALLIE').wounds.current).toBeLessThan(40);
  });

  it('avec excludesCaster : le lanceur au CENTRE de sa propre ZdE est épargné, un allié à son côté ne l\'est pas', () => {
    const c = caster(5, 5, 'regiment-monstrueux-de-merciw');
    const a = ally('ALLIE', 6, 5);
    setupBattle(c, [a, distantFoe()], 'regiment-monstrueux-de-merciw', false);
    castCommitZone(useGame.getState, useGame.setState, { x: 5, y: 5 });
    expect(combatant('caster').activeEffects?.some((e) => e.char === 'force')).not.toBe(true);
    expect(combatant('ALLIE').activeEffects?.some((e) => e.char === 'force')).toBe(true);
  });
});
