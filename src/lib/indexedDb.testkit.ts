/**
 * Doublures d'IndexedDB pour les tests (node et jsdom n'ont pas `indexedDB`) : une base simulée qui
 * trace sa montée, ses transactions et sa fermeture, et une requête d'ouverture dont le test déclenche
 * les événements.
 */
import { __setOuvertureIdbForTest } from './indexedDb';

/** Magasin simulé : sa `keyPath` (absente = clés externes) et son contenu. */
export interface MagasinSimule {
  keyPath?: string | string[];
  contenu: Map<unknown, unknown>;
}

/** Transaction simulée : se termine au microtask qui suit sa création, ou échoue sur
 *  `BaseSimulee.echec` quand il est posé. */
export interface TransactionSimulee {
  magasins: string[];
  mode: IDBTransactionMode;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  error: DOMException | null;
  objectStore(nom: string): IDBObjectStore;
}

export interface BaseSimulee {
  magasins: Map<string, MagasinSimule>;
  transactions: TransactionSimulee[];
  fermetures: number;
  /** Erreur de toute transaction ouverte ensuite (`null` : elles se terminent). */
  echec: DOMException | null;
  /** La vue `IDBDatabase` que reçoivent `upgrade` et les opérations. */
  db: IDBDatabase;
}

/** Requête simulée d'un magasin : se règle au microtask suivant sur `valeur`. */
function requeteReussie(valeur: unknown): IDBRequest {
  const req = { result: valeur, error: null, onsuccess: null, onerror: null } as unknown as IDBRequest;
  queueMicrotask(() => req.onsuccess?.(new Event('success')));
  return req;
}

/** Base simulée ; `existants` : magasins déjà présents (base d'une version antérieure). */
export function baseSimulee(existants: Record<string, { keyPath?: string | string[] }> = {}): BaseSimulee {
  const magasins = new Map<string, MagasinSimule>(
    Object.entries(existants).map(([nom, o]) => [nom, { ...o, contenu: new Map() }]),
  );
  const etat: BaseSimulee = { magasins, transactions: [], fermetures: 0, echec: null, db: null as unknown as IDBDatabase };
  const cle = (m: MagasinSimule, valeur: unknown, cleExterne: unknown): unknown => {
    if (m.keyPath === undefined) return cleExterne;
    const v = valeur as Record<string, unknown>;
    return JSON.stringify(Array.isArray(m.keyPath) ? m.keyPath.map((k) => v[k]) : v[m.keyPath]);
  };
  const vueMagasin = (nom: string): IDBObjectStore => {
    const m = magasins.get(nom);
    if (!m) throw new DOMException(`magasin « ${nom} » absent`, 'NotFoundError');
    const k = (c: unknown) => (m.keyPath === undefined ? c : JSON.stringify(c));
    return {
      get: (c: unknown) => requeteReussie(m.contenu.get(k(c))),
      getAll: () => requeteReussie([...m.contenu.values()]),
      put: (valeur: unknown, cleExterne?: unknown) => { m.contenu.set(cle(m, valeur, cleExterne), valeur); return requeteReussie(undefined); },
      delete: (c: unknown) => { m.contenu.delete(k(c)); return requeteReussie(undefined); },
      clear: () => { m.contenu.clear(); return requeteReussie(undefined); },
    } as unknown as IDBObjectStore;
  };
  etat.db = {
    objectStoreNames: { contains: (nom: string) => magasins.has(nom) } as DOMStringList,
    createObjectStore: (nom: string, o?: { keyPath?: string | string[] }) => {
      if (magasins.has(nom)) throw new DOMException(`magasin « ${nom} » déjà présent`, 'ConstraintError');
      magasins.set(nom, { keyPath: o?.keyPath, contenu: new Map() });
      return vueMagasin(nom);
    },
    deleteObjectStore: (nom: string) => {
      if (!magasins.delete(nom)) throw new DOMException(`magasin « ${nom} » absent`, 'NotFoundError');
    },
    transaction: (noms: string | string[], mode: IDBTransactionMode = 'readonly') => {
      const tx: TransactionSimulee = {
        magasins: Array.isArray(noms) ? noms : [noms],
        mode,
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore: vueMagasin,
      };
      etat.transactions.push(tx);
      const echec = etat.echec;
      queueMicrotask(() => {
        if (!echec) return tx.oncomplete?.();
        tx.error = echec;
        tx.onerror?.();
      });
      return tx as unknown as IDBTransaction;
    },
    close: () => { etat.fermetures++; },
  } as unknown as IDBDatabase;
  return etat;
}

/** Requête d'ouverture simulée : le test en déclenche les événements. */
export interface OuvertureSimulee {
  req: IDBOpenDBRequest;
  monter(ancienneVersion: number): void;
  reussir(): void;
  echouer(error: DOMException): void;
  bloquer(): void;
}

export function ouvertureSimulee(base: BaseSimulee): OuvertureSimulee {
  const req = { result: base.db, error: null } as unknown as IDBOpenDBRequest;
  return {
    req,
    monter: (ancienneVersion) => req.onupgradeneeded?.({ oldVersion: ancienneVersion } as IDBVersionChangeEvent),
    reussir: () => req.onsuccess?.(new Event('success')),
    echouer: (error) => {
      (req as { error: DOMException | null }).error = error;
      req.onerror?.(new Event('error'));
    },
    bloquer: () => req.onblocked?.({ oldVersion: 1 } as IDBVersionChangeEvent),
  };
}

/** Branche toute ouverture sur `base` : chacune réussit au microtask suivant, la première après la
 *  montée depuis `ancienneVersion`. */
export function brancherBaseSimulee(base: BaseSimulee, ancienneVersion = 0): void {
  let montee = false;
  __setOuvertureIdbForTest(() => {
    const o = ouvertureSimulee(base);
    queueMicrotask(() => {
      if (!montee) o.monter(ancienneVersion);
      montee = true;
      o.reussir();
    });
    return o.req;
  });
}
