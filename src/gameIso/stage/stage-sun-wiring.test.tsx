// @vitest-environment jsdom
/**
 * MODÈLE DE LUMIÈRE DE L'ÉCRAN DE JEU volumique (#1176, P2-5) — trois étages, tous nécessaires :
 *
 *  1. la DÉCISION (`stageLightScalars`/`stageLights`) : un seul propriétaire de luminosité par régime.
 *     L'ambiante existe toujours et se dose sur la MÊME donnée que le voile de nuit de la voie affine
 *     (`nightVeilMax`), le soleil s'allume en fondu au-dessus de l'élévation d'acné, et le passage de
 *     l'un à l'autre est CONTINU — il n'y a plus de régime à basculer au crépuscule ;
 *  2. la MATIÈRE : le monde est lambertien (l'ambiante doit donc AGIR, ce que le lambertien de three
 *     fait à `1/π` près — mesuré ici sur ses propres chunks de shader), les billboards ne le sont
 *     jamais (leur normale est l'axe caméra : une luminance lambertienne y suivrait la rotation) ;
 *  3. le MONTAGE réel de l'écran (`GameStage3D` sous `MondeDeCampagne`, voie volumique) : un canevas WebGL n'a
 *     pas d'arbre à interroger, mais il porte la signature du soleil monté (`data-sun`) et l'exposition
 *     de sa frame (`data-lum`) — et, en volumique, le voile d'ambiance du SVG n'est plus peint.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, type Scene } from '../../state/scene';
import { setNorthDeg } from '../../state/sceneEdit';
import { sunJeu } from '../backends/webgl/sunJeu';
import { AMBIENT_INTENSITY, SUN_INTENSITY } from '../backends/webgl/sceneMeshes';
import { ambianceLuminance, nightVeilAlpha } from '../catalog/ambiance';
import { AUCUN_CHROME, TEINTE_PLEINE, billboardMaterial, poseBoards, type Board, type FrameLights } from './boardPose';
import { FLAME_INTENSITY, FLAME_LIFT_M } from './stagePointLights';
import { SUN_ACNE_ELEVATION_DEG, stageLightScalars, stageLights, sunFade } from './stageLights';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, canevas as canevasDe } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

brancherArdoise();
beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

const MIDI = 12 * 60;
const NUIT = 23 * 60;
const BOITE = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(20, 4, 20));

const dehors = (northDeg?: number): Scene =>
  setNorthDeg({ ...emptyScene(6, 6), ambiance: 'exterieur' }, northDeg);
const dedans = (): Scene => ({ ...emptyScene(6, 6), ambiance: 'interieur' });

const scalaires = (scene: Scene, gameTime: number, lightLevel: number | null = null) =>
  stageLightScalars({ scene, gameTime, lightLevel });

describe('stageLights — la directionnelle a une PORTE, l’ambiante non', () => {
  const lampes = (scene: Scene, gameTime: number, lightLevel: number | null = null) =>
    stageLights({ scene, gameTime, lightLevel, shadowBox: BOITE });

  it('INTÉRIEUR : aucune directionnelle, à aucune heure — mais toujours une ambiante', () => {
    for (const t of [6 * 60, MIDI, 17 * 60]) {
      const l = lampes(dedans(), t);
      expect([t, l.sun, l.course]).toEqual([t, null, null]);
      expect(l.ambient.intensity).toBeGreaterThan(0);
    }
  });

  it('EXTÉRIEUR de jour : une directionnelle, orientée par l’heure ET le nord de la scène', () => {
    const l = lampes(dehors(), MIDI);
    expect(l.sun).not.toBeNull();
    expect(l.sun!.castShadow).toBe(true);
    // La lampe regarde la cible depuis la direction de la course (midi, nord implicite = plein sud, +z).
    const d = l.sun!.position.clone().sub(l.sun!.target.position).normalize();
    const attendu = sunJeu(MIDI)!.dir;
    expect([d.x, d.y, d.z].map((v) => +v.toFixed(6))).toEqual(
      [attendu.x, attendu.y, attendu.z].map((v) => +v.toFixed(6)),
    );
    // Nord tourné de 90° : la lampe tourne d'autant (le soleil de midi passe à l'OUEST du plan).
    const tourné = lampes(dehors(90), MIDI).sun!;
    const d90 = tourné.position.clone().sub(tourné.target.position).normalize();
    expect(d90.x).toBeLessThan(0); // ouest
    expect(Math.abs(d90.z)).toBeLessThan(1e-6); // plus rien au sud
  });

  it('EXTÉRIEUR de NUIT : plus de directionnelle (les paliers de lumière gouvernent seuls)', () => {
    expect(lampes(dehors(), NUIT).sun).toBeNull();
  });

  it('l’ambiante suit le PALIER de lumière, et cède sa part au soleil À MESURE qu’il s’allume', () => {
    // Sans soleil, l'ambiante porte la scène entière ; sous le soleil PLEIN, elle redescend à la part
    // `AMBIENT_INTENSITY` du réglage à deux lampes. Le facteur `π` est la conversion du lambertien de
    // three (cf. le test de shader plus bas), pas un coefficient de goût.
    const dedansPlein = lampes(dedans(), MIDI, 1).ambient.intensity;
    const dehorsMidi = lampes(dehors(), MIDI, 1).ambient.intensity;
    expect(dedansPlein).toBeCloseTo(Math.PI, 9);
    expect(dehorsMidi).toBeCloseTo(AMBIENT_INTENSITY * Math.PI, 9);
    // La mise en scène (`state.lightLevel`) module par le voile, pas linéairement : à mi-lumière, la
    // scène garde `1 − 0,82 × 0,5` de son exposition — exactement ce que rend le voile de la voie affine.
    expect(lampes(dedans(), MIDI, 0.5).ambient.intensity).toBeCloseTo(ambianceLuminance(0.5) * Math.PI, 9);
    expect(lampes(dehors(), MIDI, 0.5).ambient.intensity).toBeCloseTo(ambianceLuminance(0.5) * AMBIENT_INTENSITY * Math.PI, 9);
  });

  it('table des régimes : intérieur/extérieur × midi/nuit × palier authoré', () => {
    const table = (
      [
        ['intérieur', dedans(), MIDI, null],
        ['intérieur', dedans(), NUIT, null],
        ['extérieur', dehors(), MIDI, null],
        ['extérieur', dehors(), NUIT, null],
        ['extérieur ténèbres', dehors(), MIDI, 0],
        ['extérieur nuit authorée', dehors(), MIDI, 0.18],
      ] as const
    ).map(([nom, scene, t, niveau]) => {
      const s = scalaires(scene, t, niveau);
      return [nom, t, s.lit, +s.surfaceLuminance.toFixed(4)];
    });
    expect(table).toEqual([
      // Intérieur : aucun soleil, l'ambiante porte la scène à pleine exposition — et l'heure n'y change
      // rien, un intérieur n'est jamais obscurci par l'HORLOGE (`sceneIsDark`, la porte partagée de
      // toutes les vues). Son obscurité s'authore (`ambientLight`) ou se met en scène (`lightLevel`).
      ['intérieur', MIDI, false, 1],
      ['intérieur', NUIT, false, 1],
      // Extérieur de midi : ambiante rabaissée + soleil à pleine intensité sur une surface horizontale.
      ['extérieur', MIDI, true, +(AMBIENT_INTENSITY + SUN_INTENSITY * Math.sin(sunJeu(MIDI)!.elevationDeg * Math.PI / 180)).toFixed(4)],
      // Extérieur de nuit : plus de soleil du tout, le palier `nuit` gouverne seul (même valeur qu'en intérieur).
      ['extérieur', NUIT, false, 0.3276],
      // Palier `tenebres` (0) : le PLANCHER du voile, jamais l'écran noir — même sous le soleil de midi.
      ['extérieur ténèbres', MIDI, true, +(ambianceLuminance(0) * (AMBIENT_INTENSITY + SUN_INTENSITY * Math.sin(sunJeu(MIDI)!.elevationDeg * Math.PI / 180))).toFixed(4)],
      ['extérieur nuit authorée', MIDI, true, +(ambianceLuminance(0.18) * (AMBIENT_INTENSITY + SUN_INTENSITY * Math.sin(sunJeu(MIDI)!.elevationDeg * Math.PI / 180))).toFixed(4)],
    ]);
    // Le plancher de ténèbres est bien celui du voile de la voie affine, et il n'est pas nul.
    expect(ambianceLuminance(0)).toBeCloseTo(0.18, 9);
  });
});

describe('Parité des DEUX voies — le canevas dose ce que le voile retire', () => {
  it('SANS soleil, la luminance volumique est EXACTEMENT le complément du voile affine', () => {
    for (const palier of [0, 0.18, 0.45, 0.75, 1]) {
      const s = scalaires(dedans(), MIDI, palier);
      expect(s.lit).toBe(false);
      expect(s.surfaceLuminance).toBeCloseTo(1 - nightVeilAlpha(palier), 12);
      // …et c'est cette même exposition que porte l'ambiante (au `π` du lambertien près).
      expect(s.ambientIntensity).toBeCloseTo(s.surfaceLuminance * Math.PI, 12);
    }
  });

  it('le facteur π n’est pas une supposition : le lambertien de three divise l’irradiance par π', () => {
    expect(THREE.ShaderChunk.lights_pars_begin).toContain('uniform vec3 ambientLightColor');
    // `getAmbientLightIrradiance` rend l'irradiance telle quelle…
    expect(THREE.ShaderChunk.lights_pars_begin.replace(/\s+/g, ' '))
      .toContain('getAmbientLightIrradiance( const in vec3 ambientLightColor ) { vec3 irradiance = ambientLightColor;');
    // …et le BRDF lambertien la divise par π : une ambiante d'intensité `k·π` rend donc `albédo · k`.
    expect(THREE.ShaderChunk.common.replace(/\s+/g, ' '))
      .toContain('vec3 BRDF_Lambert( const in vec3 diffuseColor ) { return RECIPROCAL_PI * diffuseColor; }');
    // Le matériau du monde passe bien par ce chemin d'éclairage (sinon l'ambiante n'agirait pas).
    expect(THREE.ShaderLib.lambert.fragmentShader).toContain('lights_fragment_begin');
  });
});

describe('Fondu du soleil — l’acné rasante s’éteint avant d’exister, le crépuscule ne saute plus', () => {
  it('le soleil est ÉTEINT partout où l’acné serait visible (critère texel/tan(élév) > biais)', () => {
    // Critère analytique : un texel d'ombre couvre `texel / tan(élévation)` de profondeur sur un
    // receveur rasant, et le décalage de normale n'en couvre que `SHADOW_NORMAL_BIAS_TEXELS`.
    const biaisSuffit = (elev: number) => 1 / Math.tan((elev * Math.PI) / 180) <= 3;
    for (let e = 0.5; e < 60; e += 0.5) {
      if (!biaisSuffit(e)) expect([e, sunFade(e)]).toEqual([e, 0]);
    }
    expect(SUN_ACNE_ELEVATION_DEG).toBeCloseTo(18.4349, 4);
    expect(sunFade(SUN_ACNE_ELEVATION_DEG)).toBe(0);
    expect(sunFade(SUN_ACNE_ELEVATION_DEG + 0.5)).toBeGreaterThan(0);
    expect(sunFade(50)).toBe(1);
  });

  it('aucune directionnelle MONTÉE tant que le soleil rase (lever et coucher)', () => {
    for (const t of [5 * 60, 5 * 60 + 30, 6 * 60, 18 * 60, 18 * 60 + 45]) {
      const l = stageLights({ scene: dehors(), gameTime: t, lightLevel: null, shadowBox: BOITE });
      const rasant = sunJeu(t)!.elevationDeg < SUN_ACNE_ELEVATION_DEG;
      expect([t, rasant, l.sun === null]).toEqual([t, rasant, rasant]);
    }
  });

  it('CONTINUITÉ : de 17:00 à 20:00, minute par minute, l’exposition ne fait aucun saut', () => {
    // Un régime qui bascule vaut un pas d'un demi-albédo EN UNE MINUTE (×2,2 mesuré à 19:01 avant le
    // lot). Ici le soleil s'éteint en pente : jamais plus d'un centième d'albédo par minute.
    const suite = Array.from({ length: 181 }, (_, i) => scalaires(dehors(), 17 * 60 + i).surfaceLuminance);
    const saut = Math.max(...suite.slice(1).map((v, i) => Math.abs(v - suite[i])));
    expect(saut).toBeLessThan(0.01);
    // Le pas de 19:00 — le coucher, celui qui basculait le régime — ne se voit plus DU TOUT : à cette
    // heure-là le soleil est éteint depuis longtemps (son fondu s'est achevé vers 17:26).
    expect(scalaires(dehors(), 19 * 60 + 1).surfaceLuminance)
      .toBeCloseTo(scalaires(dehors(), 18 * 60 + 59).surfaceLuminance, 12);
  });

  it('les seuls PAS restants sont ceux du palier d’ambiance — et les DEUX voies les font ensemble', () => {
    // 05:00 et 22:00 sont les bornes de la nuit d'horloge (`sceneIsDark`) : le palier saute, donc les
    // deux voies sautent — d'un rapport IDENTIQUE, puisqu'elles se dosent sur la même donnée. Ce pas-là
    // n'est pas un artefact du volumique, et le corriger serait un autre sujet (le palier lui-même).
    for (const [avant, après] of [[4 * 60 + 59, 5 * 60 + 1], [21 * 60 + 59, 22 * 60 + 1]]) {
      const volumique = scalaires(dehors(), après).surfaceLuminance / scalaires(dehors(), avant).surfaceLuminance;
      const affine = ambianceLuminance(après === 5 * 60 + 1 ? 1 : 0.18) / ambianceLuminance(après === 5 * 60 + 1 ? 0.18 : 1);
      expect([avant, +volumique.toFixed(6)]).toEqual([avant, +affine.toFixed(6)]);
    }
  });
});

describe('Billboards — leur lumière est un SCALAIRE, jamais une normale', () => {
  const board = (luminance: number): Board => ({
    sub: {
      cid: null, anchor: new THREE.Vector3(0, 0, 0), identity: 'x', kind: 'personnage',
      scaleK: 1, cell: { x: 0, y: 0, z: 0 }, box: { w: 10, h: 10 }, svg: () => '', facing: 0,
    } as unknown as Board['sub'],
    quad: { widthM: 1, heightM: 2, centerLiftM: 1 },
    mesh: new THREE.Mesh(new THREE.PlaneGeometry(1, 2)),
    material: billboardMaterial(new THREE.Texture(), luminance),
  });

  /** Les FLAQUES de la frame, RÉELLES : une lampe allumée à trois mètres du sujet — l'exposition que la
   *  passe de pose écrit doit donc quelque chose aux lampes, pas seulement au palier de la frame. */
  const LUM_FRAME = 0.3;
  const flaques = (): FrameLights => {
    const w = { srcId: 'b0', x: 3, y: FLAME_LIFT_M, z: 0, intensity: FLAME_INTENSITY * Math.PI * 0.7, distance: 8, color: 0xffffff };
    const lampe = new THREE.PointLight(0xffffff, 0, 0, 0);
    lampe.position.set(w.x, w.y, w.z);
    lampe.intensity = w.intensity;
    lampe.distance = w.distance;
    return { pool: [lampe], slots: [w], surfaceLuminance: LUM_FRAME };
  };

  it('le matériau d’un billboard n’est JAMAIS lambertien, et porte l’exposition de la frame', () => {
    const mat = billboardMaterial(new THREE.Texture(), 0.42);
    expect(mat).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mat).not.toBeInstanceOf(THREE.MeshLambertMaterial);
    expect([mat.color.r, mat.color.g, mat.color.b]).toEqual([0.42, 0.42, 0.42]);
  });

  it('la ROTATION de la caméra ne change pas d’un iota la luminance d’un billboard', () => {
    const b = board(0.6);
    const cam = (yawDeg: number) => {
      const c = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      c.rotation.set(0, (yawDeg * Math.PI) / 180, 0);
      c.updateMatrixWorld();
      return c;
    };
    const lu = () => [b.material.color.r, b.material.color.g, b.material.color.b];
    poseBoards([b], cam(0), () => null, flaques(), AUCUN_CHROME, TEINTE_PLEINE);
    const avant = lu();
    // L'exposition écrite passe bien par les flaques (elle dépasse le palier de la frame) : la mesure
    // ci-dessous porte sur le VRAI chemin, pas sur un scalaire que rien ne recalcule.
    expect(avant[0]).toBeGreaterThan(LUM_FRAME);
    for (const yaw of [90, 180, 270]) {
      poseBoards([b], cam(yaw), () => null, flaques(), AUCUN_CHROME, TEINTE_PLEINE);
      expect([yaw, ...lu()]).toEqual([yaw, ...avant]);
      // Le quad, lui, a bien tourné : la passe de pose s'est exécutée (elle n'est pas inerte).
      expect(b.mesh.quaternion.equals(cam(0).quaternion)).toBe(yaw % 360 === 0);
    }
  });

  it('la carte d’ombre ne se redemande QUE si un casteur a glissé', () => {
    const b = board(1);
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    expect(poseBoards([b], cam, () => null, flaques(), AUCUN_CHROME, TEINTE_PLEINE)).toBe(false);
    const glissant = board(1);
    (glissant.sub as { cid: string | null }).cid = 'c1';
    expect(poseBoards([glissant], cam, () => ({ dx: 1, dy: 0, dz: 0 }), flaques(), AUCUN_CHROME, TEINTE_PLEINE)).toBe(true);
  });
});

// ── MONTAGE RÉEL : l'écran de jeu, voie volumique ────────────────────────────────────────────────

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Monte l'écran de jeu sur `scene` à l'heure `gameTime`, rend le conteneur. */
function monter(scene: Scene, gameTime: number): HTMLDivElement {
  useGame.setState({
    scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], battle: null, dialogue: null,
    flags: {}, gameTime, lightLevel: null,
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<MondeDeCampagne />));
  return container;
}

const canevas = (scene: Scene, gameTime: number) => canevasDe(monter(scene, gameTime));

/** Démonte l'arbre courant sans toucher au backend — pour enchaîner deux montages dans un test. */
function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
}

afterEach(() => {
  démonter();
});

describe('GameStage3D — le soleil MONTÉ suit la scène et l’heure', () => {
  it('scène d’EXTÉRIEUR : le canevas porte la signature du soleil de l’heure', () => {
    const canvas = canevas(dehors(), MIDI);
    const midi = sunJeu(MIDI)!;
    expect(canvas.dataset.sun).toBe(`${midi.azimuthDeg.toFixed(1)},${midi.elevationDeg.toFixed(1)}`);
  });

  it('…et elle CHANGE avec l’heure, puis avec le nord de la carte', () => {
    const matin = canevas(dehors(), 8 * 60).dataset.sun;
    démonter();
    const soir = canevas(dehors(), 17 * 60).dataset.sun;
    démonter();
    const matinTourné = canevas(dehors(90), 8 * 60).dataset.sun;
    expect(new Set([matin, soir, matinTourné]).size).toBe(3);
  });

  it('scène d’INTÉRIEUR : aucun soleil monté (aucune signature)', () => {
    expect(canevas(dedans(), MIDI).dataset.sun).toBeUndefined();
  });

  it('scène d’extérieur de NUIT — et de soleil RASANT : aucun soleil monté non plus', () => {
    expect(canevas(dehors(), NUIT).dataset.sun).toBeUndefined();
    démonter();
    expect(canevas(dehors(), 5 * 60 + 30).dataset.sun).toBeUndefined();
  });

  it('le canevas porte l’EXPOSITION de sa frame, celle de la passe de lumière', () => {
    for (const [scene, t] of [[dehors(), MIDI], [dedans(), MIDI], [dehors(), NUIT]] as const) {
      const lum = canevas(scene, t).dataset.lum;
      expect(lum).toBe(scalaires(scene, t).surfaceLuminance.toFixed(4));
      démonter();
    }
  });
});

describe('Un seul propriétaire de luminosité — aucun voile ne s’empile sur le canevas', () => {
  /** Le rect de lueur chaude `url(#g_warm)` : sa présence dirait qu'un SECOND propriétaire de
   *  luminosité peint par-dessus le monde. La passe de lumière du canevas est l'unique propriétaire ;
   *  `stage/Ambiance` ne peint que la faune (#1176). */
  const voiles = (hôte: HTMLElement) => hôte.querySelector('rect[fill="url(#g_warm)"]');

  it('un canevas, et AUCUN voile par-dessus lui — même de NUIT', () => {
    const hôte = monter(dehors(), NUIT);
    expect(hôte.querySelector('canvas.iso-stage')).not.toBeNull();
    expect(voiles(hôte)).toBeNull();
  });
});
