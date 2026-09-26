import { describe, it, expect, beforeEach } from 'vitest';
import {
  autosaveLoad,
  autosaveSave,
  autosaveDelete,
  __setAutosaveBackendForTest,
  __resetAutosaveForTest,
  type EditorAutosaveBackend,
  type EditorAutosaveRecord,
} from './editorAutosave';
import { emptyScene, type Scene } from './scene';
import { CURRENT_PROJECT_SCHEMA } from './worldMap';
import { editEntity } from './sceneEdit';
import { findSpeciesById } from '../data';

/** Backend en mémoire pour les tests — même contrat que `EditorAutosaveBackend` (cf. `projectLibrary.test.ts`). */
function fakeBackend(): EditorAutosaveBackend & { store: Map<string, EditorAutosaveRecord> } {
  const store = new Map<string, EditorAutosaveRecord>();
  return {
    store,
    async get(sceneId) {
      return store.get(sceneId) ?? null;
    },
    async put(entry) {
      store.set(entry.sceneId, entry);
    },
    async delete(sceneId) {
      store.delete(sceneId);
    },
    async clear() {
      store.clear();
    },
  };
}

describe('editorAutosave — filet local de crash de l’éditeur', () => {
  beforeEach(async () => {
    await __resetAutosaveForTest();
  });

  it('aller-retour : sauvegarde puis relecture de la MÊME scène (round-trip)', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const scene = { ...emptyScene(), id: 'scene-a', label: 'Auberge' };
    await autosaveSave({ sceneId: scene.id, scene, savedAt: 123 });
    const rec = (await autosaveLoad('scene-a')) as EditorAutosaveRecord | null;
    expect(rec).not.toBeNull();
    expect(rec!.scene.label).toBe('Auberge');
    expect(rec!.savedAt).toBe(123);
    __setAutosaveBackendForTest(null);
  });

  it('ré-enregistrer la même scène écrase la version précédente (upsert par id)', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const scene = { ...emptyScene(), id: 'scene-a' };
    await autosaveSave({ sceneId: scene.id, scene: { ...scene, label: 'v1' }, savedAt: 1 });
    await autosaveSave({ sceneId: scene.id, scene: { ...scene, label: 'v2' }, savedAt: 2 });
    expect(backend.store.size).toBe(1);
    const rec = (await autosaveLoad('scene-a')) as EditorAutosaveRecord | null;
    expect(rec!.scene.label).toBe('v2');
    __setAutosaveBackendForTest(null);
  });

  it('autosaveDelete retire la sauvegarde — plus rien à relire ensuite', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const scene = { ...emptyScene(), id: 'scene-a' };
    await autosaveSave({ sceneId: scene.id, scene, savedAt: 1 });
    await autosaveDelete('scene-a');
    expect(await autosaveLoad('scene-a')).toBeNull();
    __setAutosaveBackendForTest(null);
  });

  it('scènes distinctes = entrées distinctes (keyé par sceneId, jamais un slot unique)', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    await autosaveSave({ sceneId: 'scene-a', scene: { ...emptyScene(), id: 'scene-a', label: 'A' }, savedAt: 1 });
    await autosaveSave({ sceneId: 'scene-b', scene: { ...emptyScene(), id: 'scene-b', label: 'B' }, savedAt: 1 });
    expect(((await autosaveLoad('scene-a')) as EditorAutosaveRecord).scene.label).toBe('A');
    expect(((await autosaveLoad('scene-b')) as EditorAutosaveRecord).scene.label).toBe('B');
    __setAutosaveBackendForTest(null);
  });

  it('lecture/écriture best-effort : un backend qui rejette ne fait jamais throw', async () => {
    const failing: EditorAutosaveBackend = {
      get: async () => { throw new Error('boom'); },
      put: async () => { throw new Error('boom'); },
      delete: async () => { throw new Error('boom'); },
      clear: async () => { throw new Error('boom'); },
    };
    __setAutosaveBackendForTest(failing);
    await expect(autosaveSave({ sceneId: 'x', scene: emptyScene(), savedAt: 1 })).resolves.toBeUndefined();
    await expect(autosaveLoad('x')).resolves.toBeNull();
    await expect(autosaveDelete('x')).resolves.toBeUndefined();
    __setAutosaveBackendForTest(null);
  });
});

describe('editorAutosave — la lecture traverse la chaîne de migrations CANONIQUE (#1882)', () => {
  beforeEach(async () => {
    await __resetAutosaveForTest();
  });

  it('l’écriture porte le schéma courant', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    await autosaveSave({ sceneId: 's', scene: { ...emptyScene(), id: 's' }, savedAt: 1 });
    expect(backend.store.get('s')!.schema).toBe(CURRENT_PROJECT_SCHEMA);
    __setAutosaveBackendForTest(null);
  });

  it('un autosave au format 12 est restauré TYPÉ par la migration, et un patch de cap passe', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const ancienne = { ...emptyScene(), id: 's12', entities: [{ id: 'villageois', kind: 'personnage', pos: { x: 0, y: 0 }, appearance: { species: 'humains-reiklander' } }] };
    backend.store.set('s12', { sceneId: 's12', scene: ancienne as Scene, savedAt: 1, schema: 12 });
    const lu = await autosaveLoad('s12');
    expect(lu && 'scene' in lu).toBe(true);
    const scene = (lu as EditorAutosaveRecord).scene;
    expect(scene.entities[0].ref).toBe(findSpeciesById('humains-reiklander')!.profilStandard!.id);
    expect(editEntity(scene, 'villageois', { facing: 'E' }).entities[0].facing).toBe('E');
    __setAutosaveBackendForTest(null);
  });

  it('un autosave SANS version est ÉCARTÉ : retiré du magasin, la raison dite', async () => {
    const backend = fakeBackend();
    __setAutosaveBackendForTest(backend);
    const { schema: _sans, ...sansVersion } = { sceneId: 'sv', scene: { ...emptyScene(), id: 'sv' }, savedAt: 1, schema: 0 };
    backend.store.set('sv', sansVersion);
    const lu = await autosaveLoad('sv');
    expect(lu).toMatchObject({ sceneId: 'sv', ecartee: expect.stringContaining('schema') });
    expect(backend.store.has('sv')).toBe(false);
    __setAutosaveBackendForTest(null);
  });
});
