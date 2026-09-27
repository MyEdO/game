import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  projectsLoad,
  projectSave,
  projectRemove,
  publishedProjects,
  initLibrary,
  __resetLibraryForTest,
  __setIdbBackendForTest,
  IdbBackend,
  SavedProject,
  documentDeLEntree,
  campagneDeLEntree,
  playerEntryError,
  upgradeBibliotheque,
} from './projectLibrary';
import { __setOuvertureIdbForTest } from '../lib/indexedDb';
import { baseSimulee } from '../lib/indexedDb.testkit';
import { Scene, emptyScene } from './scene';
import { parseProject, CURRENT_PROJECT_SCHEMA, ProjetRefuse } from './worldMap';
import { allBuiltinCampaigns } from '../scenes/campaign';
import { allAxes } from '../data';

const KEY = 'wfrp4.editor-projects.v1';
const TOMBSTONE_KEY = 'wfrp4.editor-projects.tombstones.v1';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). `failSetItem` :
 *  clés dont `setItem` doit rejeter (simulation de quota dépassé/accès refusé CIBLÉE sur une clé). */
function fakeStorage(opts: { failSetItem?: Set<string> } = {}): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (opts.failSetItem?.has(k)) throw new Error(`setItem refusé (${k})`);
      m.set(k, String(v));
    },
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

/** Backend IndexedDB en mémoire pour les tests — même contrat que `IdbBackend` (#776 pt.4), sans
 *  reproduire l'API IndexedDB. `fail.put`/`fail.delete` : ids dont l'écriture doit rejeter — des
 *  `Set` mutables, pour simuler une panne qui se résorbe entre deux appels (reprise au reload). */
function fakeIdbBackend(fail: { put?: Set<string>; delete?: Set<string> } = {}): IdbBackend & { store: Map<string, SavedProject> } {
  const store = new Map<string, SavedProject>();
  return {
    store,
    async getAll() {
      return [...store.values()];
    },
    async put(entry: SavedProject) {
      if (fail.put?.has(entry.id)) throw new Error(`put refusé (${entry.id})`);
      store.set(entry.id, entry);
    },
    async delete(id: string) {
      if (fail.delete?.has(id)) throw new Error(`delete refusé (${id})`);
      store.delete(id);
    },
    async clear() {
      store.clear();
    },
  };
}

const scene = (id: string): Scene => ({ id, nom: id }) as unknown as Scene;
const proj = (id: string, label = 'Projet', published = false): SavedProject => ({
  id,
  label,
  startSceneId: 's1',
  savedAt: 1000,
  published,
  project: { schema: 2, scenes: [scene('s1')] },
});
/** Un projet dont la forme sérialisée dépasse largement la borne PAR PROJET du miroir localStorage
 *  (500 000 caractères) — sert à exercer le chemin « trop gros pour le miroir » sans dépendre d'un
 *  export du seuil interne. */
const bigProj = (id: string, label = 'Grosse campagne'): SavedProject => ({
  ...proj(id, label),
  project: {
    schema: 2,
    scenes: [scene(id)],
    meta: { desc: 'x'.repeat(600_000) },
  } as unknown as SavedProject['project'],
});

describe('projectLibrary — bibliothèque de projets éditeur (localStorage)', () => {
  beforeEach(async () => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    await __resetLibraryForTest(); // cache module-level : reparte propre (isolation)
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    __setIdbBackendForTest(null);
    __setOuvertureIdbForTest(null);
  });

  it('vide au départ', () => {
    expect(projectsLoad()).toEqual([]);
    expect(publishedProjects()).toEqual([]);
  });

  it('projectSave puis projectsLoad : le projet est retrouvé', async () => {
    await projectSave(proj('p1', 'La Diligence'));
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p1');
    expect(list[0].label).toBe('La Diligence');
    expect(list[0].project.scenes[0].id).toBe('s1');
  });

  it('projectSave avec le même id remplace (pas de doublon)', async () => {
    await projectSave(proj('p1', 'Avant'));
    await projectSave(proj('p1', 'Après'));
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Après');
  });

  it('projectRemove retire l’entrée visée et garde les autres', async () => {
    await projectSave(proj('p1'));
    await projectSave(proj('p2'));
    await projectRemove('p1');
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p2');
  });

  it('publishedProjects ne renvoie que les projets publiés', async () => {
    await projectSave(proj('p1', 'Brouillon', false));
    await projectSave(proj('p2', 'Publiée', true));
    const pub = publishedProjects();
    expect(pub).toHaveLength(1);
    expect(pub[0].id).toBe('p2');
  });

  it('stockage corrompu (JSON invalide ou pas un tableau) → []', () => {
    localStorage.setItem(KEY, '{pas du json');
    expect(projectsLoad()).toEqual([]);
    localStorage.setItem(KEY, '{"a":1}');
    expect(projectsLoad()).toEqual([]);
  });

  it('entrées invalides filtrées au chargement', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        null,
        42,
        { id: 'ok', name: 'X', startSceneId: 's1', savedAt: 1, published: false, project: { schema: 2, scenes: [{ id: 's1' }] } },
        { id: 'bad' }, // pas de project.scenes
      ]),
    );
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('ok');
  });

  it('repli IDEMPOTENT (#608) : une entrée legacy `name` (pré-renommage) migre en `label` à la '
    + 'lecture — sans casser un projet déjà enregistré', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'p1', name: 'Legacy', startSceneId: 's1', savedAt: 1, published: false, project: { schema: 2, scenes: [{ id: 's1' }] } },
      ]),
    );
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('Legacy');
    expect((list[0] as unknown as { name?: string }).name).toBeUndefined();
  });

  it('migration one-time : localStorage pré-peuplé + initLibrary() → cache le sert (repli sans IndexedDB en jsdom)', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'p1', label: 'Ancienne', startSceneId: 's1', savedAt: 1, published: true, project: { schema: 2, scenes: [{ id: 's1' }] } },
      ]),
    );
    await initLibrary();
    const list = projectsLoad();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p1');
    expect(list[0].label).toBe('Ancienne');
    expect(publishedProjects()).toHaveLength(1);
  });

  it('sans localStorage : load → [], save/remove résolvent sans jamais rejeter', async () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(projectsLoad()).toEqual([]);
    await expect(projectSave(proj('p1'))).resolves.toBeDefined();
    await expect(projectRemove('p1')).resolves.toBeDefined();
  });

  it('sans IndexedDB : un projet supprimé ne réapparaît dans AUCUNE des trois sorties de lecture (#776 pt.2)', async () => {
    await projectSave(proj('p1'));
    await projectRemove('p1');

    // Sortie 1 : `projectsLoad()` direct après le retrait (cache déjà à jour en mémoire).
    expect(projectsLoad()).toEqual([]);

    // Une copie CONCURRENTE du projet survit dans le miroir localStorage (écriture concurrente,
    // reload partiel…) — aucune des trois sorties ne doit la laisser ressusciter le projet supprimé.
    localStorage.setItem(KEY, JSON.stringify([proj('p1', 'Revenant')]));

    // Sortie 2 : `initLibrary()` SANS IndexedDB (`idbDisponible()` faux par défaut dans cet environnement
    // de test `node`) relit ce miroir directement.
    await initLibrary();
    expect(projectsLoad()).toEqual([]);

    // Sortie 3 : `initLibrary()` dont la branche IndexedDB ÉCHOUE (`getAll` rejette) retombe sur son
    // `catch`, qui relit aussi ce même miroir.
    __setIdbBackendForTest({
      async getAll() { throw new Error('getAll refusé'); },
      async put() { /* non exercé ici */ },
      async delete() { /* non exercé ici */ },
      async clear() { /* non exercé ici */ },
    });
    await initLibrary();
    expect(projectsLoad()).toEqual([]);
    __setIdbBackendForTest(null);
  });

  describe('miroir localStorage borné PAR PROJET (#776 lot correctif — LOCAL_MIRROR_ENTRY_LIMIT)', () => {
    it('un projet volumineux est écarté du miroir SANS priver les petits projets de leur filet', async () => {
      await projectSave(proj('small', 'Petit'));
      await projectSave(bigProj('big'));
      const mirrored = JSON.parse(localStorage.getItem(KEY)!) as SavedProject[];
      expect(mirrored.map((e) => e.id)).toEqual(['small']);
      // le cache sert quand même les deux (IndexedDB/cache mémoire, pas seulement le miroir).
      expect(projectsLoad().map((e) => e.id).sort()).toEqual(['big', 'small']);
    });

    it('le chemin de perte RÉEL : IndexedDB en échec ET projet trop gros pour le miroir → échec signalé', async () => {
      const idb = fakeIdbBackend({ put: new Set(['big']) });
      __setIdbBackendForTest(idb);
      const res = await projectSave(bigProj('big'));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message.length).toBeGreaterThan(0);
      const mirrored = localStorage.getItem(KEY) ? JSON.parse(localStorage.getItem(KEY)!) as SavedProject[] : [];
      expect(mirrored.some((e) => e.id === 'big')).toBe(false); // ni IndexedDB ni miroir : perte réelle
    });

    it('stockage local INDISPONIBLE (pas juste une entrée trop grosse) → message distinct, sans conseil « allégez la campagne » (#776 pt.4)', async () => {
      delete (globalThis as { localStorage?: Storage }).localStorage;
      const idb = fakeIdbBackend({ put: new Set(['small']) });
      __setIdbBackendForTest(idb);
      const res = await projectSave(proj('small', 'Petit')); // PAS un `bigProj` : le stockage est absent, pas l'entrée trop grosse
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message.toLowerCase()).not.toMatch(/volumineuse/);
    });

    it('un projet trop gros pour le miroir mais dont IndexedDB réussit n’est PAS signalé en échec (le filet IDB suffit) — la borne reste PAR PROJET, pas globale', async () => {
      __setIdbBackendForTest(fakeIdbBackend());
      await projectSave(proj('small', 'Petit'));
      const res = await projectSave(bigProj('big'));
      expect(res.ok).toBe(true);
      const mirrored = JSON.parse(localStorage.getItem(KEY)!) as SavedProject[];
      // la borne écarte CE projet volumineux du miroir (preuve que la borne par-entrée s'applique
      // bien ici, pas seulement quand IndexedDB échoue) sans emporter le petit projet avec lui.
      expect(mirrored.map((e) => e.id)).toEqual(['small']);
    });
  });

  describe('backend IndexedDB injecté (#776) — chemin de migration/réconciliation réellement exercé', () => {
    it('migration complète : localStorage peuplé + idb vide → initLibrary recopie tout dans idb', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Un'), proj('p2', 'Deux')]),
      );
      const idb = fakeIdbBackend();
      __setIdbBackendForTest(idb);
      await initLibrary();
      expect(projectsLoad().map((e) => e.id).sort()).toEqual(['p1', 'p2']);
      expect(idb.store.has('p1')).toBe(true);
      expect(idb.store.has('p2')).toBe(true);
    });

    it('migration PARTIELLE (p2 rejette) puis reprise au reload suivant', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Un'), proj('p2', 'Deux')]),
      );
      const failPut = new Set(['p2']);
      const idb = fakeIdbBackend({ put: failPut });
      __setIdbBackendForTest(idb);

      await initLibrary(); // p1 migré, p2 échoue
      expect(idb.store.has('p1')).toBe(true);
      expect(idb.store.has('p2')).toBe(false);
      expect(projectsLoad().map((e) => e.id).sort()).toEqual(['p1', 'p2']); // rien de perdu cette session

      // la panne se résorbe, et le prochain démarrage retente p2 sans dupliquer p1 (pas de flag figé
      // qui saute la reprise)
      failPut.delete('p2');
      await __resetLibraryForTest();
      (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Un'), proj('p2', 'Deux')]),
      );
      __setIdbBackendForTest(idb); // même backend idb, p1 déjà dedans
      await initLibrary();
      expect(idb.store.has('p2')).toBe(true); // reprise réussie cette fois
      expect(projectsLoad().map((e) => e.id).sort()).toEqual(['p1', 'p2']);
    });

    it('suppression respectée : un projet supprimé n’est jamais ressuscité par la réconciliation', async () => {
      const idb = fakeIdbBackend();
      __setIdbBackendForTest(idb);
      localStorage.setItem(KEY, JSON.stringify([proj('p1', 'Un')]));
      await initLibrary();
      expect(projectsLoad()).toHaveLength(1);

      await projectRemove('p1');
      expect(projectsLoad()).toEqual([]);
      expect(idb.store.has('p1')).toBe(false);

      // le miroir localStorage a suivi la suppression : un reload ne le voit plus, même si une copie
      // CONCURRENTE y traîne (écriture concurrente) — l'entrée de `TOMBSTONE_KEY` l'exclut de la migration.
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Un')]),
      );
      await initLibrary();
      expect(projectsLoad()).toEqual([]);
      expect(idb.store.has('p1')).toBe(false);
    });

    it('re-sauvegarder un projet supprimé lève sa tombe : `initLibrary` ne le fait pas disparaître (#776 pt.6)', async () => {
      const idb = fakeIdbBackend();
      __setIdbBackendForTest(idb);
      await projectSave(proj('p1', 'Un'));
      await projectRemove('p1');
      expect(projectsLoad()).toEqual([]);

      await projectSave(proj('p1', 'Ressuscité'));
      expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);

      // La levée de tombe (#776 pt.2 : « une sauvegarde explicite n'est jamais une résurrection
      // accidentelle ») est ce qui empêche `initLibrary` de re-filtrer ce même id au prochain boot.
      await initLibrary();
      expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);
    });

    it('une tombe disparaît une fois la suppression IndexedDB effectivement aboutie (#776 pt.4 : pas de croissance monotone)', async () => {
      const failDelete = new Set(['p1']);
      const idb = fakeIdbBackend({ delete: failDelete });
      idb.store.set('p1', proj('p1', 'Un'));
      __setIdbBackendForTest(idb);
      localStorage.setItem(KEY, JSON.stringify([proj('p1', 'Un')]));
      await initLibrary();

      await projectRemove('p1'); // idb.delete échoue : la tombe reste enregistrée
      expect(JSON.parse(localStorage.getItem(TOMBSTONE_KEY)!)).toEqual(['p1']);

      failDelete.delete('p1'); // la panne se résorbe
      await initLibrary(); // retente la suppression : réussit cette fois
      expect(idb.store.has('p1')).toBe(false);
      expect(JSON.parse(localStorage.getItem(TOMBSTONE_KEY) ?? '[]')).toEqual([]); // tombe purgée
    });

    it('échec d’écriture IndexedDB non silencieux : `projectSave` journalise l’échec (console.error)', async () => {
      const idb = fakeIdbBackend({ put: new Set(['p1']) });
      __setIdbBackendForTest(idb);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await projectSave(proj('p1', 'Un'));
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0][0])).toContain('Un');
      spy.mockRestore();
      // le projet reste servi malgré l'échec idb (miroir localStorage + cache).
      expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);
    });

    it('échec de suppression IndexedDB non silencieux : `projectRemove` journalise l’échec', async () => {
      const idb = fakeIdbBackend({ delete: new Set(['p1']) });
      idb.store.set('p1', proj('p1', 'Un'));
      __setIdbBackendForTest(idb);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await projectRemove('p1');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('échec d’écriture des tombes non silencieux : journalisé (console.error), comme put/delete', async () => {
      const idb = fakeIdbBackend({ delete: new Set(['p1']) });
      idb.store.set('p1', proj('p1', 'Un'));
      __setIdbBackendForTest(idb);
      localStorage.setItem(KEY, JSON.stringify([proj('p1', 'Un')]));
      await initLibrary();
      (globalThis as { localStorage?: Storage }).localStorage = fakeStorage({ failSetItem: new Set([TOMBSTONE_KEY]) });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await projectRemove('p1');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('résurrection empêchée même quand la tombe elle-même ne peut pas être écrite (secours en mémoire, #776 pt.2)', async () => {
      const failDelete = new Set(['p1']);
      const idb = fakeIdbBackend({ delete: failDelete });
      idb.store.set('p1', proj('p1', 'Un'));
      __setIdbBackendForTest(idb);
      localStorage.setItem(KEY, JSON.stringify([proj('p1', 'Un')]));
      await initLibrary();
      expect(projectsLoad()).toHaveLength(1);

      // la couche localStorage entière tombe en panne au moment de retirer : ni le miroir ni la
      // tombe ne peuvent être persistés.
      (globalThis as { localStorage?: Storage }).localStorage = fakeStorage({
        failSetItem: new Set([KEY, TOMBSTONE_KEY]),
      });
      const res = await projectRemove('p1');
      expect(res.ok).toBe(false); // la suppression risque de ne pas survivre à un vrai reload
      expect(projectsLoad()).toEqual([]); // mais reste retirée du cache pour cette session

      // « prochain démarrage » SANS reset de module (le seul filet possible ici est en mémoire) :
      // la réconciliation ne ressuscite PAS le projet malgré l'IDB delete toujours en échec.
      await initLibrary();
      expect(projectsLoad()).toEqual([]);
      expect(idb.store.has('p1')).toBe(true); // le delete réel a bien échoué à nouveau
    });

    it('open bloqué → repli localStorage : `initLibrary` sert quand même la bibliothèque', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Repli')]),
      );
      __setOuvertureIdbForTest(() => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => req.onblocked?.(new Event('blocked') as unknown as IDBVersionChangeEvent));
        return req;
      });
      await initLibrary();
      expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);
    });

    it('open jamais résolu (délai dépassé) → `initLibrary` retombe sur le repli localStorage sans jamais rester en attente', async () => {
      vi.useFakeTimers();
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Repli')]),
      );
      __setOuvertureIdbForTest(() => ({} as IDBOpenDBRequest)); // ne déclenche jamais aucun handler
      const pending = initLibrary();
      await vi.advanceTimersByTimeAsync(5000);
      await pending;
      expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);
      vi.useRealTimers();
    });
  });

  describe('__resetLibraryForTest — isolation complète (#776)', () => {
    it('purge aussi le miroir ET les tombes localStorage (pas seulement le cache mémoire/IndexedDB)', async () => {
      await projectSave(proj('p1'));
      await projectSave(proj('p2'));
      await projectRemove('p1');
      expect(localStorage.getItem(KEY)).not.toBeNull();
      expect(localStorage.getItem(TOMBSTONE_KEY)).not.toBeNull();

      await __resetLibraryForTest();
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(localStorage.getItem(TOMBSTONE_KEY)).toBeNull();
      expect(projectsLoad()).toEqual([]);
    });
  });
});

describe('documentDeLEntree — le document d’une entrée de bibliothèque, lu par UNE fonction (#1343)', () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };
  const scene = { ...emptyScene(4, 4), id: 'scene-a', label: 'Salle A' };

  it('entrée d’AVANT #1552 (document sans identité) : la porte accepte, avec l’id et le nom de l’entrée, version 0', () => {
    const { type: _muette, ...sceneMuette } = scene;
    const entree = {
      id: 'proj-ancien', label: 'Campagne d’avant', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { schema: 6, scenes: [sceneMuette as Scene], narratif },
    } as SavedProject;
    expect(() => parseProject(structuredClone(entree.project)), 'le document brut est refusé').toThrow(/id/);
    const doc = parseProject(documentDeLEntree(entree));
    expect(doc.id).toBe('proj-ancien');
    expect(doc.label).toBe('Campagne d’avant');
    expect(doc.versionContenu).toBe(0);
  });

  it('copie d’AVANT E5 au nom divergent : le nom de l’ENTRÉE prime, l’id et la version restent ceux du document', () => {
    const { scenes: _sc, startSceneId: _st, worldMap: _wm, narratif: _na, label: _lb, ...identiteDuPaquet } = allBuiltinCampaigns[0];
    const entree = {
      id: 'entree-copie', label: 'Mon nom', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { ...identiteDuPaquet, type: 'projet', schema: CURRENT_PROJECT_SCHEMA, label: 'Nom du paquet', versionContenu: 4, scenes: [scene], narratif },
    } as unknown as SavedProject;
    const doc = parseProject(documentDeLEntree(entree));
    expect(doc.label).toBe('Mon nom');
    expect(doc.id).toBe(allBuiltinCampaigns[0].id);
    expect(doc.versionContenu).toBe(4);
  });

  it('entrée au nom VIDE : le nom du document reste', () => {
    const entree = {
      id: 'e', label: '  ', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'doc-id', label: 'Nom du document', versionContenu: 1, maison: 'fixture de test', scenes: [scene], narratif },
    } as unknown as SavedProject;
    expect(parseProject(documentDeLEntree(entree)).label).toBe('Nom du document');
  });
});

describe('campagneDeLEntree — la campagne LANCÉE depuis une entrée, par la porte (#1343)', () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };
  const scene = { ...emptyScene(4, 4), id: 'scene-a', label: 'Salle A' };

  it('entrée d’un ANCIEN schéma : ses scènes sont MIGRÉES avant d’être posées', () => {
    const { type: _t, reliefDefaults: _r, ...sceneAncienne } = scene;
    const entree = {
      id: 'proj-ancien', label: 'Campagne d’avant', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { schema: 6, scenes: [sceneAncienne as Scene], narratif },
    } as SavedProject;
    const lancee = campagneDeLEntree(entree);
    expect(lancee.id).toBe('proj-ancien');
    expect(lancee.label).toBe('Campagne d’avant');
    expect(lancee.startSceneId).toBe('scene-a');
    expect(lancee.worldMap).toBeNull();
    expect(lancee.scenes[0].type).toBe('scene');
    expect(lancee.scenes[0].reliefDefaults).toBeDefined();
  });

  it('entrée FAUTIVE : la porte lève ProjetRefuse, jamais rattrapé ici', () => {
    const entree = {
      id: 'proj-fautif', label: 'Fautive', startSceneId: 'x', savedAt: 1, published: true,
      project: { schema: CURRENT_PROJECT_SCHEMA, scenes: [{ id: 'x' } as unknown as Scene], narratif },
    } as SavedProject;
    expect(() => campagneDeLEntree(entree)).toThrow(ProjetRefuse);
  });

  it('entrée dont la scène de départ n’est PAS une scène du document : ProjetRefuse de cause « entree », au chemin `startSceneId`', () => {
    const entree = {
      id: 'proj-depart', label: 'Départ perdu', startSceneId: 'scene-disparue', savedAt: 1, published: true,
      project: { type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj-depart', label: 'Départ perdu', versionContenu: 1, maison: 'fixture de test', scenes: [scene], narratif },
    } as unknown as SavedProject;
    let refus: unknown;
    try {
      campagneDeLEntree(entree);
    } catch (err) {
      refus = err;
    }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).cause).toBe('entree');
    expect((refus as ProjetRefuse).fautes.map((f) => f.chemin)).toEqual([['startSceneId']]);
    expect(campagneDeLEntree({ ...entree, startSceneId: 'scene-a' }).startSceneId, 'la même entrée, départ réparé, se lance').toBe('scene-a');
  });

  it('document aux `activeAxes` déclarés : la campagne lancée les porte (#409)', () => {
    const axes = allAxes.filter((a) => !a.core).map((a) => a.id);
    expect(axes.length, 'le registre porte des axes hors socle').toBeGreaterThan(0);
    const entree = {
      id: 'proj-axes', label: 'Campagne à axes', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj-axes', label: 'Campagne à axes', versionContenu: 1, maison: 'fixture de test', scenes: [scene], narratif, activeAxes: axes },
    } as unknown as SavedProject;
    expect(campagneDeLEntree(entree).activeAxes).toEqual(axes);
  });

  it('un bogue du JEU (hors `ProjetRefuse`) REMONTE tel quel, sans diagnostic de refus', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => playerEntryError(new TypeError('x'), 'jouer')).toThrow(TypeError);
    expect(consoleErr, 'aucun diagnostic de refus').not.toHaveBeenCalled();
  });

  it('un refus RÉEL de la porte devient le message générique du joueur, diagnostic journalisé', () => {
    const entree = {
      id: 'proj-fautif', label: 'Fautive', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: {
        type: 'projet', schema: CURRENT_PROJECT_SCHEMA, id: 'proj-fautif', label: 'Fautive', versionContenu: 1, maison: 'fixture de test',
        scenes: [{ ...scene, entities: [{ id: 'p0', kind: 'prop', pos: { x: 1, y: 1 }, label: 'Fantôme', ref: 'decor-inexistant' }] }],
        narratif,
      },
    } as unknown as SavedProject;
    let refus: unknown;
    try {
      campagneDeLEntree(entree);
    } catch (err) {
      refus = err;
    }
    expect(refus, 'la porte refuse le décor à `ref` inexistante').toBeInstanceOf(ProjetRefuse);
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(playerEntryError(refus, 'jouer')).toBe('Cette campagne ne peut pas être jouée en l’état. Demandez-en une nouvelle version à son auteur.');
    expect(playerEntryError(refus, 'exporter')).toBe('Cette campagne ne peut pas être exportée en l’état. Demandez-en une nouvelle version à son auteur.');
    expect(consoleErr).toHaveBeenCalledWith('Campagne de bibliothèque refusée :', (refus as ProjetRefuse).message);
  });
});

describe('upgradeBibliotheque — montée de `wfrp4-library`', () => {
  it('base neuve : crée `projects` keyé id', () => {
    const base = baseSimulee();
    upgradeBibliotheque(base.db, 0);
    expect([...base.magasins.keys()]).toEqual(['projects']);
    expect(base.magasins.get('projects')?.keyPath).toBe('id');
  });
});
