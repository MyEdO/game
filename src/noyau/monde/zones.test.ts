/**
 * Zones persistantes (Jalon 2.6 L11) : géométrie, TTL, traversée (Mur de feu, LDB 47),
 * occupation par Round (Grands feux d'U'Zhul, LDB 47), mitigation des Dégâts (BE + PA corps).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from '../../engine/types';
import type { RNG } from '../../engine/dice';
import { wallTiles, discTiles, decayZones, crossZones, zonesRoundTick, losBlockingTiles, sceneZonesToBattle, zoneCovers, barrierTilesFor, type BattleZone } from './zones';
import type { SceneEffectZone } from './scene';
import { findSpellById } from '../../data';

const rng: RNG = { int: () => 5 } as RNG;

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'Cobaye', kind: 'enemy', size: 'moyenne', advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 },
    conditions: [], skills: [], talents: [], traits: [], groups: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, wounds: { current: 12, max: 12 }, pos: { x: 5, y: 5 },
    ...over,
  } as unknown as Combatant;
}

describe('wallTiles — Mur de feu perpendiculaire à l’axe lanceur→centre', () => {
  it('axe horizontal → mur vertical centré, longueur exacte', () => {
    const t = wallTiles({ x: 0, y: 5 }, { x: 4, y: 5 }, 3);
    expect(t).toContainEqual({ x: 4, y: 4 });
    expect(t).toContainEqual({ x: 4, y: 5 });
    expect(t).toContainEqual({ x: 4, y: 6 });
    expect(t).toHaveLength(3);
  });
  it('axe diagonal → perpendiculaire diagonale', () => {
    const t = wallTiles({ x: 0, y: 0 }, { x: 3, y: 3 }, 3);
    expect(t).toContainEqual({ x: 3, y: 3 });
    expect(t).toHaveLength(3);
  });
});

describe('decayZones — TTL en Rounds', () => {
  it('décrémente et dissipe à 0', () => {
    const { zones, log } = decayZones([
      { label: 'Fumée', tiles: [{ x: 1, y: 1 }], rounds: 2 },
      { label: 'Mur de feu', tiles: [{ x: 2, y: 2 }], rounds: 1 },
    ]);
    expect(zones).toHaveLength(1);
    expect(zones[0].rounds).toBe(1);
    expect(log.join(' ')).toMatch(/Mur de feu se dissipe/);
  });
});

describe('crossZones — « Quiconque traverse le mur de feu » (LDB 47)', () => {
  const wall: BattleZone = {
    label: 'Mur de feu', tiles: [{ x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 }], rounds: 3,
    onCross: [{ op: 'wounds', amount: { bonusOf: 'force-mentale' }, ignoreTB: false, ignoreAP: false }, { op: 'condition', id: 'en-flammes' }],
    casterId: 'w',
  };
  const caster = mk({ id: 'w', label: 'Pyromancien', characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 30 } as Combatant['characteristics'] });
  it('chemin qui traverse : BFM Dégâts (mitigés BE) + En flammes, UNE fois par zone', () => {
    const m = mk({ id: 'm', label: 'Brigand' }); // E 30 → BE 3 ; FM lanceur 40 → 4 Dégâts → 1 PB
    const lines = crossZones([wall], m, [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }], () => caster, rng);
    expect(m.wounds.current).toBe(11);
    expect(m.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
    expect(lines.join(' ')).toMatch(/traverse Mur de feu/);
  });
  // LDB 48 l.286 ; #1595 c.6240485441 Q2.
  it('BE + PA ≥ BFM : la traversée ne coûte aucune Blessure, En flammes reste', () => {
    const ops = findSpellById('mur-de-feu')!.effects as unknown as { steps: { effect: { ops: { onCross: BattleZone['onCross'] }[] } }[] };
    const murDuSort: BattleZone = { ...wall, onCross: ops.steps[0].effect.ops[0].onCross };
    const m = mk({ id: 'm3', label: 'Blindé', armour: { tete: 1, brasG: 1, brasD: 1, corps: 1, jambeG: 1, jambeD: 1 } as Combatant['armour'] }); // BE 3 + PA 1 = BFM 4
    crossZones([murDuSort], m, [{ x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 }], () => caster, rng);
    expect(m.wounds.current).toBe(12);
    expect(m.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
  });
  it('chemin qui contourne : rien', () => {
    const m = mk({ id: 'm2' });
    const lines = crossZones([wall], m, [{ x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }], () => caster, rng);
    expect(m.wounds.current).toBe(12);
    expect(lines).toHaveLength(0);
  });
});

describe('zonesRoundTick — « Quiconque se trouve dans la ZdE au début d’un Round » (Grands feux)', () => {
  const fire: BattleZone = {
    label: "Grands feux d'U'Zhul", tiles: discTiles({ x: 5, y: 5 }, 2), rounds: 4,
    perRound: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 6 } }, ignoreTB: false, ignoreAP: true }, { op: 'condition', id: 'en-flammes' }],
  };
  it('occupant : 1d10+6 Dégâts ignorant les PA (mitigés BE) + 1 En flammes', () => {
    const inZone = mk({ id: 'a', pos: { x: 6, y: 5 }, armour: { tete: 9, brasG: 9, brasD: 9, corps: 9, jambeG: 9, jambeD: 9 } as Combatant['armour'] });
    const outZone = mk({ id: 'b', pos: { x: 20, y: 20 } });
    const ticks = zonesRoundTick([fire], [inZone, outZone], rng);
    // d10 scripté = 5 → 11 Dégâts − BE 3 = 8 (PA 9 ignorées)
    expect(inZone.wounds.current).toBe(4);
    expect(inZone.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
    expect(outZone.wounds.current).toBe(12);
    expect(ticks.map((t) => t.line).join(' ')).toMatch(/PA ignorés/);
    expect(ticks.every((t) => t.combatant.id === 'a')).toBe(true); // chaque ligne porte son combattant
  });
});

describe('GameOp[] dans une zone — wounds mitigé + condition unlessCondition (traversée & perRound)', () => {
  // Zone authorée en vocabulaire UNIQUE : op:'wounds' mitigé (BE+PA déduits) + op:'condition' entretenu.
  const ward: BattleZone = {
    label: 'Brasier corrosif', tiles: discTiles({ x: 5, y: 5 }, 1), rounds: 3,
    onCross: [{ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: false }, { op: 'condition', id: 'brise', unlessCondition: 'brise' }],
    perRound: [{ op: 'wounds', amount: 8, ignoreTB: false, ignoreAP: false }, { op: 'condition', id: 'brise', unlessCondition: 'brise' }],
  };
  it('crossZones : 8 − BE 3 − PA 2 = 3 Blessures + Brisé entretenu sans empiler', () => {
    const m = mk({ id: 'm', pos: { x: 4, y: 5 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    crossZones([ward], m, [{ x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 }], () => undefined, rng);
    expect(m.wounds.current).toBe(9); // 12 − 3
    expect(m.conditions.filter((c) => c.id === 'brise').reduce((a, c) => a + (c.value ?? 1), 0)).toBe(1);
    crossZones([ward], m, [{ x: 4, y: 5 }, { x: 5, y: 5 }], () => undefined, rng);
    expect(m.conditions.filter((c) => c.id === 'brise').reduce((a, c) => a + (c.value ?? 1), 0)).toBe(1); // unlessCondition : pas empilé
  });
  it('zonesRoundTick : même mitigation + Brisé entretenu pour l’occupant', () => {
    const c = mk({ id: 'a', pos: { x: 5, y: 5 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as Combatant['armour'] });
    zonesRoundTick([ward], [c], rng);
    expect(c.wounds.current).toBe(9);
    zonesRoundTick([ward], [c], rng);
    expect(c.wounds.current).toBe(6); // 2e tick : encore 3 Blessures
    expect(c.conditions.filter((x) => x.id === 'brise').reduce((a, x) => a + (x.value ?? 1), 0)).toBe(1); // entretenu
  });
});

describe('sceneZonesToBattle — les zones DESCRIPTIVES (#782) ne polluent jamais le combat', () => {
  it('zone descriptive {id,label,area} sans champ mécanique : absente de battle.zones', () => {
    const room: SceneEffectZone = { id: 'salle', label: 'Salle du trône', area: { kind: 'rect', x: 0, y: 0, w: 3, h: 3 } };
    expect(sceneZonesToBattle([room])).toHaveLength(0);
  });
  it('zone avec onCross : toujours convertie (non-régression)', () => {
    const trap: SceneEffectZone = {
      id: 'piege', label: 'Pic', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 },
      onCross: [{ op: 'wounds', amount: 3, ignoreTB: false, ignoreAP: false }],
    };
    expect(sceneZonesToBattle([trap])).toHaveLength(1);
  });
  it('zone avec blocksLoS seul : toujours convertie (non-régression)', () => {
    const smoke: SceneEffectZone = { id: 'fumee', label: 'Fumée', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, blocksLoS: true };
    expect(sceneZonesToBattle([smoke])).toHaveLength(1);
  });
  it('zone avec barrier seul : toujours convertie (non-régression)', () => {
    const ward: SceneEffectZone = { id: 'ward', label: 'Barrière', area: { kind: 'rect', x: 0, y: 0, w: 1, h: 1 }, barrier: {} };
    expect(sceneZonesToBattle([ward])).toHaveLength(1);
  });
});

describe('z-blind — zones authorées d’étage (#799)', () => {
  const trapUpstairs: SceneEffectZone = {
    id: 'piege-etage', label: 'Trappe', area: { kind: 'rect', x: 4, y: 4, w: 1, h: 1 }, z: 1,
    onCross: [{ op: 'wounds', amount: 5, ignoreTB: false, ignoreAP: false }],
    perRound: [{ op: 'condition', id: 'en-flammes' }],
    barrier: {},
  };
  it('sceneZonesToBattle propage z.z sur chaque case', () => {
    const [bz] = sceneZonesToBattle([trapUpstairs]);
    expect(bz.tiles).toEqual([{ x: 4, y: 4, z: 1 }]);
  });
  it('crossZones : inerte pour un mover au rez (z0), actif pour le même (x,y) à l’étage (z1)', () => {
    const [bz] = sceneZonesToBattle([trapUpstairs]);
    const ground = mk({ id: 'g', pos: { x: 4, y: 4 } });
    crossZones([bz], ground, [{ x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }], () => undefined, rng);
    expect(ground.wounds.current).toBe(12); // z0 non touché par une zone z1

    const upstairs = mk({ id: 'u', pos: { x: 4, y: 4, z: 1 } });
    crossZones([bz], upstairs, [{ x: 3, y: 4, z: 1 }, { x: 4, y: 4, z: 1 }, { x: 5, y: 4, z: 1 }], () => undefined, rng);
    expect(upstairs.wounds.current).toBe(10); // 5 − BE 3 (E 30) = 2 Blessures, même (x,y) mais z1
  });
  it('zonesRoundTick : même partition z0/z1', () => {
    const [bz] = sceneZonesToBattle([trapUpstairs]);
    const ground = mk({ id: 'g', pos: { x: 4, y: 4 } });
    const upstairs = mk({ id: 'u', pos: { x: 4, y: 4, z: 1 } });
    const ticks = zonesRoundTick([bz], [ground, upstairs], rng);
    expect(ground.conditions.some((c) => c.id === 'en-flammes')).toBe(false);
    expect(upstairs.conditions.some((c) => c.id === 'en-flammes')).toBe(true);
    expect(ticks.every((t) => t.combatant.id === 'u')).toBe(true);
  });
  it('barrierTilesFor : la case authorée porte z1 (consommée z-aware par tileKey en aval, combatGeometry.ts)', () => {
    const [bz] = sceneZonesToBattle([trapUpstairs]);
    const tiles = barrierTilesFor([bz], mk({ id: 'm' }));
    expect(tiles).toEqual([{ x: 4, y: 4, z: 1 }]);
  });
  it('zoneCovers : rétro-compat z absent des deux côtés = z0 (aucune régression du legacy sans z)', () => {
    const wall: BattleZone = { label: 'Mur de feu', tiles: [{ x: 4, y: 4 }], rounds: 3 };
    expect(zoneCovers(wall, { x: 4, y: 4 })).toBe(true);
    expect(zoneCovers(wall, { x: 4, y: 4, z: 1 })).toBe(false);
  });
});

describe('losBlockingTiles — seules les zones opaques bloquent la vue', () => {
  it('fumée opaque vs feu transparent', () => {
    const tiles = losBlockingTiles([
      { label: 'Fumée', tiles: [{ x: 1, y: 1 }], rounds: 2, blocksLoS: true },
      { label: 'Mur de feu', tiles: [{ x: 2, y: 2 }], rounds: 2 },
    ]);
    expect(tiles).toEqual([{ x: 1, y: 1 }]);
  });
});
