// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { bus, EVT } from '../../state/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import { setStageRendererFactory } from './GameStage3D';
import { battreStageFrames, resetStageFrames } from './stageFrames';
import { arreterLacet, demarrerLacet, getStageYaw, poserYaw, resetStageYaw } from '../../state/stageYaw';
import { BancRenderer, brancherArdoise, brancherImagesPilotees } from './banc-volumique';
import { VH, VW } from './useStageCamera';
import { stageYawCorrection } from './stageCam';
import { poseFromDims, worldToScreen } from './projection';
import type { Dims } from '../../geometry/iso';

/**
 * LA MARCHE PILOTÉE PAR LA BOUCLE DE RENDU (#1176, P2-4). La cadence LOGIQUE d'un pas est le store
 * (160 ms) ; le GLISSEMENT, lui, est une affaire d'image. Qui PEINT décide de ce qu'une image coûte :
 * la voie affine repeint ses jetons SVG, donc elle re-rend React à chaque image ; la voie volumique a
 * sa propre boucle, lit `walksRef` elle-même, et ne re-rend RIEN à l'image.
 *
 * Elle re-rend en revanche au FRANCHISSEMENT d'une case : les vérités de PIÈCE et de DÉGAGEMENT
 * (`visualAllies` → `roomFocus`/`cleared`/`propEls`) sont des événements DISCRETS, et les laisser
 * attendre l'arrivée ferait basculer un toit une case trop tard. Un rendu par case franchie, jamais un
 * par image — c'est la cadence du PAS.
 *
 * Le battement de la marche est ISOLÉ des autres boucles rAF de l'écran (les clips de rig en affine) :
 * le tick de marche est retiré de la file au moment où il s'y inscrit, puis rejoué seul. Un commit
 * mesuré ici est donc imputable à la marche, et à rien d'autre.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

brancherArdoise();
beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
/** L'horloge du banc et sa file de rAF — le collecteur UNIQUE des bancs d'images du stage. */
const images = brancherImagesPilotees();

/** Monte le stage et COMPTE les commits de son sous-arbre (aucun rendu = aucun commit). */
function monter(): { el: HTMLDivElement; commits: () => number } {
  useGame.setState({
    scene: emptyScene(8, 8),
    mode: 'exploration',
    partyPos: { x: 2, y: 2 },
    party: [hero('h1', { x: 2, y: 2 })],
    battle: null,
    dialogue: null,
    flags: {},
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let n = 0;
  act(() => root!.render(<Profiler id="stage" onRender={() => { n += 1; }}><MondeDeCampagne /></Profiler>));
  return { el: container!, commits: () => n };
}

/** Déclenche une marche et EXTRAIT son tick de la file commune (cf. en-tête). */
function marcher(id: string, path: { x: number; y: number }[]): FrameRequestCallback {
  const avant = images.enVol.length;
  bus.emit(EVT.ANIM_MOVE, { id, path });
  const posés = images.enVol.splice(avant);
  expect(posés).toHaveLength(1);
  return posés[0];
}

/** Avance l'horloge de `dt` et rejoue le SEUL tick de marche ; rend celui qu'il reprogramme. */
function image(tick: FrameRequestCallback, dt: number): FrameRequestCallback | null {
  images.avancer(dt);
  const avant = images.enVol.length;
  act(() => { tick(images.maintenant()); });
  return images.enVol.splice(avant)[0] ?? null;
}

const transform = (el: HTMLElement) => (el.querySelector('svg.iso-stage > g') as SVGGElement).style.transform;

/** Le canevas de jsdom n'a aucune boîte, et la passe de dessin sort sur `!w || !h` : sans cadre, le
 *  compteur d'images peintes ne bougerait jamais et la prémisse « ça peint » serait vraie du vide.
 *  Rend aussi l'ardoise du lacet et du battement, que la suite partage (`isolate: false`). */
function harnaisCanevas(): void {
  beforeEach(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => 800 });
    Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => 600 });
    resetStageFrames();
    resetStageYaw();
  });
  afterEach(() => {
    delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientWidth;
    delete (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).clientHeight;
    // Le lacet est un module PARTAGÉ par la suite (`isolate: false`) : un angle laissé en l'air
    // déplacerait le cran effectif de tout banc suivant.
    resetStageYaw();
    resetStageFrames();
  });
}

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  useGame.setState({ combatCursor: null });
  vi.restoreAllMocks();
});

/** UN PAS : la case logique du sujet est déjà la destination (le store commet AVANT l'animation), la
 *  marche rejoue le trajet depuis la case quittée — le contrat de `bus.emit(ANIM_MOVE)` des deux
 *  producteurs (`combatSlice.battleClickTile`, `useStagePointer.moveAlong`). */
const CHEMIN = [{ x: 1, y: 2 }, { x: 2, y: 2 }];
/** DEUX pas d'un seul trait : ce que le combat émet (chemin ENTIER, un seul événement). */
const COURSE = [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];
/** QUATRE pas : de quoi tenir la marche sur quarante images sans qu'elle meure en route. */
const TRAJET = [{ x: 6, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];

describe('Marche — qui peint décide de ce qu’une image coûte (#1176 P2-4)', () => {
  it('aucune IMAGE ne re-rend le stage — seul un FRANCHISSEMENT de case le fait', () => {
    const { commits } = monter();
    const avant = commits();
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    // Sept images, deux cases visuelles seulement : celle qu'on quitte (le sujet y revient à l'ouverture
    // de la marche, sa case logique étant déjà la destination) puis celle qu'on rejoint, franchie à
    // mi-pas. Les cinq autres images ne coûtent rien.
    const paliers: number[] = [];
    for (let i = 0; i < 7; i++) { tick = image(tick!, STEP_MS / 8); paliers.push(commits() - avant); }
    expect(paliers).toEqual([1, 1, 1, 2, 2, 2, 2]);
  });

  it('…et la boucle a bien LU la marche : la caméra du groupe d’overlays glisse image par image', () => {
    const { el, commits } = monter();
    const avant = commits();
    const vues: string[] = [transform(el)];
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    for (let i = 0; i < 3; i++) { tick = image(tick!, STEP_MS / 8); vues.push(transform(el)); }
    expect(commits()).toBe(avant + 1); // le seul franchissement de case, jamais une image
    expect(new Set(vues).size).toBe(vues.length); // quatre positions distinctes
  });

  it('ARRIVÉE en volumique : UN rendu re-synchronise React, et la caméra CONVERGE sur la pose committée', () => {
    const { el, commits } = monter();
    const repos = transform(el); // la caméra de la case LOGIQUE, sans aucun glissement
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    tick = image(tick!, STEP_MS / 2);
    const avant = commits();
    expect(transform(el)).not.toBe(repos); // prémisse : en plein vol, la caméra est ailleurs
    const suite = image(tick!, STEP_MS); // au-delà de la durée : la marche meurt
    expect(commits()).toBe(avant + 1);
    expect(suite).toBeNull(); // plus rien à animer : la boucle s'arrête
    // La marche n'a pas laissé la vue à côté : la caméra du dernier rendu est EXACTEMENT celle de la
    // case logique — la même chaîne (`camAt` → `stageCamTransform`) qu'au repos, sans marche vivante.
    expect(transform(el)).toBe(repos);
  });
});

/**
 * CE QUE LE POINTEUR LIT PENDANT UNE MARCHE VOLUMIQUE. L'inversion pixel→tuile (`useStagePointer`)
 * n'a qu'UNE source de caméra : la réf que le stage écrit. Tant que le rendu React était le seul à
 * l'écrire, une marche sans rendu la GELAIT — le monde glissait sous un pointeur resté à la caméra du
 * dernier rendu, et le clic visait à côté. La sonde ne bouge JAMAIS la souris : c'est le monde qui
 * bouge sous un pixel FIXE, et elle mesure ENTRE deux franchissements de case, là où AUCUN rendu ne
 * se produit — sinon c'est le rendu qui recalerait la réf, et la boucle ne serait pour rien dans le
 * verdict.
 *
 * Observable : le curseur clavier/manette (`combatCursor`), que le survol n'efface QUE lorsqu'il tombe
 * sur une AUTRE tuile que la précédente (`useStagePointer.onPointerMove`).
 */
describe('Marche volumique — le pointeur suit la caméra image par image (#1176 P2-4)', () => {
  const PIXEL = { x: 640, y: 360 };

  function bouger(el: HTMLDivElement, p: { x: number; y: number }): void {
    const svg = el.querySelector('svg.iso-stage') as SVGSVGElement;
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) });
    act(() => { svg.dispatchEvent(new MouseEvent('pointermove', { clientX: p.x, clientY: p.y, bubbles: true })); });
  }

  const curseurPosé = () => useGame.setState({ combatCursor: { tile: { x: 0, y: 0 } } as never });
  const curseurVivant = () => useGame.getState().combatCursor !== null;

  it('la case sous un pixel FIXE change SANS aucun rendu — sinon le clic viserait à côté', () => {
    const { el, commits } = monter();
    bouger(el, PIXEL);
    // Prémisse 1 — la sonde MORD : deux pixels distincts donnent deux tuiles distinctes, donc l'effacement.
    curseurPosé();
    bouger(el, { x: PIXEL.x + 220, y: PIXEL.y + 120 });
    expect(curseurVivant()).toBe(false);
    // On entre dans le SECOND pas de la marche : de f=0,55 à f=1,45, la case visuelle du marcheur ne
    // change pas (elle vaut 3 sur tout l'intervalle) — donc aucun rendu, et la caméra parcourt tout de
    // même les neuf dixièmes d'une case.
    let tick: FrameRequestCallback | null = marcher('h1', COURSE);
    tick = image(tick!, STEP_MS * 0.55);
    // Prémisse 2 — à cet instant, le même pixel donne deux fois la même tuile : rien ne s'efface.
    bouger(el, PIXEL);
    curseurPosé();
    bouger(el, PIXEL);
    expect(curseurVivant()).toBe(true);
    const avant = commits();
    for (let i = 0; i < 3; i++) tick = image(tick!, STEP_MS * 0.3);
    expect(commits()).toBe(avant); // prémisse 3 : la boucle SEULE a bougé la caméra, React n'a rien rendu
    // MESURE : le même pixel ne tombe plus sur la même tuile.
    bouger(el, PIXEL);
    expect(curseurVivant()).toBe(false);
  });
});

/**
 * INVARIANCE DES CANAUX LOURDS pendant une marche volumique : la cuisson du monde et le tracé des
 * billboards sont les deux passes que la position VISUELLE périmait avant ce lot. Elles ne doivent plus
 * tourner entre deux pas — ni aux images (aucun rendu ne s'y produit), ni à un rendu que le store
 * provoque EN PLEINE marche : l'identité d'un sujet porte sa case LOGIQUE, jamais le glissement.
 */
describe('Marche volumique — ni géométrie ni billboards reconstruits entre deux pas (#1176 P2-4)', () => {
  it('la cuisson du monde et le tracé des billboards ne rejouent AUCUNE fois', () => {
    const cuisson = vi.spyOn(sceneMeshes, 'bakeWorldGeometry');
    const billboards = vi.spyOn(sceneMeshes, 'actorBillboards');
    monter();
    const cAvant = cuisson.mock.calls.length;
    const bAvant = billboards.mock.calls.length;
    expect(bAvant).toBeGreaterThan(0); // la sonde mord : le montage, lui, en a bien tracé
    let tick: FrameRequestCallback | null = marcher('h1', CHEMIN);
    for (let i = 0; i < 4; i++) tick = image(tick!, STEP_MS / 8);
    expect(cuisson.mock.calls.length).toBe(cAvant);
    expect(billboards.mock.calls.length).toBe(bAvant);
    // Un rendu EN PLEINE marche (le store bouge : ici l'orientation, que le monde volumique lit) : les
    // sujets s'y redérivent, et leur identité ne doit pas avoir bougé d'un demi-pas pour autant.
    act(() => { useGame.getState().faceToward('__sonde-orientation', { x: 0, y: 1 }, { x: 0, y: 0 }); }); // cap N
    expect(cuisson.mock.calls.length).toBe(cAvant);
    expect(billboards.mock.calls.length).toBe(bAvant);
  });
});

/**
 * P2 — L'HORLOGE D'IMAGES NE PILOTE JAMAIS REACT (#1401). Pendant un motif continu, les commits sont
 * bornés par les ÉVÉNEMENTS DISCRETS du motif, jamais par le nombre d'images. Pour la marche, ces
 * événements sont NOMMÉS et se comptent d'avance :
 *  - un par CASE VISUELLE occupée le long du trajet (`MondeDeCampagne`, `visualAlliesKey` →
 *    `setWalkStep`) : les cases arrondies d'un trajet en ligne sont ses tuiles, la case de DÉPART
 *    comprise (la case logique du sujet est déjà la destination, la marche l'en fait repartir) ;
 *  - un à l'ARRIVÉE (`fx/useWalkAnim` : `setWalkTick` à l'image où plus aucune marche ne vit).
 *
 * CE QUE LA SONDE MESURE : les commits du SOUS-ARBRE PROFILÉ (`monter`), et le tick de marche EXTRAIT
 * de la file (cf. en-tête du fichier) — donc les commits imputables à la marche seule. ANGLE MORT : un
 * commit d'un parent de `MondeDeCampagne` ne s'y verrait pas.
 */
describe('P2 — un motif continu ne commet pas par image (#1401)', () => {
  it('marche tenue sur 40 images : commits ≤ cases franchies + la re-synchronisation d’ARRIVÉE', () => {
    const { commits } = monter();
    const avant = commits();
    const PAS_PAR_IMAGE = STEP_MS / 10; // dix images par pas : aucune case ne se saute
    const FRANCHISSEMENTS = TRAJET.length; // 6,5,4,3,2 — une case visuelle par tuile du trajet
    const ARRIVEE = 1; // `setWalkTick` de `fx/useWalkAnim`, quand la dernière marche meurt
    const BORNE = FRANCHISSEMENTS + ARRIVEE;

    let tick: FrameRequestCallback | null = marcher('h1', TRAJET);
    let images = 0;
    while (tick && images < 40) { tick = image(tick, PAS_PAR_IMAGE); images++; }

    // Prémisse : la marche a bien été TENUE — un motif éteint au bout de trois images ne prouverait
    // rien d'une horloge qui piloterait React.
    expect(images, `${images} images servies : la marche n’a pas tenu 30 images`).toBeGreaterThanOrEqual(30);
    expect(
      commits() - avant,
      `${commits() - avant} commits pour ${images} images — borne : ${FRANCHISSEMENTS} cases franchies + ${ARRIVEE} arrivée = ${BORNE}`,
    ).toBeLessThanOrEqual(BORNE);
  });
});

/**
 * P2 — LE LACET TENU NE COMMET PAS PAR IMAGE (#1403). Le lacet continu n'a plus d'horloge à lui : le
 * battement du stage l'AVANCE (`state/stageYaw.avancerLacet`, tiré par l'hôte tant que `lacetActif`),
 * et ses consommateurs par-frame le relisent à l'image — la caméra volumique par `yawAt`, le groupe
 * d'overlays par sa reprojection d'écran. Ses commits sont donc bornés par ses ÉVÉNEMENTS DISCRETS,
 * nommés et comptés d'avance :
 *  - le DÉPART et l'ARRÊT du régime (`demarrerLacet`/`arreterLacet`, un avis chacun) ;
 *  - un par CRAN franchi (`rotAtYaw` — la quantification que lisent les memos lourds du rendu).
 *
 * CE QUE LA SONDE MESURE : les commits du SOUS-ARBRE PROFILÉ (`monter`) et les images PEINTES par le
 * canevas (`data-rendus`, le compteur applicatif — un canevas WebGL n'a pas d'arbre à interroger).
 * ANGLE MORT : un commit d'un parent de `MondeDeCampagne` ne s'y verrait pas.
 */
describe('P2 — le lacet tenu ne commet pas par image (#1403)', () => {
  harnaisCanevas();

  it('lacet MAINTENU sur 40 images : commits ≤ crans franchis + départ + arrêt, et les images PEINTES montent d’autant', () => {
    // Ardoise du battement et du lacet : la suite partage ses modules (`isolate: false`), et une
    // horloge de peinte laissée loin devant par un banc voisin ferait céder toute la boucle.
    resetStageFrames();
    resetStageYaw();
    const { el, commits } = monter();
    const canevas = el.querySelector('canvas.iso-stage') as HTMLCanvasElement;
    const avant = commits();
    const peintsAvant = Number(canevas.dataset.rendus);

    act(() => demarrerLacet(1));
    const IMAGES = 40;
    for (let i = 0; i < IMAGES; i++) images.battre();
    const parcouru = getStageYaw();
    act(() => arreterLacet());

    const CRANS = Math.abs(Math.round(parcouru / 90));
    const DEPART_ET_ARRET = 2; // deux avis de RÉGIME : le geste commence, le geste finit
    const BORNE = CRANS + DEPART_ET_ARRET;
    const peints = Number(canevas.dataset.rendus) - peintsAvant;

    // Prémisse 1 — la sonde MORD : le montage, lui, a bien commis.
    expect(avant, 'aucun commit compté au montage : la sonde de commits est débranchée').toBeGreaterThan(0);
    // Prémisse 2 — le lacet a VRAIMENT tourné : un angle figé rendrait « aucun commit » vrai du vide.
    expect(parcouru, `${parcouru}° parcourus : le lacet n’a pas tourné`).toBeGreaterThan(50);
    // Prémisse 3 — les images ont bien été PEINTES : un canevas gelé ne commet pas non plus.
    expect(peints, `${peints} images peintes pour ${IMAGES} images battues`).toBeGreaterThanOrEqual(IMAGES - BORNE);
    expect(
      commits() - avant,
      `${commits() - avant} commits pour ${IMAGES} images de lacet — borne : ${CRANS} cran(s) franchi(s) + départ + arrêt = ${BORNE}`,
    ).toBeLessThanOrEqual(BORNE);
  });
});

/** Les `matrix(...)` d'une chaîne de transformation, dans l'ordre. Sur le groupe d'overlays : la
 *  CAMÉRA d'abord, puis — entre deux commits d'une rotation seulement — la reprojection d'écran du
 *  lacet parcouru depuis le dernier commit. */
function matrices(css: string): number[][] {
  return [...css.matchAll(/matrix\(([^)]*)\)/g)].map((m) => m[1].split(',').map(Number));
}

/** Image d'un point par une affine `matrix(a,b,c,d,e,f)`. */
const applique = (m: number[], p: { x: number; y: number }) => ({
  x: m[0] * p.x + m[2] * p.y + m[4],
  y: m[1] * p.x + m[3] * p.y + m[5],
});

const ecart = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * DÉSACCORD, en pixels de viewBox, entre la projection COMMISE — celle que portent les overlays SVG et
 * le picking (`dimsVue`) — et le lacet VIF que regarde le monde volumique. C'est exactement la
 * reprojection que le groupe doit encore appliquer pour remettre les uns sur l'autre, mesurée au plus
 * écarté des quatre coins du viewBox. Nul quand les deux lacets coïncident : la chaîne n'a alors
 * qu'une matrice, sa caméra.
 */
function desaccordPx(el: HTMLElement): number {
  const mats = matrices(transform(el));
  if (mats.length < 2) return 0;
  const coins = [{ x: 0, y: 0 }, { x: VW, y: 0 }, { x: 0, y: VH }, { x: VW, y: VH }];
  return Math.max(...coins.map((p) => ecart(applique(mats[1], p), p)));
}

/**
 * G4 — LA PROJECTION COMMISE CONCORDE AVEC LE LACET VIF (#1403). Le lacet vit à l'IMAGE, les overlays
 * SVG et le picking vivent au COMMIT : entre les deux, le groupe porte une reprojection d'écran
 * (`stageCam.stageYawCorrection`) qui remet les uns sur l'autre. Elle n'est TENABLE que si chaque
 * commit la ramène à rien — sinon le résidu sous-cran (jusqu'à un demi-cran, des centaines de pixels)
 * survit au dernier battement et s'installe : les overlays sont peints à un lacet, le monde à un
 * autre, et le clic vise à côté sans que rien ne vienne plus le corriger.
 *
 * CE QUE LA SONDE MESURE : la reprojection que la production ELLE-MÊME calcule entre les deux lacets,
 * lue sur le groupe d'overlays. Le battement de sonde ne change aucun état — il ne fait qu'écrire au
 * groupe ce que la projection commise réclame à cet instant.
 */
describe('Lacet — la projection commise concorde avec le lacet vif (#1403)', () => {
  harnaisCanevas();

  /** Un battement de SONDE : aucune avance (le lacet est au repos), juste la reprojection écrite. */
  const sonder = () => act(() => battreStageFrames());

  /** ~24° de maintien, sous le cran — l'état où le désaccord est maximal et où RIEN ne viendra le
   *  solder de lui-même. Rend le désaccord mesuré à cet instant. */
  function maintenirSousCran(el: HTMLElement): number {
    act(() => demarrerLacet(1));
    for (let i = 0; i < 15; i++) images.battre();
    const parcouru = getStageYaw();
    expect(parcouru, `${parcouru}° parcourus : le lacet n’a pas tourné`).toBeGreaterThan(15);
    expect(Math.round(parcouru / 90), `${parcouru}° : un cran a été franchi, le résidu n’est plus sous-cran`).toBe(0);
    return desaccordPx(el);
  }

  it('la correction de lacet ne SURVIT pas au commit d’ARRÊT', () => {
    const { el } = monter();
    // Prémisse — la sonde MORD : en plein maintien, la projection commise est bien en retard.
    expect(maintenirSousCran(el), 'aucun désaccord en plein maintien : la sonde est débranchée').toBeGreaterThan(50);
    act(() => arreterLacet());
    sonder();
    expect(
      desaccordPx(el),
      'la projection commise est restée au cran après l’arrêt : overlays et picking faux, durablement',
    ).toBeLessThan(1e-9);
  });

  it('le glisser-tourner REPROJETTE : `poserYaw` commet la projection du pointeur', () => {
    const { el } = monter();
    expect(maintenirSousCran(el), 'aucun désaccord en plein maintien : la sonde est débranchée').toBeGreaterThan(50);
    act(() => poserYaw(30));
    sonder();
    expect(desaccordPx(el), 'le glisser-tourner a laissé la projection commise en arrière').toBeLessThan(1e-9);
  });

  it('la reprojection est EXACTE au sol, et son cisaillement en élévation est MESURÉ', () => {
    const rendu: Dims = { w: 20, h: 20, rot: 0, view: 'iso', edge: false, yawDeg: 0 };
    const vif: Dims = { ...rendu, yawDeg: 37.5 };
    const m = matrices(stageYawCorrection(rendu, vif))[0];
    const poseR = poseFromDims(rendu);
    const poseV = poseFromDims(vif);
    const ecarts = (lift: number) => {
      let max = 0;
      for (let x = 0; x < 20; x += 3) {
        for (let y = 0; y < 20; y += 3) {
          max = Math.max(max, ecart(applique(m, worldToScreen(poseR, { x, y, lift })), worldToScreen(poseV, { x, y, lift })));
        }
      }
      return max;
    };
    // AU SOL, la reprojection EST la projection : `worldToScreen` est affine en la case à lift
    // constant, donc trois points la déterminent entièrement (cf. `stageCam.stageYawCorrection`).
    const sol = ecarts(0);
    expect(sol, `${sol} px d’écart au sol : la reprojection n’est plus exacte`).toBeLessThan(1e-9);
    // CE QUI EST ÉLEVÉ y est emporté comme le sol : son décalage écran vertical ne dépend pas du
    // lacet (`stage/projection.liftPx`), donc la reprojection le déplace du même vecteur que sa base.
    // L'écart qui en résulte est le produit du LIFT par un vecteur qui ne dépend que de l'angle : il
    // ne dépend NI de la case NI de la carte, et croît LINÉAIREMENT avec l'étage — c'est ce que les
    // deux mesures qui suivent établissent, et c'est ce qui le rend borné.
    const eleve1 = ecarts(1);
    const eleve2 = ecarts(2);
    expect(2 * eleve1, `lift 1 : ${eleve1} px, lift 2 : ${eleve2} px — le cisaillement n’est pas linéaire en l’étage`).toBeCloseTo(eleve2, 9);
    // BORNE, à l'angle le plus défavorable qu'un maintien puisse laisser (un demi-cran, ici 37,5°) et
    // à deux étages au-dessus du sol : 237 px de viewBox — sur 1100×720, un quart de champ.
    expect(eleve2, `${eleve2} px de cisaillement à lift 2 sous 37,5°`).toBeGreaterThan(230);
    expect(eleve2, `${eleve2} px de cisaillement à lift 2 sous 37,5°`).toBeLessThan(240);
  });
});

/**
 * G8 — L'AVANCE DU LACET PRÉCÈDE LE DESSIN, DANS LA MÊME IMAGE (#1403). Le lacet n'a plus d'horloge :
 * l'hôte l'avance dans le battement, et le canevas volumique dessine dans le MÊME battement. Si le
 * dessin passait le premier, il peindrait le lacet de l'image PRÉCÉDENTE — une image de retard sur les
 * overlays, qui, eux, sont reprojetés au lacet avancé dans la même passe.
 */
describe('Lacet — l’avance précède le dessin dans la même image (#1403)', () => {
  harnaisCanevas();

  it('la passe de dessin voit le lacet de SON image, jamais celui de la précédente', () => {
    const vus: number[] = [];
    setStageRendererFactory(() => new BancRenderer(() => vus.push(getStageYaw())));
    try {
      monter();
      act(() => demarrerLacet(1));
      vus.length = 0; // ardoise : les passes du montage et de l'avis de régime précèdent toute avance
      images.battre();
      // Prémisse — l'image a bien été DESSINÉE : un canevas gelé rendrait le verdict vrai du vide.
      expect(vus.length, 'aucune passe de dessin dans l’image battue').toBeGreaterThan(0);
      expect(vus[0], `le dessin a vu ${vus[0]}° : le lacet d’AVANT l’avance de sa propre image`).toBeGreaterThan(0);
    } finally {
      setStageRendererFactory(() => new BancRenderer());
    }
  });
});
