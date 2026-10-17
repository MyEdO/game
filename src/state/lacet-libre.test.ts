/**
 * #1176 — LE LACET DE LA CAMÉRA EST LIBRE. Ce qui se mesure ici est le geste RÉEL du joueur
 * (`tournerCamera`/`relacherCamera`, source unique de Q/E au clavier) : un appui
 * bref pousse d'un PAS FIN, un appui tenu fait tourner en CONTINU, et la caméra s'arrête là où le
 * geste la laisse — aucun cran ne la rattrape.
 *
 * Le CRAN, lui, ne disparaît pas : il n'est plus une position de repos, c'est la QUANTIFICATION que
 * lisent les memos lourds du rendu (`viewRot`/`rotAtYaw`). Et l'angle INITIAL d'une scène reste
 * diagonal — une partie qui arriverait d'une vue de face repart du coin.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { relacherCamera, tournerCamera } from './keybindings';
import { PAS_TAP_DEG, SEUIL_MAINTIEN_MS, avancerLacet, getStageYaw, resetStageYaw, rotAtYaw } from './stageYaw';
import { testScene } from '../scenes/test-fixture';

/** Joue le BATTEMENT à la main (#1403) : c'est l'image qui AVANCE le lacet (`avancerLacet`, appelé en
 *  production par l'hôte du stage), le module n'ayant plus d'horloge à lui. Le `requestAnimationFrame`
 *  stubé ne dit qu'une chose : une horloge d'images existe. */
function harnaisDeFrames() {
  vi.stubGlobal('requestAnimationFrame', (() => 0) as unknown as typeof requestAnimationFrame);
  let horloge = 0;
  return (n: number, dt = 16): void => {
    for (let i = 0; i < n; i++) {
      horloge += dt;
      avancerLacet(horloge);
    }
  };
}

const g = useGame.getState;

beforeEach(() => {
  resetStageYaw();
  useGame.setState({ camRot: 0, camEdge: false, camPan: { x: 0, y: 0 } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetStageYaw();
});

describe('LE GESTE DU JOUEUR — appui bref = pas fin, appui tenu = rotation continue', () => {
  it('un appui bref pousse de PAS_TAP_DEG, et le relâchement laisse la vue là', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined); // hors navigateur : la poussée arrive tout de suite
    tournerCamera(g, 1);
    expect(getStageYaw()).toBe(PAS_TAP_DEG);
    relacherCamera();
    vi.advanceTimersByTime(10 * SEUIL_MAINTIEN_MS); // le maintien a été désarmé : rien ne démarre
    expect(getStageYaw()).toBe(PAS_TAP_DEG);
    expect(g().camRot).toBe(0); // le cran du store ne bouge pas : c'est le LACET qui tourne
  });

  it('N appuis brefs valent N pas fins — la vue ne se recale sur aucun cran', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', undefined);
    for (let i = 0; i < 5; i++) { tournerCamera(g, 1); relacherCamera(); }
    expect(getStageYaw()).toBe(5 * PAS_TAP_DEG);
    expect(getStageYaw() % 90).not.toBe(0);
    tournerCamera(g, -1);
    relacherCamera();
    expect(getStageYaw()).toBe(4 * PAS_TAP_DEG);
  });

  it('APPUI TENU : passé le seuil, la caméra tourne en continu, et s’arrête AU RELÂCHEMENT', () => {
    vi.useFakeTimers();
    const jouer = harnaisDeFrames();
    tournerCamera(g, 1);
    jouer(4); // le pas fin glisse
    const apresLePas = getStageYaw();
    expect(apresLePas).toBeGreaterThan(0);
    expect(apresLePas).toBeLessThanOrEqual(PAS_TAP_DEG);

    vi.advanceTimersByTime(SEUIL_MAINTIEN_MS); // la touche est TENUE : le maintien prend le relais
    jouer(60);
    const enRotation = getStageYaw();
    expect(enRotation).toBeGreaterThan(50); // bien au-delà de ce qu'un pas fin atteindrait
    expect(enRotation % 90).not.toBe(0);

    relacherCamera();
    jouer(60);
    expect(getStageYaw()).toBe(enRotation); // le relâchement fige l'angle, rien ne le ramène
  });
});

describe('LE CRAN — une QUANTIFICATION pour les memos du rendu, pas une position de repos', () => {
  it('rotAtYaw rend le quart le plus proche du lacet parcouru', () => {
    expect(rotAtYaw(0, 0)).toBe(0);
    expect(rotAtYaw(0, 44)).toBe(0);
    expect(rotAtYaw(0, 46)).toBe(1);
    expect(rotAtYaw(0, 180)).toBe(2);
    expect(rotAtYaw(1, 90)).toBe(2);
    expect(rotAtYaw(0, -90)).toBe(3); // le cran reste dans [0,3] quel que soit le sens parcouru
    expect(rotAtYaw(0, 720)).toBe(0);
  });
});

describe('rotateCam — la rotation par CRAN de l’éditeur et des bancs', () => {
  it('l’action de store avance d’un cran de 90°, camEdge jamais vrai, et la vue se RE-CENTRE (camPan)', () => {
    useGame.setState({ camEdge: true, camPan: { x: 37, y: -12 } }); // vue de face héritée + décalage manuel
    g().rotateCam(1);
    expect(g().camRot).toBe(1);
    expect(g().camEdge).toBe(false);
    expect(g().camPan).toEqual({ x: 0, y: 0 }); // re-centrage conservé : sans lui, la vue reste « téléportée »
    expect(getStageYaw()).toBe(0);
  });

  it('un tour entier dans les deux sens ne pose JAMAIS la vue de face', () => {
    const crans: number[] = [];
    for (let i = 0; i < 4; i++) { g().rotateCam(1); expect(g().camEdge).toBe(false); crans.push(g().camRot); }
    expect(crans).toEqual([1, 2, 3, 0]);
    for (let i = 0; i < 4; i++) { g().rotateCam(-1); expect(g().camEdge).toBe(false); }
    expect(g().camRot).toBe(0);
  });
});

describe('ANGLE INITIAL — une partie arrivée en vue de face repart d’un cran diagonal', () => {
  it("l'entrée de scène (transitionTo) ramène la vue au cran diagonal", () => {
    g().startScene(testScene());
    useGame.setState({ camEdge: true });
    g().transitionTo(testScene().id);
    expect(g().camEdge).toBe(false);
  });
});
