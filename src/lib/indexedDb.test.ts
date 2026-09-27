import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  IDB_OPEN_TIMEOUT_MS,
  __setOuvertureIdbForTest,
  ecrireDansBase,
  idbDisponible,
  lireDansBase,
  ouvrirBase,
  requeteReglee,
  transactionReglee,
  type BaseIdb,
} from './indexedDb';
import { baseSimulee, brancherBaseSimulee, ouvertureSimulee, type BaseSimulee, type OuvertureSimulee } from './indexedDb.testkit';

const BASE: BaseIdb = {
  nom: 'wfrp4-essai',
  version: 3,
  upgrade: (db) => { db.createObjectStore('choses', { keyPath: 'id' }); },
};

/** Branche l'ouverture sur `base` ; rend chaque ouverture demandée, avec son nom et sa version. */
function brancher(base: BaseSimulee): { ouvertures: (OuvertureSimulee & { nom: string; version: number })[] } {
  const ouvertures: (OuvertureSimulee & { nom: string; version: number })[] = [];
  __setOuvertureIdbForTest((nom, version) => {
    const o = { ...ouvertureSimulee(base), nom, version };
    ouvertures.push(o);
    return o.req;
  });
  return { ouvertures };
}

afterEach(() => {
  __setOuvertureIdbForTest(null);
  vi.useRealTimers();
});

describe('idbDisponible — `indexedDB` présent OU ouverture substituée', () => {
  it('sans `indexedDB` et sans substitution : indisponible', () => {
    expect(typeof indexedDB).toBe('undefined');
    expect(idbDisponible()).toBe(false);
  });

  it('ouverture substituée : disponible ; substitution retirée : indisponible', () => {
    __setOuvertureIdbForTest(() => ouvertureSimulee(baseSimulee()).req);
    expect(idbDisponible()).toBe(true);
    __setOuvertureIdbForTest(null);
    expect(idbDisponible()).toBe(false);
  });

  it('`indexedDB` présent sans substitution : disponible', () => {
    vi.stubGlobal('indexedDB', {});
    try {
      expect(idbDisponible()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('ouvrirBase — un seul règlement, jamais d’attente indéfinie (#776)', () => {
  it('succès : rend la connexion, ouverte au nom et à la version de la base, montée depuis l’ancienne version', async () => {
    const base = baseSimulee();
    const vues: number[] = [];
    const { ouvertures } = brancher(base);
    const p = ouvrirBase({ ...BASE, upgrade: (db, ancienne) => { vues.push(ancienne); BASE.upgrade(db, ancienne); } });
    ouvertures[0].monter(2);
    ouvertures[0].reussir();
    await expect(p).resolves.toBe(base.db);
    expect([ouvertures[0].nom, ouvertures[0].version]).toEqual(['wfrp4-essai', 3]);
    expect(vues).toEqual([2]);
    expect(base.magasins.get('choses')?.keyPath).toBe('id');
    expect(base.fermetures).toBe(0);
  });

  it('erreur : rejette avec l’erreur de la requête', async () => {
    const { ouvertures } = brancher(baseSimulee());
    const p = ouvrirBase(BASE);
    const erreur = new DOMException('refus', 'UnknownError');
    ouvertures[0].echouer(erreur);
    await expect(p).rejects.toBe(erreur);
  });

  it('bloqué : rejette sans attendre la fermeture de l’autre connexion', async () => {
    const { ouvertures } = brancher(baseSimulee());
    const p = ouvrirBase(BASE);
    ouvertures[0].bloquer();
    await expect(p).rejects.toThrow('bloqué');
  });

  it('délai : une ouverture sans aucun événement rejette à `IDB_OPEN_TIMEOUT_MS`', async () => {
    vi.useFakeTimers();
    brancher(baseSimulee());
    let issue = 'en attente';
    const p = ouvrirBase(BASE).then(() => { issue = 'réglée'; }, (e: Error) => { issue = e.message; });
    await vi.advanceTimersByTimeAsync(IDB_OPEN_TIMEOUT_MS - 1);
    expect(issue).toBe('en attente');
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(issue).toBe('IndexedDB open : délai dépassé');
  });

  it('un seul règlement : l’erreur qui suit un succès ne change rien, et le délai est désarmé', async () => {
    vi.useFakeTimers();
    const base = baseSimulee();
    const { ouvertures } = brancher(base);
    const p = ouvrirBase(BASE);
    ouvertures[0].reussir();
    ouvertures[0].echouer(new DOMException('tardive', 'UnknownError'));
    await expect(p).resolves.toBe(base.db);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('succès tardif (après le délai, ou après un blocage) : la connexion est refermée', async () => {
    vi.useFakeTimers();
    const base = baseSimulee();
    const { ouvertures } = brancher(base);
    const expiree = ouvrirBase(BASE).catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(IDB_OPEN_TIMEOUT_MS);
    expect(await expiree).toBe('IndexedDB open : délai dépassé');
    ouvertures[0].reussir();
    expect(base.fermetures).toBe(1);

    const bloquee = ouvrirBase(BASE).catch((e: Error) => e.message);
    ouvertures[1].bloquer();
    expect(await bloquee).toContain('bloqué');
    ouvertures[1].reussir();
    expect(base.fermetures).toBe(2);
  });
});

describe('requeteReglee / transactionReglee — la mise en promesse, un seul règlement', () => {
  const requete = () => ({ result: undefined, error: null, onsuccess: null, onerror: null }) as unknown as IDBRequest<string>;
  const transaction = () =>
    ({ error: null, oncomplete: null, onerror: null, onabort: null }) as unknown as IDBTransaction;

  it('requête : succès rend le résultat, puis une erreur tardive ne change rien', async () => {
    const r = requete();
    const p = requeteReglee(r);
    (r as { result: string }).result = 'valeur';
    r.onsuccess?.(new Event('success'));
    (r as { error: DOMException }).error = new DOMException('tardive');
    r.onerror?.(new Event('error'));
    await expect(p).resolves.toBe('valeur');
  });

  it('requête : erreur rejette avec l’erreur de la requête', async () => {
    const r = requete();
    const p = requeteReglee(r);
    const erreur = new DOMException('lecture', 'DataError');
    (r as { error: DOMException }).error = erreur;
    r.onerror?.(new Event('error'));
    await expect(p).rejects.toBe(erreur);
  });

  it('transaction : `complete` résout, puis une erreur tardive ne change rien', async () => {
    const tx = transaction();
    const p = transactionReglee(tx);
    tx.oncomplete?.(new Event('complete'));
    tx.onerror?.(new Event('error'));
    await expect(p).resolves.toBeUndefined();
  });

  it('transaction : `error` et `abort` rejettent', async () => {
    const enErreur = transaction();
    const erreur = new DOMException('quota', 'QuotaExceededError');
    const p1 = transactionReglee(enErreur);
    (enErreur as { error: DOMException }).error = erreur;
    enErreur.onerror?.(new Event('error'));
    await expect(p1).rejects.toBe(erreur);

    const annulee = transaction();
    const p2 = transactionReglee(annulee);
    annulee.onabort?.(new Event('abort'));
    await expect(p2).rejects.toThrow('transaction annulée');
  });
});

describe('lireDansBase / ecrireDansBase — une opération, sa connexion fermée à son règlement', () => {
  it('sans IndexedDB : la lecture rend `undefined`, l’écriture ne fait rien', async () => {
    await expect(lireDansBase(BASE, 'choses', (m) => m.getAll())).resolves.toBeUndefined();
    await expect(ecrireDansBase(BASE, 'choses', () => { throw new Error('jamais appelé'); })).resolves.toBeUndefined();
  });

  it('écrit puis relit, chaque opération dans sa transaction et sa connexion, refermée', async () => {
    const base = baseSimulee();
    brancherBaseSimulee(base);
    await ecrireDansBase(BASE, 'choses', (tx) => { tx.objectStore('choses').put({ id: 'a', n: 1 }); });
    await expect(lireDansBase(BASE, 'choses', (m) => m.getAll())).resolves.toEqual([{ id: 'a', n: 1 }]);
    expect(base.transactions.map((t) => [t.magasins, t.mode])).toEqual([[['choses'], 'readwrite'], [['choses'], 'readonly']]);
    expect(base.fermetures).toBe(2);
  });

  it('une transaction en échec rejette, et la connexion est refermée quand même', async () => {
    const base = baseSimulee();
    brancherBaseSimulee(base);
    await ecrireDansBase(BASE, 'choses', () => {});
    const erreur = new DOMException('quota', 'QuotaExceededError');
    base.echec = erreur;
    await expect(ecrireDansBase(BASE, 'choses', (tx) => { tx.objectStore('choses').put({ id: 'b' }); })).rejects.toBe(erreur);
    expect(base.fermetures).toBe(2);
  });

  it('un geste qui lève rejette, et la connexion est refermée quand même', async () => {
    const base = baseSimulee();
    brancherBaseSimulee(base);
    await expect(lireDansBase(BASE, 'absent', (m) => m.getAll())).rejects.toThrow('absent');
    expect(base.fermetures).toBe(1);
  });
});
