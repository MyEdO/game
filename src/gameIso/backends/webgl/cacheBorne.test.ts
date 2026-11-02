/**
 * Contrat du CACHE BORNÉ (#1374) — la machinerie d'éviction des textures statiques
 * (`svgTexture`). Les valeurs sont des JETONS (poids + drapeau de libération) : ce module ne
 * connaît ni three ni le DOM, et son contrat se juge sans eux.
 */
import { describe, expect, it, vi } from 'vitest';
import { CacheBorne } from './cacheBorne';

interface Jeton {
  id: string;
  bytes: number;
  libéré: boolean;
}

const jeton = (id: string, bytes = 100): Jeton => ({ id, bytes, libéré: false });

/** Cache de jetons + journal des libérations et des fabrications. */
function banc(budget: number) {
  const libérés: string[] = [];
  const faits: string[] = [];
  const cache = new CacheBorne<Jeton>({
    budget,
    bytesDe: (j) => j.bytes,
    disposer: (j) => { j.libéré = true; libérés.push(j.id); },
  });
  const poser = (clé: string, bytes = 100): Promise<Jeton> =>
    cache.obtenir(clé, async () => { faits.push(clé); return jeton(clé, bytes); });
  return { cache, libérés, faits, poser };
}

describe('CacheBorne — LRU à budget d’octets', () => {
  it('l’entrée SERVIE remonte en queue : c’est la plus vieille NON servie qui saute', async () => {
    const b = banc(1000);
    await b.poser('a');
    await b.poser('b');
    await b.poser('c');
    await b.poser('a'); // 'a' re-servie : 'b' devient la plus vieille
    expect(b.faits).toEqual(['a', 'b', 'c']); // la 2ᵉ demande de 'a' n'a rien refabriqué

    b.cache.définirBudget(200); // deux entrées tiennent

    expect(b.libérés).toEqual(['b']);
    expect(b.cache.stats()).toEqual({ entries: 2, bytes: 200 });
    // …et la victime se REFABRIQUE à la demande suivante, les survivantes non.
    await b.poser('a');
    await b.poser('c');
    expect(b.faits).toEqual(['a', 'b', 'c']);
    await b.poser('b');
    expect(b.faits).toEqual(['a', 'b', 'c', 'b']);
  });

  it('le budget est TENU à la résolution : rien ne s’accumule au-delà', async () => {
    const b = banc(250);
    for (const clé of ['a', 'b', 'c', 'd', 'e']) await b.poser(clé);
    expect(b.cache.stats().bytes).toBeLessThanOrEqual(250);
    expect(b.cache.stats()).toEqual({ entries: 2, bytes: 200 });
    expect(b.libérés, 'les évincées doivent être LIBÉRÉES, pas seulement oubliées').toEqual(['a', 'b', 'c']);
  });

  it('une entrée ÉPINGLÉE ne saute JAMAIS, même la plus vieille', async () => {
    const b = banc(1000);
    await b.poser('vieille');
    await b.poser('récente');
    b.cache.épingler(['vieille']);

    b.cache.définirBudget(100);

    expect(b.libérés).toEqual(['récente']);
    expect(b.cache.stats()).toEqual({ entries: 1, bytes: 100 });
    // PRÉMISSE — l'épingle est bien ce qui la sauve : dépinglée, la même pression l'emporte.
    b.cache.épingler([]);
    b.cache.définirBudget(0);
    expect(b.libérés).toEqual(['récente', 'vieille']);
  });

  it('une entrée NON RÉSOLUE n’est jamais évincée (rien à libérer, sa promesse est déjà tenue)', async () => {
    const b = banc(1000);
    await b.poser('résolue');
    let tenir: (j: Jeton) => void = () => undefined;
    const enVol = b.cache.obtenir('en-vol', () => new Promise<Jeton>((r) => { tenir = r; }));

    b.cache.définirBudget(0);

    expect(b.libérés, 'la résolue saute, jamais celle qui court').toEqual(['résolue']);
    expect(b.cache.stats()).toEqual({ entries: 1, bytes: 0 });
    // Elle finit sa course et se pèse : sa propre résolution la protège (elle part chez son
    // demandeur), la pression SUIVANTE l'emporte.
    tenir(jeton('en-vol'));
    await enVol;
    expect(b.libérés).toEqual(['résolue']);
    b.cache.définirBudget(0);
    expect(b.libérés).toEqual(['résolue', 'en-vol']);
  });

  it('un ÉCHEC n’est pas mémoïsé : la demande suivante refait `faire`', async () => {
    const b = banc(1000);
    const faire = vi
      .fn<() => Promise<Jeton>>()
      .mockRejectedValueOnce(new Error('boum'))
      .mockResolvedValue(jeton('k'));
    await expect(b.cache.obtenir('k', faire)).rejects.toThrow('boum');
    expect(b.cache.stats()).toEqual({ entries: 0, bytes: 0 });
    const ok = await b.cache.obtenir('k', faire);
    expect(await b.cache.obtenir('k', faire), 'après le succès, la clé redevient mémoïsée').toBe(ok);
    expect(faire).toHaveBeenCalledTimes(2);
  });

  it('POIGNÉE : passée à la fabrique de l’entrée neuve, rendue à `servir` sur une clé au cache', async () => {
    const cache = new CacheBorne<Jeton, { value: number }>({ budget: 1000, bytesDe: (j) => j.bytes, disposer: () => undefined });
    const vues: { value: number }[] = [];
    const p = cache.obtenir('k', async (poignée) => { vues.push(poignée); return jeton('k'); }, { poignée: { value: 1 } });
    await p;
    cache.obtenir('k', async () => jeton('k'), { poignée: { value: 9 }, servir: (poignée) => { poignée.value = 7; } });
    expect(vues.map((v) => v.value), 'la poignée de l’entrée est celle que `servir` a relevée').toEqual([7]);
  });

  it('`vider` libère tout et oublie les épingles', async () => {
    const b = banc(1000);
    await b.poser('a');
    await b.poser('b');
    b.cache.épingler(['a']);

    b.cache.vider();

    expect(b.libérés.sort()).toEqual(['a', 'b']);
    expect(b.cache.stats()).toEqual({ entries: 0, bytes: 0 });
    // Les épingles sont tombées avec le stock : 'a' refabriquée n'est plus protégée.
    await b.poser('a');
    b.cache.définirBudget(0);
    expect(b.libérés.filter((k) => k === 'a').length).toBe(2);
  });

  it('`valeur` rend la valeur résolue en synchrone, sans compter comme un usage', async () => {
    const b = banc(1000);
    await b.poser('a');
    await b.poser('b');
    expect(b.cache.valeur('a')?.id).toBe('a');
    expect(b.cache.valeur('jamais-demandée')).toBeUndefined();
    b.cache.valeur('a'); // relue cent fois par la boucle d'image : l'ordre ne bouge pas
    b.cache.définirBudget(100);
    expect(b.libérés, 'une lecture synchrone a rajeuni l’entrée : l’ordre LRU ne serait plus l’usage').toEqual(['a']);
  });

  it('la valeur RENDUE n’est pas libérée par l’éviction de sa PROPRE résolution', async () => {
    const b = banc(100);
    // 'a' et 'b' demandées ENSEMBLE, chacune 100 o : à la résolution de 'a', le stock pèse déjà 200 o
    // (l'estimation de 'b' compte) et l'éviction court. Sans protection, la seule entrée résolue et
    // évinçable est 'a' elle-même — son demandeur recevrait une valeur libérée.
    let tenirA: (j: Jeton) => void = () => undefined;
    const pa = b.cache.obtenir('a', () => new Promise<Jeton>((r) => { tenirA = r; }), { bytesEst: 100 });
    let tenirB: (j: Jeton) => void = () => undefined;
    const pb = b.cache.obtenir('b', () => new Promise<Jeton>((r) => { tenirB = r; }), { bytesEst: 100 });

    const ja = jeton('a');
    tenirA(ja);
    const rendue = await pa;

    expect(rendue.libéré, 'la valeur rendue à son demandeur a été libérée dans la foulée').toBe(false);
    expect(b.libérés).toEqual([]);
    // …et la protection ne vaut QUE pour cette résolution : celle de 'b' peut l'évincer (seule
    // l'ÉPINGLE tient au-delà).
    const jb = jeton('b');
    tenirB(jb);
    await pb;
    expect(jb.libéré, 'la valeur rendue par CETTE résolution est protégée à son tour').toBe(false);
    expect(b.libérés).toEqual(['a']);
  });

  it('bytesEst : une entrée EN VOL pèse au budget et évince une vieille RÉSOLUE', async () => {
    const b = banc(200);
    await b.poser('vieille');
    await b.poser('récente');
    expect(b.libérés, 'PRÉMISSE : deux entrées de 100 o tiennent dans 200 o').toEqual([]);

    b.cache.obtenir('en-vol', () => new Promise<Jeton>(() => undefined), { bytesEst: 100 });

    expect(b.libérés, 'l’estimation ne pèse pas : le stock gonfle pendant toute la cuisson').toEqual(['vieille']);
    expect(b.cache.stats(), 'l’entrée en vol compte son ESTIMATION, pas zéro').toEqual({ entries: 2, bytes: 200 });
  });

  it('une valeur résolue APRÈS le retrait de son entrée est libérée en orpheline', async () => {
    const b = banc(1000);
    let tenir: (j: Jeton) => void = () => undefined;
    const enVol = b.cache.obtenir('orpheline', () => new Promise<Jeton>((r) => { tenir = r; }));
    b.cache.vider();
    const j = jeton('orpheline');
    tenir(j);
    await enVol;
    expect(j.libéré, 'la valeur d’une entrée retirée fuirait sans cette libération').toBe(true);
    expect(b.libérés).toEqual(['orpheline']);
  });
});
