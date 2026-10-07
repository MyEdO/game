/**
 * Plomberie IndexedDB des magasins locaux (#1956) : disponibilité, ouverture bornée (#776), mise en
 * promesse des requêtes et des transactions, et la poignée d'une base (`accesBase`) : ses magasins
 * typés et son vidage. Couche neutre : la donnée (`src/data`) et le store (`src/state`) l'importent
 * tous deux.
 *
 * Une base se DÉCLARE (ses magasins et leur `keyPath`) et s'ouvre SANS version (#2404) : une base
 * neuve reçoit ses magasins de la déclaration ; une base existante qui s'en écarte est supprimée puis
 * recréée, ses données perdues.
 *
 * Politique de connexion : chaque opération ouvre sa connexion et la FERME à son règlement
 * (`avecConnexion`) ; une ouverture réussie APRÈS le règlement de `ouvrirBase` est
 * refermée aussitôt. Aucune connexion ne survit à son opération, donc aucune ne bloque la suppression
 * de la base par un autre onglet.
 */

/** Un magasin déclaré : sa `keyPath`, absente pour un magasin à clés externes. */
export interface MagasinDeclare {
  readonly keyPath?: string | string[];
}

/** Une base : son nom et ses magasins déclarés, par nom. */
export interface BaseIdb {
  readonly nom: string;
  readonly magasins: Readonly<Record<string, MagasinDeclare>>;
}

/** Une base encore non conforme à sa déclaration après sa recréation. */
export class BaseIdbNonConforme extends Error {
  constructor(nom: string) {
    super(`IndexedDB : la base « ${nom} » recréée ne porte toujours pas les magasins déclarés`);
    this.name = 'BaseIdbNonConforme';
  }
}

/** #776 */
const IDB_OPEN_TIMEOUT_MS = 3000;

/** Ce que la plomberie appelle d'IndexedDB. */
export type FabriqueIdb = Pick<IDBFactory, 'open' | 'deleteDatabase'>;

let fabriqueSubstituee: FabriqueIdb | null = null;

/** Substitue l'ouverture et la suppression de TOUTES les bases (`null` rétablit `indexedDB`) : une
 *  fabrique substituée rend IndexedDB disponible (`idbDisponible`), jsdom et node n'ayant pas `indexedDB`. */
export function __setFabriqueIdbForTest(fabrique: FabriqueIdb | null): void {
  fabriqueSubstituee = fabrique;
}

const fabriqueIdb = (): FabriqueIdb => fabriqueSubstituee ?? indexedDB;

/** `indexedDB` présent, ou fabrique substituée. */
export function idbDisponible(): boolean {
  return fabriqueSubstituee !== null || typeof indexedDB !== 'undefined';
}

const cleDeChemin = (keyPath: string | string[] | null | undefined): string => JSON.stringify(keyPath ?? null);

/** Les magasins de `db` sont exactement ceux de `base`, chacun à sa `keyPath` déclarée. */
function conforme(base: BaseIdb, db: IDBDatabase): boolean {
  const declares = Object.keys(base.magasins);
  if (db.objectStoreNames.length !== declares.length || !declares.every((nom) => db.objectStoreNames.contains(nom))) return false;
  if (declares.length === 0) return true;
  const tx = db.transaction(declares, 'readonly');
  return declares.every((nom) => cleDeChemin(tx.objectStore(nom).keyPath) === cleDeChemin(base.magasins[nom].keyPath));
}

/** Crée dans `db`, base neuve en cours de création, les magasins déclarés de `base`. */
function creerMagasins(base: BaseIdb, db: IDBDatabase): void {
  for (const [nom, { keyPath }] of Object.entries(base.magasins)) {
    db.createObjectStore(nom, keyPath === undefined ? undefined : { keyPath });
  }
}

/** Ouvre `base`, conforme à sa déclaration, la recréant UNE fois au besoin. Se règle UNE fois : succès,
 *  erreur, `blocked` ou délai `IDB_OPEN_TIMEOUT_MS` (#776) ; une connexion qui aboutit après ce
 *  règlement est refermée. */
function ouvrirBase(base: BaseIdb): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let regle = false;
    const regler = (geste: () => void): boolean => {
      if (regle) return false;
      regle = true;
      clearTimeout(timer);
      geste();
      return true;
    };
    const echouer = (erreur: unknown) => regler(() => reject(erreur));
    const timer = setTimeout(() => echouer(new Error('IndexedDB open : délai dépassé')), IDB_OPEN_TIMEOUT_MS);
    const recreer = () => {
      const req = fabriqueIdb().deleteDatabase(base.nom);
      req.onblocked = () => echouer(new Error('IndexedDB delete : bloqué par une autre connexion ouverte'));
      req.onsuccess = () => {
        if (!regle) ouvrir(false);
      };
      req.onerror = () => echouer(req.error);
    };
    const ouvrir = (recreable: boolean) => {
      const req = fabriqueIdb().open(base.nom);
      req.onupgradeneeded = () => creerMagasins(base, req.result);
      req.onblocked = () => echouer(new Error('IndexedDB open : bloqué par une autre connexion ouverte'));
      req.onsuccess = () => {
        const db = req.result;
        if (regle) return db.close();
        if (conforme(base, db)) return void regler(() => resolve(db));
        db.close();
        if (recreable) recreer();
        else echouer(new BaseIdbNonConforme(base.nom));
      };
      req.onerror = () => echouer(req.error);
    };
    ouvrir(true);
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
