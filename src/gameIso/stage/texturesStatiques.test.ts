/**
 * STOCK BORNÉ des textures statiques, au chemin RÉEL du stage (#1374) : `textureAuCran` mémoïse sur la
 * clé de `cleStatique` et cuit par la FILE cadencée. Ce que ces contrats tiennent :
 *  1. sous pression de budget, la texture la plus ancienne NON épinglée est libérée ;
 *  2. sa clé redemandée REPASSE par la file (une rasterisation de plus, jamais un burst) ;
 *  3. la texture ÉPINGLÉE (celle qu'un quad porte à l'écran) survit à la pression.
 *
 * La rasterisation est SIMULÉE à la couture `svgToTexture` (elle seule touche le DOM) : ce qui se juge
 * ici est la politique de stock, pas le dessin.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import type { Rot } from '../../geometry/iso';
import * as svgTexture from '../backends/webgl/svgTexture';
import {
  TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT,
  octetsTextureStatique,
  rasterPxWidth,
  setStaticTextureBudgetBytes,
  staticTextureStats,
} from '../backends/webgl/svgTexture';
import { bakeQueueLength, resetBakeQueue, PRIORITE_VUE_COURANTE } from '../backends/webgl/atlasBake';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';
import { cleStatique, epinglerStatiques, textureAuCran, viderTexturesStatiques } from './texturesStatiques';

const PX = 64;
/** Boîte locale d'un fragment de décor (celle des props). */
const BOX = { w: 120, h: 150 };
/** Poids d'une texture de ce décor à ce palier — la MÊME formule que celle du stock (4 o/texel). */
const OCTETS = octetsTextureStatique(BOX, PX);

/** Décor : son identité de cache porte le CRAN (`identiteAuCran`), donc un cran = une entrée. */
const DÉCOR = {
  identity: 'prop:tonneau',
  facing: 'S',
  scaleK: 1,
  cell: { x: 0, y: 0, z: 0 },
  box: BOX,
  svg: (_v: unknown, _m: boolean, rot: Rot) => `<g data-cran="${rot}" />`,
} as unknown as BillboardSubject;

/** Textures simulées, une par appel : chacune porte le canevas que la RASTERISATION lui donnerait
 *  (`rasterPxWidth` × `pxHeight`), pour que le poids réel et l'estimation se comparent. */
function simulerRasterisation() {
  const rendues: { libérée: boolean }[] = [];
  const espion = vi.spyOn(svgTexture, 'svgToTexture').mockImplementation(async () => {
    const t = { libérée: false } as { libérée: boolean };
    rendues.push(t);
    return {
      image: { width: rasterPxWidth(BOX, PX), height: PX },
      dispose: () => { t.libérée = true; },
    } as unknown as THREE.CanvasTexture;
  });
  return { rendues, espion };
}

const auCran = (rot: Rot, priorité: number): Promise<THREE.Texture> =>
  textureAuCran(DÉCOR, 'front', false, rot, PX, priorité);

afterEach(() => {
  viderTexturesStatiques();
  epinglerStatiques([]);
  setStaticTextureBudgetBytes(TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT);
  resetBakeQueue();
  vi.restoreAllMocks();
});

describe('textures statiques — le stock est BORNÉ', () => {
  it('budget dépassé : le cran le plus ancien est libéré, et sa redemande RECUIT par la file', async () => {
    const { rendues, espion } = simulerRasterisation();
    setStaticTextureBudgetBytes(2 * OCTETS);

    await auCran(0, PRIORITE_VUE_COURANTE);
    await auCran(1, PRIORITE_VUE_COURANTE);
    await auCran(2, PRIORITE_VUE_COURANTE);

    expect(espion, 'PRÉMISSE : trois crans, trois rasterisations').toHaveBeenCalledTimes(3);
    expect(rendues[0].libérée, 'le cran le plus ancien doit être LIBÉRÉ sous le budget').toBe(true);
    expect([rendues[1].libérée, rendues[2].libérée]).toEqual([false, false]);
    expect(staticTextureStats()).toEqual({ entries: 2, bytes: 2 * OCTETS });

    // REDEMANDE du cran évincé : elle repasse par la FILE (rien de synchrone), puis rasterise.
    const reprise = auCran(0, PRIORITE_VUE_COURANTE);
    expect(espion, 'la recuisson ne doit RIEN rasteriser hors file').toHaveBeenCalledTimes(3);
    expect(bakeQueueLength(), 'la recuisson doit être EN FILE, pas exécutée').toBeGreaterThan(0);
    await reprise;
    expect(espion, 'la clé évincée doit se recuire : une rasterisation de plus').toHaveBeenCalledTimes(4);
  });

  it('EN VOL : l’entrée pèse son estimation AVANT toute rasterisation, et le réel la confirme', async () => {
    const { rendues, espion } = simulerRasterisation();
    const attendu = OCTETS;

    const p = auCran(0, PRIORITE_VUE_COURANTE);

    // AVANT toute rasterisation : la tâche est EN FILE, aucun canevas n'existe — et le stock pèse déjà
    // ce que la texture pèsera. Sans cela, une rafale de demandes ne pèse rien jusqu'à son service
    // (recette : 338 entrées pour 8,9 Mo comptés).
    expect(espion, 'PRÉMISSE : rien ne doit avoir rasterisé').toHaveBeenCalledTimes(0);
    expect(bakeQueueLength(), 'PRÉMISSE : la cuisson doit être en file').toBe(1);
    expect(staticTextureStats()).toEqual({ entries: 1, bytes: attendu });

    await p;

    expect(rendues.length, 'la rasterisation doit avoir eu lieu').toBe(1);
    expect(staticTextureStats(), 'l’estimation et le poids RÉEL doivent coïncider').toEqual({ entries: 1, bytes: attendu });
    expect(attendu, 'le poids d’une texture 51×64 en RGBA').toBe(13056);
  });

  it('ESTIMATION IMPOSSIBLE : une boîte dégénérée pèse zéro, jamais l’infini', () => {
    // Un poids infini au budget évincerait TOUT le stock à la première pression : l'estimation d'un
    // sujet mal formé doit rester une écriture de comptabilité, pas une purge.
    expect(() => octetsTextureStatique({ w: 120, h: 0 }, PX)).not.toThrow();
    expect(octetsTextureStatique({ w: 120, h: 0 }, PX)).toBe(0);
  });

  it('le cran ÉPINGLÉ (celui que le quad porte) survit à la pression, même le plus ancien', async () => {
    const { rendues } = simulerRasterisation();
    setStaticTextureBudgetBytes(2 * OCTETS);
    epinglerStatiques([cleStatique(DÉCOR, 'front', false, 0, PX)]);

    await auCran(0, PRIORITE_VUE_COURANTE);
    await auCran(1, PRIORITE_VUE_COURANTE);
    await auCran(2, PRIORITE_VUE_COURANTE);

    expect(rendues[0].libérée, 'la texture posée à l’écran a été libérée : son quad resterait sans art').toBe(false);
    expect(rendues[1].libérée, 'PRÉMISSE : la pression doit bien avoir mordu sur une NON épinglée').toBe(true);
    // …et le cran épinglé reste MÉMOÏSÉ : le redemander ne recuit rien.
    const avant = staticTextureStats().entries;
    await auCran(0, PRIORITE_VUE_COURANTE);
    expect(staticTextureStats().entries).toBe(avant);
  });
});
