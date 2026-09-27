/**
 * Plomberie IndexedDB des magasins locaux (#1956) : disponibilité, ouverture bornée (#776), mise en
 * promesse des requêtes et des transactions, et la poignée d'une base (`accesBase`) : ses magasins
 * typés et son vidage. Couche neutre : la donnée (`src/data`) et le store (`src/state`) l'importent
 * tous deux.
 *
 * Politique de connexion : chaque opération ouvre sa connexion et la FERME à son règlement
 * (`avecConnexion`) ; une ouverture réussie APRÈS le règlement de `ouvrirBase` est
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
const IDB_OPEN_TIMEOUT_MS = 3000;

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
function ouvrirBase(base: BaseIdb): Promise<IDBDatabase> {
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
function requeteReglee<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** La fin d'une transaction : `complete`, ou son erreur (`error`, `abort`). */
function transactionReglee(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB : transaction annulée'));
  });
}

/** Ouvre `base`, joue `geste` sur la connexion, et la ferme au règlement. */
async function avecConnexion<T>(base: BaseIdb, geste: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const db = await ouvrirBase(base);
  try {
    return await geste(db);
  } finally {
    db.close();
  }
}

/** Écrit dans les magasins `nomsMagasins` de la connexion par `geste`, dans UNE transaction. */
function transactionEcriture(db: IDBDatabase, nomsMagasins: string[], geste: (tx: IDBTransaction) => void): Promise<void> {
  const tx = db.transaction(nomsMagasins, 'readwrite');
  geste(tx);
  return transactionReglee(tx);
}

/** Lit dans le magasin `nomMagasin` de `base` par `requete` ; `undefined` sans IndexedDB. */
async function lireDansBase(
  base: BaseIdb,
  nomMagasin: string,
  requete: (m: IDBObjectStore) => IDBRequest,
): Promise<unknown> {
  if (!idbDisponible()) return undefined;
  return avecConnexion(base, (db) => requeteReglee(requete(db.transaction(nomMagasin, 'readonly').objectStore(nomMagasin))));
}

/** Écrit dans le magasin `nomMagasin` de `base` par `geste`, dans UNE transaction ; sans IndexedDB, rien. */
async function ecrireDansBase(base: BaseIdb, nomMagasin: string, geste: (m: IDBObjectStore) => void): Promise<void> {
  if (!idbDisponible()) return;
  await avecConnexion(base, (db) => transactionEcriture(db, [nomMagasin], (tx) => geste(tx.objectStore(nomMagasin))));
}

/** Un magasin d'une base : valeurs `V`, clés `K` (une clé composée est un tableau). */
export interface MagasinIdb<V, K extends IDBValidKey> {
  /** La valeur de `cle` ; `null` si absente ou sans IndexedDB. */
  lire(cle: K): Promise<V | null>;
  /** Toutes les valeurs ; `[]` sans IndexedDB. */
  lireTout(): Promise<V[]>;
  /** Pose `valeur`, sous `cle` pour un magasin à clés externes (`IDBObjectStore.put`). */
  ecrire(valeur: V, cle?: K): Promise<void>;
  supprimer(cle: K): Promise<void>;
}

/** La poignée d'une base : ses magasins, et son vidage. */
export interface AccesBase {
  magasin<V, K extends IDBValidKey>(nomMagasin: string): MagasinIdb<V, K>;
  /** Vide tous les magasins de la base, dans UNE transaction ; sans IndexedDB, rien. */
  vider(): Promise<void>;
}

export function accesBase(base: BaseIdb): AccesBase {
  return {
    magasin: <V, K extends IDBValidKey>(nomMagasin: string): MagasinIdb<V, K> => ({
      lire: async (cle) => ((await lireDansBase(base, nomMagasin, (m) => m.get(cle))) as V | undefined) ?? null,
      lireTout: async () => ((await lireDansBase(base, nomMagasin, (m) => m.getAll())) as V[] | undefined) ?? [],
      ecrire: (valeur, cle) => ecrireDansBase(base, nomMagasin, (m) => { if (cle === undefined) m.put(valeur); else m.put(valeur, cle); }),
      supprimer: (cle) => ecrireDansBase(base, nomMagasin, (m) => { m.delete(cle); }),
    }),
    vider: async () => {
      if (!idbDisponible()) return;
      await avecConnexion(base, (db) => {
        const nomsMagasins = Array.from(db.objectStoreNames);
        return transactionEcriture(db, nomsMagasins, (tx) => {
          for (const nomMagasin of nomsMagasins) tx.objectStore(nomMagasin).clear();
        });
      });
    },
  };
}
