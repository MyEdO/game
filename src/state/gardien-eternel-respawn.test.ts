import { describe, it, expect, beforeEach } from 'vitest';
import { notifySlain } from './combatFlow';
import { fireScheduledEffects } from './combatEffects';
import { seedBattleRng } from './battleRng';
import { MINUTES_PER_DAY } from '../engine/clock';
import type { Combatant } from '../engine/types';
import type { Scene } from './scene';
import { spawnEnemy } from './spawn';
import { mergeCreatureProfile } from './campaignData';
import { findCreatureById } from '../data';

/**
 * Trait Gardien éternel (Prédateur sanglant — Bestiaire de Middenheim, #19) : « si l'élémentaire incarné
 * qui garde la Source de Ghur est tué, il se reconstitue au bout de d10 jours, à moins que son pourfendeur
 * ne prenne les précautions appropriées… ». Câblé 100% en DONNÉE via l'op IMPURE `scheduleRespawn` portée
 * par un effet `onSlain` (MIROIR de Charnier/`summon`) : à la mort, `notifySlain` la moissonne
 * (`resolveTriggerImpureOps`) et PROGRAMME une entrée dans `scheduledEffects` (file horloge, Lot 0) à
 * `gameTime + d10 jours` ; l'échéance, franchie par `advanceTime`/`fireScheduledEffects`, RÉ-INVOQUE la
 * créature (`applySummon`) près de sa position de mort. Les « précautions » = le `cancelFlag` (un Effet de
 * scène/MJ le pose → l'entrée est consommée sans reconstitution).
 */
const GUARD_CREATURE = 'predateur-sanglant';
const CANCEL_FLAG = 'ghur-source-securisee';

const guardian = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'gardien', name: 'Prédateur sanglant', kind: 'enemy', creatureId: GUARD_CREATURE, porteurDeFiche: { ref: GUARD_CREATURE },
  characteristics: { 'capacite-de-combat': 56, 'capacite-de-tir': 0, force: 75, endurance: 62, initiative: 45, agilite: 49, dexterite: 15, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
  wounds: { current: 0, max: 104, base: 104 }, advantage: 0, conditions: [], skills: [], talents: [],
  traits: [{ id: 'gardien-eternel' }], weapons: [], armour: { corps: 0 }, pos: { x: 6, y: 6 }, dead: true,
  ...over,
}) as unknown as Combatant;

const scene = (): Scene => ({ id: 's', name: 's', dimensions: { w: 16, h: 16 }, ambiance: 'exterieur', layers: [{ z: 0, tiles: new Array(16 * 16).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene);
const battle = (cs: Combatant[]): any => ({ combatants: cs, order: cs.map((c) => c.id), baseOrder: cs.map((c) => c.id), turn: 0, round: 1, log: [], zones: [], over: false });

function harness(over: Record<string, unknown> = {}) {
  let s: any = { battle: undefined, scene: scene(), flags: {}, scheduledEffects: [], gameTime: 0, journal: [], log: (l: string) => { s.journal.push(l); }, ...over };
  return { get: () => s, set: (p: any) => { s = { ...s, ...(typeof p === 'function' ? p(s) : p) }; }, state: () => s };
}

/** Tue le Gardien (en combat) et renvoie le harnais + l'échéance de reconstitution programmée. */
function slayAndSchedule(gameTime = 0) {
  const c = guardian();
  const h = harness({ battle: battle([c]), gameTime });
  notifySlain(h.get as never, h.set as never, c);
  const se = h.state().scheduledEffects;
  return { h, se, executeAt: se[0]?.executeAt as number };
}

describe('Trait Gardien éternel — reconstitution différée (op scheduleRespawn onSlain → file horloge)', () => {
  beforeEach(() => seedBattleRng(20260627));

  it('à la mort, PROGRAMME une reconstitution à gameTime + d10 jours (entrée scheduledEffects)', () => {
    const { se, executeAt } = slayAndSchedule(500);
    expect(se).toHaveLength(1);
    const days = (executeAt - 500) / MINUTES_PER_DAY;
    expect(Number.isInteger(days)).toBe(true); // un multiple exact de jours
    expect(days).toBeGreaterThanOrEqual(1);
    expect(days).toBeLessThanOrEqual(10); // d10
    expect(se[0].respawn?.summon.porteur).toEqual({ ref: GUARD_CREATURE }); // « self » → la fiche du défunt (son porteur)
    expect(se[0].cancelFlag).toBe(CANCEL_FLAG); // précautions désamorçables
  });

  it('sans le trait → aucune reconstitution programmée à la mort', () => {
    const c = guardian({ traits: [] as never });
    const h = harness({ battle: battle([c]) });
    notifySlain(h.get as never, h.set as never, c);
    expect(h.state().scheduledEffects).toHaveLength(0);
  });

  it('franchir l’échéance ré-invoque la créature (de retour en jeu), et vide la file', () => {
    const { h, executeAt } = slayAndSchedule();
    h.set({ gameTime: executeAt }); // l'horloge atteint l'échéance
    fireScheduledEffects(h.get as never, h.set as never);
    const respawned = h.state().battle.combatants.filter((x: Combatant) => x.summon && x.creatureId === GUARD_CREATURE);
    expect(respawned).toHaveLength(1);
    expect(respawned[0].id).not.toBe('gardien'); // une nouvelle incarnation, pas le cadavre
    expect(respawned[0].kind).toBe('enemy'); // même camp que le défunt → hostile au groupe
    expect(h.state().scheduledEffects).toHaveLength(0);
  });

  it('avant l’échéance, rien ne se reconstitue (l’entrée reste en file)', () => {
    const { h, executeAt } = slayAndSchedule();
    h.set({ gameTime: executeAt - 1 });
    fireScheduledEffects(h.get as never, h.set as never);
    expect(h.state().battle.combatants.filter((x: Combatant) => x.summon).length).toBe(0);
    expect(h.state().scheduledEffects).toHaveLength(1);
  });

  it('cancelFlag posé (précautions prises) → l’échéance ne reconstitue rien, entrée consommée', () => {
    const { h, executeAt } = slayAndSchedule();
    h.set({ flags: { [CANCEL_FLAG]: true }, gameTime: executeAt });
    fireScheduledEffects(h.get as never, h.set as never);
    expect(h.state().battle.combatants.filter((x: Combatant) => x.summon).length).toBe(0);
    expect(h.state().scheduledEffects).toHaveLength(0);
  });
});
describe("Gardien éternel — `ref:'self'` reconstitue la FICHE du défunt, quel qu'en soit le porteur (#1882, LDB 76 l.11)", () => {
  beforeEach(() => seedBattleRng(20260627));
  /** Tue un combattant SPAWNÉ par la couture réelle, franchit l'échéance, rend l'incarnation revenue. */
  const reconstitue = (defunt: Combatant): Combatant => {
    Object.assign(defunt, { pos: { x: 6, y: 6 }, dead: true, wounds: { ...defunt.wounds, current: 0 } });
    const h = harness({ battle: battle([defunt]) });
    notifySlain(h.get as never, h.set as never, defunt);
    const se = h.state().scheduledEffects;
    expect(se).toHaveLength(1);
    h.set({ gameTime: se[0].executeAt });
    fireScheduledEffects(h.get as never, h.set as never);
    const revenus = h.state().battle.combatants.filter((x: Combatant) => x.summon);
    expect(revenus).toHaveLength(1);
    return revenus[0];
  };

  it('un preset de PNJ nommé revient avec SA fiche : son libellé et sa CC surchargée, pas la base', () => {
    const preset = mergeCreatureProfile(findCreatureById(GUARD_CREATURE)!, { label: 'Gardien nommé', char: { 'capacite-de-combat': 99 } as never });
    const defunt = spawnEnemy({ presetCreature: preset }, 'gardien-nomme', { x: 6, y: 6 });
    expect(defunt.characteristics['capacite-de-combat']).toBe(99);
    const revenu = reconstitue(defunt);
    expect(revenu.label).toBe('Gardien nommé');
    expect(revenu.characteristics['capacite-de-combat']).toBe(99);
  });

  it('un statbloc d’auteur portant le Trait revient avec SON statbloc', () => {
    const defunt = spawnEnemy({ statblock: { type: 'statblock', label: 'Gardien de statbloc', char: { 'capacite-de-combat': 42, B: 20 }, traits: [{ id: 'gardien-eternel' }] } }, 'gardien-sb', { x: 6, y: 6 });
    const revenu = reconstitue(defunt);
    expect(revenu.label).toBe('Gardien de statbloc');
    expect(revenu.characteristics['capacite-de-combat']).toBe(42);
  });
});
