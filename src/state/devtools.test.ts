import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, setDoorOpen } from './scene';
import { useGame } from './store';
import { buildApi } from './devtools';
import { partyMoneyTotal } from './bourseFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { isOutOfAction } from '../engine/conditions';
import { itemFromTrappingById } from '../engine/items';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { EMPTY_FLOW } from './flow';
import type { BattleState } from './store';
import type { Combatant, ShipPoste } from '../engine/types';
import type { WorldMap } from './worldMap';
import { builtinCampaigns } from '../scenes/campaign';
import { testScenarios, type TestScenario } from '../scenes/test-scenarios';
import { editeur } from './editeurBridge';
import { signalerEntreeEnScene } from './entreeEnScene';
import { buildOperaFloorplan } from '../scenes/opera/floorplan';
import { sceneToAscii } from './sceneToAscii';
import { GLYPHES_RESERVES } from '../data/schemas/grammaire/carte-ascii';
import { t } from '../i18n';
import { findSpellById } from '../data';
import { projectsLoad, __resetLibraryForTest, __setIdbBackendForTest, type SavedProject } from './projectLibrary';
import { parseProject } from './worldMap';

describe('__wfrp.killEnemies — commande de recette (élimine les ennemis, victoire normale)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('hors combat : refus explicite', () => {
    expect(buildApi().killEnemies()).toContain('✗');
  });

  it('en combat : tous les ennemis hors de combat + victoire par le flux normal (pendingVictory)', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();

    const out = buildApi().killEnemies();

    expect(out).toContain('✓');
    const b = useGame.getState().battle!;
    expect(b.over).toBe('victory');
    expect(b.combatants.filter((c) => c.kind === 'enemy').every((c) => isOutOfAction(c))).toBe(true);
    expect(useGame.getState().pendingVictory).toBeTruthy();
  });
});

describe('__wfrp.screen — garde d’id (#211)', () => {
  it('id invalide → throw (liste des ids valides), aucun routage silencieux vers un écran blanc', () => {
    expect(() => buildApi().screen('game')).toThrow(/game/);
    expect(() => buildApi().screen('game')).toThrow(/menu/); // la liste des ids valides est portée par le message
  });

  it('id valide → navigue normalement', () => {
    expect(buildApi().screen('menu')).toBe('menu');
  });
});

describe('__wfrp — autres commandes de recette', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ battle: null, party: [hero] });
    useGame.getState().startScene(testScene);
    vi.clearAllTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('healParty : PB max, états purgés, mort relevé', () => {
    const h = useGame.getState().party[0];
    useGame.setState({
      party: [{ ...h, wounds: { ...h.wounds, current: 0 }, conditions: [{ id: 'hemorragique', stacks: 2 }] as never, criticalWounds: 3, dead: true }],
    });
    buildApi().healParty();
    const healed = useGame.getState().party[0];
    expect(healed.wounds.current).toBe(healed.wounds.max);
    expect(healed.conditions).toEqual([]);
    expect(healed.criticalWounds).toBe(0);
    expect(healed.dead).toBe(false);
  });

  it('give / xp : bourse créditée, PX ajoutés au groupe', () => {
    const before = partyMoneyTotal(useGame.getState).gold;
    buildApi().give(5);
    expect(partyMoneyTotal(useGame.getState).gold).toBe(before + 5);
    const xpBefore = useGame.getState().party[0].xp ?? 0;
    buildApi().xp(150);
    expect(useGame.getState().party[0].xp).toBe(xpBefore + 150);
  });

  it('spell : mémorise un sort au grimoire par l’EFFET MOTEUR (jamais une écriture parallèle)', () => {
    const hero = useGame.getState().party[0];
    // Sans Talent de lanceur, l'effet REFUSE (LDB 46 l.14, #1702) : la console le dit, le journal le nomme.
    useGame.setState({ party: [{ ...hero, spells: [] }] });
    expect(buildApi().spell(hero.id, 'sommeil')).toContain('✗');
    expect(useGame.getState().party[0].spells, 'rien n’a été écrit sans le Talent').toEqual([]);
    expect(useGame.getState().journal).toContain(t('pf.spellCannotLearn', { name: hero.label, spell: findSpellById('sommeil')!.label }));
    // Magie mineure au Talent (talents.json:2926) → `sommeil` devient mémorisable.
    useGame.setState({ party: [{ ...hero, spells: [], talents: [...hero.talents, { talentId: 'magie-mineure', times: 1 }] }] });
    const out = buildApi().spell(hero.id, 'sommeil');
    expect(out, 'la commande DIT ce qu’elle a fait').toContain('✓');
    expect(useGame.getState().party[0].spells, 'le grimoire porte l’ID du sort').toContain('sommeil');
    // Sort INCONNU : l'effet moteur ne pose rien, et la commande le DIT au lieu de mentir.
    expect(buildApi().spell(hero.id, 'sort-qui-nexiste-pas')).toContain('✗');
    expect(useGame.getState().party[0].spells, 'rien n’a été écrit').toEqual(['sommeil']);
  });

  it('flag/flags : force et relit un drapeau de scénario', () => {
    buildApi().flag('zone3_clear');
    expect(buildApi().flags().zone3_clear).toBe(true);
    buildApi().flag('zone3_clear', false);
    expect(buildApi().flags().zone3_clear).toBe(false);
  });

  it('lastRoll : trace le DERNIER Test résolu (observation pure, #514)', () => {
    expect(buildApi().lastRoll()).toBeNull();
    const hero = useGame.getState().party[0];
    useGame.setState({
      pendingTest: {
        actorId: hero.id, actorName: hero.label, label: 'Test', skillValue: 50, difficulty: 'intermediaire',
        requireSL: 0, target: 50, roll: 42, success: true, sl: 1,
        onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW,
      },
    });
    useGame.getState().resolveTest();
    expect(buildApi().lastRoll()).toEqual({ actorId: hero.id, success: true, sl: 1, roll: 42, target: 50 });
  });

  it('fight : sans argument liste les rencontres de la scène, avec id lance le combat', () => {
    expect(buildApi().fight()).toContain('enc-mutants');
    expect(buildApi().fight('enc-inconnue')).toContain('✗');
    const out = buildApi().fight('enc-mutants');
    expect(out).toContain('✓');
    expect(useGame.getState().battle).toBeTruthy();
  });

  it('go : id de scène inconnu → message d’erreur, scène inchangée', () => {
    const before = useGame.getState().scene?.id;
    expect(buildApi().go('scene-qui-n-existe-pas')).toContain('✗');
    expect(useGame.getState().scene?.id).toBe(before);
  });

  it('time : avance l’horloge de jeu', () => {
    const before = useGame.getState().gameTime;
    buildApi().time(90);
    expect(useGame.getState().gameTime).toBe(before + 90);
  });

  it('seed : re-ensemence le RNG de bataille (même action que store.seedRng)', () => {
    const spy = vi.spyOn(useGame.getState(), 'seedRng');
    expect(buildApi().seed(42)).toContain('42');
    expect(spy).toHaveBeenCalledWith(42);
  });

  it('goto : succès quand le groupe atteint réellement la cible', () => {
    const out = buildApi().goto({ x: 10, y: 8 });
    expect(out).toContain('✓');
    expect(useGame.getState().partyPos).toMatchObject({ x: 10, y: 8 });
  });

  it('goto (#793) : cible inatteignable (hors grille) → message ✗ avec la position RÉELLE, jamais un faux ✓', () => {
    const before = useGame.getState().partyPos;
    const out = buildApi().goto({ x: 999, y: 999 });
    expect(out).toContain('✗');
    expect(out).not.toContain('✓');
    expect(useGame.getState().partyPos).toEqual(before);
  });

  it('roofCut (#1478) : pose le lève-toit à false, le repose à true', () => {
    expect(useGame.getState().debugRoofCut).toBe(true); // défaut = comportement de jeu
    const off = buildApi().roofCut();
    expect(useGame.getState().debugRoofCut).toBe(false);
    expect(off).toContain('lève-toit OFF');
    const on = buildApi().roofCut(true);
    expect(useGame.getState().debugRoofCut).toBe(true);
    expect(on).toBe('lève-toit ON');
  });

  it('editorOpen (#1478) sans id : rend les trois familles ouvrables', async () => {
    const out = await buildApi().editorOpen() as { projets: string[]; campagnes: string[]; scenarios: string[] };
    expect(Array.isArray(out.projets)).toBe(true);
    expect(out.campagnes.length).toBeGreaterThan(0);
    expect(out.scenarios.some((s) => s.startsWith(`${testScenarios[0].id} —`))).toBe(true);
  });

  it('editorOpen (#1478) avec un pont VIDE : rejet NOMMÉ (l\'éditeur ne s\'est pas monté)', async () => {
    expect(editeur.ouvrir).toBeUndefined(); // aucun Editor monté dans ce banc
    const p = buildApi().editorOpen('opera', 120);
    const verdict = p.then(() => 'résolu', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(400);
    expect(await verdict).toContain("l'éditeur ne s'est pas monté");
  });

  it('editorPatchEntity (#877) avec un pont VIDE : rejet NOMMÉ, portant CE helper-là', async () => {
    expect(editeur.patcherEntite).toBeUndefined(); // aucun Editor monté dans ce banc
    const p = buildApi().editorPatchEntity('p0', { ref: undefined }, 120);
    const verdict = p.then(() => 'résolu', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(400);
    expect(await verdict).toContain("l'éditeur ne s'est pas monté");
    expect(await verdict, 'le refus nomme le helper appelé, jamais son voisin').toContain('editorPatchEntity');
  });
});

describe('__wfrp.projectMinimal / projectSave — poser un projet en bibliothèque sans recharger (#1343)', () => {
  beforeEach(async () => {
    const store = new Map<string, SavedProject>();
    __setIdbBackendForTest({
      getAll: async () => [...store.values()],
      put: async (e: SavedProject) => void store.set(e.id, e),
      delete: async (id: string) => void store.delete(id),
      clear: async () => store.clear(),
    });
    await __resetLibraryForTest();
  });
  afterEach(() => __setIdbBackendForTest(null));

  it('projectMinimal rend une entrée que la porte du document accepte', () => {
    const entree = buildApi().projectMinimal('p-recette', 'Recette');
    expect(() => parseProject(entree.project)).not.toThrow();
    expect(entree.project.scenes.map((s) => s.id)).toContain(entree.startSceneId);
  });

  it('projectSave écrit par la fonction projectSave de la bibliothèque : projectsLoad la rend aussitôt', async () => {
    const api = buildApi();
    const out = await api.projectSave(api.projectMinimal('p-recette', 'Recette'));
    expect(out).toContain('✓');
    expect(projectsLoad().map((p) => p.id)).toContain('p-recette');
  });
});

describe('__wfrp.place — piège composite (coque à postes / membre de crew)', () => {
  const CHARS = { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  const mkPoste = (crewIds: string[]): ShipPoste => ({ item: itemFromTrappingById('belier-ade2')!, crewIds });
  const mkHull = (poste: ShipPoste, pos = { x: 5, y: 5 }): Combatant =>
    ({ id: 'hull', label: 'Bélier', kind: 'enemy', pos, conditions: [], weapons: [],
      inert: true, wounds: { current: 0, max: 0 }, advantage: 0, postes: [poste] }) as unknown as Combatant;
  const mkServant = (id: string, pos: { x: number; y: number }): Combatant =>
    ({ id, label: id, kind: 'npc', characteristics: CHARS, wounds: { current: 8, max: 8 }, advantage: 0,
      conditions: [], skills: [], talents: [], weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos }) as unknown as Combatant;

  beforeEach(() => useGame.setState({ battle: null, party: [] }));

  function setup() {
    const poste = mkPoste(['chef', 's1', 's2']);
    const hull = mkHull(poste);
    const chef = mkServant('chef', { x: 5, y: 6 });
    const s1 = mkServant('s1', { x: 6, y: 6 });
    const s2 = mkServant('s2', { x: 4, y: 6 });
    const combatants = [chef, hull, s1, s2];
    const battle: BattleState = {
      combatants, order: [chef.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle });
    return { chef, hull, s1, s2 };
  }

  it('place() de la COQUE déplace coque + tout le crew du MÊME delta', () => {
    const { hull, chef, s1, s2 } = setup();
    const from = { hull: { ...hull.pos! }, chef: { ...chef.pos! }, s1: { ...s1.pos! }, s2: { ...s2.pos! } };
    const out = buildApi().place('hull', { x: 8, y: 9 }) as { msg: string; moved: string[] };
    const delta = { x: 8 - from.hull.x, y: 9 - from.hull.y };
    expect(out.moved.sort()).toEqual(['chef', 'hull', 's1', 's2'].sort());
    const find = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(find(hull.id).pos).toEqual({ x: 8, y: 9 });
    expect(find(chef.id).pos).toEqual({ x: from.chef.x + delta.x, y: from.chef.y + delta.y });
    expect(find(s1.id).pos).toEqual({ x: from.s1.x + delta.x, y: from.s1.y + delta.y });
    expect(find(s2.id).pos).toEqual({ x: from.s2.x + delta.x, y: from.s2.y + delta.y });
  });

  it('place() d’un MEMBRE DE CREW déplace aussi toute la formation (coque + crew) du même delta', () => {
    const { hull, chef, s1, s2 } = setup();
    const from = { hull: { ...hull.pos! }, chef: { ...chef.pos! }, s1: { ...s1.pos! }, s2: { ...s2.pos! } };
    const out = buildApi().place('s1', { x: 10, y: 10 }) as { msg: string; moved: string[] };
    const delta = { x: 10 - from.s1.x, y: 10 - from.s1.y };
    expect(out.moved.sort()).toEqual(['chef', 'hull', 's1', 's2'].sort());
    const find = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;
    expect(find(s1.id).pos).toEqual({ x: 10, y: 10 });
    expect(find(hull.id).pos).toEqual({ x: from.hull.x + delta.x, y: from.hull.y + delta.y });
    expect(find(chef.id).pos).toEqual({ x: from.chef.x + delta.x, y: from.chef.y + delta.y });
    expect(find(s2.id).pos).toEqual({ x: from.s2.x + delta.x, y: from.s2.y + delta.y });
  });

  it('place() d’un combattant SIMPLE (ni coque ni crew) reste une téléportation directe inchangée', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    hero.pos = { x: 1, y: 1 };
    const battle: BattleState = {
      combatants: [hero], order: [hero.id], turn: 0, round: 1, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    useGame.setState({ battle });
    const out = buildApi().place(hero.id, { x: 3, y: 4 });
    expect(out).toBe(`✓ ${hero.label} → (3,4)`);
    expect(useGame.getState().battle!.combatants[0].pos).toEqual({ x: 3, y: 4 });
  });
});

describe('__wfrp.fastForward — avance-rapide des tours IA (garde anti-boucle, machinerie existante)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ battle: null, party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    vi.clearAllTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('s’arrête au tour d’un combattant piloté humain (les mutants, loin du héros, se contentent de bouger)', async () => {
    const b = useGame.getState().battle!;
    const heroId = b.combatants.find((c) => c.kind === 'hero')!.id;
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    // Ordre forcé : les 3 Mutants d'abord — ils sont loin du héros (fixture) → pas de jet d'attaque (juste
    // du mouvement), donc pas d'issue RNG-dépendante (pas de risque de cascade de fin de combat).
    useGame.setState({ battle: { ...b, order: [...enemyIds, heroId], baseOrder: [...enemyIds, heroId], turn: -1 } });
    useGame.getState().confirmRoundStart();
    // Le beat de tour armé par `confirmRoundStart` EST la machinerie mesurée : l'annuler ici laissait
    // `fastForward` seul à relancer l'IA — ce qu'il ne fait plus (#1852, il n'amorce que ce qui est
    // arrêté et ne double jamais un tour). On le laisse vivre : `runAllTimersAsync` le déroule.

    const p = buildApi().fastForward(100);
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg).toContain('✓');
    expect(msg).not.toContain('✗');
    const after = useGame.getState().battle;
    if (after && !after.over) {
      const active = after.combatants.find((c) => c.id === after.order[after.turn]);
      expect(active?.kind).toBe('hero'); // rendu au tour du héros (piloté humain)
    }
  });

  it('chaîne ARRÊTÉE (beats purgés) : `fastForward` la RAMORCE et rend la main au héros', async () => {
    const b = useGame.getState().battle!;
    const heroId = b.combatants.find((c) => c.kind === 'hero')!.id;
    const enemyIds = b.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id);
    useGame.setState({ battle: { ...b, order: [...enemyIds, heroId], baseOrder: [...enemyIds, heroId], turn: -1 } });
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers(); // PLUS AUCUN beat en vol : c'est `fastForward` SEUL qui doit ramorcer (#1852)

    const p = buildApi().fastForward(100);
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg, msg).toContain('✓');
    const after = useGame.getState().battle;
    if (after && !after.over) {
      expect(after.combatants.find((c) => c.id === after.order[after.turn])?.kind).toBe('hero');
    }
  });

  it('fenêtre OUVERTE : `fastForward` rend la main en la NOMMANT, sans rien décider à la place du joueur', async () => {
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    const enemyId = b.combatants.find((c) => c.kind === 'enemy')!.id;
    useGame.setState({
      // Tour de l'IA (sinon `fastForward` rend la main pour la bonne autre raison : « tour piloté »),
      // mais la fenêtre du défenseur est ouverte.
      battle: { ...b, order: [enemyId, hero.id], baseOrder: [enemyId, hero.id], turn: 0 },
      // Une fenêtre de défense VIVANTE, sur son étape : la main appartient au joueur.
      pendingDefense: { attackerId: b.combatants.find((c) => c.kind === 'enemy')!.id, defenderId: hero.id, weapon: hero.weapons[0], mode: 'parade', def: null, result: null } as never,
      pendingCascade: { title: 'Défense', purpose: 'combat', cursor: 0, log: [], seq: 1, participants: [{ id: 'defense-jet-0', kind: 'defenseJet', jet: 'defense', actorId: hero.id }] } as never,
    });

    const p = buildApi().fastForward(100);
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg, 'la fenêtre est NOMMÉE, pas scrutée jusqu’à la borne').toBe('✓ fenêtre « cascade » ouverte (à répondre)');
    expect(useGame.getState().pendingDefense, 'aucune décision prise à la place du joueur').not.toBeNull();
  });

  it('borne à maxIters (garde-fou anti-boucle infinie) si rien ne progresse jamais vers un tour humain', async () => {
    const b = useGame.getState().battle!;
    const enemyId = b.combatants.find((c) => c.kind === 'enemy')!.id;
    // Tour figé sur un Ennemi SANS jamais lancer confirmRoundStart/maybeRunEnemyTurn nous-mêmes au préalable
    // — mais fastForward RELANCE la machinerie à chaque scrutation (maybeRunEnemyTurn) : avec maxIters=0,
    // la borne mord dès la 1ʳᵉ scrutation, AVANT toute action IA — vérifie que la borne est bien respectée.
    useGame.setState({ battle: { ...b, order: [enemyId], baseOrder: [enemyId], turn: 0 } });

    const msg = await buildApi().fastForward(0);

    expect(msg).toContain('✗');
    expect(msg).toContain('borne atteinte');
  });
});

describe('__wfrp.advanceSeaDay / skipToArrival / dealShipDamage / clickRoute — outillage recette navale (#297)', () => {
  const seaMap: WorldMap = {
    id: 'm', label: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 100, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };
  const freshState = () => {
    seedBattleRng(1); // déterminisme (suite isolate:false)
    useGame.setState({
      party: makePregens().slice(0, 3),
      scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null,
      worldMap: seaMap,
      travelPlan: null,
      travelRecap: null,
      pendingCrewTest: null,
      pendingRest: null,
      pendingCascade: null,
      pendingSeaActivities: null,
      suspendedCascades: [],
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
      journal: [],
    } as never);
  };
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    freshState();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('advanceSeaDay() fait avancer d’UN jour (cascade + halte de nuit résolues), s’arrête sur la cascade FRAÎCHE du jour suivant', async () => {
    useGame.getState().startTravel('r1', 'mer');
    const p = buildApi().advanceSeaDay();
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg).toContain('✓');
    expect(msg).not.toContain('✗');
    expect(useGame.getState().pendingRest).toBeNull(); // halte de nuit RÉSOLUE (pas juste ouverte)
    expect(useGame.getState().travelPlan?.sea?.daysAtSea).toBeGreaterThanOrEqual(1);
    // Le jour 2 est déjà amorcé (`runSeaDay` enchaîne) mais INTACT — pas une étape déjà consommée.
    const pc = useGame.getState().pendingCascade;
    expect(pc?.purpose).toBe('travelDay');
    expect(pc?.cursor).toBe(0);
  });

  it('advanceSeaDay() hors voyage : refus explicite', async () => {
    const msg = await buildApi().advanceSeaDay();
    expect(msg).toContain('✗');
  });

  it('skipToArrival() roule jusqu’à l’accostage (travelPlan vidé, route courte de 100 milles)', async () => {
    useGame.getState().startTravel('r1', 'mer');
    const p = buildApi().skipToArrival();
    await vi.runAllTimersAsync();
    const msg = await p;

    expect(msg).toContain('✓');
    expect(useGame.getState().travelPlan).toBeNull();
  });

  it('dealShipDamage() inflige des Dégâts HORS COMBAT via la SOURCE UNIQUE vessel.wounds (#296)', () => {
    useGame.getState().startTravel('r1', 'mer');
    // À l'appareillage, `vessel.wounds` reste `undefined` jusqu'à la première écriture (piège #296) —
    // la coque de trajet (`travelPlan.vehicle`) porte la valeur RÉELLE tant qu'aucun Dégât/jour n'écrit.
    const before = useGame.getState().travelPlan!.vehicle!.wounds.current;

    const msg = buildApi().dealShipDamage(7);

    expect(msg).toContain('✓');
    expect(useGame.getState().vessel!.wounds!.current).toBe(before - 7);
    expect(useGame.getState().travelPlan!.vehicle!.wounds.current).toBe(before - 7); // deux copies en phase
  });

  it('dealShipDamage() au port (pas de voyage en cours) écrit directement vessel.wounds', () => {
    useGame.setState({ vessel: { ...useGame.getState().vessel!, wounds: { current: 20, max: 30 } } });

    const msg = buildApi().dealShipDamage(5);

    expect(msg).toContain('✓');
    expect(useGame.getState().vessel!.wounds!.current).toBe(15);
  });

  // `clickRoute` accède au DOM (`document.querySelectorAll`) au-delà de la validation route/carte —
  // comme `screenPos`/`hover`, non couvert en environnement 'node' (vitest) : recette navigateur seule.
  it('clickRoute() : route invalide → refus explicite (validation AVANT tout accès DOM)', () => {
    expect(buildApi().clickRoute('r-inconnue')).toContain('✗');
  });

  it('setMorale() : pose directement vessel.morale.score (setup, pas le recalc hebdomadaire)', () => {
    const msg = buildApi().setMorale(20);
    expect(msg).toContain('✓');
    expect(useGame.getState().vessel!.morale.score).toBe(20);
    // Facteurs/lastMoraleWeek inchangés — un setup direct, pas `recalcMorale`.
    expect(useGame.getState().vessel!.morale.factors).toEqual([]);
  });

  it('setMorale() sans navire de campagne : refus explicite', () => {
    useGame.setState({ vessel: null });
    expect(buildApi().setMorale(20)).toContain('✗');
  });

  it('forceShipwreck() : déclenche beginShipwreck DIRECTEMENT (vessel purgé), pas le pipeline dealShipDamage', () => {
    expect(useGame.getState().vessel).toBeTruthy();

    const msg = buildApi().forceShipwreck();

    expect(msg).toContain('✓');
    expect(useGame.getState().vessel).toBeNull(); // coque + cargaison perdues, IMMÉDIAT (beginShipwreck)
    expect(useGame.getState().journal.some((j) => String(j).includes('NAUFRAGE'))).toBe(true);
  });

  it('forceShipwreck() sans navire de campagne : refus explicite', () => {
    useGame.setState({ vessel: null });
    expect(buildApi().forceShipwreck()).toContain('✗');
  });
});

describe('__wfrp.campaign — charge une campagne BUILT-IN sans le character creator (#353)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], scene: null, pendingCampaign: null } as never);
  });

  it('sans argument : liste les ids', () => {
    const out = buildApi().campaign() as string[];
    expect(out.some((s) => s.startsWith('loup-et-saumure'))).toBe(true);
  });

  it('id inconnu : refus explicite', () => {
    expect(buildApi().campaign('campagne-qui-n-existe-pas')).toContain('✗');
  });

  it("id connu : groupe canonique constitué, scène d'entrée chargée, écran campaign", () => {
    const msg = buildApi().campaign('loup-et-saumure', 42) as string;

    expect(msg).toContain('✓');
    expect(msg).toContain('Le Loup et la Saumure');
    const s = useGame.getState();
    expect(s.party.length).toBe(4);
    // `pendingCampaign` est le champ TRANSITOIRE du picker (avant lancement) — `loadProject` appelle
    // `startScene`, qui réinitialise l'état à l'INITIAL (hors le sous-ensemble préservé, cf.
    // `store.ts:startScene`) : `pendingCampaign` n'y figure pas et redevient `null` après chargement,
    // EXACTEMENT comme le flux réel du picker (`PartyScreen.startCampaign`) — pas une régression d'ici.
    expect(s.pendingCampaign).toBeNull();
    expect(s.scene).toBeTruthy();
    expect(s.worldMap).toBeTruthy();
    expect(s.screen).toBe('campaign');
  });

  it('déterministe sous seed : même seed → même groupe (mêmes ids)', () => {
    buildApi().campaign('loup-et-saumure', 7);
    const ids1 = useGame.getState().party.map((h) => h.id);
    useGame.setState({ battle: null, party: [], scene: null, pendingCampaign: null } as never);
    buildApi().campaign('loup-et-saumure', 7);
    const ids2 = useGame.getState().party.map((h) => h.id);
    expect(ids2).toEqual(ids1);
  });

  it('sceneId optionnel : démarre sur une autre scène du projet que l’entrée par défaut', () => {
    const c = builtinCampaigns.find((b) => b.id === 'loup-et-saumure')!;
    const otherSceneId = c.scenes.find((sc) => sc.id !== c.startSceneId)?.id;
    if (!otherSceneId) return; // projet à une seule scène — rien à vérifier ici
    buildApi().campaign('loup-et-saumure', 1, otherSceneId);
    expect(useGame.getState().scene?.id).toBe(otherSceneId);
  });

  it('sceneId hors des scènes du projet : refus NOMMANT la scène, rien de chargé', () => {
    const msg = buildApi().campaign('loup-et-saumure', 1, 'SCENE-INEXISTANTE') as string;
    expect(msg).toMatch(/^✗ scène « SCENE-INEXISTANTE » introuvable dans « loup-et-saumure »/);
    const s = useGame.getState();
    expect(s.party).toEqual([]);
    expect(s.scene).toBeNull();
  });
});

describe('__wfrp.gmSeat — flip du siège MJ solo (#332)', () => {
  afterEach(() => {
    useGame.setState({ net: { ...useGame.getState().net, gmSeat: undefined } });
  });

  it('gmSeat(true) pose le siège MJ (siège 0) ; gmSeat(false) le retire', () => {
    expect(useGame.getState().net.gmSeat).toBeUndefined();

    expect(buildApi().gmSeat(true)).toContain('✓');
    expect(useGame.getState().net.gmSeat).toBe(0);

    expect(buildApi().gmSeat(false)).toContain('✓');
    expect(useGame.getState().net.gmSeat).toBeUndefined();
  });

  it('gmSeat() sans argument BASCULE l’état courant', () => {
    expect(useGame.getState().net.gmSeat).toBeUndefined();
    buildApi().gmSeat();
    expect(useGame.getState().net.gmSeat).toBe(0);
    buildApi().gmSeat();
    expect(useGame.getState().net.gmSeat).toBeUndefined();
  });
});

describe('__wfrp.resumeLastScenario — reprise du dernier scénario après un reload (#1335)', () => {
  // Env de test = node : pas de sessionStorage. On en pose un faux (même contrat Storage) pour
  // observer la MÉMOIRE d'onglet, puis on le retire.
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  } as Storage;

  beforeEach(() => {
    store.clear();
    (globalThis as { sessionStorage?: Storage }).sessionStorage = fake;
    useGame.setState({ battle: null, party: [], scene: null });
  });
  afterEach(() => {
    delete (globalThis as { sessionStorage?: Storage }).sessionStorage;
  });

  it('sans scénario mémorisé : refus explicite, aucun lancement', () => {
    const out = buildApi().resumeLastScenario();
    expect(out).toContain('✗');
    expect(useGame.getState().scene).toBeNull();
  });

  it('scenario(id, seed) MÉMORISE {id, seed} dans le stockage d’onglet', () => {
    buildApi().scenario('entrainement', 7);
    expect(JSON.parse(store.get('wfrp.dev.lastScenario')!)).toEqual({ id: 'entrainement', seed: 7 });
  });

  it('après un reload (état perdu, stockage conservé) : relance le MÊME scénario avec le MÊME seed', () => {
    buildApi().scenario('entrainement', 7);
    const sceneId = useGame.getState().scene?.id;
    expect(sceneId).toBeTruthy();

    // Reload : le store repart vierge (menu), seul le stockage d'onglet survit.
    useGame.setState({ battle: null, party: [], scene: null });
    useGame.getState().setScreen('menu');

    const out = buildApi().resumeLastScenario();

    expect(out).toContain('✓');
    expect(useGame.getState().scene?.id).toBe(sceneId);
    expect(useGame.getState().party.length).toBeGreaterThan(0);
    expect(JSON.parse(store.get('wfrp.dev.lastScenario')!)).toEqual({ id: 'entrainement', seed: 7 });
  });

  it('id inconnu : REFUS NOMMÉ qui JETTE (id demandé + ids disponibles), et rien n’est mémorisé (#1734)', () => {
    buildApi().scenario('entrainement', 3);
    // Un plateau muet ferait attribuer le rouge de la recette au geste suivant : le refus interrompt.
    expect(() => buildApi().scenario('scenario-inexistant')).toThrowError(/scenario-inexistant/);
    expect(() => buildApi().scenario('scenario-inexistant')).toThrowError(/entrainement/); // les ids disponibles
    expect(JSON.parse(store.get('wfrp.dev.lastScenario')!)).toEqual({ id: 'entrainement', seed: 3 });
  });

  it('scène qui charge VIDE : REFUS NOMMÉ qui JETTE, et rien n’est mémorisé (pas de reprise en boucle, #1734)', () => {
    // Scénario FORGÉ : sa scène n'a aucune entité (`emptyScene`), donc aucun `heroStart` sous le groupe.
    // Il est servi par le SEAM de registre de `buildApi` — le chemin que lit `runScenario` — dans une
    // liste LOCALE dérivée du registre réel : le tableau importé, que d'autres tests comptent, est intact.
    const vide: TestScenario = {
      id: 'plateau-vide-1734',
      order: 9999,
      category: 'combat',
      icon: 'scenario/bestiary',
      title: 'Plateau vide (garde du refus nommé)',
      tests: 'le refus de plateau vide',
      partyNote: 'pré-tirés',
      makeParty: () => makePregens().slice(0, 1),
      scene: emptyScene(),
    };
    const api = () => buildApi([...testScenarios, vide]); // registre LOCAL : le tableau importé n'est pas touché
    api().scenario('entrainement', 5); // mémoire d'onglet posée par un lancement QUI ABOUTIT
    expect(() => api().scenario('plateau-vide-1734', 11)).toThrowError(/VIDE/);
    expect(() => api().scenario('plateau-vide-1734', 11)).toThrowError(/plateau-vide-1734/);
    // La mémoire d'onglet porte toujours le DERNIER lancement abouti : `resumeLastScenario()` ne
    // rejouera jamais le scénario qui jette.
    expect(JSON.parse(store.get('wfrp.dev.lastScenario')!)).toEqual({ id: 'entrainement', seed: 5 });
    expect(testScenarios.some((s) => s.id === 'plateau-vide-1734')).toBe(false); // registre partagé intact
  });
});

describe('__wfrp.visibleCount / __wfrp.walls — sondes de brouillard et d’arêtes (#1680)', () => {
  beforeEach(() => {
    useGame.setState({ scene: null, battle: null, party: [] });
  });

  it('hors scène : refus explicite (aucun chiffre fabriqué)', () => {
    expect(buildApi().visibleCount()).toContain('✗');
    expect(buildApi().walls()).toContain('✗');
  });

  it('visibleCount chiffre la vue SANS la confondre avec la carte entière', () => {
    buildApi().scenario('ecuries-clayonnage', 7);
    const sc = useGame.getState().scene!;
    const c = buildApi().visibleCount() as { visible: number; explored: number; total: number };
    expect(c.total).toBe(sc.dimensions.w * sc.dimensions.h * sc.layers.length);
    expect(c.visible).toBeGreaterThan(0);
    expect(c.visible).toBeLessThan(c.total);
    expect(c.explored).toBe((useGame.getState().explored[sc.id] ?? []).length);
  });

  it('walls() décompte par structure ; walls(id) rend les arêtes de CETTE structure', () => {
    buildApi().scenario('ecuries-clayonnage', 7);
    const sc = useGame.getState().scene!;
    const parStructure = buildApi().walls() as Record<string, number>;
    expect(Object.values(parStructure).reduce((a, b) => a + b, 0)).toBe(sc.walls!.length);
    const clayonnage = buildApi().walls('cloture-en-clayonnage') as { x: number; y: number; side: string; structure: string }[];
    expect(clayonnage.length).toBe(parStructure['cloture-en-clayonnage']);
    expect(clayonnage.every((w) => w.structure === 'cloture-en-clayonnage')).toBe(true);
    // La séparation de box des écuries que la recette vise (aucune fenêtre, aucune porte).
    expect(clayonnage).toContainEqual(expect.objectContaining({ x: 23, y: 30, side: 'E', window: false, door: false }));
  });

  it('`closed` rend l’état VIVANT d’une porte (flags de scène), jamais son seul champ authoré', () => {
    buildApi().scenario('ecuries-clayonnage', 7);
    const portes = () => buildApi().walls('solide-porte-en-bois') as { x: number; y: number; side: 'N' | 'E'; closed: boolean }[];
    const p = portes()[0];
    expect(p.closed).toBe(false);
    useGame.setState((s) => ({ scene: setDoorOpen(s.scene!, p.x, p.y, p.side, 0, false) }));
    const relue = portes().find((q) => q.x === p.x && q.y === p.y && q.side === p.side)!;
    expect(relue.closed).toBe(true);
  });
});

describe('__wfrp.ready — la PROSE du refus est composée ICI (#1478)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signalerEntreeEnScene(null, false); // état de module de `entreeEnScene` : remis à neuf
    useGame.setState({ scene: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    signalerEntreeEnScene(null, false);
  });

  it('aucun monde signalé : le rejet porte le texte FR de la console de recette', async () => {
    const verdict = buildApi().ready(800).then(() => 'résolu', (e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await verdict).toBe(
      '✗ __wfrp.ready : aucun monde monté après 800 ms — aucune scène volumique n\'a signalé son entrée en scène',
    );
  });

  it('monde monté, voile tombé : le ✓ nomme la scène', async () => {
    useGame.setState({ scene: { ...emptyScene(4, 4), id: 'opera-plan' } });
    const p = buildApi().ready(800);
    await vi.advanceTimersByTimeAsync(0);
    signalerEntreeEnScene('opera-plan', false);
    expect(await p).toContain('✓ monde prêt — scène « opera-plan »');
  });
});

describe('__wfrp.ascii — le PLAN de la couche, ses trois légendes et son relief (#1789)', () => {
  /** Scène la plus riche du dépôt : deux couches, murs à apparence, relief (scène +1 m, fosse −1 m). */
  const opera = () => {
    const sc = buildOperaFloorplan();
    useGame.setState({ scene: sc });
    return sc;
  };
  const sortie = (z: number) => buildApi().ascii(z) as string;
  /** La liste `ch = valeur` d'une légende imprimée, ou `[]` quand la ligne est absente. */
  const glyphesDe = (texte: string, titre: string): string[] => {
    const ligne = texte.split('\n').find((l) => l.startsWith(`${titre} : `));
    if (!ligne) return [];
    return ligne.slice(`${titre} : `.length).split(' · ').map((e) => e.split(' = ')[0]);
  };
  const grilleDeRelief = (texte: string): string[] => {
    const lignes = texte.split('\n');
    const i = lignes.indexOf('relief :');
    return i < 0 ? [] : lignes.slice(i + 1);
  };

  afterEach(() => useGame.setState({ scene: null }));

  it('aucun char n’est partagé entre la légende de CASES, celle d’ARÊTES et celle de ZONES', () => {
    const ex = sceneToAscii(opera());
    const espaces = { cases: Object.keys(ex.legend), arêtes: Object.keys(ex.wallLegend), zones: Object.keys(ex.zoneLegend) };
    // `-`/`|` sont les mots NUS de la grammaire : l'export les pose en légende d'arêtes quand toutes
    // les cloisons portent une apparence — ils ne sortent d'aucun allocateur et ne collisionnent rien.
    const alloues = (chars: string[]) => chars.filter((c) => !GLYPHES_RESERVES.has(c));
    for (const [a, b] of [['cases', 'arêtes'], ['cases', 'zones'], ['arêtes', 'zones']] as const) {
      const communs = alloues(espaces[a]).filter((c) => alloues(espaces[b]).includes(c));
      expect(communs, `chars servis À LA FOIS en légende ${a} et en légende ${b} : ${communs.join(', ')}`).toEqual([]);
    }
  });

  it('les trois légendes s’impriment, et la légende d’arêtes dit l’apparence/la structure', () => {
    const ex = sceneToAscii(opera());
    // z1 : c'est l'ÉTAGE qui porte les cloisons à apparence de l'Opéra (`wallLegend` non vide) — une
    // légende d'arêtes ne s'imprime que là où la couche écrit ses chars.
    const texte = sortie(1);
    expect(texte).toContain('légende : ');
    expect(glyphesDe(texte, 'légende arêtes'), 'aucune légende d’arêtes imprimée').not.toEqual([]);
    expect(texte, 'la légende d’arêtes ne dit pas ce que porte le char').toMatch(/légende arêtes : .+ = (appearance|structure)=/);
    expect(glyphesDe(texte, 'légende zones'), 'aucune légende de zones imprimée').not.toEqual([]);
    for (const ch of glyphesDe(texte, 'légende arêtes')) expect(Object.keys(ex.wallLegend)).toContain(ch);
    for (const ch of glyphesDe(texte, 'légende zones')) expect(Object.keys(ex.zoneLegend)).toContain(ch);
    // Le rez n'écrit AUCUN char de `wallLegend` : sa légende d'arêtes ne s'imprime pas du tout.
    expect(sortie(0), 'le rez imprime une légende d’arêtes dont il n’écrit aucun char').not.toContain('légende arêtes');
  });

  it('la légende de cases est RESTREINTE aux glyphes PRÉSENTS dans la grille de la couche demandée', () => {
    const sc = opera();
    for (const z of [0, 1]) {
      const texte = sortie(z);
      const lignes = texte.split('\n');
      const grille = lignes.slice(1, 1 + 2 * sc.dimensions.h + 1);
      const vus = new Set<string>();
      grille.forEach((l, ry) => { for (let rx = 0; rx < l.length; rx++) if (ry % 2 === 1 && rx % 2 === 1) vus.add(l[rx]); });
      for (const ch of glyphesDe(texte, 'légende').slice(1))
        expect(vus.has(ch), `z${z} : la légende liste « ${ch} », ABSENT de la grille de cette couche`).toBe(true);
    }
    const z0 = new Set(glyphesDe(sortie(0), 'légende'));
    const z1 = new Set(glyphesDe(sortie(1), 'légende'));
    expect([...z0].some((ch) => !z1.has(ch)), 'les deux couches listent exactement les mêmes glyphes : la restriction ne mesure rien').toBe(true);
  });

  it('le RELIEF est une GRILLE h×w alignée sur la carte, jamais une liste de tuples', () => {
    const sc = opera();
    for (const z of [0, 1]) {
      const texte = sortie(z);
      const grille = grilleDeRelief(texte);
      expect(grille.length, `z${z} : le relief n’a pas ${sc.dimensions.h} rangées`).toBe(sc.dimensions.h);
      for (const [y, rangee] of grille.entries())
        expect(rangee.trim().split(/ +/).length, `z${z} rangée ${y} : ${sc.dimensions.w} jetons attendus`).toBe(sc.dimensions.w);
    }
    expect(grilleDeRelief(sortie(0)).join('\n'), 'aucune hauteur signée dans le relief du rez').toMatch(/[+-]\d/);
  });

  it('une couche ABSENTE est refusée par un ✗ qui nomme les couches existantes', () => {
    opera();
    const texte = sortie(9);
    expect(texte).toContain('✗');
    expect(texte).toContain('z0');
    expect(texte).toContain('z1');
  });
});
