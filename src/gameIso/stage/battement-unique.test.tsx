import type { JSX } from 'react';
// @vitest-environment jsdom
/**
 * UN BATTEMENT, UNE IMAGE (#1378) — l'écran volumique monté sous ses TROIS motifs continus à la fois :
 * l'averse qui tombe, la flamme qui vacille, le halo qui pulse. Chacun tenait sa propre boucle rAF
 * avec sa propre cession — quatre horloges pour un canevas, 2,2 rendus par image mesurés en rotation.
 *
 * Ce que ce banc tient, sur l'écran câblé comme en production (`VolumetricWorld` ne fournit AUCUN
 * pilote d'images : l'écran s'abonne lui-même au battement) :
 *  1. les trois motifs vivants ne posent qu'UN `requestAnimationFrame` par image et ne peignent qu'un
 *     rendu — le compteur applicatif du canevas (`data-rendus`) dit exactement ce que le renderer a
 *     reçu (un canevas WebGL n'a pas d'arbre à interroger) ;
 *  2. un battement VENU D'AILLEURS (un geste qui tient déjà son horloge — la marche, un `pointermove`
 *     que le navigateur cadence) dans la MÊME image ne s'ajoute pas au rendu de la boucle : la cession
 *     vit au module, et nulle part ailleurs.
 */
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dims } from '../../geometry/iso';
import type { LightSource } from '../../state/vision';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { InteractHalo } from '../builders/interactHalos';
import { GameStage3D, setStageRendererFactory, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, brancherImagesPilotees, scènes, viderCaptures } from './banc-volumique';
import { POINT_LIGHT_BUDGET, resolveTone } from './stagePointLights';
import { battreStageFrames, resetStageFrames } from './stageFrames';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Le canevas de jsdom n'a aucune boîte : la passe de dessin sort sur `!w || !h` sans elle. */
const TAILLE = { w: 800, h: 600 };

brancherArdoise();
/** L'horloge du banc et sa file de rAF : les poses disent combien d'HORLOGES tournent, et le banc ne
 *  mesure ni la vitesse de la machine ni l'ordre des fichiers du worker. */
const images = brancherImagesPilotees();

/** Scène d'EXTÉRIEUR sous la pluie : c'est elle qui ouvre le semis d'intempéries (le premier motif). */
const SCENE: Scene = (() => {
  const s = emptyScene(8, 8);
  s.weather = 'pluie';
  s.ambiance = 'exterieur';
  return s;
})();
const MPT = sceneMetresPerTile(SCENE);
const NUIT = 23 * 60; // de jour les flaques retombent à 0, et rien ne vacille
/** Une source POSÉE au ton par défaut (`flamme`), donc porteuse d'un vacillement : le deuxième motif. */
const LAMPES: LightSource[] = [{ pos: { x: 4, y: 4 }, radiusTiles: 4, srcId: 'brasero' }];
/** Un décor fouillable à l'écran : le troisième motif. */
const HALOS: readonly InteractHalo[] = [
  { id: 'coffre', cell: { x: 3, y: 4, z: 0 }, n: 1, scaleK: 1, bodyTopFrac: 1, span: { w: 1, h: 1 }, centre: { x: 3, y: 4 }, echelle: { x: 1, y: 1 }, etat: 'revele', visible: true },
];
/** Câblage de PRODUCTION (`VolumetricWorld`) : AUCUN pilote d'images — l'écran s'abonne lui-même au
 *  battement du module. Un `subscribe` de plus ici doublerait l'abonnement, donc les rendus. */
const ANIM: StageWalkAnim = {
  glide: () => null,
  cam: () => ({ x: 0, y: 0 }),
};

const dimsDe = (yawDeg: number): Dims => ({ w: SCENE.dimensions.w, h: SCENE.dimensions.h, rot: 0, view: 'iso', yawDeg });

/** Les commits React des écrans montés par le test courant — comptés par un `<Profiler>` posé AUTOUR
 *  de l'écran (`walk-frame-loop.test.tsx` compte les siens de la même façon). Il ne voit que le
 *  SOUS-ARBRE profilé : un commit d'un parent qui ne re-rendrait pas l'écran lui échapperait. */
let commitsReact = 0;

/** `avecAnim` = l'hôte de JEU (qui passe un `anim` pour le glissement) ; sans lui, c'est l'ÉDITEUR
 *  (`ui/editor/EditorCanvas`), qui monte le même écran sans aucune prop d'animation. */
const écran = (yawDeg = 0, avecAnim = true): JSX.Element => (
  <Profiler id="stage" onRender={() => { commitsReact += 1; }}>
    <GameStage3D
      scene={SCENE}
      mpt={MPT}
      frame={{ mode: 'plateau', dims: dimsDe(yawDeg), cam: { x: 0, y: 0 }, zoom: 1 }}
      tintAt={() => 1}
      keepEl={() => true}
      els={{ tokens: [], props: [] }}
      actors={[]}
      gameTime={NUIT}
      lightLevel={null}
      lights={LAMPES}
      halos={HALOS}
      {...(avecAnim ? { anim: ANIM } : {})}
    />
  </Profiler>
);

/** Les écrans MONTÉS par un test — plusieurs à la fois (deux stages coexistent : jeu et aperçu). */
let écrans: { root: Root; hôte: HTMLDivElement }[] = [];

function monter(avecAnim = true): HTMLCanvasElement {
  const hôte = document.createElement('div');
  document.body.appendChild(hôte);
  const root = createRoot(hôte);
  act(() => root.render(écran(0, avecAnim)));
  écrans.push({ root, hôte });
  return hôte.querySelector('canvas.iso-stage') as HTMLCanvasElement;
}

function démonterTout(): void {
  for (const { root, hôte } of écrans) { act(() => root.unmount()); hôte.remove(); }
  écrans = [];
}

/** Les trois motifs sont-ils VRAIMENT vivants ? Sans ces prémisses, « une seule boucle » serait vrai
 *  du vide — un écran sans pluie, sans flamme et sans halo n'en ouvre aucune. */
function prémisses(canevas: HTMLCanvasElement): void {
  expect(Number(canevas.dataset.precip), 'aucune particule : la boucle de chute n’aurait rien à animer').toBeGreaterThan(0);
  expect(canevas.dataset.lampes, 'aucune flaque allumée : rien ne vacille').toBe(`1/${POINT_LIGHT_BUDGET}`);
  expect(resolveTone(undefined).flicker, 'le ton par défaut ne vacille pas : le deuxième motif serait éteint').toBeDefined();
  expect(HALOS.filter((h) => h.etat !== 'muet').length, 'aucun halo : le troisième motif serait éteint').toBeGreaterThan(0);
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});

afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  viderCaptures();
  commitsReact = 0;
  // ARDOISE NEUVE du battement : la suite partage ses modules (`isolate: false`) — un écran resté
  // monté dans un autre fichier tiendrait des images sur SON `requestAnimationFrame`, et la boucle ne se
  // réarmerait jamais sur celui de ce banc.
  resetStageFrames();
});

afterEach(() => {
  démonterTout();
  resetStageFrames();
  vi.restoreAllMocks();
});

describe('Trois motifs continus — une seule horloge (#1378)', () => {
  it('averse + vacillement + halos : UN rAF posé par image, UN rendu par image', () => {
    const canevas = monter();
    prémisses(canevas);

    const rendusAvant = scènes.length;
    const posesAvant = images.poses();
    const IMAGES = 6;
    for (let i = 0; i < IMAGES; i++) images.battre();

    const poses = images.poses() - posesAvant;
    expect(poses, `${poses} rAF posés pour ${IMAGES} images`).toBe(IMAGES);
    expect(scènes.length - rendusAvant, `${scènes.length - rendusAvant} rendus pour ${IMAGES} images`).toBe(IMAGES);
    // Le compteur applicatif dit ce que le renderer a REÇU : c'est par lui que la recette navigateur
    // lit le même fait sur un canevas qui n'a pas d'arbre.
    expect(canevas.dataset.rendus, 'le compteur du canevas ne suit pas les rendus').toBe(String(scènes.length));
  });

  it('un battement VENU D’AILLEURS dans la MÊME image ne double pas le rendu', () => {
    const canevas = monter();
    prémisses(canevas);

    const avant = scènes.length;
    act(() => battreStageFrames()); // un geste qui tient déjà son horloge fait battre le stage
    expect(scènes.length, 'le battement doit peindre : sans cela la suite serait vraie du vide').toBe(avant + 1);

    images.battre(1); // moins de `MEME_IMAGE_MS` : c'est la MÊME image
    expect(scènes.length, 'la boucle continue a repeint une image déjà peinte').toBe(avant + 1);

    images.battre(20); // …et l'image SUIVANTE se peint bien
    expect(scènes.length).toBe(avant + 2);
    expect(canevas.dataset.rendus).toBe(String(scènes.length));
  });

  it('ROTATION CONTINUE : la boucle d’image ne coûte qu’un rAF et qu’un rendu par image', () => {
    const canevas = monter();
    prémisses(canevas);
    const IMAGES = 10;
    const posesAvant = images.poses();
    let aLImage = 0;
    for (let i = 0; i < IMAGES; i++) {
      // Un lacet qui FRANCHIT un cran pose un yaw neuf — le seul commit React que la rotation coûte
      // (#1403) — et le battement suit ; ce que ce contrat borne est ce que la boucle d'image ajoute
      // PAR-DESSUS.
      act(() => écrans[0].root.render(écran(10 * (i + 1))));
      act(() => battreStageFrames());
      const avant = scènes.length;
      images.battre();
      aLImage += scènes.length - avant;
    }

    const poses = images.poses() - posesAvant;
    expect(poses, `${poses} rAF posés pour ${IMAGES} images de rotation`).toBe(IMAGES);
    expect(aLImage, `${aLImage} rendus de boucle pour ${IMAGES} images`).toBe(IMAGES);
  });
});

/**
 * L'ÉCRAN TIENT SON DESSIN DU BATTEMENT, SANS PROP (#1378). L'éditeur monte le MÊME `GameStage3D`
 * sans aucun `anim` (`ui/editor/EditorCanvas.tsx`, sa balise n'en porte pas) : une averse qui tient le
 * battement sans que personne ne dessine, c'est une pluie armée et GELÉE.
 */
describe('Battement sans hôte — l’écran s’abonne de lui-même', () => {
  it('SANS anim : les images demandées par l’averse sont PEINTES', () => {
    const canevas = monter(false);
    expect(Number(canevas.dataset.precip), 'prémisse : il doit pleuvoir, sinon rien ne demande d’image').toBeGreaterThan(0);

    const rendusAvant = scènes.length;
    const posesAvant = images.poses();
    const IMAGES = 6;
    for (let i = 0; i < IMAGES; i++) images.battre();

    expect(images.poses() - posesAvant, 'la boucle doit être armée : sans elle, « rien ne peint » serait vrai du vide').toBe(IMAGES);
    expect(scènes.length - rendusAvant, `${scènes.length - rendusAvant} rendus pour ${IMAGES} images sans anim`).toBe(IMAGES);
    expect(canevas.dataset.rendus).toBe(String(scènes.length));
  });
});

/**
 * CESSION DU COMMIT (#1378). Un commit React redessine le stage hors du battement ; l'horloge du
 * module doit le voir, sinon la boucle repeint la même image du navigateur (mesuré avant : 4 rendus
 * dans l'image d'un commit).
 */
describe('Image peinte par un commit — la boucle cède', () => {
  it('commit puis rAF servi 2 ms après : aucun rendu de plus', () => {
    const canevas = monter();
    prémisses(canevas);
    for (let i = 0; i < 3; i++) images.battre(); // régime établi

    images.avancer(20); // image N du navigateur
    const avant = scènes.length;
    act(() => écrans[0].root.render(écran(10)));
    const aprèsCommit = scènes.length;
    expect(aprèsCommit - avant, 'le commit doit peindre : sans cela il n’y aurait rien à céder').toBeGreaterThan(0);

    images.battre(2); // MOINS de `MEME_IMAGE_MS` : la boucle sert son rAF dans la MÊME image

    expect(scènes.length - aprèsCommit, 'la boucle a repeint une image que le commit venait de peindre').toBe(0);
  });
});

/**
 * DEUX ÉCRANS MONTÉS (#1378). Les sources sont des clés d'INSTANCE : le même motif vivant sur deux
 * écrans en pose deux, et le démontage de l'un ne relâche jamais les images de l'autre (une clé
 * partagée — le nom du motif — les confondrait, et le second écran se figerait).
 */
describe('Deux écrans — aucun ne relâche les images de l’autre', () => {
  it('démonter le premier laisse le second recevoir ses images', () => {
    const c1 = monter();
    const c2 = monter();
    expect(Number(c1.dataset.precip), 'prémisse : les deux écrans ont bien leur averse').toBeGreaterThan(0);
    expect(Number(c2.dataset.precip)).toBeGreaterThan(0);
    images.battre();

    const { root, hôte } = écrans.shift()!;
    act(() => root.unmount());
    hôte.remove();

    const avantC2 = Number(c2.dataset.rendus);
    images.battre();

    expect(Number(c2.dataset.rendus) - avantC2, 'le démontage du premier a coupé les images du second').toBe(1);
  });

  it('l’écran DÉMONTÉ ne dessine plus : un seul rendu par battement', () => {
    const c1 = monter();
    const c2 = monter();
    expect(Number(c1.dataset.precip), 'prémisse : les deux écrans peignent').toBeGreaterThan(0);
    expect(Number(c2.dataset.precip)).toBeGreaterThan(0);
    images.battre();

    const { root, hôte } = écrans.shift()!;
    act(() => root.unmount());
    hôte.remove();

    const avant = scènes.length;
    const mortAvant = Number(c1.dataset.rendus);
    images.avancer(20);
    act(() => battreStageFrames());

    expect(scènes.length - avant, 'un écran démonté peint encore : son abonnement a fui').toBe(1);
    expect(Number(c1.dataset.rendus), 'l’écran mort a redessiné').toBe(mortAvant);
  });
});

/**
 * P2 — L'HORLOGE D'IMAGES NE PILOTE JAMAIS REACT (#1401). Pendant un motif continu, AUCUN commit React
 * par image : les commits sont bornés par les ÉVÉNEMENTS DISCRETS du motif. L'averse n'en a aucun —
 * elle ne fait que tomber —, donc la borne y est ZÉRO.
 *
 * CE QUE LA SONDE MESURE : les commits du SOUS-ARBRE PROFILÉ (l'écran monté ici), comptés par
 * `<Profiler>`. ANGLE MORT : un commit d'un parent qui ne re-rendrait pas cet écran ne s'y verrait
 * pas, et un état interne qui ne re-rendrait aucun composant du sous-arbre non plus.
 *
 * Le LACET TENU est le même contrat sur l'autre motif continu ; il exige l'HÔTE (c'est lui qui avance
 * le lacet et tient les images) et se mesure donc là où l'hôte est monté : `stage/walk-frame-loop.test.tsx`.
 */
describe('P2 — un motif continu ne commet pas (#1401)', () => {
  it('averse tenue sur 30 images : 0 commit React, alors que les images PEINTES montent d’autant', () => {
    const canevas = monter();
    prémisses(canevas);

    const IMAGES = 30;
    const peintsAvant = Number(canevas.dataset.rendus);
    const commitsAvant = commitsReact;
    for (let i = 0; i < IMAGES; i++) images.battre();

    const peints = Number(canevas.dataset.rendus) - peintsAvant;
    // Prémisse : le compteur MORD — le montage, lui, a bien commis ; un zéro par construction (sonde
    // débranchée, sous-arbre jamais profilé) rendrait le contrat vrai du vide.
    expect(commitsAvant, 'aucun commit compté au montage : la sonde de commits est débranchée').toBeGreaterThan(0);
    // Prémisse : sans images peintes, « aucun commit » serait vrai d'un écran gelé.
    expect(peints, `${peints} images peintes pour ${IMAGES} images battues`).toBeGreaterThanOrEqual(IMAGES);
    expect(
      commitsReact - commitsAvant,
      `${commitsReact - commitsAvant} commits React pour ${IMAGES} images d’averse — aucun événement discret ne s’est produit, la borne est 0`,
    ).toBe(0);
  });
});
