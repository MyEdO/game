// @vitest-environment jsdom
/**
 * CRAN EFFECTIF de la vue (#1176, P2-7). Sous lacet LIBRE, le cran du store ne bouge plus : après un
 * demi-tour, `camRot` vaut toujours 0. Tout ce qui se décide au CRAN — la géométrie de dégagement
 * (quelle façade est frontale) et les couches affines pré-triées — doit donc suivre le cran que le
 * lacet RÉEL regarde, sans quoi la façade qui tombe reste celle du départ et le groupe demeure caché
 * derrière le mur du fond.
 *
 * Deux faits, chacun réfutable seul :
 *  1. le VERDICT de façade au cran effectif est celui du lacet réel arrondi au quart ;
 *  2. le franchissement d'un quart — et lui SEUL — fait rejouer les memos lourds du stage (l'intention
 *     de perf d'origine : 44° ne rebâtit rien, 46° rebâtit une fois).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../../state/store';
import { emptyScene } from '../../noyau/monde/scene';
import { nudgeStageYaw, resetStageYaw, rotAtYaw } from '../../state/stageYaw';
import type { Combatant } from '../../engine/types';
import type { Dims, Rot } from '../../geometry/iso';
import { MondeDeCampagne } from './MondeDeCampagne';
import { artRot, setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';
import * as archVis from './architectureVisibility';
import { frontFacadeCutaway, type ClearedSpace } from './architectureVisibility';
import * as percage from './percage';
import { blessuresSurLeProfil, blessuresDeBase, profilDeTest } from '../../engine/combattantDeTest.testkit';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

brancherArdoise();
beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

/** Un allié dans une PIÈCE dégagée, et les cases qu'elle couvre (même fixture qu'`architectureVisibility.test`). */
const piece = (id: string, cells: string[]): ClearedSpace =>
  ({ zoneIds: new Set([id]), zoneCells: new Map([[id, new Set(cells)]]), roomlessCells: new Set(), overheadCells: new Set(), seenSections: null });

const cranDims = (rot: Rot): Dims => ({ w: 8, h: 8, rot });

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return blessuresSurLeProfil({
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: blessuresDeBase(12), weapons: [],
    characteristics: profilDeTest(), advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  }) as unknown as Combatant;
}

describe('rotAtYaw — le cran que le lacet regarde', () => {
  it('les huit vues de production restent à leur cran (le lacet nul ne déplace rien)', () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) expect(rotAtYaw(rot, 0)).toBe(rot);
  });

  it('un quart de tour parcouru = un cran de plus, demi-tour = deux, et ça boucle', () => {
    expect(rotAtYaw(0, 90)).toBe(1);
    expect(rotAtYaw(0, 180)).toBe(2);
    expect(rotAtYaw(3, 90)).toBe(0);
    expect(rotAtYaw(0, 360)).toBe(0);
    expect(rotAtYaw(0, -90)).toBe(3);
  });

  it('le cran bascule au MILIEU du quart : 44° reste au cran, 46° l’a franchi', () => {
    expect(rotAtYaw(0, 44)).toBe(0);
    expect(rotAtYaw(0, 46)).toBe(1);
    expect(rotAtYaw(2, 44)).toBe(2);
    expect(rotAtYaw(2, 46)).toBe(3);
  });
});

describe('CRAN D’ART — les huit vues de production peignent l’atlas de leur propre cran', () => {
  it('coin (r·90) ET face (r·90+45) rendent le cran r, sous lacet libre comme au cran nu', () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      expect(artRot({ w: 8, h: 8, rot, view: 'iso' })).toBe(rot); // cran nu (aucun lacet)
      expect(artRot({ w: 8, h: 8, rot, edge: true, view: 'iso' })).toBe(rot);
      expect(artRot({ w: 8, h: 8, rot: 0, view: 'iso', yawDeg: rot * 90 })).toBe(rot); // lacet libre : coin
      expect(artRot({ w: 8, h: 8, rot: 0, view: 'iso', yawDeg: rot * 90 + 45 })).toBe(rot); // …et face
    }
  });

  it('un tour complet et un lacet négatif restent dans les quatre crans', () => {
    expect(artRot({ w: 8, h: 8, rot: 0, view: 'iso', yawDeg: 360 })).toBe(0);
    expect(artRot({ w: 8, h: 8, rot: 0, view: 'iso', yawDeg: -45 })).toBe(3);
  });
});

describe('Verdict de FAÇADE au cran effectif (sonde du juge, promue)', () => {
  // Panneau E de (3,3), dedans en (4,3) : frontal aux crans 1 et 2, gardé aux crans 0 et 3
  // (`architectureVisibility.test.ts`, table des deux normales).
  const panel = { roomZoneIds: ['salle'], x: 3, y: 3, z: 0, side: 'E' as const };
  const dedans = piece('salle', ['4,3,0']);

  it('à 180° de lacet réel, la façade tombe — au cran du store (0), elle tiendrait', () => {
    expect(frontFacadeCutaway(panel, dedans, cranDims(0))).toBe(false); // le cran du store, figé
    expect(frontFacadeCutaway(panel, dedans, cranDims(rotAtYaw(0, 180)))).toBe(true); // le lacet réel
  });

  it('le verdict suit le lacet quart par quart, comme il suivrait les crans', () => {
    const attendu = [false, true, true, false]; // crans 0..3
    for (const q of [0, 1, 2, 3])
      expect(frontFacadeCutaway(panel, dedans, cranDims(rotAtYaw(0, q * 90)))).toBe(attendu[q]);
  });
});

describe('MondeDeCampagne — le cran effectif ALIMENTE le dégagement, et ne rejoue qu’au franchissement', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
    resetStageYaw();
  });

  /** Scène minimale PORTEUSE DE MUR : sans arête, aucune façade ne se juge. */
  function monterVolumique(): void {
    const scene = emptyScene('scene-test', 8, 8);
    scene.walls = [{ x: 3, y: 3, side: 'E' }];
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 3, y: 3 },
      party: [hero('h1', { x: 3, y: 3 })],
      battle: null,
      dialogue: null,
      flags: {},
    });
    // Hors navigateur, le lacet arrive tout de suite (`nudgeStageYaw`) : la poussée se mesure sans
    // dérouler une approche à la frame.
    vi.stubGlobal('requestAnimationFrame', undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
  }

  it('après un demi-tour de lacet, la loi de façade reçoit le cran 2 — jamais le cran 0 du store', () => {
    const spy = vi.spyOn(archVis, 'frontFacadeCutaway');
    monterVolumique();
    expect(spy).toHaveBeenCalled();
    expect(useGame.getState().camRot).toBe(0);
    spy.mockClear();
    act(() => { nudgeStageYaw(90); nudgeStageYaw(90); });
    const crans = spy.mock.calls.map((c) => c[2].rot);
    expect(crans.length).toBeGreaterThan(0);
    expect(new Set(crans)).toEqual(new Set([2]));
    expect(useGame.getState().camRot).toBe(0); // le store n'a pas bougé : c'est bien le LACET qui décide
  });

  it('44° ne rebâtit RIEN, 46° rebâtit UNE fois (le memo lourd suit le franchissement, pas la frame)', () => {
    // Le memo qui dépend du cran est celui des ENTRÉES DE LA DÉCOUPE LOCALE (nappes projetées et
    // capsules d'alliés, clé `clePercage` — tout y exige la projection) : le stage ne bâtit plus
    // lui-même sols et murs depuis la mort de la voie affine (#1176 P3-4, commit C5a), et la cuisson
    // du monde volumique, elle, ne dépend pas du regard.
    const spy = vi.spyOn(percage, 'clePercage');
    monterVolumique();
    const monte = spy.mock.calls.length;
    expect(monte).toBeGreaterThan(0);
    act(() => { nudgeStageYaw(44); });
    expect(spy.mock.calls.length).toBe(monte); // même cran : aucune entrée reprojetée
    act(() => { nudgeStageYaw(2); }); // 46° : le quart est franchi
    expect(spy.mock.calls.length).toBe(monte + 1);
    act(() => { nudgeStageYaw(2); }); // 48° : toujours le même cran
    expect(spy.mock.calls.length).toBe(monte + 1);
  });
});
