import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { captureMutation, applyMutation, type SceneMutation } from './sceneInstance';
import { emptyScene, doorIsOpen, setDoorOpen, type Scene, type WallSeg } from './scene';
import { useGame } from './store';
import { removeEntity } from './combatGeometry';
import { readSlot, saveToSlot, deleteSlot, type SaveGame } from './saves';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  } as Storage;
}

const DOOR_OPENED: WallSeg = { x: 1, y: 1, side: 'N', door: true, closed: true };
const DOOR_UNTOUCHED: WallSeg = { x: 3, y: 3, side: 'N', door: true, closed: true };

function fixtureScene(id: string): Scene {
  const s = emptyScene(6, 6);
  s.id = id;
  s.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
  s.entities.push({ id: 'decor-untouche', kind: 'prop', pos: { x: 2, y: 0 } });
  s.entities.push({ id: 'decor-retire', kind: 'prop', pos: { x: 3, y: 0 } });
  s.walls = [DOOR_OPENED, DOOR_UNTOUCHED];
  return s;
}

describe('sceneInstance — helpers PURS (#707)', () => {
  it('captureMutation détecte une entité retirée', () => {
    const authored = fixtureScene('s1');
    const current: Scene = { ...authored, entities: authored.entities.filter((e) => e.id !== 'decor-retire') };
    const mut = captureMutation(current, authored);
    expect(mut).toEqual<SceneMutation>({ removedEntityIds: ['decor-retire'], flags: {} });
  });

  it('captureMutation détecte un flag de porte changé', () => {
    const authored = fixtureScene('s2');
    const current = setDoorOpen(authored, 1, 1, 'N', 0, true);
    const mut = captureMutation(current, authored);
    expect(mut).toEqual<SceneMutation>({ removedEntityIds: [], flags: { __door_1_1_N_0: true } });
  });

  it('captureMutation ignore un flag authored INCHANGÉ', () => {
    const authored = fixtureScene('s3');
    const current: Scene = { ...authored, flags: { ...authored.flags } };
    const mut = captureMutation(current, authored);
    expect(mut).toBeUndefined();
  });

  it('captureMutation renvoie undefined si rien n’a changé', () => {
    const authored = fixtureScene('s4');
    const mut = captureMutation(authored, authored);
    expect(mut).toBeUndefined();
  });

  it('applyMutation filtre les entités retirées et fusionne les flags delta', () => {
    const cloned = fixtureScene('s5');
    const mut: SceneMutation = { removedEntityIds: ['decor-retire'], flags: { __door_1_1_N_0: true } };
    const out = applyMutation(cloned, mut);
    expect(out.entities.map((e) => e.id)).not.toContain('decor-retire');
    expect(out.entities.map((e) => e.id)).toContain('decor-untouche');
    expect(out.flags.__door_1_1_N_0).toBe(true);
  });

  it('applyMutation est un no-op si mutation absente', () => {
    const cloned = fixtureScene('s6');
    const out = applyMutation(cloned, undefined);
    expect(out).toBe(cloned);
  });
});

function hero() {
  return ({
    id: 'h1', name: 'Testeur', race: 'humain', career: 'soldat', careerLevel: 1,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], movement: 4,
  }) as unknown as import('../engine/types').Combatant;
}

beforeEach(() => {
  useGame.setState({ party: [], scene: null, sceneInstances: {} });
});

describe('sceneInstance — câblage store, REVISIT (#707)', () => {
  it('une entité retirée et une porte ouverte SURVIVENT au revisit ; le décor/porte non touché reste intact', () => {
    useGame.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-a');
    const sceneB = fixtureScene('scene-b');
    useGame.getState().loadProject([sceneA, sceneB], 'scene-a', undefined);

    removeEntity(useGame.getState, useGame.setState, 'decor-retire');
    useGame.setState((s) => ({ scene: setDoorOpen(s.scene!, 1, 1, 'N', 0, true) }));
    expect(useGame.getState().scene!.entities.map((e) => e.id)).not.toContain('decor-retire');
    expect(doorIsOpen(useGame.getState().scene!, DOOR_OPENED)).toBe(true);

    useGame.getState().transitionTo('scene-b');
    expect(useGame.getState().scene?.id).toBe('scene-b');
    expect(useGame.getState().sceneInstances['scene-a']).toEqual<SceneMutation>({
      removedEntityIds: ['decor-retire'],
      flags: { __door_1_1_N_0: true },
    });

    useGame.getState().transitionTo('scene-a');
    const back = useGame.getState().scene!;
    expect(back.id).toBe('scene-a');
    expect(back.entities.map((e) => e.id)).not.toContain('decor-retire'); // ressuscité si régression
    expect(back.entities.map((e) => e.id)).toContain('decor-untouche');
    expect(doorIsOpen(back, DOOR_OPENED)).toBe(true); // referme si régression
    expect(doorIsOpen(back, DOOR_UNTOUCHED)).toBe(false); // porte jamais touchée : reste authored
  });

  it('une scène jamais mutée : sceneInstances reste vide, le revisit ne change rien', () => {
    useGame.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-c');
    const sceneB = fixtureScene('scene-d');
    useGame.getState().loadProject([sceneA, sceneB], 'scene-c', undefined);
    useGame.getState().transitionTo('scene-d');
    useGame.getState().transitionTo('scene-c');
    expect(useGame.getState().sceneInstances).toEqual({});
    const back = useGame.getState().scene!;
    expect(back.entities.map((e) => e.id).sort()).toEqual(['decor-retire', 'decor-untouche', 'hs']);
    expect(doorIsOpen(back, DOOR_OPENED)).toBe(false);
  });

  it('nouvelle partie (startScene) REMET sceneInstances à vide', () => {
    useGame.setState({ party: [hero()] });
    const sceneA = fixtureScene('scene-e');
    useGame.getState().loadProject([sceneA], 'scene-e', undefined);
    removeEntity(useGame.getState, useGame.setState, 'decor-retire');
    useGame.getState().transitionTo('scene-e'); // capture (même scène, revisit immédiat)
    expect(Object.keys(useGame.getState().sceneInstances)).toHaveLength(1);
    useGame.getState().startScene(fixtureScene('scene-f'));
    expect(useGame.getState().sceneInstances).toEqual({});
  });

  // RÈGLE : à l'entrée en scène, l'assise se NORMALISE — ne survit que la place dont le meuble est
  // posé, la place déclarée au catalogue, et le corps disponible.
  it('transitionTo : l’assise AUTHORÉE d’un héros hors groupe est élaguée à l’entrée en scène', () => {
    useGame.setState({ party: [hero()] });
    const a = fixtureScene('scene-t1');
    const b = fixtureScene('scene-t2');
    b.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'N' });
    b.entities.push({ id: 'attable', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 } }); // abord NORD
    b.seatAssignments = {
      'table-1': { 'place-1': { kind: 'entity', entityId: 'attable' }, 'place-3': { kind: 'party', rang: 4 } },
    };
    useGame.getState().loadProject([a, b], 'scene-t1', undefined);
    useGame.getState().transitionTo('scene-t2');
    // Le PNJ authoré reste assis ; le héros qui n'est pas du groupe ne réserve rien.
    expect(useGame.getState().scene!.seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'entity', entityId: 'attable' } } });
  });

  describe('save/load RÉEL (applyLoadedSave, #707)', () => {
    beforeEach(() => {
      (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
      deleteSlot(1);
    });
    afterEach(() => { deleteSlot(1); });

    it('l’entité retirée et la porte ouverte survivent à un vrai saveGame → loadGame → revisit', () => {
      useGame.setState({ party: [hero()] });
      const sceneA = fixtureScene('scene-g');
      const sceneB = fixtureScene('scene-h');
      useGame.getState().loadProject([sceneA, sceneB], 'scene-g', undefined);
      removeEntity(useGame.getState, useGame.setState, 'decor-retire');
      useGame.getState().transitionTo('scene-h', undefined, { x: 0, y: 0 }); // capture scene-g avant sauvegarde d'une AUTRE scène
      expect(useGame.getState().saveGame(1)).toBe(true);

      useGame.setState({ sceneInstances: {} }); // « nouvelle partie » — état écrasé avant le chargement
      expect(useGame.getState().sceneInstances).toEqual({});
      expect(useGame.getState().loadGame(1)).toBe(true);
      expect(useGame.getState().sceneInstances['scene-g']).toEqual<SceneMutation>({ removedEntityIds: ['decor-retire'], flags: {} });

      useGame.getState().transitionTo('scene-g');
      expect(useGame.getState().scene!.entities.map((e) => e.id)).not.toContain('decor-retire');
    });

    // MÊME RÈGLE au CHARGEMENT : une save dont l'assise ment (meuble disparu, place inconnue, héros
    // hors groupe) arrive normalisée, jamais telle quelle.
    it('une save v28 portant une place INVALIDE arrive ÉLAGUÉE en état', () => {
      useGame.setState({ party: [hero()] });
      const s = fixtureScene('scene-assise');
      s.entities.push({ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'N' });
      s.entities.push({ id: 'attable', kind: 'personnage', ref: 'humain', pos: { x: 2, y: 2 } }); // abord NORD de la table
      useGame.getState().loadProject([s], 'scene-assise', undefined);
      useGame.setState((st) => ({ scene: { ...st.scene!, seatAssignments: { 'table-1': { 'place-1': { kind: 'entity', entityId: 'attable' } } } } }));
      expect(useGame.getState().saveGame(1)).toBe(true);

      // La save est trafiquée à la VERSION COURANTE : meuble disparu, héros hors groupe, slot inconnu
      // — exactement ce qu'un paquet de campagne réédité ou un groupe recomposé produit.
      const brut = readSlot(1)!;
      const data = brut.data as { scene: Scene };
      data.scene.seatAssignments = {
        'table-1': { 'place-1': { kind: 'entity', entityId: 'attable' }, plafond: { kind: 'entity', entityId: 'attable' } },
        'meuble-disparu': { 'place-1': { kind: 'entity', entityId: 'attable' } },
        'table-2': { 'place-1': { kind: 'party', rang: 4 } },
      };
      saveToSlot(1, brut);

      expect(useGame.getState().loadGame(1)).toBe(true);
      expect(useGame.getState().scene!.seatAssignments).toEqual({ 'table-1': { 'place-1': { kind: 'entity', entityId: 'attable' } } });
    });

    it('tolérance PAR CONSTRUCTION : clé « sceneInstances » absente du snapshot → valeur initiale ({}) au chargement', () => {
      useGame.setState({ party: [hero()] });
      const sceneA = fixtureScene('scene-i');
      useGame.getState().loadProject([sceneA], 'scene-i', undefined);
      expect(useGame.getState().saveGame(1)).toBe(true);
      const withField = readSlot(1)!;
      const dataSans = { ...withField.data } as Record<string, unknown>;
      delete dataSans.sceneInstances;
      // Save écrite à la version COURANTE, clé `sceneInstances` RETIRÉE : filet n°1 de la politique de
      // version (champ manquant → `initialFields`), pas une save d'une autre version.
      saveToSlot(1, { ...withField, data: dataSans } as unknown as SaveGame);
      expect(useGame.getState().loadGame(1)).toBe(true);
      expect(useGame.getState().sceneInstances).toEqual({});
    });
  });
});
