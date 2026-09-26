import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { removeEntities } from './combatGeometry';
import { seatPoseOf, seatSlotsOf } from './seating';
import { createHero } from '../engine/character';
import { inanimateCombatant } from '../engine/inanimate';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene, type SceneEntity } from './scene';
import { enemyRigProfile, entityRigProfile } from '../gameIso/rig/enemyProfile';
import { hashSeed } from '../engine/dice';

/**
 * Identité UNIFIÉE SceneEntity ↔ Combatant : le combattant spawné GARDE l'id de l'entité de scène
 * qui l'a enrôlé (plus de ré-ID `enemy-${i}`). Conséquences vérifiées ici : parité d'apparence
 * explo↔combat (même seed), et réconciliation post-combat (les vaincus quittent la scène).
 */

function startFixtureCombat() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
  useGame.setState({ party: [hero], battle: null });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
}

function enrolledEntityIds(): string[] {
  const enc = useGame.getState().scene!.encounters.find((e) => e.id === 'enc-mutants')!;
  return (enc.members ?? []).map((m) => m.entityId);
}

/** Résout la cascade de fin de combat (Tests de Résistance maladie/Corruption influençables) — lance
 *  chaque étape puis valide, jusqu'à fermeture (`finishCombatEnd` → écran de victoire). No-op si aucune. */
function drainCombatEndCascade(): void {
  for (let guard = 0; guard < 30; guard++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.combatEndBoundary) break;
    const cur = p.participants[p.cursor];
    // Les jets de bilan de combat sont des BANDES (#1117 L4) : on lance chaque RANGÉE ; une étape MONO
    // (upkeep différé non bandable) garde son lancer d'étape.
    if (cur?.participants) { for (const row of cur.participants) if (!row.result) useGame.getState().cascadeBatchRoll(row.id); }
    else if (cur?.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
}

describe('Identité unifiée SceneEntity ↔ Combatant (fix embuscade)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('les ennemis spawnés portent l’id de leur SceneEntity (plus de enemy-${i})', () => {
    startFixtureCombat();
    const enemyIds = useGame.getState().battle!.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id).sort();
    expect(enemyIds).toEqual([...enrolledEntityIds()].sort());
    // Chaque id de combattant correspond bien à une entité de la scène.
    const entIds = new Set(useGame.getState().scene!.entities.map((e) => e.id));
    for (const id of enemyIds) expect(entIds.has(id)).toBe(true);
  });

  it('apparence identique en exploration et en combat (même seed → même sexe/carrure)', () => {
    startFixtureCombat();
    const scene = useGame.getState().scene!;
    const enemy = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
    const ent = scene.entities.find((e) => e.id === enemy.id)!;
    const combat = enemyRigProfile(enemy);
    const explo = entityRigProfile(ent.ref!, ent.appearance?.seed ?? hashSeed(ent.id), {
      species: ent.appearance?.species, tenue: ent.appearance?.tenue, sex: ent.appearance?.sex, build: ent.appearance?.build,
    });
    expect(combat).toBeTruthy();
    expect(explo).toBeTruthy();
    expect(combat!.appearance.seed).toBe(explo!.appearance.seed);
    expect(combat!.appearance.sex).toBe(explo!.appearance.sex);
    expect(combat!.appearance.build).toBe(explo!.appearance.build);
  });

  it('victoire : les ennemis vaincus quittent la scène ; un badaud non enrôlé reste', () => {
    startFixtureCombat();
    // Badaud non enrôlé (PNJ d'ambiance) : doit survivre à la fin du combat.
    const sc = useGame.getState().scene!;
    sc.entities.push({ id: 'badaud', kind: 'personnage', pos: { x: 2, y: 2 }, ref: 'mutant' });
    useGame.setState({ scene: { ...sc } });

    const ids = enrolledEntityIds();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true;
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);
    // Les mutants portent le Trait Corruption (Mineure) → cascade de fin de combat (Test de Résistance
    // INFLUENÇABLE) AVANT l'écran de victoire. On la résout pour atteindre la victoire (+ réconciliation).
    drainCombatEndCascade();

    expect(useGame.getState().battle!.over).toBe('victory');
    const remaining = new Set(useGame.getState().scene!.entities.map((e) => e.id));
    for (const id of ids) expect(remaining.has(id)).toBe(false);
    expect(remaining.has('badaud')).toBe(true);
  });

  it('défaite : les ennemis survivants restent dans la scène', () => {
    startFixtureCombat();
    const ids = enrolledEntityIds();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'hero') c.dead = true;
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);

    expect(useGame.getState().battle!.over).toBe('defeat');
    const remaining = new Set(useGame.getState().scene!.entities.map((e) => e.id));
    for (const id of ids) expect(remaining.has(id)).toBe(true);
  });
});

describe('checkBattleOver — un engin INERTE ne compte ni pour la victoire ni pour la défaite (AA 10 l.136-193)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  const mkInertEngine = (id: string, kind: 'enemy' | 'hero') => {
    const c = inanimateCombatant({ id, label: 'Baliste', refId: 'baliste', bodyShape: 'engin', inert: true });
    c.kind = kind; c.pos = { x: 1, y: 1 };
    return c;
  };

  it('victoire NON bloquée par un engin ENNEMI inerte (immune) — on tue l’équipage, pas la pièce', () => {
    startFixtureCombat();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true; // ennemis/équipage vaincus
    b.combatants.push(mkInertEngine('empl-enemy', 'enemy'));            // l'affût ennemi reste (immune, jamais tué)
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(useGame.getState().battle!.over).toBe('victory'); // l'engin inerte ne maintient PAS enemiesAlive
  });

  it('défaite NON bloquée par un engin ALLIÉ inerte (`kind:hero`)', () => {
    startFixtureCombat();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'hero') c.dead = true; // groupe anéanti
    b.combatants.push(mkInertEngine('empl-ally', 'hero'));             // l'affût allié reste
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);
    expect(useGame.getState().battle!.over).toBe('defeat'); // l'engin inerte ne maintient PAS heroesAlive
  });
});

describe('removeEntities — retrait par lot (brique partagée)', () => {
  it('retire les ids donnés en un seul passage, ignore les inconnus, conserve le reste', () => {
    const scene: Scene = {
      type: 'scene', id: 's', label: '', dimensions: { w: 4, h: 4 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: new Array(16).fill('herbe') }],
      entities: (['a', 'b', 'c'] as const).map((id): SceneEntity => ({ id, kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 } })),
      dialogues: [], triggers: [], encounters: [], flags: {},
    };
    let stored: Scene = scene;
    const get = (() => ({ scene: stored, party: [] })) as never;
    const set = ((patch: { scene: Scene }) => { stored = patch.scene; }) as never;
    removeEntities(get, set, ['a', 'c', 'inconnu']);
    expect(stored.entities.map((e) => e.id)).toEqual(['b']);
  });

  it('une suppression NETTOIE l’assise dans la MÊME écriture de scène (meuble ou corps)', () => {
    const assis = { kind: 'entity' as const, entityId: 'pnj-1' };
    const fixture = (): Scene => ({
      type: 'scene', id: 's', label: '', dimensions: { w: 6, h: 6 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
      layers: [{ z: 0, tiles: new Array(36).fill('herbe') }],
      entities: [
        { id: 'table-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'table-ronde-4-tabourets', facing: 'N' },
        { id: 'pnj-1', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 1 } }, // abord NORD : la `pos` d'un attablé
      ] as SceneEntity[],
      dialogues: [], triggers: [], encounters: [], flags: {},
      seatAssignments: { 'table-1': { 'place-1': assis } },
    });
    for (const retire of ['table-1', 'pnj-1']) {
      let stored: Scene = fixture();
      const get = (() => ({ scene: stored, party: [] })) as never;
      const set = ((patch: { scene: Scene }) => { stored = patch.scene; }) as never;
      removeEntities(get, set, [retire]);
      expect(seatPoseOf(stored, assis), `« ${retire} » retiré`).toBeNull();
      expect(stored.seatAssignments, `« ${retire} » retiré`).toEqual({});
    }
  });
});

describe('ouverture de combat — un PNJ enrôlé ASSIS se lève', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('sa place est libérée AVANT la pose du combat ; le voisin non enrôlé reste attablé', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(testScene);
    const sc = useGame.getState().scene!;
    const enrole = sc.encounters.find((e) => e.id === 'enc-mutants')!.members![0].entityId;
    const pos = sc.entities.find((e) => e.id === enrole)!.pos;
    // Table posée au NORD de l'enrôlé, cap `N` : son abord SUD est exactement la case de l'enrôlé, et
    // son abord NORD celle du badaud. RÈGLE : la `pos` d'un attablé EST l'abord de sa place.
    const table = { x: pos.x, y: pos.y - 1 };
    const entities: SceneEntity[] = [
      ...sc.entities,
      { id: 'table-1', kind: 'prop', pos: table, ref: 'table-ronde-4-tabourets', facing: 'N' },
      { id: 'badaud', kind: 'personnage', pos: { x: table.x, y: table.y - 1 }, ref: 'mutant' },
    ];
    const combattant = { kind: 'entity' as const, entityId: enrole };
    const badaud = { kind: 'entity' as const, entityId: 'badaud' };
    useGame.setState({ scene: { ...sc, entities, seatAssignments: { 'table-1': { 'place-3': combattant, 'place-1': badaud } } } });
    // Les deux attablés sont bien posés sur l'abord de LEUR place (le document est sain).
    for (const [slotId, o] of [['place-3', combattant], ['place-1', badaud]] as const) {
      const place = seatSlotsOf(useGame.getState().scene!, 'table-1').find((p) => p.slotId === slotId)!;
      const ent = useGame.getState().scene!.entities.find((e) => e.id === o.entityId)!;
      expect({ x: ent.pos.x, y: ent.pos.y }, `« ${o.entityId} »`).toEqual({ x: place.approach.x, y: place.approach.y });
    }
    expect(seatPoseOf(useGame.getState().scene!, combattant)).not.toBeNull();

    useGame.getState().startCombat('enc-mutants');

    expect(seatPoseOf(useGame.getState().scene!, combattant)).toBeNull();
    expect(seatPoseOf(useGame.getState().scene!, badaud)).toMatchObject({ slotId: 'place-1' });
  });
});
