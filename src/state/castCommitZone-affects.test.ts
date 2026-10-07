/**
 * `castCommitZone` (src/state/combatFlow.ts:3502) — `affects` (SpellTarget kind:'area',
 * src/engine/spellRange.ts:31) : la Zone d'Effet déclare EN DONNÉE, par une `Condition` du
 * vocabulaire existant (src/engine/flowCore.ts:116), quels candidats elle retient.
 *  - champ absent = LDB 47 l.28 ;
 *  - champ présent = réserve du texte du Sort (VDM 11 l.418).
 * Cumul avec `excludesCaster` : les deux filtres s'appliquent.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castCommitZone } from './combatFlow';
import { pregen, PREGEN } from '../data/pregens';
import { findSpellById, spells } from '../data/index';
import { setDataset } from '../data/overrides';
import type { Combatant } from '../engine/types';
import type { SpellTarget } from '../engine/spellRange';
import type { CastResult } from '../engine/magic';

const SPELL = 'regiment-monstrueux-de-merciw';

const okCast = (): CastResult => ({ cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' });

function caster(x: number, y: number, spellId: string, id = 'caster'): Combatant {
  const h = pregen(PREGEN.sorcier);
  h.id = id; h.label = id; h.pos = { x, y, z: 0 };
  h.wounds = { ...h.wounds, max: 99, current: 99 };
  const sk = h.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 40);
  else h.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 40 } as never);
  h.spells = [spellId, ...(h.spells ?? [])];
  return h;
}

const mk = (id: string, kind: 'hero' | 'enemy', x: number, y: number, traits: { id: string }[] = []): Combatant =>
  ({ id, label: id, name: id, kind, pos: { x, y, z: 0 }, wounds: { current: 40, max: 40 }, advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, conditions: [], traits, talents: [], skills: [], weapons: [] }) as unknown as Combatant;
// Ennemi hors ZdE, présent pour que le combat reste actif (une Victoire immédiate purgerait les
// `activeEffects` de fin de combat, faussant la mesure).
const distantFoe = (): Combatant => mk('FOE', 'enemy', 40, 40);

function setupBattle(c: Combatant, others: Combatant[], spellId: string) {
  const battle = {
    combatants: [c, ...others], order: [c.id, ...others.map((o) => o.id)], baseOrder: [c.id, ...others.map((o) => o.id)],
    turn: 0, round: 1, action: 'cast', selectedSpellId: spellId, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  } as never;
  useGame.setState({ battle, scene: undefined, party: [] });
  useGame.setState({
    pendingCast: {
      casterId: c.id, targetId: c.id, spellId, missile: false, focused: false,
      result: okCast() as never,
      zone: { center: null, radius: 3, r0m: 3, placing: true },
    } as never,
  });
}

const combatant = (id: string) => useGame.getState().battle!.combatants.find((cc) => cc.id === id)!;
const boosted = (id: string) => combatant(id).activeEffects?.some((e) => e.char === 'force') === true;

/** Pose la Cible du Sort d'épreuve par le seam des datasets (restaurée en `afterEach`). */
function setTarget(t: SpellTarget): void {
  setDataset('spells', spells.map((s) => (s.id === SPELL ? { ...s, target: t } : s)));
}
const AREA: Extract<SpellTarget, { kind: 'area' }> = { kind: 'area', span: 'diameter', meters: { bonusOf: 'force-mentale' } };

function cast(): void {
  castCommitZone(useGame.getState, useGame.setState, { x: 5, y: 5 });
}

describe("castCommitZone — `affects` : qui la Zone d'Effet retient", () => {
  const original = [...spells];

  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null, pendingLogQueue: [] });
    useGame.getState().seedRng(17);
  });
  afterEach(() => {
    setDataset('spells', original);
    vi.clearAllTimers(); vi.useRealTimers();
  });

  it("affects relation 'ally' : l'allié dans la zone reçoit l'effet, l'ennemi dans la zone ne reçoit rien", () => {
    setTarget({ ...AREA, affects: { kind: 'relation', who: 'target', is: 'ally' } });
    const c = caster(5, 5, SPELL);
    setupBattle(c, [mk('ALLIE', 'hero', 6, 5), mk('ENNEMI', 'enemy', 4, 5), distantFoe()], SPELL);
    cast();
    expect(boosted('ALLIE')).toBe(true);
    expect(boosted('ENNEMI')).toBe(false);
  });

  it('sans affects : allié ET ennemi de la zone reçoivent l\'effet (LDB 47 l.28)', () => {
    setTarget({ ...AREA });
    const c = caster(5, 5, SPELL);
    setupBattle(c, [mk('ALLIE', 'hero', 6, 5), mk('ENNEMI', 'enemy', 4, 5), distantFoe()], SPELL);
    cast();
    expect(boosted('ALLIE')).toBe(true);
    expect(boosted('ENNEMI')).toBe(true);
  });

  it("affects camp 'party' + excludesCaster : l'allié reçoit, le lanceur non (les deux filtres se cumulent)", () => {
    // `party` retient TOUT héros — le lanceur compris ; seul `excludesCaster` l'écarte.
    setTarget({ ...AREA, excludesCaster: true, affects: { kind: 'relation', who: 'target', is: 'party' } });
    const c = caster(5, 5, SPELL);
    setupBattle(c, [mk('ALLIE', 'hero', 6, 5), mk('ENNEMI', 'enemy', 4, 5), distantFoe()], SPELL);
    cast();
    expect(boosted('ALLIE')).toBe(true);
    expect(boosted('caster')).toBe(false);
    expect(boosted('ENNEMI')).toBe(false);
  });

  it("affects has trait : seul le porteur du trait reçoit l'effet (forme non-camp — généralité du vocabulaire Condition)", () => {
    setTarget({ ...AREA, affects: { kind: 'has', who: 'target', what: 'trait', value: 'amphibie' } });
    const c = caster(5, 5, SPELL);
    setupBattle(c, [mk('PORTEUR', 'hero', 6, 5, [{ id: 'amphibie' }]), mk('SANS-TRAIT', 'hero', 4, 5), distantFoe()], SPELL);
    cast();
    expect(boosted('PORTEUR')).toBe(true);
    expect(boosted('SANS-TRAIT')).toBe(false);
    expect(boosted('caster')).toBe(false);
  });

  // CÂBLAGE sur la DONNÉE RÉELLE (aucun `setTarget` ici) : `any(self, ally)` est la seule forme du
  // catalogue qui retient le LANCEUR — VDM 11 l.351.
  it('les-lunes-du-chasseur (donnée RÉELLE) : lanceur ET allié boostés, ennemi non', () => {
    expect(JSON.stringify(findSpellById('les-lunes-du-chasseur')!.target)).toContain('"is":"self"');
    const c = caster(5, 5, 'les-lunes-du-chasseur');
    setupBattle(c, [mk('ALLIE', 'hero', 6, 5), mk('ENNEMI', 'enemy', 4, 5), distantFoe()], 'les-lunes-du-chasseur');
    cast();
    expect(boosted('caster')).toBe(true);
    expect(boosted('ALLIE')).toBe(true);
    expect(boosted('ENNEMI')).toBe(false);
  });
});
