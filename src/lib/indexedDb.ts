/**
 * Plomberie IndexedDB des magasins locaux (#1956) : disponibilité, ouverture bornée (#776), mise en
 * promesse des requêtes et des transactions, et accès d'UNE opération à une base. Couche neutre : la
 * donnée (`src/data`) et le store (`src/state`) l'importent tous deux.
 *
 * Politique de connexion : chaque opération ouvre sa connexion et la FERME à son règlement
 * (`lireDansBase`, `ecrireDansBase`) ; une ouverture réussie APRÈS le règlement de `ouvrirBase` est
 * refermée aussitôt. Aucune connexion ne survit à son opération, donc aucune ne bloque la montée de
 * version d'un autre onglet.
 */

/** Une base : son nom, sa version, et sa montée (`onupgradeneeded`), fonction pure de la connexion
 *  en cours de montée et de la version d'où elle part (0 pour une base neuve). */
export interface BaseIdb {
  readonly nom: string;
  readonly version: number;
  readonly upgrade: (db: IDBDatabase, ancienneVersion: number) => void;
}

/** #776 */
export const IDB_OPEN_TIMEOUT_MS = 3000;

type OuvertureIdb = (nom: string, version: number) => IDBOpenDBRequest;

const ouvertureNative: OuvertureIdb = (nom, version) => indexedDB.open(nom, version);
let ouverture: OuvertureIdb = ouvertureNative;
let ouvertureSubstituee = false;

/** Substitue l'ouverture de TOUTES les bases (`null` rétablit l'ouverture native) : une ouverture
 *  substituée rend IndexedDB disponible (`idbDisponible`), jsdom et node n'ayant pas `indexedDB`. */
export function __setOuvertureIdbForTest(fn: OuvertureIdb | null): void {
  ouverture = fn ?? ouvertureNative;
  ouvertureSubstituee = fn !== null;
}

/** `indexedDB` présent, ou ouverture substituée. */
export function idbDisponible(): boolean {
  return ouvertureSubstituee || typeof indexedDB !== 'undefined';
}

/** Ouvre `base`. Se règle UNE fois : succès, erreur, `blocked` ou délai `IDB_OPEN_TIMEOUT_MS` (#776) ;
 *  une connexion qui aboutit après ce règlement est refermée. */
export function ouvrirBase(base: BaseIdb): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = ouverture(base.nom, base.version);
    let regle = false;
    const regler = (geste: () => void): boolean => {
      if (regle) return false;
      regle = true;
      clearTimeout(timer);
      geste();
      return true;
    };
    const timer = setTimeout(() => regler(() => reject(new Error('IndexedDB open : délai dépassé'))), IDB_OPEN_TIMEOUT_MS);
    req.onupgradeneeded = (e) => base.upgrade(req.result, e.oldVersion);
    req.onblocked = () => regler(() => reject(new Error('IndexedDB open : bloqué par une autre connexion ouverte')));
    req.onsuccess = () => {
      if (!regler(() => resolve(req.result))) req.result.close();
    };
    req.onerror = () => regler(() => reject(req.error));
  });
}

/** Le résultat d'une requête, ou son erreur. */
export function requeteReglee<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** La fin d'une transaction : `complete`, ou son erreur (`error`, `abort`). */
export function transactionReglee(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB : transaction annulée'));
  });
}

/** Lit dans UN magasin de `base` par `requete` ; `undefined` sans IndexedDB. */
export async function lireDansBase(
  base: BaseIdb,
  magasin: string,
  requete: (m: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  if (!idbDisponible()) return undefined;
  const db = await ouvrirBase(base);
  try {
    return await requeteReglee(requete(db.transaction(magasin, 'readonly').objectStore(magasin)));
  } finally {
    db.close();
  }
}

/** Écrit dans les `magasins` de `base` par `geste`, dans UNE transaction ; sans IndexedDB, rien. */
export async function ecrireDansBase(
  base: BaseIdb,
  magasins: string | string[],
  geste: (tx: IDBTransaction) => void,
): Promise<void> {
  if (!idbDisponible()) return;
  const db = await ouvrirBase(base);
  try {
    const tx = db.transaction(magasins, 'readwrite');
    geste(tx);
    await transactionReglee(tx);
  } finally {
    db.close();
  }
}
