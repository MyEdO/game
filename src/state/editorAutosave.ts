import type { Scene } from './scene';
import { CURRENT_PROJECT_SCHEMA, exigerUnRefus, sceneAuSchemaCourant } from './worldMap';

/**
 * Sauvegarde locale AUTOMATIQUE de la scène en cours d'édition — un crash de rendu de l'éditeur
 * (`SceneErrorBoundary`) démontait jusqu'ici l'`Editor` à neuf et perdait tout le travail
 * d'authoring en mémoire. Ce magasin, débattu/throttlé à l'écriture (`useEditorAutosave`,
 * `ui/editor/`), est INDÉPENDANT du « Fichier → Enregistrer » explicite (`projectLibrary.ts`, qui
 * persiste un `SavedProject` PUBLIÉ/nommé) et du calque de référence (`traceLayer.ts`, une aide
 * d'authoring qui n'entre dans AUCUN export) : magasin dédié, keyé par SEUL id de scène (une
 * scène = sa dernière frappe, jamais tout le projet multi-scènes). Même plomberie IndexedDB que
 * ces deux modules (ouverture avec délai, backend injectable) — un troisième magasin pour un
 * troisième grain de donnée, PAS une seconde mécanique.
 */
export interface EditorAutosaveRecord {
  sceneId: string;
  scene: Scene;
  savedAt: number;
  /** `CURRENT_PROJECT_SCHEMA` à l'écriture : l'axe de version que la lecture fait traverser à la chaîne
   *  canonique (`sceneAuSchemaCourant`). Absent = écrit avant ce versionnage (#1882). */
  schema?: number;
}

/** Enregistrement ÉCARTÉ à la lecture : la chaîne de migrations ne sait pas le porter au schéma
 *  courant (sans version, ou version refusée) — retiré du magasin, la raison dite à l'auteur. */
export interface AutosaveEcartee {
  sceneId: string;
  ecartee: string;
}

export interface EditorAutosaveBackend {
  get(sceneId: string): Promise<EditorAutosaveRecord | null>;
  put(entry: EditorAutosaveRecord): Promise<void>;
  delete(sceneId: string): Promise<void>;
  clear(): Promise<void>;
}

const DB = 'wfrp4-editor-autosave';
const STORE = 'autosave';
const IDB_OPEN_TIMEOUT_MS = 3000;

const openIdbRequest: () => IDBOpenDBRequest = () => indexedDB.open(DB, 1);

let backendOverridden = false;

function hasIdb(): boolean {
  return backendOverridden || typeof indexedDB !== 'undefined';
}

/** N'attend jamais indéfiniment (même garde que `projectLibrary.idb`/`traceLayer.idb`, #776) : un
 *  `open` coincé rejette après `IDB_OPEN_TIMEOUT_MS` plutôt que de geler l'appelant. */
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = openIdbRequest();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('IndexedDB open : délai dépassé'));
    }, IDB_OPEN_TIMEOUT_MS);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'sceneId' });
    req.onblocked = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error('IndexedDB open : bloqué par une autre connexion ouverte'));
    };
    req.onsuccess = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(req.error);
    };
  });
}

const realBackend: EditorAutosaveBackend = {
  async get(sceneId) {
    if (!hasIdb()) return null;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(sceneId);
      r.onsuccess = () => resolve((r.result as EditorAutosaveRecord | undefined) ?? null);
      r.onerror = () => reject(r.error);
    });
  },
  async put(entry) {
    if (!hasIdb()) return;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async delete(sceneId) {
    if (!hasIdb()) return;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(sceneId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
  async clear() {
    if (!hasIdb()) return;
    const db = await idb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

let backend: EditorAutosaveBackend = realBackend;

export function __setAutosaveBackendForTest(b: EditorAutosaveBackend | null): void {
  backend = b ?? realBackend;
  backendOverridden = b !== null;
}

/** Lecture — `null` si aucune sauvegarde automatique pour cette scène, ou si IndexedDB est
 *  indisponible (mode privé strict, jsdom…) : l'autosave reste une aide de SESSION, jamais une
 *  donnée qui bloque l'ouverture de l'éditeur. La scène lue traverse la chaîne de migrations
 *  canonique (`sceneAuSchemaCourant`) ; celle qu'elle refuse est RETIRÉE et rendue `AutosaveEcartee`
 *  (politique de `saves.ts` : rejetée, retirée, dite). */
export async function autosaveLoad(sceneId: string): Promise<EditorAutosaveRecord | AutosaveEcartee | null> {
  let rec: EditorAutosaveRecord | null;
  try {
    rec = await backend.get(sceneId);
  } catch {
    return null;
  }
  if (!rec) return null;
  try {
    return { ...rec, scene: sceneAuSchemaCourant(rec.scene, rec.schema), schema: CURRENT_PROJECT_SCHEMA };
  } catch (err) {
    exigerUnRefus(err);
    await autosaveDelete(sceneId);
    return { sceneId, ecartee: err.message };
  }
}

/** Écriture best-effort : un échec (quota dépassé, accès refusé…) ne doit jamais faire planter
 *  l'éditeur — seul le filet disque est perdu, la session en mémoire n'est pas affectée. */
export async function autosaveSave(entry: Omit<EditorAutosaveRecord, 'schema'>): Promise<void> {
  try {
    await backend.put({ ...entry, schema: CURRENT_PROJECT_SCHEMA });
  } catch (err) {
    console.error(`[editorAutosave] sauvegarde automatique de « ${entry.sceneId} » en échec (session non affectée).`, err);
  }
}

export async function autosaveDelete(sceneId: string): Promise<void> {
  try {
    await backend.delete(sceneId);
  } catch (err) {
    console.error(`[editorAutosave] suppression de la sauvegarde automatique de « ${sceneId} » en échec.`, err);
  }
}

/** Test-only : vide le magasin pour l'isolation entre tests. */
export async function __resetAutosaveForTest(): Promise<void> {
  await backend.clear().catch(() => { /* idb absent en jsdom */ });
}
