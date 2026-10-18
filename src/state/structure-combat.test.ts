import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult, applyStructureCriticalToTarget, applyCriticalToTarget, applyCast, checkBattleOver, collapseStructure, weaponContextOf, resolveRoundBoundary, STRUCTURE_CRIT_TABLE } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { evaluateMissile, type CastResult } from '../engine/magic';
import { findSpellById } from '../data';
import { isOutOfAction, endState, usesSuddenDeath, inDeathCondition, tickDeath, hasCondition } from '../engine/conditions';
import { rederivePassiveAttack } from '../engine/combat';
import { critiquesDuCoup } from '../engine/critical';
import { setRule, resetRule } from '../engine/policy';
import type { TestResult } from '../engine/tests';
import { stepInteraction } from './cascade';
import { draineCascade } from './cascadeTestKit';
import { findTableEntry } from '../engine/tables';
import { tableDesCritiquesDeStructure } from '../engine/structureCritical';
import { rollStructureCritical } from '../engine/structureCritical';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { itemFromTrappingById, recomputeLoadout } from '../engine/items';
import { occupied } from './combatGeometry';
import { woundsFromHit } from '../engine/woundsCalc';
import { structureIsDown, structureDownKey, wallBetween, type Scene } from './scene';
import { testScene } from '../scenes/test-fixture';
import type { Weapon, Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { effectiveWeapon } from '../engine/weaponDamage';
import { spawnEnemy } from './spawn';

/**
 * Structures destructibles JOUABLES en combat (AA 10 l.94-127) : enrôlement depuis les arêtes de mur,
 * Dégâts par le CHEMIN combat (`applyAttackResult`), BRÈCHE à 0 Blessure et Critique de Structure.
 * Déterministe (RNG seedé, `forcedRoll` pour les Critiques) — on dépose un `WallSeg.structure` dans la
 * scène de fixture puis on `startCombat`, et la structure devient un Combattant inerte ciblable.
 */
const mkWeapon = (over: Partial<Weapon> = {}): Weapon => ({
  label: 'arme', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], ...over,
});
const hache = mkWeapon({ label: 'Hache', type: 'melee' });
const fleche = mkWeapon({ label: 'Flèche', type: 'ranged' });
const canon = mkWeapon({ label: 'Canon', type: 'ranged', qualities: [{ id: 'siege' }] });
const belier = mkWeapon({ label: 'Bélier', type: 'melee', qualities: [{ id: 'siege' }, { id: 'belier' }] });

/** Arête E de (2,2) — sépare (2,2) de (3,2). On y pose la structure `structId` (intacte sauf `down`). */
const EDGE = { x: 2, y: 2, side: 'E' as const };
function sceneWithStructure(structId: string, down = false): Scene {
  const s = structuredClone(testScene());
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: structId }];
  if (down) s.flags = { ...s.flags, [structureDownKey(EDGE.x, EDGE.y, EDGE.side, 0)]: true };
  return s;
}

/** Lance un combat sur la scène de fixture munie d'une structure d'arête, RNG seedé. Renvoie la structure
 *  enrôlée (undefined si `down`), un héros attaquant et l'accès store. */
function start(structId: string, opts?: { down?: boolean; seed?: number }) {
  useGame.getState().seedRng(opts?.seed ?? 1);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: opts?.seed ?? 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(sceneWithStructure(structId, opts?.down));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const S = b.combatants.find((c) => c.bodyShape === 'structure');
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  return { S, H, b };
}

/** Jet de toucher réussi SANS double (AA 10 l.114 : le double est l'autre déclencheur). */
const sansDouble: TestResult = { roll: 6, target: 70, success: true, sl: 5, isDouble: false } as TestResult;

/** La structure `id` telle que le store la porte (absente = retirée du combat). */
const live = (id: string): Combatant | undefined => useGame.getState().battle!.combatants.find((c) => c.id === id);

/** Étapes de Critique de Structure empilées dans la cascade courante. */
const etapesDeCritique = (): number =>
  (useGame.getState().pendingCascade?.participants ?? []).filter((s) => s.table?.tableId === STRUCTURE_CRIT_TABLE).length;

/** Construit un AttackResult de touche dont les Blessures sont calculées par le VRAI résolveur de Dégâts
 *  (`woundsFromHit`) — on teste ainsi le CHEMIN combat (Siège ×2 / immunités) jusqu'à l'application. */
function hitRes(weapon: Weapon, target: Combatant, totalDamage: number, over: Partial<AttackResult> = {}): AttackResult {
  return {
    hit: true, attackerRoll: 41, netSL: 2, location: 'corps', damage: totalDamage,
    woundsLost: woundsFromHit(weapon, target, 'corps', totalDamage, 0, 1, undefined),
    critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'touche', ...over,
  };
}

describe('Structures de siège — enrôlement au combat (AA 10 l.94-127)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('une arête `structure` INTACTE devient un Combattant bodyShape=structure (pos=arête, structureEdge renseigné)', () => {
    const { S } = start('porte-de-ville');
    expect(S).toBeTruthy();
    expect(S!.id).toBe('structure-2-2-E-0');
    expect(S!.bodyShape).toBe('structure');
    expect(S!.kind).toBe('npc');
    expect(S!.pos).toEqual({ x: 2, y: 2 });
    expect(S!.structureEdge).toEqual({ x: 2, y: 2, side: 'E', z: 0 });
  });

  it("une structure déjà ABATTUE n'est pas ré-instanciée", () => {
    const { S } = start('porte-de-ville', { down: true });
    expect(S).toBeUndefined();
  });

  it("la présence de la structure ne déclenche pas la victoire, et elle n'a PAS de tour (hors `order`)", () => {
    const { S, b } = start('porte-de-ville');
    expect(b.over).toBeNull(); // 3 Mutants vivants → combat en cours
    expect(b.order).not.toContain(S!.id); // inerte 'npc' → aucun tour (sinon boucle figée)
    expect(b.combatants).toContain(S); // mais RESTE ciblable
  });
});

describe('Structures de siège — Dégâts par le chemin combat', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Canon (Atout Siège) sur Mur en pierre : ×2 appliqué aux Blessures de la structure', () => {
    const { S, H } = start('mur-en-pierre'); // B 40, BE 12, Impénétrable
    // 20 × 2 (Siège) = 40 ; − BE 12 = 28 retirés → 40 − 28 = 12 restants (Impénétrable franchi par Siège).
    applyAttackResult(useGame.getState, useGame.setState, H, S!, canon, hitRes(canon, S!, 20));
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id)!;
    expect(s.wounds.current).toBe(12);
  });

  it('Canon qui entame le Mur : le coup ne se clôt pas sur des PB de Personnage — ni Premier sang ni État (AA 10 l.127 ; #1595 C7)', () => {
    const { S, H } = start('mur-en-pierre');
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'firstBlood' } } });
    applyAttackResult(useGame.getState, useGame.setState, H, S!, canon, hitRes(canon, S!, 60));
    draineCascade(useGame.getState);
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id)!;
    expect(s.wounds.current).toBe(0);
    expect(s.outOfRencontre, 'une structure ne sort pas au Premier sang').toBeFalsy();
    expect(s.conditions.map((c) => c.id)).toEqual([]);
  });

  it('Flèche sur Mur en pierre (Impénétrable) : 0 Blessure (immunité dans le chemin combat)', () => {
    const { S, H } = start('mur-en-pierre');
    applyAttackResult(useGame.getState, useGame.setState, H, S!, fleche, hitRes(fleche, S!, 30));
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id)!;
    expect(s.wounds.current).toBe(40); // intacte
  });

  it('Bélier sur Porte : ×2 (cible légitime) ; hors-porte le funnel pose ctx.improvised (ADE II 8 l.249)', () => {
    // Porte B 8 / BE 2 ; 3 × 2 = 6 − 2 = 4 retirés → 8 − 4 = 4 restants (pas de brèche).
    const door = start('porte');
    applyAttackResult(useGame.getState, useGame.setState, door.H, door.S!, belier, hitRes(belier, door.S!, 3));
    expect(useGame.getState().battle!.combatants.find((c) => c.id === door.S!.id)!.wounds.current).toBe(4);
    expect(weaponContextOf(door.H, belier, door.S!).improvised).toBe(false); // porte = cible légitime
    // Hors-porte : ramVsNonDoor → ctx.improvised → effectiveWeapon applique le profil improvisé (plus de Siège, +BF+1).
    const wall = start('mur-en-pierre');
    expect(weaponContextOf(wall.H, belier, wall.S!).improvised).toBe(true);
  });
});

describe('Structures de siège — à 0 Blessure, la Structure reste debout (AA 10 l.114)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  it('amener une Porte à 0 Blessure (sans double) → elle reste en jeu, l\'arête bloque, aucun Critique', () => {
    const { S, H } = start('porte'); // B 8, Résistant (mêlée passe)
    // Hache (mêlée) 20 Dégâts − BE 2 = 18 ≥ 8 → 0 Blessure ; pas de Critique au dépassement (AA 10 l.114).
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, hitRes(hache, S!, 20));
    const s = live(S!.id);
    expect(s, 'la Structure à 0 reste au combat').toBeTruthy();
    expect(s!.wounds.current).toBe(0);
    expect(isOutOfAction(s!)).toBe(false);
    expect(endState(s!)).toBe(null);
    expect(etapesDeCritique()).toBe(0);
    expect(structureIsDown(useGame.getState().scene!, { x: 2, y: 2, side: 'E', structure: 'porte' })).toBe(false);
    expect(wallBetween(useGame.getState().scene!, 2, 2, 3, 2)).toBe(true); // pas de brèche
  });

  for (const mode of ['ldb', 'aa'] as const) {
    it(`'${mode}' : usesSuddenDeath est faux pour une Structure et un navire ; vrai pour un PNJ non important`, () => {
      setRule('combat-aa-blessures', mode);
      const { S, b } = start('porte');
      const nav = spawnEnemy({ ref: 'cogue' }, 'nav', { x: 9, y: 5 });
      expect(usesSuddenDeath(S!)).toBe(false);
      expect(usesSuddenDeath(nav)).toBe(false);
      const pnj = b.combatants.find((c) => c.kind === 'enemy' && !c.important);
      expect(pnj, 'un PNJ non important').toBeTruthy();
      expect(usesSuddenDeath(pnj!), 'contrôle').toBe(true);
    });
  }

  it('à 0, le coup suivant SANS double est un Critique de Structure ; au-dessus de 0, non', () => {
    const { S, H } = start('porte');
    expect(rederivePassiveAttack(H, S!, hache, sansDouble, 'melee').critical, 'contrôle : Structure intacte').toBe(false);
    S!.wounds.current = 0;
    expect(critiquesDuCoup(S!, { coupCritique: null, prise: true, current: 0, blessures: () => 1 }).critiques.map((c) => c.origine)).toEqual(['a-zero']);
    const res = rederivePassiveAttack(H, S!, hache, sansDouble, 'melee');
    expect(res.critical, 'le Coup Critique seul').toBe(false);
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, res);
    expect(etapesDeCritique()).toBe(1);
  });

  it('un double qui fait TOMBER la Structure à 0 donne un Critique (seuil 25 % franchi)', () => {
    const { S, H } = start('porte');
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, hitRes(hache, S!, 20, { critical: true, attackerRoll: 22 }));
    expect(etapesDeCritique()).toBe(1);
  });

  it('un double sur une Structure DÉJÀ à 0 donne UN SEUL Critique', () => {
    const { S, H } = start('porte');
    S!.wounds.current = 0;
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, hitRes(hache, S!, 20, { critical: true, attackerRoll: 22 }));
    expect(etapesDeCritique()).toBe(1);
  });
});

describe('Structures de siège — Critique de Structure (AA 10 l.112-127)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("Effondrement (forcedRoll 98) → `destroyed`, Blessures restantes CONSERVÉES (AA 10 l.127), puis BRÈCHE", () => {
    const { S, H } = start('mur-en-pierre');
    const log: string[] = [];
    const before = S!.wounds.current;
    expect(applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, log, { forcedRoll: 98 }).destroyed).toBe(true);
    expect(S!.wounds.current).toBe(before);
    expect(S!.criticalWounds).toBe(1);
    collapseStructure(useGame.getState, useGame.setState, S!);
    expect(structureIsDown(useGame.getState().scene!, { x: 2, y: 2, side: 'E', structure: 'mur-en-pierre' })).toBe(true);
    expect(useGame.getState().battle!.combatants.some((c) => c.id === S!.id)).toBe(false);
  });

  it("ligne à Blessures (forcedRoll 40, Secouée = 1) → 1 Blessure retirée, comptée au cumul, Structure gardée", () => {
    const { S, H } = start('mur-en-pierre');
    const before = S!.wounds.current;
    expect(applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, [], { forcedRoll: 40 }).destroyed).toBe(false);
    expect(S!.wounds.current).toBe(before - 1);
    expect(S!.criticalWounds).toBe(1);
  });

  it("Blessure Triviale (forcedRoll 10, Ébréchée) → 0 Blessure retirée, hors du cumul (AA 07 l.79)", () => {
    const { S, H } = start('mur-en-pierre');
    const before = S!.wounds.current;
    applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, [], { forcedRoll: 10 });
    expect(S!.wounds.current).toBe(before);
    expect(S!.criticalWounds ?? 0).toBe(0);
  });

  it("le Critique empile une ÉTAPE À TABLE : le tirage est DÉCLARÉ (table + dé + ligne stable), la séquence l'affiche", () => {
    const { S, H } = start('mur-en-pierre');
    applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, [], { forcedRoll: 40 });
    const steps = useGame.getState().pendingCascade!.participants;
    const step = steps[steps.length - 1];
    expect(stepInteraction(step)).toBe('affichage'); // dé déjà tiré (le coup est résolu) → l'étape MONTRE
    expect(step.table!.tableId).toBe(STRUCTURE_CRIT_TABLE);
    expect(step.table!.result).toMatchObject({ roll: 40, die: 40, id: findTableEntry(tableDesCritiquesDeStructure(), 40).id });
    // La ligne affichée est celle du MOTEUR (source unique du formatage), pas une reformulation.
    expect(step.table!.result!.lines[0]).toBe(rollStructureCritical(makeRNG(1), 40).log[0]);
  });

  it("un double retirant ≥25 % des Blessures restantes déclenche un Critique dans le chemin combat", () => {
    const { S, H } = start('mur-en-pierre'); // B 40 → 25 % = 10
    // Canon Siège : 20 × 2 = 40 − 12 = 28 retirés (≥10), sur un DOUBLE → Critique de Structure.
    applyAttackResult(useGame.getState, useGame.setState, H, S!, canon, hitRes(canon, S!, 20, { critical: true, attackerRoll: 22 }));
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id);
    // 28 de base ; le Critique a incrémenté criticalWounds (et peut avoir retiré des Blessures en plus).
    const live = s ?? S!;
    expect(live.criticalWounds).toBe(1);
    expect(live.wounds.current).toBeLessThanOrEqual(12); // au moins les 28 de base retirés
  });
});

describe('Structures de siège — à 0, seul le 96+ effondre (AA 10 l.114, l.127 ; LDB 18 l.34 ; AA 07 l.73)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  const seg = { x: 2, y: 2, side: 'E' as const, structure: 'porte' };
  /** Porte (BE 2) amenée à 0 par la Hache, puis `critiques` Critiques Secouée (dé 40) et `rounds`
   *  franchissements de Round (`tick-death` puis `resolveRoundBoundary`, comme `advanceTurn`). */
  function porteAZero(critiques: number, rounds: number) {
    const { S, H } = start('porte');
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, hitRes(hache, S!, 20));
    const s = live(S!.id)!;
    for (let i = 0; i < critiques; i++) applyStructureCriticalToTarget(useGame.setState, s, {}, [], { forcedRoll: 40 });
    useGame.setState({ pendingCascade: null });
    for (let r = 0; r < rounds; r++) {
      tickDeath(s);
      useGame.setState({ pendingCascade: null });
      resolveRoundBoundary(useGame.getState, useGame.setState);
    }
    return s;
  }

  for (const mode of ['ldb', 'aa'] as const) {
    it(`mode '${mode}' : à 0 depuis 4 Rounds avec 4 Critiques (BE 2), la Structure reste en jeu, jamais Inconsciente`, () => {
      setRule('combat-aa-blessures', mode);
      const s = porteAZero(4, 4);
      expect(s.wounds.current).toBe(0);
      expect(s.criticalWounds).toBe(4);
      expect(live(s.id), 'en jeu').toBeTruthy();
      expect(structureIsDown(useGame.getState().scene!, seg)).toBe(false);
      expect(hasCondition(s, 'inconscient')).toBe(false);
      expect(inDeathCondition(s)).toBe(false);
    });

    it(`mode '${mode}' : contrôle, un Critique au dé 96 l'effondre (retrait et brèche)`, () => {
      setRule('combat-aa-blessures', mode);
      const s = porteAZero(4, 4);
      expect(applyStructureCriticalToTarget(useGame.setState, s, {}, [], { forcedRoll: 96 }).destroyed).toBe(true);
      checkBattleOver(useGame.getState, useGame.setState);
      expect(live(s.id), 'retirée du combat').toBeUndefined();
      expect(structureIsDown(useGame.getState().scene!, seg)).toBe(true);
    });
  }
});

describe('Structures de siège — le jet du Critique prend le modificateur du mode (AA 10 l.114 ; AA 07 l.36 ; LDB 18 l.17)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });
  const heros = (H: Combatant) => ({ attackerId: H.id, attackerKind: 'hero' as const });
  /** Dernière étape de Critique de Structure de la cascade : sa déclaration et son tirage. */
  const derniereEtape = () => {
    const st = (useGame.getState().pendingCascade?.participants ?? []).filter((p) => p.table?.tableId === STRUCTURE_CRIT_TABLE).slice(-1)[0];
    expect(st, 'une étape de Critique de Structure').toBeTruthy();
    return st!.table!;
  };

  it("'aa', chemin de la mêlée : Structure à 2, un double qui retire 6, l'appelant transmet le dépassement (+40)", () => {
    setRule('combat-aa-blessures', 'aa');
    const { S, H } = start('porte');
    S!.wounds.current = 2;
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, hitRes(hache, S!, 20, { critical: true, attackerRoll: 22, woundsLost: 6 }));
    const table = derniereEtape();
    expect(table.mod).toBe(40);
    expect(table.result!.die).toBe(table.result!.roll + 40);
    expect(table.result!.id).toBe(findTableEntry(tableDesCritiquesDeStructure(), table.result!.die).id);
  });

  it("'aa' : Structure à 2, un coup qui en retire 6, dé naturel 60 → dé effectif 100, Effondrement", () => {
    setRule('combat-aa-blessures', 'aa');
    const { S, H } = start('porte');
    S!.wounds.current = 0;
    const outcome = applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill: Math.max(0, 6 - 2), forcedRoll: 60 });
    expect(derniereEtape().result).toMatchObject({ roll: 60, die: 100 });
    expect(outcome.destroyed).toBe(true);
  });

  it("'aa' : Structure déjà à 0, un coup de 3, dé naturel 70 → dé effectif 100, Effondrement", () => {
    setRule('combat-aa-blessures', 'aa');
    const { S, H } = start('porte');
    S!.wounds.current = 0;
    const outcome = applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill: 3, forcedRoll: 70 });
    expect(derniereEtape().result).toMatchObject({ roll: 70, die: 100 });
    expect(outcome.destroyed).toBe(true);
  });

  it("'aa', filet d'applyCriticalToTarget : son dépassement atteint la déclaration", () => {
    setRule('combat-aa-blessures', 'aa');
    const { S, H } = start('porte');
    S!.wounds.current = 0;
    applyCriticalToTarget(S!, 'corps', 3, [], useGame.setState, { get: useGame.getState, ctx: heros(H) });
    expect(derniereEtape().mod).toBe(30);
  });

  it("'ldb' : Structure de BE 2 à 0, un coup d'1 Blessure → −20 (dé 40 → 20 ; dé 10 → 01 ; dé 100 → 80), le 96+ hors d'atteinte (LDB 18 l.17 ; #1595 c.6222318751)", () => {
    setRule('combat-aa-blessures', 'ldb');
    const { S, H } = start('porte');
    S!.wounds.current = 0;
    applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill: 1, forcedRoll: 40 });
    expect(derniereEtape().result).toMatchObject({ roll: 40, die: 20, id: 'ebrechee' });
    applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill: 1, forcedRoll: 10 });
    expect(derniereEtape().result).toMatchObject({ roll: 10, die: 1, id: 'ebrechee' });
    const outcome = applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill: 1, forcedRoll: 100 });
    expect(derniereEtape().result).toMatchObject({ roll: 100, die: 80, id: 'pluie-d-echardes' });
    expect(outcome.destroyed).toBe(false);
  });

  for (const overkill of [2, 3]) {
    it(`'ldb' : Structure de BE 2 à 0, un coup de ${overkill} Blessures → aucun −20, dé 98 → Effondrement (LDB 18 l.17 ; AA 10 l.127)`, () => {
      setRule('combat-aa-blessures', 'ldb');
      const { S, H } = start('porte');
      S!.wounds.current = 0;
      const outcome = applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill, forcedRoll: 98 });
      expect(derniereEtape().result).toMatchObject({ roll: 98, die: 98, id: 'effondrement' });
      expect(outcome.destroyed).toBe(true);
    });
  }

  for (const mode of ['ldb', 'aa'] as const) {
    it(`mode '${mode}', contrôle : sans dépassement, le modificateur vaut 0 (dé 40 → Secouée)`, () => {
      setRule('combat-aa-blessures', mode);
      const { S, H } = start('porte');
      applyStructureCriticalToTarget(useGame.setState, S!, heros(H), [], { overkill: 0, forcedRoll: 40 });
      expect(derniereEtape().result).toMatchObject({ roll: 40, die: 40, id: 'secouee' });
    });
  }
});

describe('Structures de siège — retrait à UNE couture, filet compris (AA 10 l.127)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
  const seg = { x: 2, y: 2, side: 'E' as const, structure: 'porte' };

  it("un Effondrement tiré par le filet d'applyCriticalToTarget retire la Structure et pose la brèche au balayage de checkBattleOver ; un autre Critique la laisse en jeu", () => {
    let effondree = false;
    let tenue = false;
    for (let seed = 1; seed <= 400 && !(effondree && tenue); seed++) {
      const { S } = start('porte', { seed });
      S!.wounds.current = 0;
      seedBattleRng(seed);
      applyCriticalToTarget(S!, 'corps', 0, [], useGame.setState, { get: useGame.getState });
      const destroyed = !!S!.effondree;
      if (destroyed ? effondree : tenue) continue;
      checkBattleOver(useGame.getState, useGame.setState);
      if (destroyed) {
        effondree = true;
        expect(live(S!.id), 'retirée du combat').toBeUndefined();
        expect(structureIsDown(useGame.getState().scene!, seg)).toBe(true);
      } else {
        tenue = true;
        expect(live(S!.id), 'contrôle : Critique sans Effondrement, la Structure tient').toBeTruthy();
        expect(structureIsDown(useGame.getState().scene!, seg)).toBe(false);
      }
    }
    expect(effondree && tenue).toBe(true);
  });
});

describe('Structures de siège — Projectile magique (AA 10 l.114 ; LDB 18 l.17 ; AA 07 l.36)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });
  const cr: CastResult = { cast: true, roll: 44, target: 60, sl: 2, isCritical: false, isFumble: false, log: '' };
  const critiquesAuJournal = (): number =>
    (useGame.getState().battle?.log ?? []).filter((e) => (typeof e === 'string' ? e : (e as { text?: string }).text ?? '').includes('Critique de Structure')).length;
  const lancer = (H: Combatant, S: Combatant, lost: number): void => {
    const spell = findSpellById('flechette')!;
    applyCast(useGame.getState, useGame.setState, H, S, spell, { ...evaluateMissile(H, S, spell, cr), hit: true, woundsLost: lost }, true, false);
  };

  for (const mode of ['ldb', 'aa'] as const) {
    it(`'${mode}' : un Projectile qui dépasse les Blessures d'une Structure au-dessus de 0, sans double → aucun Critique ; à 0 → Critique`, () => {
      setRule('combat-aa-blessures', mode);
      const { S, H } = start('porte');
      expect(S!.wounds.current).toBeGreaterThan(0);
      lancer(H, S!, S!.wounds.current + 5);
      const s = live(S!.id)!;
      expect(s.wounds.current).toBe(0);
      expect(critiquesAuJournal(), "au-dessus de 0 : la Structure n'a que ses déclencheurs").toBe(0);
      useGame.setState({ pendingCascade: null });
      lancer(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!, s, 3);
      expect(critiquesAuJournal(), 'contrôle : à 0, tout coup qui touche est un Critique').toBe(1);
    });
  }
});

describe('Structures de siège — CHEMIN DE CLIC joueur (overlay d’arête → battleClickEntity → brèche)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-blessures'); });

  it("cliquer la porte (battleClickEntity = le clic sur l'overlay d'arête) la martèle par le flux d'attaque NORMAL jusqu'à l'Effondrement et la BRÈCHE", () => {
    const { S, H } = start('porte', { seed: 7 });
    const seg = { x: 2, y: 2, side: 'E' as const, structure: 'porte' };
    // Héros au CONTACT de l'ancrage (2,2), arme de mêlée, Combat/Force élevés → traverse les 8 Bl (BE 2).
    const sword = itemFromTrappingById('arme-simple')!; sword.equipped = true;
    H.items = [sword]; H.loadouts = undefined; H.activeLoadoutId = undefined; recomputeLoadout(H);
    H.characteristics['capacite-de-combat'] = 80; H.characteristics.force = 60;
    H.pos = { x: 1, y: 2 };
    expect(wallBetween(useGame.getState().scene!, 2, 2, 3, 2)).toBe(true); // porte intacte : bloque
    const giveTurn = () => { const b = useGame.getState().battle!; useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 99, acted: false } }); };
    let guard = 0;
    let aZeroEnJeu = false;
    while (!structureIsDown(useGame.getState().scene!, seg) && guard++ < 400) {
      giveTurn();
      useGame.getState().battleClickEntity(S!.id, { confirm: true }); // = clic sur l'overlay d'arête de la structure
      if (useGame.getState().pendingAttack) { useGame.getState().attackRoll(); useGame.getState().attackConfirm(); }
      draineCascade(useGame.getState);
      const s = live(S!.id);
      if (s && s.wounds.current <= 0) aZeroEnJeu = true;
    }
    expect(aZeroEnJeu, 'la porte a été martelée à 0 sans tomber (AA 10 l.114)').toBe(true);
    const after = useGame.getState();
    expect(structureIsDown(after.scene!, seg)).toBe(true);                    // porte abattue par le clic
    expect(after.battle!.combatants.some((c) => c.id === S!.id)).toBe(false); // retirée du combat
    expect(wallBetween(after.scene!, 2, 2, 3, 2)).toBe(false);               // BRÈCHE : passage rouvert
  });
});

describe('weaponContextOf — exceptions hors-spécialisation dégradées (LDB 62 l.184/188, #472)', () => {
  const attacker = (spec: string) => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.skills = [{ id: 'projectiles', spec, characteristic: 'capacite-de-tir', advances: 5 }];
    return hero;
  };

  it("Arbalète via une AUTRE Spé de Tir (Arc) → mode 'degraded' : Atouts retirés, Défauts conservés", () => {
    const h = attacker('arc');
    const arbalete = mkWeapon({ label: 'Arbalète', type: 'ranged', subType: 'arbalete', damage: { plusBF: false, flat: 10 }, qualities: [{ id: 'siege' }, { id: 'imprecise' }] });
    const ctx = weaponContextOf(h, arbalete);
    expect(ctx.groupSkillMode).toBe('degraded');
    const eff = effectiveWeapon(arbalete, ctx);
    expect(eff.qualities.map((q) => q.id)).toEqual(['imprecise']); // Atout Siège perdu, Défaut Imprécise gardé
  });

  it("Poudre noire via Ingénierie (Spé exacte réciproque) → mode 'full' : aucun retrait (LDB 62 l.192)", () => {
    const h = attacker('ingenierie');
    const pistolet = mkWeapon({ label: 'Pistolet', type: 'ranged', subType: 'poudre-noire', damage: { plusBF: false, flat: 10 }, qualities: [{ id: 'siege' }, { id: 'imprecise' }] });
    const ctx = weaponContextOf(h, pistolet);
    expect(ctx.groupSkillMode).toBe('full');
    const eff = effectiveWeapon(pistolet, ctx);
    expect(eff.qualities.map((q) => q.id)).toEqual(['siege', 'imprecise']); // rien de retiré
  });
});

describe('Structures de siège — OCCUPATION (arête ≠ case : on peut se tenir au pied de la herse)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("la case d'ancrage de la structure n'est PAS une emprise au sol (déplacement libre), mais l'arête bloque le passage", () => {
    const { S, H, b } = start('porte');
    expect(S!.pos).toEqual({ x: 2, y: 2 });                       // pos conservée pour le CIBLAGE
    expect(occupied(b, H).has('2,2')).toBe(false);               // case LIBRE : on s'y tient / on la traverse
    expect(wallBetween(useGame.getState().scene!, 2, 2, 3, 2)).toBe(true); // l'ARÊTE bloque toujours le franchissement
  });
});
