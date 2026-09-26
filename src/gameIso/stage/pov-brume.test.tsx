// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { poserCapDuGroupe } from '../../state/combatants';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { setRevealAll } from '../../state/visionState';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Dims } from '../../geometry/iso';
import { AMBIANCE, ambianceLuminance } from '../catalog/ambiance';
import { fogCurveOf, povDepth } from '../pov/camera';
import { MondeDeCampagne } from './MondeDeCampagne';
import { FOG_GAMMA_DEFINE, type MatériauEmbrumable } from '../backends/webgl/sceneMeshes';
import { GameStage3D, setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { toHex } from '../shade';

/**
 * BRUME & CIEL DE LA PREMIÈRE PERSONNE (#1176, P3-1c) — l'horizon du POV volumique cesse d'être tranché
 * net sur le fond de canevas. Ce banc mesure les quatre faits du lot sur l'écran RÉEL (le goût, lui, se
 * juge au navigateur) :
 *  1. le monde est embrumé en POV, et par la courbe du MILIEU (portée, début, couleur) ;
 *  2. DEUX couleurs — la brume des SURFACES n'est pas celle du FOND (ciel) ;
 *  3. le GAMMA de la courbe est posé sur les matériaux embrumés, milieu par milieu ;
 *  4. la vue de PLATEAU n'a pas d'horizon : aucune brume, aucun fond, aucun gamma.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** Pose une scène jouable au store — `interieur` bascule le MILIEU (c'est `isIndoor` qui tranche). */
function poser(ambiance: Scene['ambiance']): Scene {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
  const scene = emptyScene(12, 12);
  scene.ambiance = ambiance;
  useGame.setState({
    screen: 'campaign', mode: 'exploration', party: [hero], scene,
    partyPos: { x: 4, y: 4 }, facing: poserCapDuGroupe({}, 'N'),
    dialogue: null, battle: null, povActive: true, lightLevel: 1,
  } as never);
  return scene;
}

function monter(node: JSX.Element): void {
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(node));
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

const dernièreScène = () => scènes[scènes.length - 1];
const hex = (c: THREE.Color) => `#${c.getHexString(THREE.SRGBColorSpace)}`;

/** Les gammas RÉELLEMENT portés par les matériaux embrumés du monde monté. */
function gammasPosés(scene3d: THREE.Scene): Set<string | undefined> {
  const vus = new Set<string | undefined>();
  scene3d.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const m of mats) if (m.fog) vus.add(m.defines?.[FOG_GAMMA_DEFINE] as string | undefined);
  });
  return vus;
}

/** Les matériaux EMBRUMÉS du monde monté, gardés en main : ils survivent au démontage de l'effet, ce
 *  qui permet de mesurer ce que son nettoyage leur laisse. */
function matériauxEmbrumés(scene3d: THREE.Scene): MatériauEmbrumable[] {
  const out: MatériauEmbrumable[] = [];
  scene3d.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const m of mats) if (m.fog) out.push(m);
  });
  return out;
}

/** Les pools d'AFFORDANCE montés (surbrillances, marques dynamiques, halos), par nom. */
function chromeMonté(scene3d: THREE.Scene): { nom: string; mat: MatériauEmbrumable }[] {
  const out: { nom: string; mat: MatériauEmbrumable }[] = [];
  scene3d.traverse((o) => {
    if (!/^(marques|marquesDyn|halos):/.test(o.name)) return;
    const porteur = o as THREE.Mesh;
    if (!porteur.material) return;
    const mats = (Array.isArray(porteur.material) ? porteur.material : [porteur.material]) as MatériauEmbrumable[];
    for (const mat of mats) out.push({ nom: o.name, mat });
  });
  return out;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
  setRevealAll(true);
});
afterAll(() => {
  setStageRendererFactory(null);
  setRevealAll(false);
});
afterEach(() => {
  démonter();
});

describe('POV volumique — la BRUME du milieu (#1176 P3-1c)', () => {
  it('EXTÉRIEUR : brume des surfaces sur la courbe du dehors, fond = le dégradé de CIEL', () => {
    const scene = poser('exterieur');
    const mpt = sceneMetresPerTile(scene);
    monter(<MondeDeCampagne />);
    const s = dernièreScène();
    const fog = s.fog as THREE.Fog;
    expect(fog, 'la première personne a un horizon : il lui faut une brume').toBeTruthy();
    const courbe = fogCurveOf(false);
    expect(fog.near).toBeCloseTo(courbe.start * mpt, 6);
    // …et elle s'éteint EXACTEMENT à la portée de rendu : plus rien n'arrive net à la coupure.
    expect(fog.far).toBeCloseTo(courbe.end * mpt, 6);
    expect(hex(fog.color), 'la brume des SURFACES').toBe(AMBIANCE.pov.fogOutdoorSurface.toLowerCase());

    const fond = s.background as THREE.DataTexture;
    expect(fond?.isTexture, 'le fond porte le dégradé de ciel').toBe(true);
    const d = fond.image.data as Uint8Array;
    const bas = toHex(d[0], d[1], d[2]);
    expect(bas, 'l’horizon du fond porte la brume de CIEL, pas celle des surfaces').toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    expect(bas).not.toBe(hex(fog.color));
  });

  it('INTÉRIEUR : brume sombre et COURTE, fond sombre (aucun ciel sous un toit)', () => {
    const scene = poser('interieur');
    const mpt = sceneMetresPerTile(scene);
    monter(<MondeDeCampagne />);
    const fog = dernièreScène().fog as THREE.Fog;
    const courbe = fogCurveOf(true);
    expect(fog.near).toBeCloseTo(courbe.start * mpt, 6);
    expect(fog.far).toBeCloseTo(courbe.end * mpt, 6);
    expect(fog.far, 'plus courte que dehors').toBeLessThan(fogCurveOf(false).end * mpt);
    expect(hex(fog.color)).toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
    const fond = dernièreScène().background as THREE.Color;
    expect(fond?.isColor, 'pas de dégradé de ciel en intérieur').toBe(true);
    expect(hex(fond)).toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
  });

  /** #1176 (correctif de la bascule C4) : à la nuit, l'ÉCRAN rendait un sol au palier sous un horizon
   *  resté à la brume de ciel de PLEIN JOUR (sonde du juge : #7f9ab4 mesuré). Le ciel et les brumes
   *  prennent désormais le MÊME scalaire que les lampes (`ambianceLum`) — c'est le CÂBLAGE de bout en
   *  bout que ce cas mesure : store `lightLevel` → `stageLightScalars` → `reposerCiel`/`povFog`. */
  it('NUIT : le CIEL et la brume suivent le palier de la scène — plus d’horizon de plein jour à minuit', () => {
    poser('exterieur');
    useGame.setState({ lightLevel: 0.18 } as never); // le palier `nuit` de `lightLevels.json`
    monter(<MondeDeCampagne />);
    const s = dernièreScène();
    const lum = ambianceLuminance(0.18);
    /** La loi du MONDE : l'albédo décodé × le palier, en linéaire (l'espace où les lampes multiplient). */
    const commeUneFace = (h: string) => hex(new THREE.Color(h).multiplyScalar(lum));
    const d = (s.background as THREE.DataTexture).image.data as Uint8Array;
    const horizon = toHex(d[0], d[1], d[2]);
    expect(horizon, 'l’horizon ne reste pas à la brume de ciel de plein jour').toBe(commeUneFace(AMBIANCE.pov.fogOutdoor));
    expect(horizon).not.toBe(AMBIANCE.pov.fogOutdoor.toLowerCase());
    expect(hex((s.fog as THREE.Fog).color), 'la brume des surfaces suit le même palier').toBe(
      commeUneFace(AMBIANCE.pov.fogOutdoorSurface),
    );
  });

  /** #1404 — le ciel est une `DataTexture` de 64 paliers : un franchissement d'heure en RÉÉCRIT les
   *  texels, il ne libère pas la texture pour en allouer une autre. */
  it('un PALIER franchi réécrit le ciel EN PLACE : même texture, texels neufs, image peinte', () => {
    poser('exterieur');
    monter(<MondeDeCampagne />);
    const ciel = dernièreScène().background as THREE.DataTexture;
    expect(ciel?.isTexture, 'dehors, le fond est le dégradé de ciel').toBe(true);
    const avant = Array.from(ciel.image.data as Uint8Array);
    const versionAvant = ciel.version;
    const imagesAvant = scènes.length;

    // Le palier `nuit` de `lightLevels.json` — la même entrée que celle du cas précédent.
    act(() => { useGame.setState({ lightLevel: 0.18 } as never); });

    const après = dernièreScène().background as THREE.DataTexture;
    expect(après.uuid, 'le ciel se RÉÉCRIT : aucune texture libérée, aucune allouée').toBe(ciel.uuid);
    expect(Array.from(après.image.data as Uint8Array), 'les texels n’ont pas suivi le palier').not.toEqual(avant);
    expect(après.version, 'des texels neufs sans téléversement = un ciel de plein jour à l’écran')
      .toBeGreaterThan(versionAvant);
    // ATTRIBUTION (grief du juge de cumul, #1394) : « une image a été peinte » n'est pas un verdict du
    // CIEL — trois autres effets de cet écran réagissent au même palier (pose du soleil, exposition du
    // monde, remontage) et repeignent de toute façon. C'est donc le COMPTE qui attribue : quatre
    // images, dont celle que le ciel peint pour son compte. Un compte qui bouge se relit ici, il ne se
    // recale pas : c'est la seule mesure qui distingue le repeint du ciel de celui de ses voisins.
    expect(scènes.length - imagesAvant, 'le ciel n’a peint aucune image POUR SON COMPTE').toBe(4);
  });

  it('le GAMMA de la courbe est posé sur TOUS les matériaux embrumés, et c’est celui du milieu', () => {
    poser('exterieur');
    monter(<MondeDeCampagne />);
    expect(gammasPosés(dernièreScène())).toEqual(new Set([fogCurveOf(false).gamma.toFixed(4)]));
    démonter();

    poser('interieur');
    monter(<MondeDeCampagne />);
    expect(gammasPosés(dernièreScène())).toEqual(new Set([fogCurveOf(true).gamma.toFixed(4)]));
  });

  it('le CHROME d’interface n’est PAS de la matière : les pools d’affordance montés n’ont ni brume ni gamma', () => {
    poser('exterieur');
    monter(<MondeDeCampagne />);
    const chrome = chromeMonté(dernièreScène());
    // NON-VACUITÉ PAR FAMILLE, jamais par un compte : la scène POV monte des pools de CHAQUE famille
    // d'affordance — un compte figé rougirait au premier slot ajouté ou retiré (les halos en ont perdu
    // deux en passant au régime de révélation, #1687) sans qu'aucune brume soit en cause.
    const familles = new Set(chrome.map((c) => c.nom.split(':')[0]));
    expect([...familles].sort(), 'la scène POV monte bien ses familles d’affordance').toEqual(['halos', 'marquesDyn']);
    expect(chrome.filter((c) => c.mat.fog).map((c) => c.nom), 'la brume délaverait une affordance lointaine').toEqual([]);
    expect(chrome.filter((c) => c.mat.defines?.[FOG_GAMMA_DEFINE] !== undefined).map((c) => c.nom)).toEqual([]);
  });

  it('à la SORTIE du POV, le gamma part AVEC la brume (nettoyage de l’effet)', () => {
    poser('exterieur');
    monter(<MondeDeCampagne />);
    const scène3d = dernièreScène();
    const embrumés = matériauxEmbrumés(scène3d);
    expect(embrumés.length, 'le monde du POV a bien des matériaux embrumés').toBeGreaterThan(0);
    expect(new Set(embrumés.map((m) => m.defines?.[FOG_GAMMA_DEFINE]))).toEqual(new Set([fogCurveOf(false).gamma.toFixed(4)]));

    démonter();
    expect(scène3d.fog, 'la brume se retire au démontage').toBeNull();
    for (const m of embrumés) {
      expect(m.defines?.[FOG_GAMMA_DEFINE], 'un gamma sans brume = une clé de programme orpheline').toBeUndefined();
    }
  });
});

/**
 * MÉTÉO EN PREMIÈRE PERSONNE (#1247) — la brume authorée MODULE la brume de distance existante, elle
 * n'ouvre pas un canal concurrent : sa couleur remplace celle du milieu, son `povTightenK` resserre la
 * portée, et la porte est le milieu de la FRAME (entrer sous un toit éteint la modulation).
 */
describe('POV volumique — la météo module la brume du milieu (#1247)', () => {
  /** Monte la première personne sur une scène EXTÉRIEURE embrumée, au milieu que dit la frame. */
  function monterPov(indoor: boolean, meteo: Scene['weather']): { scene: Scene; mpt: number } {
    const scene = poser('exterieur');
    scene.weather = meteo;
    useGame.setState({ scene: { ...scene } });
    const s = useGame.getState().scene!;
    const mpt = sceneMetresPerTile(s);
    monter(
      <GameStage3D
        scene={s}
        mpt={mpt}
        frame={{ mode: 'pov', partyPos: { x: 4, y: 4 }, facing: 'N', indoor, cid: null }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={1}
        lights={[]}
      />,
    );
    return { scene: s, mpt };
  }

  it('DEHORS sous le brouillard : sa couleur remplace celle du milieu et la portée se resserre', () => {
    const brume = AMBIANCE.iso.weather.brouillard!.brume!;
    const { mpt } = monterPov(false, 'brouillard');
    const fog = dernièreScène().fog as THREE.Fog;
    expect(hex(fog.color), 'la brume authorée EST la brume de distance').toBe(brume.color.toLowerCase());
    const serre = povDepth(false, brume.povTightenK);
    expect(fog.far).toBeCloseTo(serre.curve.end * mpt, 6);
    expect(fog.near).toBeCloseTo(serre.curve.start * mpt, 6);
    expect(fog.far, 'la portée s’est VRAIMENT resserrée').toBeLessThan(fogCurveOf(false).end * mpt);
  });

  it('la même scène par BEAU TEMPS garde la brume et la portée du milieu (aucune modulation)', () => {
    const { mpt } = monterPov(false, 'clair');
    const fog = dernièreScène().fog as THREE.Fog;
    expect(hex(fog.color)).toBe(AMBIANCE.pov.fogOutdoorSurface.toLowerCase());
    expect(fog.far).toBeCloseTo(fogCurveOf(false).end * mpt, 6);
  });

  it('ENTRÉ SOUS UN TOIT (milieu de la FRAME) : la modulation s’éteint — la tempête ne déteint pas dans la taverne', () => {
    const { mpt } = monterPov(true, 'brouillard');
    const fog = dernièreScène().fog as THREE.Fog;
    expect(hex(fog.color), 'dedans, c’est la brume d’intérieur').toBe(AMBIANCE.pov.fogIndoor.toLowerCase());
    expect(fog.far).toBeCloseTo(fogCurveOf(true).end * mpt, 6);
  });

  it('aucune NAPPE de brume en première personne : elle a la brume de distance, pas des plafonds', () => {
    monterPov(false, 'brouillard');
    let nappes = 0;
    dernièreScène().traverse((o) => { if (/^brume:/.test(o.name)) nappes++; });
    expect(nappes).toBe(0);
  });

  /** ÉCART DÉCLARÉ du lot : en vue du DESSUS (tangage 90°, `affineScales`), les nappes se projettent
   *  l'une sur l'autre — l'empilement dégénère en voile plein écran. La météo y reste la teinte de
   *  lumière et le semis. */
  it('vue de PLATEAU : des nappes en losange, AUCUNE en vue du dessus', () => {
    const scene = poser('exterieur');
    scene.weather = 'brouillard';
    useGame.setState({ scene: { ...scene } });
    const s = useGame.getState().scene!;
    const compter = () => {
      let n = 0;
      dernièreScène().traverse((o) => { if (/^brume:/.test(o.name)) n++; });
      return n;
    };
    const monterVue = (view: Dims['view']) => monter(
      <GameStage3D
        scene={s}
        mpt={sceneMetresPerTile(s)}
        frame={{ mode: 'plateau', dims: { w: s.dimensions.w, h: s.dimensions.h, rot: 0, view }, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={1}
        lights={[]}
      />,
    );
    monterVue('iso');
    expect(compter(), 'la vue de plateau porte la brume dans le volume').toBe(
      AMBIANCE.iso.weather.brouillard!.brume!.layers.length,
    );
    démonter();

    monterVue('top');
    expect(compter(), 'à 90° de tangage, l’empilement dégénère en voile plein écran').toBe(0);
  });
});

describe('Vue de PLATEAU — pas d’horizon, donc pas de brume (#1176 P3-1c)', () => {
  it('en affine : `scene.fog` nul, aucun fond, aucun gamma sur les matériaux', () => {
    const scene = poser('exterieur');
    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' };
    monter(
      <GameStage3D
        scene={scene}
        mpt={sceneMetresPerTile(scene)}
        frame={{ mode: 'plateau', dims, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
      />,
    );
    const s = dernièreScène();
    expect(s.fog, 'une brume de distance délaverait le bord de carte').toBeNull();
    expect(s.background).toBeNull();
    expect(gammasPosés(s), 'aucun matériau ne porte de gamma en vue de plateau').toEqual(new Set([undefined]));
  });
});
