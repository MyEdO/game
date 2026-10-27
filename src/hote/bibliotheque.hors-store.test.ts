/**
 * LA PROCÉDURE DE LA BIBLIOTHÈQUE sur les ports d'un hôte (#3041) : une `Base` et un `Stockage` en mémoire. La base
 * est la source de vérité, le stockage porte le miroir et les tombes (#776) ; une entrée refusée reste listée et se
 * réécrit telle quelle (#2404) ; l'état vit dans la poignée.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ouvrirLaBibliotheque, type BaseDeLaBibliotheque } from './bibliotheque';
import { ProjetRefuse, type SavedProject } from '../noyau/index';
import type { Stockage } from '../lib/stockage';
import { stockageEnMemoire } from '../lib/stockage.testkit';

/** Les clés persistées du miroir et des tombes : le format du stockage d'un joueur. */
const CLE_DU_MIROIR = 'wfrp4.editor-projects';
const CLE_DES_TOMBES = 'wfrp4.editor-projects.tombstones';

/** Une `Base` en mémoire keyée par `id` ; `panne` : les ids dont l'écriture et la suppression rejettent. */
function baseEnMemoire(panne: Set<string> = new Set()): BaseDeLaBibliotheque & { contenu: Map<string, unknown> } {
  const contenu = new Map<string, unknown>();
  const echec = (id: string) => (panne.has(id) ? Promise.reject(new Error(`panne (${id})`)) : null);
  return {
    contenu,
    lire: async (cle) => contenu.get(cle) ?? null,
    lireTout: async () => [...contenu.values()],
    ecrire: (valeur) => {
      const id = (valeur as { id: string }).id;
      return echec(id) ?? Promise.resolve(void contenu.set(id, valeur));
    },
    supprimer: (cle) => echec(cle) ?? Promise.resolve(void contenu.delete(cle)),
  };
}

const entree = (id: string, desc?: string): SavedProject => ({
  id,
  label: `Projet ${id}`,
  startSceneId: 's1',
  savedAt: 1000,
  published: false,
  project: { scenes: [], ...(desc === undefined ? {} : { desc }) },
});

const ouvrir = (base: BaseDeLaBibliotheque | null, stockage: Stockage | null) =>
  ouvrirLaBibliotheque(() => base, () => stockage, { borneDuMiroirParEntree: 500_000, causesDIndisponibilite: 'accès refusé' });
const ids = (l: readonly { id: string }[]) => l.map((e) => e.id);
const miroir = (s: Stockage) => JSON.parse(s.getItem(CLE_DU_MIROIR) ?? '[]') as unknown[];

afterEach(() => vi.restoreAllMocks());

describe('ouvrirLaBibliotheque — réconciliation de la base et du miroir (#776)', () => {
  it('une entrée du miroir absente de la base y est recopiée, et servie', async () => {
    const base = baseEnMemoire();
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_DU_MIROIR, JSON.stringify([entree('a'), entree('b')]));
    base.contenu.set('a', entree('a'));
    const b = ouvrir(base, stockage);
    await b.initLibrary();
    expect([...base.contenu.keys()].sort()).toEqual(['a', 'b']);
    expect(ids(b.projectsLoad()).sort()).toEqual(['a', 'b']);
  });

  it('une entrée tombée n’est jamais ressuscitée : ni par le miroir, ni par la base, à la relecture comme à la réconciliation', async () => {
    const base = baseEnMemoire(new Set(['a']));
    const stockage = stockageEnMemoire();
    const b = ouvrir(base, stockage);
    await b.projectSave(entree('b'));
    base.contenu.set('a', entree('a'));
    await b.projectRemove('a');
    expect(JSON.parse(stockage.getItem(CLE_DES_TOMBES)!)).toEqual(['a']);
    stockage.setItem(CLE_DU_MIROIR, JSON.stringify([entree('a'), entree('b')]));
    const relue = ouvrir(base, stockage);
    expect(ids(relue.projectsLoad())).toEqual(['b']);
    await relue.initLibrary();
    expect(ids(relue.projectsLoad())).toEqual(['b']);
  });

  it('sans base, la bibliothèque est le miroir, tombes filtrées', async () => {
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_DU_MIROIR, JSON.stringify([entree('a'), entree('b')]));
    stockage.setItem(CLE_DES_TOMBES, JSON.stringify(['a']));
    const b = ouvrir(null, stockage);
    await b.initLibrary();
    expect(ids(b.projectsLoad())).toEqual(['b']);
    expect(JSON.parse(stockage.getItem(CLE_DES_TOMBES)!)).toEqual(['a']);
  });

  it('une tombe dont la base confirme l’absence est purgée', async () => {
    const base = baseEnMemoire();
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_DES_TOMBES, JSON.stringify(['a']));
    await ouvrir(base, stockage).initLibrary();
    expect(JSON.parse(stockage.getItem(CLE_DES_TOMBES)!)).toEqual([]);
  });

  it('une tombe que le stockage refuse reste en attente dans la poignée : l’entrée n’est pas ressuscitée', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = baseEnMemoire(new Set(['a']));
    const stockage = stockageEnMemoire({ refuserEcriture: (cle) => cle === CLE_DES_TOMBES });
    const b = ouvrir(base, stockage);
    await b.projectSave(entree('b'));
    stockage.setItem(CLE_DU_MIROIR, JSON.stringify([entree('a'), entree('b')]));
    await b.projectRemove('a');
    stockage.contenu.set(CLE_DU_MIROIR, JSON.stringify([entree('a'), entree('b')]));
    base.contenu.set('a', entree('a'));
    await b.initLibrary();
    expect(ids(b.projectsLoad())).toEqual(['b']);
  });
});

describe('ouvrirLaBibliotheque — miroir borné PAR ENTRÉE (#776)', () => {
  it('une entrée trop grosse est écartée du miroir, les petites y restent ; la base suffit', async () => {
    const base = baseEnMemoire();
    const stockage = stockageEnMemoire();
    const b = ouvrir(base, stockage);
    await b.projectSave(entree('petit'));
    expect(await b.projectSave(entree('gros', 'x'.repeat(600_000)))).toEqual({ ok: true });
    expect(ids(miroir(stockage) as SavedProject[])).toEqual(['petit']);
    expect([...base.contenu.keys()].sort()).toEqual(['gros', 'petit']);
  });

  it('trop grosse pour le miroir ET base en échec : perte signalée au joueur', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = ouvrir(baseEnMemoire(new Set(['gros'])), stockageEnMemoire());
    const issue = await b.projectSave(entree('gros', 'x'.repeat(600_000)));
    expect(issue.ok).toBe(false);
  });

  it('base en échec, miroir actif : absorbée, dégradée', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = ouvrir(baseEnMemoire(new Set(['a'])), stockageEnMemoire());
    expect(await b.projectSave(entree('a'))).toEqual({ ok: true, degraded: true });
  });

  it('quota dépassé : les entrées les plus volumineuses sortent une à une jusqu’à ce que le miroir s’écrive', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const quota = stockageEnMemoire({ refuserEcriture: (_cle, valeur) => valeur.length > 300_000 });
    const b = ouvrir(baseEnMemoire(), quota);
    await b.projectSave(entree('moyen1', 'x'.repeat(200_000)));
    await b.projectSave(entree('moyen2', 'y'.repeat(250_000)));
    await b.projectSave(entree('petit'));
    expect(ids(miroir(quota) as SavedProject[])).toEqual(['moyen1', 'petit']);
  });
});

describe('ouvrirLaBibliotheque — entrées refusées (#2404)', () => {
  const refusee = { id: 'vieux', label: 'Ancien', format: 1 };
  const sansId = { label: 'Orpheline' };

  it('listée refusée, son refus levé au geste, réécrite brute avec l’entrée indésignable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const stockage = stockageEnMemoire();
    stockage.setItem(CLE_DU_MIROIR, JSON.stringify([refusee, sansId]));
    const b = ouvrir(null, stockage);
    const [listee] = b.projectsLoad();
    expect(listee.id).toBe('vieux');
    expect(b.estRefusee(listee)).toBe(true);
    expect(() => b.projetDeLEntree(listee)).toThrow(ProjetRefuse);
    await b.projectSave(entree('voisin'));
    expect(miroir(stockage)).toEqual([sansId, refusee, entree('voisin')]);
  });

  it('refusée au GESTE par la porte, levée par la réécriture de l’entrée ; témoin propre à la poignée', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const stockage = stockageEnMemoire();
    const b = ouvrir(baseEnMemoire(), stockage);
    const fautive = { ...entree('p'), project: { scenes: [{ id: 's1' }] } };
    await b.projectSave(fautive);
    const [listee] = b.projectsLoad();
    expect(b.estRefusee(listee)).toBe(false);
    expect(() => b.campagneDeLEntree(listee)).toThrow(ProjetRefuse);
    expect(b.estRefusee(listee)).toBe(true);
    expect(ouvrir(null, stockage).estRefusee(listee)).toBe(false);
    await b.projectSave(fautive);
    expect(b.estRefusee(listee)).toBe(false);
  });
});
