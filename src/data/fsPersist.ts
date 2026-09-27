/**
 * Persistance disque de l'éditeur de données (DEV-only) via la **File System Access API**.
 * L'utilisateur connecte une fois le dossier `src/data/` ; le handle est mémorisé en IndexedDB pour
 * survivre au full-reload Vite qui suit chaque sauvegarde (l'écriture d'un *.json watché recharge la
 * page). Repli `download` quand l'API est absente (Firefox/Safari). Aucun serveur.
 */
// eslint-disable-next-line murs/purete-imports -- #518 : le repli `download` de cette persistance DEV appelle `downloadText`, qui vit dans `state/fileIo` avec ses quatre consommateurs de `src/ui` — l'inversion de couche est tracée par ce ticket, et VISIBLE à son site.
import { downloadText } from '../state/fileIo';

export const FS_API = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ── IndexedDB minimal (les FileSystemHandle sont structured-cloneables, pas localStorage) ──
const DB = 'wfrp4-data-editor';
const STORE = 'handles';
const KEY = 'dataDir';

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, val: unknown): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(val, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type DirHandle = FileSystemDirectoryHandle;

async function perm(h: DirHandle, request: boolean): Promise<boolean> {
  const opts = { mode: 'readwrite' } as const;
  // @ts-expect-error queryPermission/requestPermission ne sont pas (encore) dans lib.dom standard
  const q: PermissionState = await h.queryPermission(opts);
  if (q === 'granted') return true;
  if (!request) return false;
  // @ts-expect-error idem
  return (await h.requestPermission(opts)) === 'granted';
}

/** Ouvre le sélecteur de dossier (geste utilisateur requis) et mémorise le handle. */
export async function connectDataDir(): Promise<DirHandle> {
  // @ts-expect-error showDirectoryPicker hors lib.dom standard
  const h: DirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  await idbSet(KEY, h);
  return h;
}

/** Handle mémorisé + permission encore accordée (sans prompt) ? Sinon il faudra reconnecter. */
export async function restoreDataDir(): Promise<{ handle: DirHandle; granted: boolean } | null> {
  if (!FS_API) return null;
  const h = await idbGet<DirHandle>(KEY);
  if (!h) return null;
  return { handle: h, granted: await perm(h, false) };
}

/** Redemande la permission (à appeler dans un geste utilisateur). */
export async function grantPermission(h: DirHandle): Promise<boolean> {
  return perm(h, true);
}

/** Écrit le texte dans un fichier du dossier (créé au besoin). */
export async function writeFile(dir: DirHandle, name: string, text: string): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(text);
  await w.close();
}

/** Repli quand l'API FS est absente : télécharge le fichier à reposer manuellement dans src/data/. */
export function downloadFallback(name: string, text: string): void {
  downloadText(name, text);
}
