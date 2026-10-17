import { describe, it, expect, afterEach, vi } from 'vitest';
import { __setFabriqueIdbForTest, accesBase, idbDisponible, type BaseIdb } from './indexedDb';
import { baseSimulee, brancherBasesSimulees, brancherOuvertures, ouvertureSimulee, type BaseSimulee, type OuvertureSimulee } from './indexedDb.testkit';

const BASE: BaseIdb = { nom: 'wfrp4-essai', magasins: { choses: { keyPath: 'id' } } };

/** Branche l'ouverture sur `base` ; rend chaque ouverture demandée, avec ses arguments. */
function brancher(base: BaseSimulee): { ouvertures: (OuvertureSimulee & { args: unknown[] })[] } {
  const ouvertures: (OuvertureSimulee & { args: unknown[] })[] = [];
  brancherOuvertures((...args: unknown[]) => {
    const o = { ...ouvertureSimulee(base), args };
    ouvertures.push(o);
    return o.req;
  });
  return { ouvertures };
}

afterEach(() => {
  __setFabriqueIdbForTest(null);
  vi.useRealTimers();
});

describe('idbDisponible — `indexedDB` présent OU fabrique substituée', () => {
  it('sans `indexedDB` et sans substitution : indisponible', () => {
    expect(typeof indexedDB).toBe('undefined');
    expect(idbDisponible()).toBe(false);
  });

  it('fabrique substituée : disponible ; substitution retirée : indisponible', () => {
    brancherOuvertures(() => ouvertureSimulee(baseSimulee()).req);
    expect(idbDisponible()).toBe(true);
    __setFabriqueIdbForTest(null);
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

describe('ouverture d’une base, par la poignée — un seul règlement, jamais d’attente indéfinie (#776)', () => {
  const lireChoses = (base: BaseIdb = BASE) => accesBase(base).magasin<{ id: string }, string>('choses').lireTout();
  const avecChoses = () => baseSimulee({ choses: { keyPath: 'id' } });

  it('succès : l’opération joue sur la connexion ouverte au SEUL nom de la base, ses magasins créés de la déclaration, puis refermée', async () => {
    const base = baseSimulee();
    const { ouvertures } = brancher(base);
    const p = lireChoses();
    ouvertures[0].monter();
    base.magasins.get('choses')!.contenu.set('a', { id: 'a' });
    ouvertures[0].reussir();
    await expect(p).resolves.toEqual([{ id: 'a' }]);
    expect(ouvertures[0].args).toEqual(['wfrp4-essai']);
    expect(base.magasins.get('choses')?.keyPath).toBe('id');
    expect(base.fermetures).toBe(1);
  });

  it('erreur : l’opération rejette avec l’erreur de la requête d’ouverture', async () => {
    const { ouvertures } = brancher(avecChoses());
    const p = lireChoses();
    const erreur = new DOMException('refus', 'UnknownError');
    ouvertures[0].echouer(erreur);
    await expect(p).rejects.toBe(erreur);
  });

  it('bloqué : l’opération rejette sans attendre la fermeture de l’autre connexion', async () => {
    const { ouvertures } = brancher(avecChoses());
    const p = lireChoses();
    ouvertures[0].bloquer();
    await expect(p).rejects.toThrow('bloqué');
  });

  it('délai : une ouverture sans aucun événement fait rejeter l’opération à l’échéance de son délai', async () => {
    vi.useFakeTimers();
    brancher(avecChoses());
    let issue = 'en attente';
    const p = lireChoses().then(() => { issue = 'réglée'; }, (e: Error) => { issue = e.message; });
    await Promise.resolve();
    expect([issue, vi.getTimerCount()]).toEqual(['en attente', 1]);
    await vi.advanceTimersToNextTimerAsync();
    await p;
    expect(issue).toBe('IndexedDB open : délai dépassé');
  });

  it('un seul règlement : l’erreur qui suit un succès ne change rien, et le délai est désarmé', async () => {
    vi.useFakeTimers();
    const { ouvertures } = brancher(avecChoses());
    const p = lireChoses();
    ouvertures[0].reussir();
    ouvertures[0].echouer(new DOMException('tardive', 'UnknownError'));
    await expect(p).resolves.toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('succès tardif (après le délai, ou après un blocage) : la connexion est refermée', async () => {
    vi.useFakeTimers();
    const base = avecChoses();
    const { ouvertures } = brancher(base);
    const expiree = lireChoses().catch((e: Error) => e.message);
    await vi.advanceTimersToNextTimerAsync();
    expect(await expiree).toBe('IndexedDB open : délai dépassé');
    ouvertures[0].reussir();
    expect(base.fermetures).toBe(1);

    const bloquee = lireChoses().catch((e: Error) => e.message);
    ouvertures[1].bloquer();
    expect(await bloquee).toContain('bloqué');
    ouvertures[1].reussir();
    expect(base.fermetures).toBe(2);
  });
});

describe('accesBase — un magasin par opération, sa connexion fermée à son règlement', () => {
  const choses = accesBase(BASE).magasin<{ id: string; n?: number }, string>('choses');

  it('sans IndexedDB : `lire` rend `null`, `lireTout` `[]`, les écritures et le vidage ne font rien', async () => {
    await expect(choses.lire('a')).resolves.toBeNull();
    await expect(choses.lireTout()).resolves.toEqual([]);
    await expect(choses.ecrire({ id: 'a' })).resolves.toBeUndefined();
    await expect(choses.supprimer('a')).resolves.toBeUndefined();
    await expect(accesBase(BASE).vider()).resolves.toBeUndefined();
  });

  it('écrit, relit, supprime, chaque opération dans sa transaction et sa connexion, refermée', async () => {
    const base = brancherBasesSimulees().base(BASE.nom);
    await choses.ecrire({ id: 'a', n: 1 });
    await expect(choses.lire('a')).resolves.toEqual({ id: 'a', n: 1 });
    await expect(choses.lireTout()).resolves.toEqual([{ id: 'a', n: 1 }]);
    await choses.supprimer('a');
    await expect(choses.lire('a')).resolves.toBeNull();
    const conformite = [['choses'], 'readonly'];
    expect(base.transactions.map((t) => [t.magasins, t.mode])).toEqual([
      conformite, [['choses'], 'readwrite'], conformite, [['choses'], 'readonly'], conformite, [['choses'], 'readonly'],
      conformite, [['choses'], 'readwrite'], conformite, [['choses'], 'readonly'],
    ]);
    expect(base.fermetures).toBe(5);
  });

  it('clé externe et clé composée passent telles quelles', async () => {
    const bases = brancherBasesSimulees();
    const externe: BaseIdb = { nom: 'wfrp4-externe', magasins: { poignees: {} } };
    const composee: BaseIdb = { nom: 'wfrp4-composee', magasins: { couches: { keyPath: ['scene', 'z'] } } };
    const poignees = accesBase(externe).magasin<{ kind: string }, string>('poignees');
    const couches = accesBase(composee).magasin<{ scene: string; z: number }, [string, number]>('couches');
    await poignees.ecrire({ kind: 'directory' }, 'dataDir');
    await couches.ecrire({ scene: 's', z: 1 });
    await expect(poignees.lire('dataDir')).resolves.toEqual({ kind: 'directory' });
    await expect(couches.lire(['s', 1])).resolves.toEqual({ scene: 's', z: 1 });
    await expect(couches.lire(['s', 0])).resolves.toBeNull();
    expect(bases.base('wfrp4-externe').ecritures).toEqual([{ magasin: 'poignees', geste: 'put', cle: 'dataDir', valeur: { kind: 'directory' } }]);
  });

  it('une écriture en panne rejette, n’applique RIEN, et la connexion est refermée quand même', async () => {
    const base = brancherBasesSimulees().base(BASE.nom);
    await choses.ecrire({ id: 'a' });
    const erreur = new DOMException('quota', 'QuotaExceededError');
    base.panne = (q) => (q.geste === 'put' && (q.valeur as { id: string }).id === 'b' ? erreur : null);
    await expect(choses.ecrire({ id: 'b' })).rejects.toBe(erreur);
    await expect(choses.lire('b')).resolves.toBeNull();
    expect(base.ecritures.map((q) => q.valeur)).toEqual([{ id: 'a' }]);
    expect(base.fermetures).toBe(3);
  });

  it('une transaction annulée au commit rejette par son erreur, ou « transaction annulée » sans cause, et n’applique RIEN', async () => {
    const base = brancherBasesSimulees().base(BASE.nom);
    const quota = new DOMException('quota', 'QuotaExceededError');
    base.annulationAuCommit = quota;
    await expect(choses.ecrire({ id: 'a' })).rejects.toBe(quota);
    base.annulationAuCommit = null;
    await expect(choses.supprimer('a')).rejects.toThrow('transaction annulée');
    expect(base.ecritures).toEqual([]);
    expect(base.fermetures).toBe(2);
  });

  it('une lecture en panne rejette par sa requête, et la connexion est refermée quand même', async () => {
    const base = brancherBasesSimulees().base(BASE.nom);
    const erreur = new DOMException('illisible', 'UnknownError');
    base.panne = (q) => (q.geste === 'getAll' ? erreur : null);
    await expect(choses.lireTout()).rejects.toBe(erreur);
    await expect(choses.lire('a')).resolves.toBeNull();
    expect(base.fermetures).toBe(2);
  });

  it('un magasin absent rejette, et la connexion est refermée quand même', async () => {
    const base = brancherBasesSimulees().base(BASE.nom);
    await expect(accesBase(BASE).magasin('absent').lireTout()).rejects.toThrow('absent');
    expect(base.fermetures).toBe(1);
  });

  it('`vider` vide TOUS les magasins de la base dans UNE transaction ; en panne, il n’en vide aucun', async () => {
    const deux: BaseIdb = {
      nom: 'wfrp4-deux',
      magasins: { a: { keyPath: 'id' }, b: { keyPath: 'id' } },
    };
    const bases = brancherBasesSimulees();
    const acces = accesBase(deux);
    await acces.magasin('a').ecrire({ id: 1 });
    await acces.magasin('b').ecrire({ id: 2 });
    const base = bases.base('wfrp4-deux');
    base.panne = (q) => (q.geste === 'clear' && q.magasin === 'b' ? new DOMException('quota', 'QuotaExceededError') : null);
    await expect(acces.vider()).rejects.toThrow('quota');
    expect([bases.contenu('wfrp4-deux', 'a').size, bases.contenu('wfrp4-deux', 'b').size]).toEqual([1, 1]);
    base.panne = () => null;
    await acces.vider();
    expect([bases.contenu('wfrp4-deux', 'a').size, bases.contenu('wfrp4-deux', 'b').size]).toEqual([0, 0]);
    expect(base.transactions[base.transactions.length - 1].magasins).toEqual(['a', 'b']);
  });
});

describe('ouverture déclarative — la base existante est comparée à sa déclaration, recréée si elle s’en écarte (#2404)', () => {
  const choses = accesBase(BASE).magasin<{ id: string }, string>('choses');

  it('base neuve : créée depuis la déclaration, aucune suppression', async () => {
    const bases = brancherBasesSimulees();
    await choses.ecrire({ id: 'a' });
    expect(bases.base(BASE.nom).magasins.get('choses')?.keyPath).toBe('id');
    expect(bases.suppressions).toEqual([]);
  });

  it('base existante conforme : ouverte telle quelle, son contenu gardé', async () => {
    const bases = brancherBasesSimulees();
    bases.amorcer(BASE.nom, { choses: { keyPath: 'id' } }).magasins.get('choses')!.contenu.set('p', { id: 'p' });
    await expect(choses.lire('p')).resolves.toEqual({ id: 'p' });
    expect(bases.suppressions).toEqual([]);
  });

  it.each<[string, Record<string, { keyPath?: string | string[] }>]>([
    ['magasin manquant', {}],
    ['magasin en trop', { choses: { keyPath: 'id' }, vieux: {} }],
    ['`keyPath` différent', { choses: { keyPath: 'cle' } }],
    ['`keyPath` composée au lieu de simple', { choses: { keyPath: ['id'] } }],
    ['clés externes au lieu d’une `keyPath`', { choses: {} }],
  ])('%s : la base est supprimée puis recréée depuis la déclaration, ses données perdues', async (_cas, existants) => {
    const bases = brancherBasesSimulees();
    const ancienne = bases.amorcer(BASE.nom, existants);
    for (const m of ancienne.magasins.values()) m.contenu.set('p', { id: 'p' });
    await expect(choses.lire('p')).resolves.toBeNull();
    expect(bases.suppressions).toEqual([BASE.nom]);
    expect([...bases.base(BASE.nom).magasins].map(([nom, m]) => [nom, m.keyPath])).toEqual([['choses', 'id']]);
    expect(ancienne.fermetures).toBe(ancienne.ouvertures);
  });

  it('une base encore non conforme après sa recréation : erreur nommée, une seule suppression', async () => {
    const suppressions: string[] = [];
    __setFabriqueIdbForTest({
      open: () => {
        const o = ouvertureSimulee(baseSimulee({ autre: {} }));
        queueMicrotask(() => o.reussir());
        return o.req;
      },
      deleteDatabase: (nom) => {
        suppressions.push(nom);
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => req.onsuccess?.(new Event('success')));
        return req;
      },
    });
    await expect(choses.lireTout()).rejects.toMatchObject({ name: 'BaseIdbNonConforme' });
    expect(suppressions).toEqual([BASE.nom]);
  });

  it('suppression bloquée : l’opération rejette sans attendre', async () => {
    __setFabriqueIdbForTest({
      open: () => {
        const o = ouvertureSimulee(baseSimulee());
        queueMicrotask(() => o.reussir());
        return o.req;
      },
      deleteDatabase: () => {
        const req = {} as IDBOpenDBRequest;
        queueMicrotask(() => req.onblocked?.(new Event('blocked') as IDBVersionChangeEvent));
        return req;
      },
    });
    await expect(choses.lireTout()).rejects.toThrow('IndexedDB delete : bloqué');
  });
});

describe('brancherBasesSimulees — un branchement, une base par nom', () => {
  it('deux bases ouvertes par le même branchement restent distinctes', async () => {
    const bases = brancherBasesSimulees();
    const autre: BaseIdb = { nom: 'wfrp4-autre', magasins: { choses: { keyPath: 'id' } } };
    await accesBase(BASE).magasin('choses').ecrire({ id: 'e' });
    await accesBase(autre).magasin('choses').ecrire({ id: 'x' });
    await accesBase(BASE).magasin('choses').ecrire({ id: 'f' });
    expect([...bases.contenu('wfrp4-essai', 'choses').keys()]).toEqual(['e', 'f']);
    expect([...bases.contenu('wfrp4-autre', 'choses').keys()]).toEqual(['x']);
    expect(bases.suppressions).toEqual([]);
  });
});
