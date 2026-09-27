/**
 * Persistance disque de l'éditeur de données (DEV-only) via la **File System Access API**.
 * L'utilisateur connecte une fois le dossier `src/data/` ; le handle est mémorisé en IndexedDB pour
 * survivre au full-reload Vite qui suit chaque sauvegarde (l'écriture d'un *.json watché recharge la
 * page). Repli `download` quand l'API est absente (Firefox/Safari). Aucun serveur.
 */
import { downloadText } from '../lib/fileIo';
import { ecrireDansBase, lireDansBase, type BaseIdb } from '../lib/indexedDb';

/** File System Access présente dans ce navigateur. */
export function fsApiDisponible(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

const STORE = 'handles';
const KEY = 'dataDir';

/** Montée de `wfrp4-data-editor` : un magasin à clés externes (le handle, structured-cloneable). */
export const upgradeEditeurDeDonnees: BaseIdb['upgrade'] = (db) => {
  db.createObjectStore(STORE);
};

const BASE: BaseIdb = { nom: 'wfrp4-data-editor', version: 1, upgrade: upgradeEditeurDeDonnees };

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

/** Ouvre le sélecteur de dossier (geste utilisateur requis) et mémorise le handle ; `null` quand
 *  l'utilisateur annule le sélecteur (`AbortError`). Tout autre échec rejette. */
export async function connectDataDir(): Promise<DirHandle | null> {
  let h: DirHandle;
  try {
    // @ts-expect-error showDirectoryPicker hors lib.dom standard
    h = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
  await ecrireDansBase(BASE, STORE, (tx) => { tx.objectStore(STORE).put(h, KEY); });
  return h;
}

/** Handle mémorisé + permission encore accordée (sans prompt) ? Sinon il faudra reconnecter. */
export async function restoreDataDir(): Promise<{ handle: DirHandle; granted: boolean } | null> {
  if (!fsApiDisponible()) return null;
  const h = (await lireDansBase(BASE, STORE, (m) => m.get(KEY))) as DirHandle | undefined;
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
