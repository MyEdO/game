import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  autosaveLoad,
  autosaveSave,
  autosaveDelete,
  __resetAutosaveForTest,
  type EditorAutosaveRecord,
  type RepriseLocale,
  upgradeAutosave,
} from './editorAutosave';
import { __setOuvertureIdbForTest } from '../lib/indexedDb';
import { baseSimulee, brancherBasesSimulees, type BasesSimulees } from '../lib/indexedDb.testkit';
import { cheminLisible } from '../data/schemas/validate';
import { emptyScene, type Scene } from './scene';
import { CURRENT_PROJECT_SCHEMA } from './worldMap';
import { editEntity } from './sceneEdit';
import { findSpeciesById } from '../data';

/** La scène d’une reprise relue — l’enregistrement monté au format courant, donc repris. */
const repris = async (sceneId: string) => {
  const lu = await autosaveLoad(sceneId);
  if (!lu?.ok) throw new Error(`reprise attendue pour « ${sceneId} »`);
  return lu.record;
};

const NOM = 'wfrp4-editor-autosave';
let bases: BasesSimulees;
/** Le magasin `autosave` de la base simulée, amorcée à sa version courante. */
const sauvegardes = () => bases.contenu(NOM, 'autosave');

beforeEach(() => {
  bases = brancherBasesSimulees();
  bases.amorcer(NOM, 1, { autosave: { keyPath: 'sceneId' } });
});
afterEach(() => __setOuvertureIdbForTest(null));

describe('editorAutosave — filet local de crash de l’éditeur', () => {
  beforeEach(async () => {
    await __resetAutosaveForTest();
  });

  it('aller-retour : sauvegarde puis relecture de la MÊME scène (round-trip)', async () => {
    const scene = { ...emptyScene(), id: 'scene-a', label: 'Auberge' };
    await autosaveSave({ sceneId: scene.id, scene, savedAt: 123 });
    const rec = await repris('scene-a');
    expect(rec.scene.label).toBe('Auberge');
    expect(rec.savedAt).toBe(123);
  });

  it('ré-enregistrer la même scène écrase la version précédente (upsert par id)', async () => {
    const scene = { ...emptyScene(), id: 'scene-a' };
    await autosaveSave({ sceneId: scene.id, scene: { ...scene, label: 'v1' }, savedAt: 1 });
    await autosaveSave({ sceneId: scene.id, scene: { ...scene, label: 'v2' }, savedAt: 2 });
    expect(sauvegardes().size).toBe(1);
    expect((await repris('scene-a')).scene.label).toBe('v2');
  });

  it('autosaveDelete retire la sauvegarde — plus rien à relire ensuite', async () => {
    const scene = { ...emptyScene(), id: 'scene-a' };
    await autosaveSave({ sceneId: scene.id, scene, savedAt: 1 });
    await autosaveDelete('scene-a');
    expect(await autosaveLoad('scene-a')).toBeNull();
  });

  it('scènes distinctes = entrées distinctes (keyé par sceneId, jamais un slot unique)', async () => {
    await autosaveSave({ sceneId: 'scene-a', scene: { ...emptyScene(), id: 'scene-a', label: 'A' }, savedAt: 1 });
    await autosaveSave({ sceneId: 'scene-b', scene: { ...emptyScene(), id: 'scene-b', label: 'B' }, savedAt: 1 });
    expect((await repris('scene-a')).scene.label).toBe('A');
    expect((await repris('scene-b')).scene.label).toBe('B');
  });

  it('lecture/écriture best-effort : une base dont toute requête échoue ne fait jamais throw', async () => {
    bases.base(NOM).panne = () => new DOMException('boom', 'UnknownError');
    await expect(autosaveSave({ sceneId: 'x', scene: emptyScene(), savedAt: 1 })).resolves.toBeUndefined();
    await expect(autosaveLoad('x')).resolves.toBeNull();
    await expect(autosaveDelete('x')).resolves.toBeUndefined();
  });

  describe('la scène relue passe par le SCHÉMA de scène avant la reprise', () => {
    /** Le refus d'une relecture ÉCARTÉE, en `lieu : message` par faute. */
    const fautesLues = (lu: RepriseLocale | null) => (lu && !lu.ok ? lu.refus.fautes.map((f) => `${cheminLisible(f.lieu)} : ${f.message}`) : null);
    /** Ce que rend la relecture d'une scène au format COURANT portant `scene`. */
    const relu = async (scene: object) => {
      sauvegardes().set('s', { sceneId: 's', scene: { ...emptyScene(), id: 's', ...scene }, schema: CURRENT_PROJECT_SCHEMA, savedAt: 7 });
      return autosaveLoad('s');
    };

    it('un champ inconnu du schéma de scène : ÉCARTÉ, la faute nommée', async () => {
      expect(fautesLues(await relu({ champInconnu: 1 }))).toEqual(['(racine) : Clé non reconnue : "champInconnu"']);
    });

    it('une forme que le normaliseur ne sait pas lire : ÉCARTÉE par le schéma, jamais une exception', async () => {
      expect(fautesLues(await relu({ entities: 5 }))).toEqual(['entities : Entrée invalide : tableau attendu, nombre reçu']);
    });

    it('un `presetId` sans narratif à qui le résoudre : REPRIS, la FK reste à la porte du projet', async () => {
      const lu = await relu({ entities: [{ id: 'e1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'fantome' }] });
      expect(lu?.ok && lu.record.scene.entities[0].presetId).toBe('fantome');
    });
  });
});

describe('upgradeAutosave — montée de `wfrp4-editor-autosave`', () => {
  it('base neuve : crée `autosave` keyé sceneId', () => {
    const base = baseSimulee();
    upgradeAutosave(base.db, 0);
    expect([...base.magasins.keys()]).toEqual(['autosave']);
    expect(base.magasins.get('autosave')?.keyPath).toBe('sceneId');
  });

  it('une base neuve monte puis passe sauvegarde, reprise, suppression', async () => {
    bases = brancherBasesSimulees();
    const base = bases.base(NOM);
    await autosaveSave({ sceneId: 's1', scene: { ...emptyScene(), id: 's1' }, savedAt: 5 });
    expect((await repris('s1')).savedAt).toBe(5);
    await autosaveDelete('s1');
    expect(await autosaveLoad('s1')).toBeNull();
    expect(base.fermetures).toBe(base.transactions.length);
  });
});

describe('editorAutosave — la lecture traverse la chaîne de migrations CANONIQUE (#1882)', () => {
  beforeEach(async () => {
    await __resetAutosaveForTest();
  });

  it('l’écriture porte le schéma courant', async () => {
    await autosaveSave({ sceneId: 's', scene: { ...emptyScene(), id: 's' }, savedAt: 1 });
    expect((sauvegardes().get('s') as EditorAutosaveRecord).schema).toBe(CURRENT_PROJECT_SCHEMA);
  });

  it('un autosave au format 12 est restauré TYPÉ par la migration, et un patch de cap passe', async () => {
    const ancienne = { ...emptyScene(), id: 's12', entities: [{ id: 'villageois', kind: 'personnage', pos: { x: 0, y: 0 }, appearance: { species: 'humains-reiklander' } }] };
    sauvegardes().set('s12', { sceneId: 's12', scene: ancienne as Scene, savedAt: 1, schema: 12 });
    const scene = (await repris('s12')).scene;
    expect(scene.entities[0].ref).toBe(findSpeciesById('humains-reiklander')!.profilStandard!.id);
    expect(editEntity(scene, 'villageois', { facing: 'E' }).entities[0].facing).toBe('E');
  });
});
