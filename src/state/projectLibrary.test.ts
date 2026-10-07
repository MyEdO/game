import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  projectsLoad,
  projectSave,
  projectRemove,
  publishedProjects,
  initLibrary,
  __resetLibraryForTest,
  SavedProject,
  campagneDeLEntree,
  playerEntryError,
  estRefusee,
  projetDeLEntree,
  savedProjectSchema,
} from './projectLibrary';
import { mesurerCheminsNommes } from '../../scripts/guards/lib/cheminsNommes.mts';
import { __setFabriqueIdbForTest } from '../lib/indexedDb';
import { brancherBasesSimulees, brancherOuvertures } from '../lib/indexedDb.testkit';
import { Scene, emptyScene } from './scene';
import { ProjetRefuse } from './worldMap';
import { allAxes } from '../data';
import { emptyNarratif } from './campaignNarratif';

const KEY = 'wfrp4.editor-projects';
const TOMBSTONE_KEY = 'wfrp4.editor-projects.tombstones';

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

const NOM = 'wfrp4-library';

/** Branche la bibliothèque IndexedDB sur une base simulée, et rend son magasin `projects`.
 *  `pannes.put`/`pannes.delete` : ids dont l'écriture échoue — des `Set` mutables, pour simuler une
 *  panne qui se résorbe entre deux appels (reprise au reload). */
function bibliothequeSimulee(pannes: { put?: Set<string>; delete?: Set<string> } = {}): { store: Map<unknown, unknown> } {
  const base = brancherBasesSimulees().amorcer(NOM, { projects: { keyPath: 'id' } });
  base.panne = (q) => {
    const id = q.geste === 'put' ? (q.valeur as SavedProject).id : String(q.cle);
    const echoue = (q.geste === 'put' && pannes.put?.has(id)) || (q.geste === 'delete' && pannes.delete?.has(id));
    return echoue ? new DOMException(`${q.geste} refusé (${id})`, 'UnknownError') : null;
  };
  return { store: base.magasins.get('projects')!.contenu };
}

const scene = (id: string): Scene => ({ id, nom: id }) as unknown as Scene;
const proj = (id: string, label = 'Projet', published = false): SavedProject => ({
  id,
  label,
  startSceneId: 's1',
  savedAt: 1000,
  published,
  project: { scenes: [scene('s1')] },
});
/** Un projet dont la forme sérialisée dépasse largement la borne PAR PROJET du miroir localStorage
 *  (500 000 caractères) — sert à exercer le chemin « trop gros pour le miroir » sans dépendre d'un
 *  export du seuil interne. */
const bigProj = (id: string, label = 'Grosse campagne'): SavedProject => ({
  ...proj(id, label),
  project: { scenes: [scene(id)], desc: 'x'.repeat(600_000) },
});

describe('projectLibrary — bibliothèque de projets éditeur (localStorage)', () => {
  it('nomme tous les champs des objets propriétaires de la bibliothèque', () => {
    const mesure = mesurerCheminsNommes([savedProjectSchema]);
    expect(mesure.objets).toBeGreaterThanOrEqual(2);
    expect(mesure.champs).toBeGreaterThanOrEqual(10);
    expect(mesure.fautes).toEqual([]);
  });
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    __setFabriqueIdbForTest(null);
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
    expect(list[0].project.scenes).toEqual([scene('s1')]);
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

  it('enveloppe refusée (`savedProjectSchema`) : listée REFUSÉE si un `id` la désigne, refus levé au geste ; sans `id`, journalisée (#2404)', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem(
      KEY,
      JSON.stringify([
        null,
        42,
        { id: 'ok', label: 'X', startSceneId: 's1', savedAt: 1, published: false, project: { scenes: [{ id: 's1' }] } },
        { id: 'bad' },
        { id: 'nom', name: 'Avant #608', startSceneId: 's1', savedAt: 1, published: true, project: { scenes: [] } },
      ]),
    );
    const list = projectsLoad();
    expect(consoleErr, 'une relecture journalise chaque enveloppe refusée').toHaveBeenCalledTimes(4);
    expect(list.map((e) => [e.id, e.refus === undefined])).toEqual([['ok', true], ['bad', false], ['nom', false]]);
    expect(publishedProjects().map((e) => e.id), 'le drapeau `published` du brut est lu').toEqual(['nom']);
    let refus: unknown;
    try {
      campagneDeLEntree(list[2]);
    } catch (err) {
      refus = err;
    }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).message).toMatch(/^Entrée de bibliothèque d’un autre format, ou mal formée — /);
    consoleErr.mockRestore();
  });

  describe('une entrée refusée n’est jamais retirée par une écriture voisine (#2404)', () => {
    const oeuvre = { id: 'oeuvre', label: 'Mon oeuvre', startSceneId: 's1', savedAt: 1, published: false, project: { scenes: [{ id: 's1' }] }, champEnTrop: 1 };
    const sansId = { label: 'Sans id', project: { scenes: [] } };

    it('sans IndexedDB : listée, et le miroir la réécrit TELLE QUELLE avec l’entrée sans `id`', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      localStorage.setItem(KEY, JSON.stringify([oeuvre, sansId]));
      await initLibrary();
      expect(projectsLoad().map((e) => e.id)).toEqual(['oeuvre']);
      await projectSave(proj('voisin'));
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([sansId, oeuvre, proj('voisin')]);
      await projectRemove('voisin');
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([sansId, oeuvre]);
    });

    it('avec IndexedDB : listée depuis la base, et le miroir la porte telle quelle', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { store } = bibliothequeSimulee();
      store.set('oeuvre', oeuvre);
      await initLibrary();
      expect(projectsLoad().map((e) => e.id)).toEqual(['oeuvre']);
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([oeuvre]);
      expect(store.get('oeuvre')).toEqual(oeuvre);
    });

    it('la suppression, geste de l’auteur, retire l’entrée refusée', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const { store } = bibliothequeSimulee();
      store.set('oeuvre', oeuvre);
      await initLibrary();
      await projectRemove('oeuvre');
      expect(projectsLoad()).toEqual([]);
      expect(store.has('oeuvre')).toBe(false);
      expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual([]);
    });
  });

  it('un PROJET d’un autre format, sous une enveloppe valide : LISTÉ, refusé au geste, jamais retiré (#2404)', async () => {
    const entree = { id: 'p-ancien', label: 'Ancienne', startSceneId: 's1', savedAt: 1, published: true, project: { schema: 18, scenes: [{ id: 's1' }] } };
    localStorage.setItem(KEY, JSON.stringify([entree]));
    await initLibrary();
    const [listee] = projectsLoad();
    expect(listee.id, 'l’entrée reste listée : sa suppression est un geste de l’auteur').toBe('p-ancien');
    let refus: unknown;
    try {
      campagneDeLEntree(listee);
    } catch (err) {
      refus = err;
    }
    expect(refus).toBeInstanceOf(ProjetRefuse);
    expect((refus as ProjetRefuse).cause).toBe('schema');
    expect((refus as ProjetRefuse).message).toMatch(/^Projet d’un autre format, ou mal formé — /);
    await projectSave(proj('autre'));
    expect(projectsLoad().map((e) => e.id), 'une écriture voisine ne l’efface pas').toEqual(['p-ancien', 'autre']);
    expect(JSON.parse(localStorage.getItem(KEY)!).map((e: { id: string }) => e.id)).toEqual(['p-ancien', 'autre']);
  });

  it('miroir localStorage pré-peuplé + initLibrary() → cache le sert (repli sans IndexedDB en jsdom)', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        { id: 'p1', label: 'Ancienne', startSceneId: 's1', savedAt: 1, published: true, project: { scenes: [{ id: 's1' }] } },
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
    brancherBasesSimulees().base(NOM).panne = (q) => (q.geste === 'getAll' ? new DOMException('getAll refusé', 'UnknownError') : null);
    await initLibrary();
    expect(projectsLoad()).toEqual([]);
    // Le `catch` a joué : la branche de succès aurait purgé la tombe, absente d'IndexedDB.
    expect(JSON.parse(localStorage.getItem(TOMBSTONE_KEY)!)).toEqual(['p1']);
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
      bibliothequeSimulee({ put: new Set(['big']) });
      const res = await projectSave(bigProj('big'));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message.length).toBeGreaterThan(0);
      const mirrored = localStorage.getItem(KEY) ? JSON.parse(localStorage.getItem(KEY)!) as SavedProject[] : [];
      expect(mirrored.some((e) => e.id === 'big')).toBe(false); // ni IndexedDB ni miroir : perte réelle
    });

    it('stockage local INDISPONIBLE (pas juste une entrée trop grosse) → message distinct, sans conseil « allégez la campagne » (#776 pt.4)', async () => {
      delete (globalThis as { localStorage?: Storage }).localStorage;
      bibliothequeSimulee({ put: new Set(['small']) });
      const res = await projectSave(proj('small', 'Petit')); // PAS un `bigProj` : le stockage est absent, pas l'entrée trop grosse
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.message.toLowerCase()).not.toMatch(/volumineuse/);
    });

    it('un projet trop gros pour le miroir mais dont IndexedDB réussit n’est PAS signalé en échec (le filet IDB suffit) — la borne reste PAR PROJET, pas globale', async () => {
      bibliothequeSimulee();
      await projectSave(proj('small', 'Petit'));
      const res = await projectSave(bigProj('big'));
      expect(res.ok).toBe(true);
      const mirrored = JSON.parse(localStorage.getItem(KEY)!) as SavedProject[];
      // la borne écarte CE projet volumineux du miroir (preuve que la borne par-entrée s'applique
      // bien ici, pas seulement quand IndexedDB échoue) sans emporter le petit projet avec lui.
      expect(mirrored.map((e) => e.id)).toEqual(['small']);
    });
  });

  describe('IndexedDB simulée (#776) — chemin de réconciliation réellement exercé', () => {
    it('recopie complète : localStorage peuplé + idb vide → initLibrary recopie tout dans idb', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Un'), proj('p2', 'Deux')]),
      );
      const idb = bibliothequeSimulee();
      await initLibrary();
      expect(projectsLoad().map((e) => e.id).sort()).toEqual(['p1', 'p2']);
      expect(idb.store.has('p1')).toBe(true);
      expect(idb.store.has('p2')).toBe(true);
    });

    it('recopie PARTIELLE (p2 rejette) puis reprise au reload suivant', async () => {
      localStorage.setItem(
        KEY,
        JSON.stringify([proj('p1', 'Un'), proj('p2', 'Deux')]),
      );
      const failPut = new Set(['p2']);
      const idb = bibliothequeSimulee({ put: failPut });

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
      await initLibrary();
      expect(idb.store.has('p2')).toBe(true); // reprise réussie cette fois
      expect(projectsLoad().map((e) => e.id).sort()).toEqual(['p1', 'p2']);
    });

    it('suppression respectée : un projet supprimé n’est jamais ressuscité par la réconciliation', async () => {
      const idb = bibliothequeSimulee();
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
      bibliothequeSimulee();
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
      const idb = bibliothequeSimulee({ delete: failDelete });
      idb.store.set('p1', proj('p1', 'Un'));
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
      bibliothequeSimulee({ put: new Set(['p1']) });
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await projectSave(proj('p1', 'Un'));
      expect(spy).toHaveBeenCalled();
      expect(String(spy.mock.calls[0][0])).toContain('Un');
      spy.mockRestore();
      // le projet reste servi malgré l'échec idb (miroir localStorage + cache).
      expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);
    });

    it('échec de suppression IndexedDB non silencieux : `projectRemove` journalise l’échec', async () => {
      const idb = bibliothequeSimulee({ delete: new Set(['p1']) });
      idb.store.set('p1', proj('p1', 'Un'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await projectRemove('p1');
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it('échec d’écriture des tombes non silencieux : journalisé (console.error), comme put/delete', async () => {
      const idb = bibliothequeSimulee({ delete: new Set(['p1']) });
      idb.store.set('p1', proj('p1', 'Un'));
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
      const idb = bibliothequeSimulee({ delete: failDelete });
      idb.store.set('p1', proj('p1', 'Un'));
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
      brancherOuvertures(() => {
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
      brancherOuvertures(() => ({} as IDBOpenDBRequest)); // ne déclenche jamais aucun handler
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

describe('campagneDeLEntree — la campagne LANCÉE depuis une entrée, par la porte (#1343)', () => {
  const narratif = emptyNarratif();
  const scene = { ...emptyScene(4, 4), id: 'scene-a', label: 'Salle A' };

  it('entrée d’un AUTRE format (scène sans `reliefDefaults`) : ProjetRefuse de cause `schema`, jamais migrée', () => {
    const { reliefDefaults: _r, ...sceneAncienne } = scene;
    const entree = {
      id: 'proj-ancien', label: 'Campagne d’avant', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { type: 'projet', id: 'proj-ancien', label: 'Campagne d’avant', versionContenu: 1, maison: 'fixture de test', scenes: [sceneAncienne], narratif },
    } as unknown as SavedProject;
    expect(() => campagneDeLEntree(entree)).toThrow(expect.objectContaining({ cause: 'schema' }));
  });

  it('entrée au format courant : la campagne lancée porte l’id et la scène de départ de l’ENTRÉE', () => {
    const entree = {
      id: 'proj-courant', label: 'Campagne', startSceneId: 'scene-a', savedAt: 1, published: true,
      project: { type: 'projet', id: 'proj-courant', label: 'Campagne', versionContenu: 1, maison: 'fixture de test', scenes: [scene], narratif },
    } as unknown as SavedProject;
    const lancee = campagneDeLEntree(entree);
    expect(lancee.id).toBe('proj-courant');
    expect(lancee.label).toBe('Campagne');
    expect(lancee.startSceneId).toBe('scene-a');
    expect(lancee.worldMap).toBeNull();
  });

  it('entrée FAUTIVE : la porte lève ProjetRefuse, jamais rattrapé ici', () => {
    const entree = {
      id: 'proj-fautif', label: 'Fautive', startSceneId: 'x', savedAt: 1, published: true,
      project: { scenes: [{ id: 'x' } as unknown as Scene], narratif },
    } as SavedProject;
    expect(() => campagneDeLEntree(entree)).toThrow(ProjetRefuse);
  });

  it('entrée dont la scène de départ n’est PAS une scène du document : ProjetRefuse de cause « entree », au chemin `startSceneId`', () => {
    const entree = {
      id: 'proj-depart', label: 'Départ perdu', startSceneId: 'scene-disparue', savedAt: 1, published: true,
      project: { type: 'projet', id: 'proj-depart', label: 'Départ perdu', versionContenu: 1, maison: 'fixture de test', scenes: [scene], narratif },
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
      project: { type: 'projet', id: 'proj-axes', label: 'Campagne à axes', versionContenu: 1, maison: 'fixture de test', scenes: [scene], narratif, activeAxes: axes },
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
        type: 'projet', id: 'proj-fautif', label: 'Fautive', versionContenu: 1, maison: 'fixture de test',
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
    expect(playerEntryError(refus, 'jouer')).toBe('Projet d’un autre format, ou mal formé : cette campagne ne peut pas être jouée.');
    expect(playerEntryError(refus, 'exporter')).toBe('Projet d’un autre format, ou mal formé : cette campagne ne peut pas être exportée.');
    expect(consoleErr).toHaveBeenCalledWith('Campagne de bibliothèque refusée :', (refus as ProjetRefuse).message);
  });
});

describe('`wfrp4-library` — déclarée, recréée si elle s’en écarte (#2404)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    __setFabriqueIdbForTest(null);
  });

  it('base neuve : `projects` keyé id', async () => {
    const bases = brancherBasesSimulees();
    await initLibrary();
    expect(bases.base(NOM).magasins.get('projects')?.keyPath).toBe('id');
  });

  it('base d’une autre forme recréée : le miroir localStorage repeuple la bibliothèque', async () => {
    const bases = brancherBasesSimulees();
    bases.amorcer(NOM, { projects: { keyPath: 'cle' } });
    localStorage.setItem(KEY, JSON.stringify([proj('p1', 'Miroir')]));
    await initLibrary();
    expect(bases.suppressions).toEqual([NOM]);
    expect(projectsLoad().map((e) => e.id)).toEqual(['p1']);
    expect([...bases.contenu(NOM, 'projects').keys()]).toEqual(['p1']);
  });
});

describe('estRefusee — le refus au GESTE, témoin de la bibliothèque lu par chaque écran (#2404)', () => {
  const narratif = emptyNarratif();
  const scene = { ...emptyScene(4, 4), id: 'scene-a', label: 'Salle A' };
  const entree = (id: string, startSceneId: string, scenes: unknown[]) => ({
    id, label: id, startSceneId, savedAt: 1, published: true,
    project: { type: 'projet', id, label: id, versionContenu: 1, maison: 'fixture de test', scenes, narratif },
  }) as unknown as SavedProject;

  it('contenu refusé : non refusée à la relecture, refusée après le geste, levée par la réécriture de l’entrée', async () => {
    const fautive = entree('proj-fautif', 'x', [{ id: 'x' }]);
    expect(estRefusee(fautive)).toBe(false);
    expect(() => projetDeLEntree(fautive)).toThrow(ProjetRefuse);
    expect(estRefusee(fautive)).toBe(true);
    await projectSave(entree('proj-fautif', 'scene-a', [scene]));
    expect(estRefusee(fautive), 'l’entrée réécrite n’est plus celle refusée').toBe(false);
  });

  it('départ inconnu : refusée après « Jouer », levée par le retrait de l’entrée', async () => {
    const depart = entree('proj-depart', 'scene-disparue', [scene]);
    expect(() => campagneDeLEntree(depart)).toThrow(ProjetRefuse);
    expect(estRefusee(depart)).toBe(true);
    await projectRemove('proj-depart');
    expect(estRefusee(depart)).toBe(false);
  });

  it('entrée au format courant : jamais refusée', () => {
    const saine = entree('proj-sain', 'scene-a', [scene]);
    campagneDeLEntree(saine);
    expect(estRefusee(saine)).toBe(false);
  });
});
