/**
 * Doublures d'IndexedDB pour les tests (node et jsdom n'ont pas `indexedDB`) : une base simulée qui
 * trace sa montée, ses transactions, ses écritures validées et sa fermeture ; une requête d'ouverture
 * dont le test déclenche les événements ; et le branchement de toutes les ouvertures sur des bases
 * simulées, routées par nom.
 */
import { __setOuvertureIdbForTest } from './indexedDb';

/** Magasin simulé : sa `keyPath` (absente = clés externes) et son contenu, par clé. Une clé composée
 *  (tableau) y est rangée sérialisée en JSON. */
export interface MagasinSimule {
  keyPath?: string | string[];
  contenu: Map<unknown, unknown>;
}

export type GesteMagasin = 'get' | 'getAll' | 'put' | 'delete' | 'clear';

/** Une requête adressée à un magasin : son geste, et sa clé ou sa valeur quand il en porte. */
export interface RequeteSimulee {
  magasin: string;
  geste: GesteMagasin;
  cle?: unknown;
  valeur?: unknown;
}

/** L'erreur qu'une requête rencontre (`null` : elle aboutit). Une lecture en échec rejette sa
 *  requête ; une écriture en échec fait échouer sa transaction. */
export type PanneSimulee = (q: RequeteSimulee) => DOMException | null;

/** Transaction simulée : se termine au microtask qui suit sa création. Ses écritures ne touchent le
 *  contenu qu'à son `complete` ; une transaction en échec n'en applique aucune. Ses lectures voient
 *  le contenu validé. */
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
  /** Les écritures VALIDÉES, dans l'ordre. */
  ecritures: RequeteSimulee[];
  fermetures: number;
  panne: PanneSimulee;
  /** Annulation au COMMIT de toute transaction qui écrit (`abort` sans `error`, comme un quota
   *  dépassé à la validation) : son `error`, `null` pour une annulation sans cause. `undefined` :
   *  aucune annulation. */
  annulationAuCommit: DOMException | null | undefined;
  /** La vue `IDBDatabase` que reçoivent `upgrade` et les opérations. */
  db: IDBDatabase;
}

const sansPanne: PanneSimulee = () => null;

/** Requête simulée d'un magasin : se règle au microtask suivant, sur `valeur` ou sur `erreur`. */
function requeteSimulee(valeur: unknown, erreur: DOMException | null = null): IDBRequest {
  const req = { result: valeur, error: erreur, onsuccess: null, onerror: null } as unknown as IDBRequest;
  queueMicrotask(() => (erreur ? req.onerror?.(new Event('error')) : req.onsuccess?.(new Event('success'))));
  return req;
}

/** Base simulée ; `existants` : magasins déjà présents (base d'une version antérieure). */
export function baseSimulee(existants: Record<string, { keyPath?: string | string[] }> = {}): BaseSimulee {
  const magasins = new Map<string, MagasinSimule>(
    Object.entries(existants).map(([nom, o]) => [nom, { ...o, contenu: new Map() }]),
  );
  const etat: BaseSimulee = { magasins, transactions: [], ecritures: [], fermetures: 0, panne: sansPanne, annulationAuCommit: undefined, db: null as unknown as IDBDatabase };
  const rangement = (c: unknown): unknown => (Array.isArray(c) ? JSON.stringify(c) : c);
  const cleDe = (m: MagasinSimule, valeur: unknown, cleExterne: unknown): unknown => {
    if (m.keyPath === undefined) return rangement(cleExterne);
    const v = valeur as Record<string, unknown>;
    return rangement(Array.isArray(m.keyPath) ? m.keyPath.map((k) => v[k]) : v[m.keyPath]);
  };
  /** Vue du magasin `nom` ; `ecrire` reçoit chaque écriture et son geste sur le contenu. */
  const vueMagasin = (nom: string, ecrire: (q: RequeteSimulee, geste: () => void) => IDBRequest): IDBObjectStore => {
    const m = magasins.get(nom);
    if (!m) throw new DOMException(`magasin « ${nom} » absent`, 'NotFoundError');
    const lire = (q: RequeteSimulee, valeur: () => unknown) => {
      const erreur = etat.panne(q);
      return requeteSimulee(erreur ? undefined : valeur(), erreur);
    };
    return {
      get: (cle: unknown) => lire({ magasin: nom, geste: 'get', cle }, () => m.contenu.get(rangement(cle))),
      getAll: () => lire({ magasin: nom, geste: 'getAll' }, () => [...m.contenu.values()]),
      put: (valeur: unknown, cle?: unknown) => {
        const k = cleDe(m, valeur, cle);
        return ecrire({ magasin: nom, geste: 'put', cle, valeur }, () => { m.contenu.set(k, valeur); });
      },
      delete: (cle: unknown) => ecrire({ magasin: nom, geste: 'delete', cle }, () => { m.contenu.delete(rangement(cle)); }),
      clear: () => ecrire({ magasin: nom, geste: 'clear' }, () => { m.contenu.clear(); }),
    } as unknown as IDBObjectStore;
  };
  const ecritureImmediate = (_q: RequeteSimulee, geste: () => void) => { geste(); return requeteSimulee(undefined); };
  etat.db = {
    get objectStoreNames() {
      const noms = [...magasins.keys()];
      return Object.assign(noms, { contains: (nom: string) => magasins.has(nom), item: (i: number) => noms[i] ?? null }) as unknown as DOMStringList;
    },
    createObjectStore: (nom: string, o?: { keyPath?: string | string[] }) => {
      if (magasins.has(nom)) throw new DOMException(`magasin « ${nom} » déjà présent`, 'ConstraintError');
      magasins.set(nom, { keyPath: o?.keyPath, contenu: new Map() });
      return vueMagasin(nom, ecritureImmediate);
    },
    deleteObjectStore: (nom: string) => {
      if (!magasins.delete(nom)) throw new DOMException(`magasin « ${nom} » absent`, 'NotFoundError');
    },
    transaction: (noms: string | string[], mode: IDBTransactionMode = 'readonly') => {
      const enAttente: { q: RequeteSimulee; geste: () => void }[] = [];
      let echec: DOMException | null = null;
      const differer = (q: RequeteSimulee, geste: () => void) => {
        echec ??= etat.panne(q);
        enAttente.push({ q, geste });
        return requeteSimulee(undefined);
      };
      const tx: TransactionSimulee = {
        magasins: Array.isArray(noms) ? noms : [noms],
        mode,
        oncomplete: null,
        onerror: null,
        onabort: null,
        error: null,
        objectStore: (nom) => vueMagasin(nom, differer),
      };
      etat.transactions.push(tx);
      queueMicrotask(() => {
        if (echec) {
          tx.error = echec;
          tx.onerror?.();
          return;
        }
        if (enAttente.length && etat.annulationAuCommit !== undefined) {
          tx.error = etat.annulationAuCommit;
          tx.onabort?.();
          return;
        }
        for (const { q, geste } of enAttente) {
          geste();
          etat.ecritures.push(q);
        }
        tx.oncomplete?.();
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

/** Les bases simulées d'un branchement, par nom. */
export interface BasesSimulees {
  /** La base `nom` ; neuve (version 0) si ni ouverte ni amorcée. */
  base(nom: string): BaseSimulee;
  /** Amorce la base `nom` à `version`, avec ses magasins `existants` : ouverte ensuite à une version
   *  supérieure, elle monte depuis `version`. */
  amorcer(nom: string, version: number, existants: Record<string, { keyPath?: string | string[] }>): BaseSimulee;
  /** Le contenu du magasin `nomMagasin` de la base `nom` ; lève s'il n'existe pas. */
  contenu(nom: string, nomMagasin: string): Map<unknown, unknown>;
}

/** Branche toute ouverture sur une base simulée routée par son NOM : chacune réussit au microtask
 *  suivant, après la montée quand la version demandée dépasse celle de la base. */
export function brancherBasesSimulees(): BasesSimulees {
  const bases = new Map<string, { base: BaseSimulee; version: number }>();
  const entree = (nom: string) => {
    let e = bases.get(nom);
    if (!e) bases.set(nom, (e = { base: baseSimulee(), version: 0 }));
    return e;
  };
  __setOuvertureIdbForTest((nom, version) => {
    const e = entree(nom);
    const o = ouvertureSimulee(e.base);
    queueMicrotask(() => {
      if (e.version < version) {
        o.monter(e.version);
        e.version = version;
      }
      o.reussir();
    });
    return o.req;
  });
  return {
    base: (nom) => entree(nom).base,
    amorcer: (nom, version, existants) => {
      const base = baseSimulee(existants);
      bases.set(nom, { base, version });
      return base;
    },
    contenu: (nom, nomMagasin) => {
      const m = entree(nom).base.magasins.get(nomMagasin);
      if (!m) throw new Error(`magasin « ${nomMagasin} » absent de la base « ${nom} »`);
      return m.contenu;
    },
  };
}
