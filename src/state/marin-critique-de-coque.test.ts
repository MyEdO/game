import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Combatant, Weapon } from '../engine/types';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { toucheAuJetPose } from '../engine/combat';
import { useGame } from './store';
import { spawnEnemy } from './spawn';
import { seedBattleRng } from './battleRng';
import { applyHullCriticalToTarget } from './combatFlow';
import type { CoupDeTouche } from './pendings';
import { emptyScene } from './scene';
import { createHero } from '../engine/character';
import { findSpell } from '../data';
import { hasCondition, COND } from '../engine/conditions';
import { draineCascade } from './cascadeTestKit';

/**
 * Critique de coque à l'Équipage : le marin encaisse LE coup qui porte le Critique, calculé contre LUI
 * (MDG 13 l.584 ; LDB 85 l.360-361 ; LDB 14 l.183 ; #1595 c.6228605059 (b), C12).
 */
const CARAC = { 'capacite-de-combat': 31, 'capacite-de-tir': 31, force: 51, endurance: 31, initiative: 31, agilite: 36, dexterite: 36, intelligence: 31, 'force-mentale': 31, sociabilite: 36 };
const perso = (id: string, over: Partial<Combatant> = {}): Combatant => ({
  id, name: id, label: id, kind: 'npc', characteristics: { ...CARAC }, pos: { x: 5, y: 5 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [], liveTraits: [], weapons: [], items: [],
  armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, wounds: { current: 13, max: 13, base: 13 }, advantage: 0, ...over,
}) as unknown as Combatant;
const hache: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] } as unknown as Weapon;
/** CC réussi, DR 2 ; 43 sans double, 44 en double (Coup Critique, LDB 13). */
const jet = (roll: number) => ({ label: 'CC', base: 60, modifier: 0, target: 60, roll, success: true, sl: 2 });

const navire = (marin: Combatant): Combatant => {
  const c = spawnEnemy({ ref: 'cogue' }, 'nav', { x: 9, y: 5 });
  c.crewIds = [marin.id];
  return c;
};
const poser = (combatants: Combatant[]): void => {
  useGame.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: combatants.filter((c) => c.kind === 'hero'), scene: emptyScene(20, 20), travelPlan: null, facing: {}, vessel: null,
    journal: [], pendingCascade: null, suspendedCascades: [], pendingFateSave: null,
  } as never);
};
/** Graines du dé de sévérité (battleRng) : 1 → Blessure critique non létale ; 37 → létale pour le héros. */
const SEED_NON_LETAL = 1;
const SEED_LETAL = 37;
const enJeu = (id: string): Combatant => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

/** Le Critique de coque à l'Équipage (d100 de Localisation imposé à 5, MDG 13), porté par `coup`. */
const critiqueDEquipage = (seed: number, attaquant: Combatant, nav: Combatant, marin: Combatant, coup: CoupDeTouche): string[] => {
  poser([attaquant, nav, marin]);
  seedBattleRng(seed);
  const log: string[] = [];
  applyHullCriticalToTarget(nav, 'voile', log, useGame.setState, {
    get: useGame.getState, forcedLocRoll: 5, suppressReveal: true,
    ctx: { attackerId: attaquant.id, attackerKind: attaquant.kind, weapon: 'Hache', coup },
  });
  return log;
};
const enMelee = (attaquant: Combatant, nav: Combatant, roll: number, dmgProxy?: { sb: number; size: Combatant['size'] }): CoupDeTouche =>
  ({ mode: 'melee', weapon: hache, res: toucheAuJetPose(attaquant, nav, hache, jet(roll), 2, false, dmgProxy) });
/** Ce que le même jet inflige au marin, calculé contre lui hors flux. */
const contreLeMarin = (attaquant: Combatant, marin: Combatant, roll: number, dmgProxy?: { sb: number; size: Combatant['size'] }): number =>
  toucheAuJetPose(attaquant, structuredClone(marin), hache, jet(roll), 2, false, dmgProxy).woundsLost ?? 0;

describe("Critique de coque à l'Équipage : le marin encaisse le coup, calculé contre lui", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('mêlée sur une coque : les Blessures du marin ne dépendent ni de la Robustesse ni de la Taille de la coque', () => {
    const att = perso('att');
    const marin = perso('marin', { important: true });
    const nav = navire(marin);
    const coup = enMelee(att, nav, 43);
    const surLaCoque = coup.mode === 'melee' ? coup.res.woundsLost ?? 0 : -1;
    const attendu = contreLeMarin(att, marin, 43);
    expect(attendu).toBe(8);
    expect(surLaCoque).not.toBe(attendu);
    const avantCoque = nav.criticalWounds ?? 0;
    const log = critiqueDEquipage(1, att, nav, marin, coup);
    expect(enJeu('marin').wounds.current).toBe(13 - attendu);
    expect(enJeu('marin').criticalWounds ?? 0).toBe(0);
    expect(enJeu('nav').criticalWounds ?? 0, "la coque ne prend pas le Critique d'Équipage").toBe(avantCoque);
    expect(log.join('\n')).toContain('marin subit 8 Blessure(s).');
    expect(log.join('\n')).not.toMatch(/perd 0 Blessure/);
  });

  it('attaquant plus grand que le marin : le multiplicateur de Taille joue contre le marin (LDB 85 l.360-361)', () => {
    const ogre = perso('ogre', { size: 'enorme' as Combatant['size'] });
    const marin = perso('marin', { important: true, wounds: { current: 40, max: 40, base: 40 } as Combatant['wounds'] });
    const nav = navire(marin);
    const attendu = contreLeMarin(ogre, marin, 43);
    expect(attendu).toBeGreaterThan(contreLeMarin(perso('humain'), marin, 43));
    critiqueDEquipage(1, ogre, nav, marin, enMelee(ogre, nav, 43));
    expect(enJeu('marin').wounds.current).toBe(40 - attendu);
  });

  it('Charge montée : la Force et la Taille de la monture portent jusqu’au marin (LDB 14 l.183)', () => {
    const att = perso('att');
    const marin = perso('marin', { important: true, wounds: { current: 40, max: 40, base: 40 } as Combatant['wounds'] });
    const nav = navire(marin);
    const monture = { sb: 8, size: 'grande' as Combatant['size'] };
    const attendu = contreLeMarin(att, marin, 43, monture);
    expect(attendu).toBeGreaterThan(contreLeMarin(att, marin, 43));
    critiqueDEquipage(1, att, nav, marin, enMelee(att, nav, 43, monture));
    expect(enJeu('marin').wounds.current).toBe(40 - attendu);
  });

  it('Projectile magique : les Dégâts se recalculent contre le marin', () => {
    const mage = perso('mage');
    const marin = perso('marin', { important: true, wounds: { current: 40, max: 40, base: 40 } as Combatant['wounds'], armour: { tete: 2, brasG: 2, brasD: 2, corps: 2, jambeG: 2, jambeD: 2 } });
    const nav = navire(marin);
    const sort = findSpell('Carreau')!;
    const incantation: CastResult = { cast: true, roll: 21, target: 90, sl: 4, isCritical: false, isFumble: false, log: 'jet' };
    const mres = evaluateMissile(mage, nav, sort, incantation);
    const attendu = evaluateMissile(mage, structuredClone(marin), sort, mres).woundsLost ?? 0;
    expect(attendu).toBeGreaterThan(0);
    expect(mres.woundsLost ?? 0).not.toBe(attendu);
    const coup: CoupDeTouche = { mode: 'projectile', touche: { casterId: mage.id, de: mage.id, targetId: nav.id, spell: sort, mres, zoneTalentMod: 0, critWound: false, overcastDamageSteps: 0, overcastDurationSteps: 0 } };
    critiqueDEquipage(1, mage, nav, marin, coup);
    expect(enJeu('marin').wounds.current).toBe(40 - attendu);
  });

  it('marin mis à 0, Critique non létal : À Terre, et ses compteurs de Blessure critique (LDB 18 l.15, l.17)', () => {
    const ogre = perso('ogre', { size: 'enorme' as Combatant['size'] });
    const marin = perso('marin', { important: true });
    const nav = navire(marin);
    const avantCoque = nav.criticalWounds ?? 0;
    critiqueDEquipage(SEED_NON_LETAL, ogre, nav, marin, enMelee(ogre, nav, 43));
    const m = enJeu('marin');
    expect(m.wounds.current).toBe(0);
    expect(m.dead ?? false).toBe(false);
    expect(hasCondition(m, COND.aTerre)).toBe(true);
    expect(m.criticalWounds ?? 0).toBeGreaterThan(0);
    expect(m.critEntriesSuffered?.length ?? 0).toBeGreaterThan(0);
    expect(m.tookCriticalThisFight).toBe(true);
    expect(enJeu('nav').criticalWounds ?? 0).toBe(avantCoque);
  });

  it('héros marin tué par le Critique : le Destin est proposé (LDB 17 l.29)', () => {
    const ogre = perso('ogre', { size: 'enorme' as Combatant['size'] });
    const marin = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Marin', seed: 1 });
    marin.id = 'marin';
    marin.pos = { x: 6, y: 5 };
    marin.fate = 2;
    const nav = navire(marin);
    critiqueDEquipage(SEED_LETAL, ogre, nav, marin, enMelee(ogre, nav, 44));
    expect(draineCascade(useGame.getState, 200, undefined, () => 'subir'), 'héros tenu : sa fenêtre s’ouvre (LDB 63 l.30)').toEqual(['deviation']);
    expect(useGame.getState().pendingFateSave?.heroId).toBe('marin');
    expect(enJeu('marin').criticalWounds ?? 0).toBeGreaterThan(0);
  });
});
