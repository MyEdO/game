import type { Scene } from './scene';
import { ecrireDansBase, lireDansBase, type BaseIdb } from '../lib/indexedDb';
import { CURRENT_PROJECT_SCHEMA, migreSceneDeProjet, exigerUnRefus, type ProjetRefuse, type ProjectDoc } from './worldMap';

/**
 * Sauvegarde locale AUTOMATIQUE de la scène en cours d'édition : filet du crash de rendu de
 * l'éditeur (`SceneErrorBoundary`), qui démonte l'`Editor` et perd le travail d'authoring en
 * mémoire. Ce magasin, débattu/throttlé à l'écriture (`useEditorAutosave`, `ui/editor/`), est
 * INDÉPENDANT du « Fichier → Enregistrer » explicite (`projectLibrary.ts`, qui persiste un
 * `SavedProject` PUBLIÉ/nommé) et du calque de référence (`traceLayer.ts`, une aide d'authoring qui
 * n'entre dans AUCUN export) : magasin dédié, keyé par SEUL id de scène (une scène = sa dernière
 * frappe, jamais tout le projet multi-scènes). Plomberie IndexedDB : `lib/indexedDb.ts`.
 */
export interface EditorAutosaveRecord {
  sceneId: string;
  scene: Scene;
  /** Marqueur de FORME : le `schema` de projet de l'application qui a écrit la scène. */
  schema: ProjectDoc['schema'];
  savedAt: number;
}

/** Ce que l'éditeur peut faire d'un enregistrement relu : le reprendre, sa scène montée au format
 *  courant, ou l'ÉCARTER sur le refus MESURÉ de la porte (cause, fautes et leur lieu), que l'écran
 *  traduit (`refusDeLaPorteDuProjet`, `ui/editor/ProjectModals.tsx`). */
export type RepriseLocale =
  | { readonly ok: true; readonly record: EditorAutosaveRecord }
  | { readonly ok: false; readonly sceneId: string; readonly savedAt: number; readonly refus: ProjetRefuse };

export interface EditorAutosaveBackend {
  get(sceneId: string): Promise<EditorAutosaveRecord | null>;
  put(entry: EditorAutosaveRecord): Promise<void>;
  delete(sceneId: string): Promise<void>;
  clear(): Promise<void>;
}

const STORE = 'autosave';

/** Montée de `wfrp4-editor-autosave`. */
export const upgradeAutosave: BaseIdb['upgrade'] = (db) => {
  db.createObjectStore(STORE, { keyPath: 'sceneId' });
};

const BASE: BaseIdb = { nom: 'wfrp4-editor-autosave', version: 1, upgrade: upgradeAutosave };

const realBackend: EditorAutosaveBackend = {
  async get(sceneId) {
    return ((await lireDansBase(BASE, STORE, (m) => m.get(sceneId))) as EditorAutosaveRecord | undefined) ?? null;
  },
  put: (entry) => ecrireDansBase(BASE, STORE, (tx) => { tx.objectStore(STORE).put(entry); }),
  delete: (sceneId) => ecrireDansBase(BASE, STORE, (tx) => { tx.objectStore(STORE).delete(sceneId); }),
  clear: () => ecrireDansBase(BASE, STORE, (tx) => { tx.objectStore(STORE).clear(); }),
};

let backend: EditorAutosaveBackend = realBackend;

export function __setAutosaveBackendForTest(b: EditorAutosaveBackend | null): void {
  backend = b ?? realBackend;
}

/** Lecture — `null` si aucune sauvegarde automatique pour cette scène, ou si IndexedDB est
 *  indisponible (mode privé strict, jsdom…) : l'autosave reste une aide de SESSION, jamais une
 *  donnée qui bloque l'ouverture de l'éditeur. */
export async function autosaveLoad(sceneId: string): Promise<RepriseLocale | null> {
  let brut: EditorAutosaveRecord | null;
  try {
    brut = await backend.get(sceneId);
  } catch {
    return null;
  }
  return brut && relire(brut);
}

/** Un enregistrement du magasin est une donnée PERSISTÉE d'une version antérieure de l'application :
 *  il monte par la chaîne de forme du projet (`migreSceneDeProjet`), au `schema` qu'il porte. Sans
 *  marqueur de format, il est ÉCARTÉ, jamais migré sur une version supposée. */
function relire(brut: EditorAutosaveRecord): RepriseLocale {
  try {
    return { ok: true, record: { ...brut, scene: migreSceneDeProjet(brut.scene, brut.schema), schema: CURRENT_PROJECT_SCHEMA } };
  } catch (e) {
    exigerUnRefus(e);
    return { ok: false, sceneId: brut.sceneId, savedAt: brut.savedAt, refus: e };
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
  await backend.clear();
}
