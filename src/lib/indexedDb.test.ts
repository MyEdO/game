import { describe, it, expect, afterEach, vi } from 'vitest';
import { __setOuvertureIdbForTest, accesBase, idbDisponible, type BaseIdb } from './indexedDb';
import { baseSimulee, brancherBasesSimulees, ouvertureSimulee, type BaseSimulee, type OuvertureSimulee } from './indexedDb.testkit';

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

describe('ouverture d’une base, par la poignée — un seul règlement, jamais d’attente indéfinie (#776)', () => {
  const lireChoses = (base: BaseIdb = BASE) => accesBase(base).magasin<{ id: string }, string>('choses').lireTout();
  const avecChoses = () => baseSimulee({ choses: { keyPath: 'id' } });

  it('succès : l’opération joue sur la connexion ouverte au nom et à la version de la base, montée depuis l’ancienne version, puis refermée', async () => {
    const base = baseSimulee();
    const vues: number[] = [];
    const { ouvertures } = brancher(base);
    const p = lireChoses({ ...BASE, upgrade: (db, ancienne) => { vues.push(ancienne); BASE.upgrade(db, ancienne); } });
    ouvertures[0].monter(2);
    base.magasins.get('choses')!.contenu.set('a', { id: 'a' });
    ouvertures[0].reussir();
    await expect(p).resolves.toEqual([{ id: 'a' }]);
    expect([ouvertures[0].nom, ouvertures[0].version]).toEqual(['wfrp4-essai', 3]);
    expect(vues).toEqual([2]);
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
    expect(base.transactions.map((t) => [t.magasins, t.mode])).toEqual([
      [['choses'], 'readwrite'], [['choses'], 'readonly'], [['choses'], 'readonly'], [['choses'], 'readwrite'], [['choses'], 'readonly'],
    ]);
    expect(base.fermetures).toBe(5);
  });

  it('clé externe et clé composée passent telles quelles', async () => {
    const bases = brancherBasesSimulees();
    const externe: BaseIdb = { nom: 'wfrp4-externe', version: 1, upgrade: (db) => { db.createObjectStore('poignees'); } };
    const composee: BaseIdb = { nom: 'wfrp4-composee', version: 1, upgrade: (db) => { db.createObjectStore('couches', { keyPath: ['scene', 'z'] }); } };
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
      version: 1,
      upgrade: (db) => { db.createObjectStore('a', { keyPath: 'id' }); db.createObjectStore('b', { keyPath: 'id' }); },
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

describe('brancherBasesSimulees — un branchement, une base par nom', () => {
  it('deux bases ouvertes par le même branchement restent distinctes, chacune montée UNE fois', async () => {
    const bases = brancherBasesSimulees();
    const montees: string[] = [];
    const autre: BaseIdb = { nom: 'wfrp4-autre', version: 1, upgrade: (db) => { montees.push('autre'); db.createObjectStore('choses', { keyPath: 'id' }); } };
    const essai: BaseIdb = { ...BASE, upgrade: (db, v) => { montees.push('essai'); BASE.upgrade(db, v); } };
    await accesBase(essai).magasin('choses').ecrire({ id: 'e' });
    await accesBase(autre).magasin('choses').ecrire({ id: 'x' });
    await accesBase(essai).magasin('choses').ecrire({ id: 'f' });
    expect([...bases.contenu('wfrp4-essai', 'choses').keys()]).toEqual(['e', 'f']);
    expect([...bases.contenu('wfrp4-autre', 'choses').keys()]).toEqual(['x']);
    expect(montees).toEqual(['essai', 'autre']);
  });

  it('une base amorcée à une version antérieure monte depuis elle ; à la version courante, ne monte pas', async () => {
    const bases = brancherBasesSimulees();
    const vues: number[] = [];
    const amorcee = bases.amorcer(BASE.nom, 2, { vieux: {} });
    await accesBase({ ...BASE, upgrade: (db, v) => { vues.push(v); BASE.upgrade(db, v); } }).magasin('choses').lireTout();
    expect(vues).toEqual([2]);
    expect([...amorcee.magasins.keys()]).toEqual(['vieux', 'choses']);

    const aJour = bases.amorcer('wfrp4-a-jour', 1, { choses: { keyPath: 'id' } });
    aJour.magasins.get('choses')!.contenu.set('p', { id: 'p' });
    await expect(accesBase({ ...BASE, nom: 'wfrp4-a-jour', version: 1, upgrade: () => { vues.push(-1); } }).magasin('choses').lire('p')).resolves.toEqual({ id: 'p' });
    expect(vues).toEqual([2]);
  });
});
