// @vitest-environment jsdom
/**
 * ENTRÉE EN SCÈNE (#1372) — le MONTAGE d'une scène ne rasterise plus en rafale, et ce qu'on regarde
 * arrive AVANT le lointain.
 *
 * Quatre faits, chacun réfutable seul, chacun avec une panne mesurée en face :
 *  1. aucune rasterisation SYNCHRONE au montage — tout part par la file cadencée du cuiseur
 *     (mesuré avant le lot : trois longtasks de 692/624/630 ms à l'ouverture d'une carte) ;
 *  2. ORDRE DE PROXIMITÉ — les sujets sont servis du plus proche du groupe au plus lointain, sans
 *     quoi le décor sous les pieds du groupe arrive après celui du fond de carte ;
 *  3. le VOILE d'entrée tombe quand les sujets DANS LE RAYON (donnée) sont posés — jamais après le
 *     lointain, qui a le droit d'arriver en silence derrière ;
 *  4. PLAFOND de sécurité (donnée) : une texture qui n'arrive jamais ne tient pas l'écran voilé.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Dir8 } from '../../state/dir8';
import type { BillboardPropEl } from '../builders/types';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import * as svgTexture from '../backends/webgl/svgTexture';
import { bakeQueueLength } from '../backends/webgl/atlasBake';
import { AMBIANCE } from '../catalog/ambiance';
import { GameStage3D, centreDuGroupe, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import {
  BancRenderer,
  PLAFOND_ATTENTE_MS,
  PLAFOND_HORS_ATTEINTE_MS,
  attendreQuads,
  attendreQue,
  brancherArdoise,
  quads,
  respirer as respirerBanc,
  simulerRasterisation,
  viderCaptures,
  type Rasterisation,
} from './banc-volumique';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Budget de test calé AU-DESSUS du plafond d'attente du harnais (`PLAFOND_ATTENTE_MS`) : sous un
 *  budget plus court, une attente qui va au bout de son plafond meurt sur le chronomètre de Vitest, et
 *  le banc accuse une lenteur là où sa PRÉMISSE a la réponse. */
vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };
/** Carte LARGE : le rayon d'entrée se compte en mètres, il faut de la place pour poser un décor
 *  franchement au-delà (une carte de 12 cases n'en offrirait pas). */
const SCENE: Scene = emptyScene(40, 40);
const MPT = sceneMetresPerTile(SCENE);
/** Le GROUPE, au milieu de la carte — l'origine des distances de proximité. */
const GROUPE = { x: 20, y: 20 };
/** Rayon d'entrée en CASES, lu de la donnée : un rayon changé au JSON déplace les décors de ce banc. */
const RAYON_CASES = AMBIANCE.entreeEnScene.rayonM / MPT;
/** Une case FRANCHEMENT au-delà du rayon (le lointain, celui qui n'a pas à tenir le voile). */
const LOIN = Math.ceil(RAYON_CASES) + 2;

const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
const SANS_ACTEUR: ActorPose[] = [];

const décor = (id: string, x: number, y = GROUPE.y): BillboardPropEl => ({
  kind: 'prop', source: 'entity', key: `prop:${id}`, entId: id, span: { w: 1, h: 1 }, ref: 'tonneau', facing: 'S',
  cell: { x, y, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 },
  states: { visible: true },
});

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let battre: (() => void) | null = null;

brancherArdoise();

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: () => null,
  cam: () => ({ x: GROUPE.x, y: GROUPE.y }),
};

/** IMAGES RETENUES : la rasterisation d'un billboard ne s'achève qu'au chargement de son image, et ce
 *  banc en tient l'instant (mode `retenue`, file `ras.enAttente`) — une file jamais servie est le cas
 *  du SVG qui ne charge pas. */
let ras!: Rasterisation;

/** Le cadre de PREMIÈRE PERSONNE au cap `facing`, le groupe à sa case — le regard qui porte lui-même
 *  la position du groupe (`StageFrame`), donc le banc n'a aucun héros à monter pour l'exprimer. */
const cadrePov = (facing: Dir8 = 'N'): StageFrame => ({ mode: 'pov', partyPos: GROUPE, facing, indoor: false, cid: null });

/** Le cadre de PLATEAU — l'autre regard, celui dont la position du groupe ne vient PAS du cadre mais
 *  des héros posés (`centreDuGroupe`). */
const cadrePlateau = (): StageFrame => ({
  mode: 'plateau',
  dims: { ...SCENE.dimensions, rot: 0, view: 'iso', yawDeg: 0 },
  cam: { x: GROUPE.x, y: GROUPE.y },
  zoom: 1,
});

function écran(
  els: SceneBillboardEls,
  onEntree?: (v: boolean) => void,
  frame: StageFrame = cadrePov(),
  acteurs: readonly ActorPose[] = SANS_ACTEUR,
): JSX.Element {
  return (
    <GameStage3D
      scene={SCENE}
      mpt={MPT}
      frame={frame}
      tintAt={TINT}
      keepEl={KEEP}
      els={els}
      actors={acteurs}
      gameTime={720}
      lightLevel={1}
      lights={[]}
      anim={anim}
      onEntreeEnScene={onEntree}
    />
  );
}

/** La file du cuiseur servie (une rasterisation par tranche) en battant la boucle d'image de CE banc. */
const respirer = (ms: number): Promise<void> => respirerBanc(ms, () => battre?.());

/** Le même patron d'attente que le harnais, la pompe d'images de CE banc branchée dessus (#1442) :
 *  toute attente de ce fichier SORT AU FAIT ACCOMPLI, jamais au bout d'une fenêtre de mur. */
const attendre = (fait: () => boolean): Promise<void> => attendreQue(fait, PLAFOND_ATTENTE_MS, () => battre?.());

/** Le plafond de sécurité du voile, tel qu'il est AUTHORÉ — relu à chaque fois qu'un banc le pousse. */
const plafondNominal = AMBIANCE.entreeEnScene.plafondMs;

function monterSync(
  els: SceneBillboardEls,
  onEntree?: (v: boolean) => void,
  frame: StageFrame = cadrePov(),
  acteurs: readonly ActorPose[] = SANS_ACTEUR,
): void {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => { root!.render(écran(els, onEntree, frame, acteurs)); });
}

const canevas = (): HTMLCanvasElement => hôte!.querySelector('canvas')!;

/**
 * Sert les images RETENUES une par une jusqu'à la tombée du voile, et rend le nombre de quads montés
 * à cet instant (−1 si le voile n'est jamais tombé).
 *
 * Chaque image servie s'attend à SON FAIT — son quad en scène — jamais au bout d'une fenêtre de mur :
 * sur une machine chargée, une fenêtre trop courte ferait servir l'image suivante avant que la
 * précédente ne soit posée, et le compte de la chute serait celui du banc, pas celui du voile.
 */
async function servirJusquAuVoileTombé(tours: number): Promise<number> {
  for (let i = 0; i < tours && canevas().dataset.voile; i++) {
    // Une image doit être EN VOL pour être servie : la file cadencée du cuiseur les pousse à leur tour.
    await attendre(() => ras.enAttente.length > 0);
    expect(ras.enAttente.length, `PRÉMISSE : aucune rasterisation en vol au tour ${i + 1} — il n’y a rien à servir`).toBeGreaterThan(0);
    const montés = quads().length;
    const paquet = ras.enAttente.splice(0, 1);
    await act(async () => { for (const f of paquet) f(); });
    await attendre(() => quads().length > montés);
    expect(quads().length, `l’image servie au tour ${i + 1} n’a monté aucun quad : le compte de la chute ne dirait rien`)
      .toBeGreaterThan(montés);
  }
  return canevas().dataset.voile ? -1 : quads().length;
}

/** Distance MONDE (m) d'un quad posé au groupe — la grandeur que le tri de proximité ordonne. */
const distanceAuGroupe = (m: THREE.Mesh): number =>
  Math.hypot(m.position.x - GROUPE.x * MPT, m.position.z - GROUPE.y * MPT);

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  ras = simulerRasterisation('auto');
});
afterEach(() => {
  // La donnée d'ambiance est un SINGLETON de module que la suite partage (`isolate: false`) : un banc
  // qui la pousse la rend, sinon le fichier voisin monte son écran sous un voile immortel. La rendre
  // EN TÊTE, avant le démontage qui peut lever : une restauration en queue de hook est conditionnelle.
  AMBIANCE.entreeEnScene.plafondMs = plafondNominal;
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
  // Les faux timers sont un SINGLETON de worker, comme l'ambiance : un banc qui simule le temps le
  // rend, sinon le fichier voisin attend un réveil que plus personne ne déclenche.
  vi.useRealTimers();
});

describe('Montage d’une scène — aucune rasterisation en rafale', () => {
  const DENSE: SceneBillboardEls = {
    tokens: [],
    props: Array.from({ length: 12 }, (_, i) => décor(`d${i}`, GROUPE.x - 5 + i)),
  };

  it('douze sujets montés : ZÉRO rasterisation avant la première tranche de file', async () => {
    // La sonde se pose sur `svgToTexture`, la couture que l'écran APPELLE (`rasterizeSvg` lui est
    // interne, donc hors de portée d'un espion de module).
    const statique = vi.spyOn(svgTexture, 'svgToTexture');

    // Rendu SYNCHRONE : aucune tranche d'inactivité ne peut s'intercaler entre le montage et la
    // mesure — ce que la file a différé y est encore différé, et ce qu'elle n'aurait pas différé s'y
    // serait déjà exécuté.
    monterSync(DENSE);

    expect(statique, 'une rafale de rasterisations au montage : c’est le gel de chargement mesuré').not.toHaveBeenCalled();
    expect(bakeQueueLength(), 'les rasterisations du montage doivent être EN FILE, pas exécutées').toBeGreaterThanOrEqual(DENSE.props.length);
    // PRÉMISSE — la sonde MORD : ces mêmes textures rasterisent bien PAR ELLE, une fois la file servie.
    // Le premier appel est un FAIT : on l'attend, on ne parie pas sur 200 ms de mur.
    await attendre(() => statique.mock.calls.length > 0);
    expect(statique.mock.calls.length, 'espion branché à côté : « zéro appel » ne dirait rien').toBeGreaterThan(0);
  });

  it('`data-file` témoigne de la file : chargée au montage, au repos une fois servie', async () => {
    monterSync(DENSE);
    // Une image peinte AVANT toute tranche d'inactivité : ce que le témoin doit montrer, c'est la file
    // telle que le montage vient de la charger — pas ce qu'il en reste une fois le cuiseur passé.
    act(() => battre!());
    expect(Number(canevas().dataset.file), 'le témoin de file ne voit pas les cuissons du montage').toBeGreaterThan(0);
    await attendre(() => bakeQueueLength() === 0);
    expect(bakeQueueLength(), 'PRÉMISSE : la file du cuiseur doit être servie avant de lire son témoin au repos').toBe(0);
    if (battre) act(() => battre!());
    expect(canevas().dataset.file, 'le cuiseur devrait être au repos, la file servie').toBe('0');
  });
});

describe('Montage d’une scène — l’ORDRE est celui de la PROXIMITÉ', () => {
  // Les décors sont donnés du plus LOIN au plus PRÈS : sans tri, l'ordre de service serait celui-ci.
  const ÉTAGÉS: SceneBillboardEls = {
    tokens: [],
    props: [décor('loin', GROUPE.x + LOIN), décor('moyen', GROUPE.x + 4), décor('près', GROUPE.x + 1)],
  };

  it('trois décors à distances distinctes : servis du plus proche au plus lointain', async () => {
    monterSync(ÉTAGÉS);
    await attendreQuads(ÉTAGÉS.props.length, PLAFOND_ATTENTE_MS, () => battre?.());

    const distances = quads().map(distanceAuGroupe);
    expect(distances.length, 'les trois décors doivent être montés').toBe(ÉTAGÉS.props.length);
    // PRÉMISSE — trois distances DISTINCTES, sinon l'ordre ne dirait rien.
    expect(new Set(distances.map((d) => d.toFixed(3))).size).toBe(3);
    expect(distances, 'l’ordre de montage n’est pas celui de la proximité').toEqual([...distances].sort((a, b) => a - b));
    // …et l'ordre des SUJETS, lui, est l'inverse : un tri retiré rendrait ce banc rouge.
    expect(distances[0], 'PRÉMISSE : le premier sujet donné est le plus LOINTAIN').toBeLessThan(distances[distances.length - 1]);
  });
});

describe('Voile d’entrée en scène — les PROCHES le tiennent, le lointain non', () => {
  const PROCHE_ET_LOIN: SceneBillboardEls = {
    tokens: [],
    props: [
      décor('loin1', GROUPE.x + LOIN),
      décor('loin2', GROUPE.x + LOIN + 1),
      décor('loin3', GROUPE.x + LOIN + 2),
      décor('près', GROUPE.x + 1),
    ],
  };

  it('levé au montage, il tombe dès le décor PROCHE posé — sans attendre le lointain', async () => {
    // IMAGES RETENUES : le banc choisit l'instant où chaque texture s'achève, donc l'instant où le
    // voile peut tomber.
    ras = simulerRasterisation('retenue');
    // Le voile a DEUX causes de tombée : ses sujets proches, ou son plafond de sécurité — un vrai timer
    // qu'une machine saturée fait gagner la course. Le plafond est poussé hors d'atteinte : la tombée
    // a seulement UNE cause possible, et le compte de quads relevé à la chute est bien celui du décor
    // qui l'a fait tomber.
    AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
    const états: boolean[] = [];
    monterSync(PROCHE_ET_LOIN, (v) => états.push(v));

    expect(canevas().dataset.voile, 'le voile doit être levé au montage').toBe('1');
    expect(états[états.length - 1], 'l’hôte doit apprendre que l’entrée en scène court').toBe(true);

    // Les textures s'achèvent UNE PAR UNE, dans l'ordre où la file les sert (donc par proximité) :
    // le voile doit tomber à la PREMIÈRE, celle du décor proche.
    const montésÀLaChute = await servirJusquAuVoileTombé(PROCHE_ET_LOIN.props.length);

    expect(canevas().dataset.voile, 'le voile n’est jamais tombé sur son décor proche — et son plafond ne pouvait pas le faire tomber').toBeUndefined();
    expect(états[états.length - 1], 'l’hôte n’a pas appris la tombée du voile').toBe(false);
    expect(montésÀLaChute, 'le voile a attendu le LOINTAIN : la carte s’ouvre trop tard')
      .toBeLessThan(PROCHE_ET_LOIN.props.length);
    // PRÉMISSE — le lointain était bien encore en vol quand le voile est tombé.
    expect(montésÀLaChute, 'aucun quad monté à la chute : le voile serait tombé sans rien attendre').toBeGreaterThan(0);
  });

  it('une texture qui n’arrive JAMAIS TIENT le voile tant que le plafond n’est pas atteint', async () => {
    // Aucune image ne se chargera. Le plafond est poussé hors d'atteinte : plus RIEN ne peut faire
    // tomber le voile, donc s'il tombe c'est qu'un sujet non servi a été compté comme entré en scène.
    // Aucune prémisse de vitesse ici : une machine lente ne fait que respirer plus longtemps sous un
    // plafond de 120 s.
    ras = simulerRasterisation('retenue');
    AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
    monterSync({ tokens: [], props: [décor('près', GROUPE.x + 1)] });

    await attendre(() => ras.enAttente.length > 0);
    expect(ras.enAttente.length, 'PRÉMISSE : une rasterisation doit être en vol, image jamais servie').toBeGreaterThan(0);
    // Fenêtre d'OBSERVATION d'une absence, pas une prémisse : une machine lente ne fait qu'observer
    // plus longtemps un voile que rien ne peut faire tomber (plafond hors d'atteinte, image jamais
    // servie). Aucune durée n'est ici attendue de qui que ce soit.
    await respirer(200);
    expect(quads(), 'PRÉMISSE : aucune image servie, donc aucun quad ne doit être en scène').toHaveLength(0);
    expect(canevas().dataset.voile, 'le voile est tombé sans qu’un seul sujet soit entré en scène').toBe('1');
  });

  it('PLAFOND : le voile tient jusqu’à la MILLISECONDE authorée, et tombe à celle-là', async () => {
    // Le plafond garde ici sa valeur AUTHORÉE : c'est lui qu'on mesure. Sa tombée n'a qu'une cause
    // possible — aucune image n'est servie de tout le banc (rasterisation retenue, zéro quad en scène
    // au retour), donc aucun sujet ne peut déclarer son entrée.
    //
    // Le temps est SIMULÉ : le plafond de production est un `setTimeout` (`GameStage3D.tsx:852`,
    // `setTimeout(finirEntrée, AMBIANCE.entreeEnScene.plafondMs)`), que les faux timers de vitest
    // couvrent par DÉFAUT. On n'y ajoute NI `performance` NI `requestAnimationFrame` : la boucle
    // d'images s'arme par rAF (`stageFrames.ts:90-97`) et se figerait. L'échéance devient ainsi une
    // CONSTANTE d'avance, et la borne est EXACTE des deux côtés — plus rien à concéder à la machine.
    vi.useFakeTimers();
    ras = simulerRasterisation('retenue');
    monterSync({ tokens: [], props: [décor('près', GROUPE.x + 1)] });

    await act(async () => { await vi.advanceTimersByTimeAsync(plafondNominal - 1); });
    expect(canevas().dataset.voile, `le voile est tombé AVANT le plafond authoré de ${plafondNominal} ms`).toBe('1');

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(canevas().dataset.voile, `le voile n’est pas tombé AU plafond authoré de ${plafondNominal} ms`).toBeUndefined();

    expect(ras.enAttente.length, 'PRÉMISSE : une rasterisation doit être restée en vol, image jamais servie').toBeGreaterThan(0);
    expect(quads(), 'un sujet est entré en scène : la tombée ne serait plus celle du plafond').toHaveLength(0);
  });

  it('SVG en ÉCHEC dans le rayon : sa clé est SERVIE, le voile n’attend pas le plafond', async () => {
    // Un sujet dont la rasterisation ÉCHOUE n'entrera jamais en scène : s'il retenait le voile, le
    // seul chemin de sortie serait le plafond — deux secondes d'écran noir pour un décor cassé.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { queueMicrotask(() => this.onerror?.()); }
    });
    // Le plafond est poussé HORS D'ATTEINTE : il ne peut plus faire tomber le voile, donc la tombée n'a
    // qu'UNE cause possible — la clé du sujet en échec, SERVIE. La cause s'établit ainsi, jamais en
    // datant la chute : un chronomètre mural ne mesure que la vitesse de la machine.
    AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
    monterSync({ tokens: [], props: [décor('près', GROUPE.x + 1)] });
    expect(canevas().dataset.voile, 'PRÉMISSE : le voile doit être levé au montage').toBe('1');

    await attendre(() => !canevas().dataset.voile);

    expect(canevas().dataset.voile, 'le voile est resté sur une rasterisation qui a échoué — et son plafond ne pouvait pas le faire tomber').toBeUndefined();
    expect(quads(), 'PRÉMISSE : le sujet en échec ne doit monter AUCUN quad').toHaveLength(0);
    expect(warn, 'PRÉMISSE : le sujet sauté se signale').toHaveBeenCalled();
  });

  it('AUCUN sujet dans le rayon : le voile tombe au montage, il n’a rien à couvrir', async () => {
    // Une scène dont tout le décor est au LOIN (ou un écran sans groupe) n'a rien à faire attendre :
    // le voile qui tiendrait quand même serait un écran noir gratuit, jusqu'au plafond.
    ras = simulerRasterisation('retenue');
    const états: boolean[] = [];
    monterSync(
      { tokens: [], props: [décor('loin1', GROUPE.x + LOIN), décor('loin2', GROUPE.x + LOIN + 1)] },
      (v) => états.push(v),
    );

    expect(canevas().dataset.voile, 'aucun sujet proche : rien ne tient le voile').toBeUndefined();
    expect(états[états.length - 1], 'l’hôte doit apprendre tout de suite qu’il n’y a rien à voiler').toBe(false);
    // PRÉMISSE — les lointains sont bien là, et bien EN VOL : le voile est tombé DEVANT eux. Leur
    // mise en vol est un FAIT que la file cadencée produit à son rythme, pas au bout de 60 ms.
    await attendre(() => ras.enAttente.length > 0);
    expect(ras.enAttente.length, 'aucune rasterisation en vol : la scène serait vide').toBeGreaterThan(0);
    expect(quads(), 'aucun quad ne doit être monté à cet instant').toHaveLength(0);
  });
});

/**
 * LE GROUPE SUR LA VUE DE PLATEAU (#1372) — là, le cadre ne porte AUCUNE position : le centre de
 * proximité se prend au barycentre des HÉROS posés (`centreDuGroupe`). La panne en face est muette et
 * générale : un centre `null` sur cette vue rend toute distance infinie, donc plus aucun tri et plus
 * aucun voile — sur la moitié du jeu.
 */
describe('Vue de plateau — le centre de proximité vient des HÉROS', () => {
  const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
  const héros = (id: string, x: number, y: number): ActorPose => ({ c: { ...HÉROS, id }, x, y, z: 0 });
  const ennemi = (id: string, x: number, y: number): ActorPose => ({ c: { ...HÉROS, id, kind: 'enemy' }, x, y, z: 0 });

  it('BARYCENTRE des héros, l’ennemi IGNORÉ — et rien du tout sans héros', () => {
    const plateau = cadrePlateau();
    // Deux héros de part et d'autre du groupe, et un ennemi au diable : le centre est celui des héros.
    expect(centreDuGroupe(plateau, [héros('h1', GROUPE.x - 4, GROUPE.y), héros('h2', GROUPE.x + 4, GROUPE.y), ennemi('e1', 0, 0)]))
      .toEqual(GROUPE);
    // PRÉMISSE — l'ennemi DÉPLACERAIT le centre s'il comptait : la garde ci-dessus mord.
    expect(centreDuGroupe(plateau, [héros('h1', GROUPE.x - 4, GROUPE.y), héros('h2', GROUPE.x + 4, GROUPE.y), héros('h3', 0, 0)]))
      .not.toEqual(GROUPE);
    // Aucun héros monté (éditeur, planche QC) : aucune proximité à juger.
    expect(centreDuGroupe(plateau, [])).toBeNull();
    expect(centreDuGroupe(plateau, [ennemi('e1', GROUPE.x, GROUPE.y)])).toBeNull();
    // …et le regard de première personne, lui, porte SA position dans le cadre.
    expect(centreDuGroupe(cadrePov(), [])).toEqual(GROUPE);
  });

  it('MONTAGE de plateau : le voile est armé, et il tombe sur le décor PROCHE des héros', async () => {
    ras = simulerRasterisation('retenue');
    // Même raison qu'au banc du regard à hauteur d'œil : hors d'atteinte, le plafond ne peut pas gagner
    // la course, et la chute n'a qu'UNE cause — le décor proche des héros.
    AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
    const états: boolean[] = [];
    const PROCHE_ET_LOIN: SceneBillboardEls = {
      tokens: [],
      props: [
        décor('loin1', GROUPE.x + LOIN),
        décor('loin2', GROUPE.x + LOIN + 1),
        décor('loin3', GROUPE.x + LOIN + 2),
        décor('près', GROUPE.x + 1),
      ],
    };
    monterSync(PROCHE_ET_LOIN, (v) => états.push(v), cadrePlateau(), [héros('h1', GROUPE.x, GROUPE.y)]);

    expect(canevas().dataset.voile, 'le voile doit être levé au montage de plateau').toBe('1');
    expect(états[états.length - 1]).toBe(true);

    const montésÀLaChute = await servirJusquAuVoileTombé(PROCHE_ET_LOIN.props.length);

    expect(canevas().dataset.voile, 'le voile n’est jamais tombé sur la vue de plateau').toBeUndefined();
    expect(états[états.length - 1]).toBe(false);
    // Le héros et le décor proche sont servis les premiers : le voile tombe avant les trois lointains.
    expect(montésÀLaChute, 'le voile a attendu le lointain — le tri de proximité ne porte pas sur cette vue')
      .toBeLessThan(PROCHE_ET_LOIN.props.length);
    expect(montésÀLaChute, 'aucun quad monté à la chute : le voile serait tombé sans rien attendre').toBeGreaterThan(0);
  });
});
