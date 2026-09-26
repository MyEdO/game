// @vitest-environment jsdom
/**
 * UN FRANCHISSEMENT DE CRAN EST UNE REPOSE — mesuré sur l'écran monté, au chemin RÉEL de la
 * rotation en jeu (le lacet continu pose `Dims.yawDeg`, dont `artRot` PLANCHÉRISE le cran).
 *
 * Trois faits, chacun réfutable seul, et chacun avec une panne coûteuse en face :
 *  1. les quads SURVIVENT au quart de tour — aucun `dispose`, aucune identité perdue (le rebuild du
 *     groupe entier libérait matériaux et géométries de TOUT le décor à chaque quart : 55-380 ms de
 *     gel mesurés en recette) ;
 *  2. aucune rasterisation SYNCHRONE au franchissement — un cran jamais visité passe par la file
 *     cadencée du cuiseur, et le quad garde son art jusqu'à la relève ;
 *  3. après la relève, l'art montré est bien celui du NOUVEAU cran — décor (texture échangée en place)
 *     comme corps à flipbook (planche du cran choisie par l'image).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { Dir8 } from '../../state/dir8';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Rot } from '../../geometry/iso';
import type { BillboardPropEl } from '../builders/types';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import { atlasLayout, billboardView } from '../backends/webgl/billboardMath';
import { dir8Basis } from '../pov/camera';
import * as svgTexture from '../backends/webgl/svgTexture';
import * as atlasBake from '../backends/webgl/atlasBake';
import { PRIORITE_RECHAUFFAGE, PRIORITE_VUE_COURANTE, setBudgetTrancheMs, atlasBytesEstimés, bakeQueueLength, resetBakeQueue } from '../backends/webgl/atlasBake';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, PLAFOND_ATTENTE_MS, attendreQue, brancherArdoise, quads, respirer as respirerBanc, scènes, simulerRasterisation, viderCaptures } from './banc-volumique';
import { bbCameraDe, povArtRot } from './regard';
import { poigneesEnAttente } from './texturesStatiques';
import { atlasPxHeight } from './boardPose';
import { pxPerM } from '../backends/webgl/worldTris';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Budget de test calé AU-DESSUS du plafond d'attente du harnais (`PLAFOND_ATTENTE_MS`) : ce banc sert
 *  une file CADENCÉE à une tâche par tranche, et sa durée suit la machine. Sous un budget plus court,
 *  une attente qui va au bout de son plafond meurt sur le chronomètre de Vitest, et le banc accuse une
 *  lenteur là où sa PRÉMISSE a la réponse. */
vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(12, 12);
const MPT = sceneMetresPerTile(SCENE);
const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
const ACTEURS: ActorPose[] = [{ c: HÉROS, x: 4, y: 4, z: 0, facing: 'S' }];
/** Teinte et dégagement STABLES : le groupe de billboards se rebâtit sur l'IDENTITÉ de ses entrées —
 *  une lambda par rendu le remonterait à chaque image, et la mesure porterait sur le banc. */
const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
/** Liste d'acteurs VIDE et stable — même raison : `[]` reforgé par rendu remonte tout le groupe. */
const SANS_ACTEUR: ActorPose[] = [];

const décor = (id: string, x: number): BillboardPropEl => ({
  kind: 'prop', source: 'entity', key: `prop:${id}`, entId: id, span: { w: 1, h: 1 }, ref: 'tonneau', facing: 'S',
  cell: { x, y: 4, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 },
  states: { visible: true },
});

const ELS: SceneBillboardEls = { tokens: [], props: [décor('a', 6), décor('b', 7), décor('c', 8)] };

/** Le cadre de plateau à un LACET donné — la forme que le lacet continu passe au stage (`dimsVue`). */
const cadre = (yawDeg: number): StageFrame => ({
  mode: 'plateau',
  dims: { ...SCENE.dimensions, rot: 0, view: 'iso', yawDeg },
  cam: { x: 6, y: 6 },
  zoom: 1,
});

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let battre: (() => void) | null = null;

brancherArdoise();

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: () => null,
  cam: () => ({ x: 6, y: 6 }),
};

/** Le cadre de PREMIÈRE PERSONNE au cap `facing` — la forme que le pas de POV passe au stage. */
const cadrePov = (facing: Dir8): StageFrame => ({ mode: 'pov', partyPos: { x: 6, y: 6 }, facing, indoor: false, cid: HÉROS.id });

function écran(
  frame: StageFrame,
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
  animUtilisée: StageWalkAnim = anim,
  keepEl: KeepEl = KEEP,
): JSX.Element {
  return (
    <GameStage3D
      scene={SCENE}
      mpt={MPT}
      frame={frame}
      tintAt={TINT}
      keepEl={keepEl}
      els={els}
      actors={acteurs}
      gameTime={720}
      lightLevel={1}
      lights={[]}
      anim={animUtilisée}
    />
  );
}

function vue(
  yawDeg: number,
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
  animUtilisée: StageWalkAnim = anim,
  keepEl: KeepEl = KEEP,
): JSX.Element {
  return écran(cadre(yawDeg), els, acteurs, animUtilisée, keepEl);
}

async function monter(
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
  animUtilisée: StageWalkAnim = anim,
): Promise<void> {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(vue(0, els, acteurs, animUtilisée)); });
  await attendreMontage(els.props.length + els.tokens.length + acteurs.length);
}

/** Montage en PREMIÈRE PERSONNE au cap `cap` — même banc, l'autre regard. */
async function monterPov(
  cap: Dir8,
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
): Promise<void> {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(écran(cadrePov(cap), els, acteurs)); });
  await attendreMontage(els.props.length + els.tokens.length + acteurs.length);
}

/** Changement de CAP servi comme le jeu le sert : un rendu, puis la file servie jusqu'à ce que plus
 *  rien n'attende — c'est dans ce service que la repose se joue, et une fenêtre de mur ne le porte que
 *  sur une machine au repos. */
async function allerAuCap(
  cap: Dir8,
  els: SceneBillboardEls = ELS,
  acteurs: ActorPose[] = ACTEURS,
): Promise<void> {
  await act(async () => { root!.render(écran(cadrePov(cap), els, acteurs)); });
  await attendreFileVidée();
}

/** La file du cuiseur servie (une rasterisation par tranche) en battant la boucle d'image de CE banc. */
const respirer = (ms: number): Promise<void> => respirerBanc(ms, () => battre?.());

/** Le même patron d'attente que le harnais, la pompe d'images de CE banc branchée dessus (#1442) :
 *  toute attente de ce fichier SORT AU FAIT ACCOMPLI, jamais au bout d'une fenêtre de mur — la file
 *  cadencée sert UNE tâche par tranche d'inactivité, et son débit suit la machine. */
const attendre = (fait: () => boolean): Promise<void> => attendreQue(fait, PLAFOND_ATTENTE_MS, () => battre?.());

/** Attend l'ENTRÉE EN SCÈNE de tous les sujets : depuis #1372 les textures du montage passent par la
 *  file cadencée, donc les quads naissent une tranche d'inactivité après l'autre. PRÉMISSE de tout ce
 *  que ce banc mesure ensuite — affirmée ici, au retour. */
async function attendreMontage(attendus: number): Promise<void> {
  await attendre(() => quads().length >= attendus);
  expect(quads().length, `PRÉMISSE : les ${attendus} sujets doivent être en scène — sans eux, rien de ce que ce banc affirme ensuite n'est mesuré`)
    .toBeGreaterThanOrEqual(attendus);
}

const mapDe = (m: THREE.Mesh) => (m.material as THREE.MeshBasicMaterial).map;

/** L'art PORTÉ par les quads en scène, dans l'ordre — la grandeur que toute relève de ce banc compare. */
const artDes = (): (THREE.Texture | null)[] => quads().map(mapDe);

/** Combien de quads ont changé d'art depuis `artAvant`. */
const relevés = (artAvant: (THREE.Texture | null)[]): number =>
  quads().filter((m, k) => mapDe(m) !== artAvant[k]).length;

/** Attend la relève de TOUS les quads depuis `artAvant`, et rend le compte relevé — SOURCE UNIQUE de
 *  l'attente de relève de ce banc (#1442). Le fait attendu est la relève elle-même ; c'est à
 *  l'appelant d'affirmer ce qu'il en attend. */
async function attendreRelève(artAvant: (THREE.Texture | null)[]): Promise<number> {
  await attendre(() => relevés(artAvant) >= artAvant.length);
  return relevés(artAvant);
}

/** Attend que la file cadencée du cuiseur soit VIDE — le fait de QUIESCENCE de ce banc : tout ce qu'un
 *  franchissement a mis en file a été servi, donc tout ce qui devait se reposer s'est reposé. */
async function attendreFileVidée(): Promise<void> {
  await attendre(() => bakeQueueLength() === 0);
  expect(bakeQueueLength(), 'PRÉMISSE : la file du cuiseur doit être servie — ce qu’elle porte encore n’est pas mesuré').toBe(0);
}

/** Images battues APRÈS LE FAIT avant de figer une assertion NÉGATIVE (#1442, patron
 *  `gabarits-en-file`) : une sortie d'attente est au PLUS TÔT, et une libération qui arriverait dans
 *  l'image suivante resterait hors du jugement. Chaque image est un FAIT affirmé, jamais une durée. */
const IMAGES_APRES_LE_FAIT = 3;
async function battreAprèsLeFait(): Promise<void> {
  const fenêtre = scènes.length + IMAGES_APRES_LE_FAIT;
  await attendre(() => scènes.length >= fenêtre);
  expect(scènes.length, `PRÉMISSE : la pompe d'images du banc doit battre après le fait — ${scènes.length} image(s) pour ${fenêtre} attendues`)
    .toBeGreaterThanOrEqual(fenêtre);
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  // CADENCE STRICTE (une tâche par tranche) : ce banc lit l'ORDRE DE SERVICE de la file, et ses
  // rasterisations sont des modèles à coût NUL — sous le budget de temps d'une tranche, elles se
  // serviraient toutes dans la première et il n'y aurait plus ni pré-chauffe en attente ni rang à lire.
  setBudgetTrancheMs(0);
  simulerRasterisation();
});
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
  svgTexture.setStaticTextureBudgetBytes(svgTexture.TEXTURE_STATIQUE_BUDGET_BYTES_DEFAUT);
});

describe('Cran franchi — les quads SURVIVENT', () => {
  it('ni matériau ni géométrie libérés, et pas un seul quad remplacé', async () => {
    await monter();
    const avant = quads();
    // PRÉMISSE — sans quads montés, « rien n'est libéré » serait vrai du vide.
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    // FRANCHISSEMENT : le lacet passe le quart (`artRot` : 100° ⇒ cran 1).
    await act(async () => { root!.render(vue(100)); });
    // La repose se joue au rendu ET à l'arrivée des textures du cran neuf : on attend que la file les
    // ait TOUTES servies — un franchissement mesuré à file encore chargée laisserait la libération
    // hors du jugement.
    await attendreFileVidée();
    await battreAprèsLeFait();

    expect(disposeMat, 'le groupe entier se libère au quart de tour : c’est LE gel signalé').not.toHaveBeenCalled();
    expect(disposeGeo, 'une géométrie de quad refaite au quart de tour, c’est une repose ratée').not.toHaveBeenCalled();
    const après = quads();
    expect(après.length, 'le compte de quads ne change pas d’un cran à l’autre').toBe(avant.length);
    expect(après.filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
  });

  it('un tour COMPLET (quatre quarts) ne libère toujours rien', async () => {
    await monter();
    const avant = quads();
    expect(avant.length).toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    for (const yaw of [100, 190, 280, 370]) {
      await act(async () => { root!.render(vue(yaw)); });
      await attendreFileVidée();
      await battreAprèsLeFait();
    }
    expect(disposeMat).not.toHaveBeenCalled();
    expect(quads().filter((m) => avant.includes(m)).length).toBe(avant.length);
  });
});

describe('Cran franchi — aucune rasterisation en rafale', () => {
  it('cache FROID : rien ne rasterise dans l’image du franchissement, tout part en FILE', async () => {
    await monter();
    const quadsAvant = quads();
    expect(quadsAvant.length).toBeGreaterThan(0);
    const artAvant = quadsAvant.map(mapDe);
    // Cache VIDÉ : le cran d'arrivée n'a plus une seule texture servie — le cas du premier passage,
    // sans le secours de la pré-chauffe.
    svgTexture.clearBillboardTextures();
    resetBakeQueue();
    // La sonde se pose sur `svgToTexture`, la couture que l'écran APPELLE : `rasterizeSvg` lui est
    // interne, donc hors de portée d'un espion de module (le dépôt le documente déjà —
    // `flipbook-frames.test.tsx`, « sa texture statique ne passe pas par ici »). Un espion posé là ne
    // verrait jamais rien, et l'assertion serait vide.
    const statique = vi.spyOn(svgTexture, 'svgToTexture');

    // Rendu SYNCHRONE : aucune tranche d'inactivité ne peut s'intercaler entre le franchissement et la
    // mesure — ce que la file a différé y est encore différé, et ce qu'elle n'aurait pas différé s'y
    // serait déjà exécuté.
    act(() => { root!.render(vue(100)); });

    expect(statique, 'une rafale de rasterisations dans l’image, c’est ~10 ms de mur chacune').not.toHaveBeenCalled();
    expect(bakeQueueLength(), 'les cuissons du cran neuf doivent être EN FILE, pas exécutées').toBeGreaterThan(0);
    // …et l'art du cran PRÉCÉDENT reste à l'écran tant que la relève n'est pas venue : rien ne clignote.
    expect(quads().map(mapDe).every((t, i) => t === artAvant[i]), 'le quad a perdu son art avant la relève').toBe(true);
    // PRÉMISSE — la sonde MORD : ces mêmes textures rasterisent bien PAR ELLE, une fois la file servie.
    // Le premier appel est un FAIT : on l'attend, on ne parie pas sur 120 ms de mur.
    await attendre(() => statique.mock.calls.length > 0);
    expect(statique.mock.calls.length, 'espion branché à côté : « zéro appel » ne dirait rien').toBeGreaterThan(0);
  });

  it('la file SERT ensuite : les textures du cran neuf arrivent, et l’art change', async () => {
    await monter();
    const artAvant = artDes();
    svgTexture.clearBillboardTextures();
    resetBakeQueue();
    await act(async () => { root!.render(vue(100)); });
    // La file sert une rasterisation par tranche : on attend la PREMIÈRE relève, le fait que ce banc
    // affirme — jamais une fenêtre de mur, dont la longueur ne dirait que la vitesse de la machine.
    await attendre(() => relevés(artAvant) > 0);
    expect(relevés(artAvant), 'aucune relève : le décor resterait peint au cran précédent').toBeGreaterThan(0);
  });
});

/**
 * L'ORDRE DE SERVICE de la file, sur une carte à la densité d'une vraie scène (20 décors, et les
 * textures des trois autres crans en attente au moment du franchissement — 38 clés mesurées).
 *
 * Ce que ce contrat tient : la relève de ce que la caméra REGARDE passe DEVANT le réchauffage déjà
 * posé. La panne en face est silencieuse et coûteuse — la mémoïsation rend la promesse déjà en file
 * sans relever son rang, et le décor reste peint au cran quitté le temps que toute la pré-chauffe
 * défile (mesuré avant le lot : 56 rasterisations pour 20 utiles ; ~2 s sur une carte à 68 entités).
 */
describe('Cran franchi — la relève passe devant la pré-chauffe', () => {
  const DENSE: SceneBillboardEls = {
    tokens: [],
    props: Array.from({ length: 20 }, (_, i) => décor(`d${i}`, 2 + (i % 10))),
  };

  it('20 décors : pas une tâche de pré-chauffe servie AVANT la fin de la relève', async () => {
    // ORDRE DE SERVICE, jamais un TOTAL SERVI : la clé s'inscrit à la RÉSOLUTION de sa promesse,
    // c'est-à-dire quand le cuiseur a servi sa tâche. Un total servi, lui, est PROPORTIONNEL à la
    // durée d'observation — la pré-chauffe étant servie tranche après tranche tant qu'on regarde, il
    // mesurerait la fenêtre d'attente, donc la vitesse de la machine.
    const ordre: string[] = [];
    // La marque se pose sur la PROMESSE, jamais sur la clé : une clé redemandée rend la promesse
    // mémoïsée, et une seule inscription lui revient.
    const vues = new WeakSet<Promise<THREE.Texture>>();
    const originalTexture = svgTexture.getBillboardTexture;
    vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé, faire) => {
      const p = originalTexture(clé, faire);
      if (!vues.has(p)) { vues.add(p); void p.then(() => ordre.push(clé)); }
      return p;
    });
    // CUISEUR SERVI À LA MAIN : les tranches d'inactivité ne partent plus d'elles-mêmes, ce banc les
    // sert UNE PAR UNE. Ce que la pré-chauffe a eu le temps de servir avant le franchissement décide
    // de ce qu'il reste à ordonner — laissé à l'horloge, il dépend de la machine (mesuré ici : les 18
    // clés du cran d'arrivée déjà servies, et plus rien à mesurer). Chaque tour de ces boucles est un
    // FAIT servi, jamais une fenêtre de mur.
    const tranches: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { tranches.push(cb); });
    const servirUneTranche = async (): Promise<void> => {
      const t = tranches.shift();
      if (t) await act(async () => { t(); });
      else await act(async () => { await Promise.resolve(); });
    };
    const servirJusquA = async (fait: () => boolean): Promise<void> => {
      for (let i = 0; i < 400 && !fait(); i++) await servirUneTranche();
    };

    viderCaptures();
    hôte = document.createElement('div');
    document.body.appendChild(hôte);
    root = createRoot(hôte);
    await act(async () => { root!.render(vue(0, DENSE, SANS_ACTEUR)); });
    await servirJusquA(() => quads().length >= DENSE.props.length);
    const avantQuads = quads();
    expect(avantQuads.length, 'aucun décor monté : rien à mesurer').toBe(DENSE.props.length);
    const artAvant = avantQuads.map(mapDe);

    // Les décors sont les seuls sujets dont l'identité de cache porte le cran (`|r<n>`), et le cran
    // d'arrivée est le 1 (`artRot` : 100° ⇒ cran 1) : tout le reste est de la pré-chauffe.
    const estRelève = (k: string) => k.startsWith('prop:') && k.includes('|r1|');
    // PRÉMISSE — LA PANNE EST EN PLACE : les textures du cran d'arrivée sont DÉJÀ EN FILE, au rang du
    // réchauffage, derrière la pré-chauffe des autres crans. C'est la situation exacte que la relève
    // de rang doit défaire ; sans elle, ce banc mesurerait une file neuve, qui n'a rien à doubler.
    // Le compte de CLÉS est inférieur au compte de décors : deux tonneaux au même palier de cuisson
    // partagent une identité de cache, donc une seule texture (`cleStatique`).
    const avantFranchissement = poigneesEnAttente();
    const clésRelève = [...avantFranchissement.keys()].filter(estRelève);
    expect(clésRelève.length, 'PRÉMISSE : les textures du cran d’arrivée doivent être EN FILE au franchissement')
      .toBeGreaterThan(0);
    expect(clésRelève.map((k) => avantFranchissement.get(k)), 'PRÉMISSE : elles doivent y être au rang du RÉCHAUFFAGE — c’est ce rang que la relève doit remonter')
      .toEqual(clésRelève.map(() => PRIORITE_RECHAUFFAGE));
    expect([...avantFranchissement.keys()].filter((k) => !estRelève(k)).length, 'PRÉMISSE : la pré-chauffe des autres crans doit être en file — sans elle, rien à doubler')
      .toBeGreaterThan(0);
    const départ = ordre.length;

    await act(async () => { root!.render(vue(100, DENSE, SANS_ACTEUR)); });
    await servirJusquA(() => relevés(artAvant) >= artAvant.length);
    expect(relevés(artAvant), 'tous les décors doivent finir relevés').toBe(artAvant.length);

    const servi = ordre.slice(départ);
    const dernièreRelève = servi.map(estRelève).lastIndexOf(true);
    // PRÉMISSE — les relèves ont bien été SERVIES après le franchissement : sans elles, « rien ne les
    // a doublées » serait vrai du vide.
    expect(servi.filter(estRelève).length, 'toutes les textures du cran d’arrivée doivent avoir été servies')
      .toBe(clésRelève.length);
    // MESURE BORNÉE AU FAIT : ce que le cuiseur sert APRÈS la dernière relève sort du compte. La
    // fenêtre d'observation peut donc s'allonger autant que la machine l'exige sans bouger d'un
    // cran ce que ce banc affirme — sans la relève de rang, les clés de pré-chauffe défilent DEVANT.
    const devant = servi.slice(0, dernièreRelève).filter((k) => !estRelève(k));
    expect(devant.length, `${devant.length} tâche(s) de pré-chauffe servies avant la fin de la relève : ${devant.slice(0, 3).join(', ')}…`)
      .toBe(0);
  });
});

describe('Cran franchi — l’art est celui du NOUVEAU cran', () => {
  it('DÉCOR : la texture posée est celle demandée pour le cran d’arrivée', async () => {
    // Les textures demandées, et celles qui ont FINI de cuire — la seconde carte est alimentée à la
    // résolution, pour que le fait attendu se lise SYNCHRONEMENT (une attente ne peut pas dépendre
    // d'un `await` caché dans sa propre condition).
    const servies = new Map<string, Promise<THREE.Texture>>();
    const cuites = new Map<string, THREE.Texture>();
    const original = svgTexture.getBillboardTexture;
    vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé, faire) => {
      const p = original(clé, faire);
      servies.set(clé, p);
      void p.then((t) => cuites.set(clé, t));
      return p;
    });
    await monter();
    expect(quads().length).toBeGreaterThan(0);

    await act(async () => { root!.render(vue(100)); });

    // Les décors sont les seuls sujets dont l'identité de cache porte le cran (`|r<n>`).
    const clésCran1 = () => [...servies.keys()].filter((k) => k.startsWith('prop:') && k.includes('|r1|'));
    const toutesPosées = (): boolean => {
      const clés = clésCran1();
      if (clés.length < ELS.props.length) return false;
      const posées = new Set(quads().map(mapDe));
      return clés.every((k) => cuites.has(k) && posées.has(cuites.get(k)!));
    };
    // La file sert une rasterisation par tranche : le fait attendu est la POSE des trois textures du
    // cran 1 sur leurs quads, jamais une fenêtre de mur.
    await attendre(toutesPosées);
    expect(clésCran1().length, 'aucune texture demandée au cran 1 : le décor est resté au cran 0').toBe(ELS.props.length);
    expect(toutesPosées(), 'une texture du cran 1 cuite mais jamais posée sur son quad').toBe(true);
  });

  it('CORPS À FLIPBOOK : la planche jouée est celle de la vue du cran d’arrivée', async () => {
    // Planches SERVIES SANS RASTERISATION (une cellule coûte ~10 ms de mur) : la GRILLE reste réelle.
    vi.spyOn(atlasBake, 'bakeAtlas').mockImplementation(async (_draw, _box, n) => {
      const layout = atlasLayout(24, 30, n);
      return { texture: new THREE.CanvasTexture(document.createElement('canvas')), layout, bytes: layout.texW * layout.texH * 4 };
    });
    const clés: string[] = [];
    const original = atlasBake.getCachedAtlas;
    vi.spyOn(atlasBake, 'getCachedAtlas').mockImplementation((k: string) => { clés.push(k); return original(k); });

    await monter();
    const vueDe = (rot: Rot) => billboardView({ kind: 'ortho', yawDeg: rot * 90 }, 'S');
    const marque = (rot: Rot) => `|${vueDe(rot).view}|${vueDe(rot).mirror ? 'm' : 'd'}|`;
    // Le corps joue la planche de SON cran de montage : c'est ce fait qu'on attend avant de repartir,
    // jamais 120 ms de mur.
    await attendre(() => (clés[clés.length - 1] ?? '').includes(marque(0)));
    // PRÉMISSE — sans elle, la mesure d'arrivée ne dirait rien : les deux crans doivent DIFFÉRER de vue.
    expect(marque(0), 'crans indiscernables : cette garde ne mordrait pas').not.toBe(marque(1));
    expect(clés.length, 'aucune planche réclamée : le corps ne joue pas').toBeGreaterThan(0);
    expect(clés[clés.length - 1], 'PRÉMISSE : le corps doit jouer la vue de son cran de montage').toContain(marque(0));

    clés.length = 0;
    await act(async () => { root!.render(vue(100)); });
    // La planche du cran d'arrivée est réchauffée au montage, mais la file la sert à SON tour — on bat
    // la boucle d'image jusqu'à ce que le corps la JOUE : un fait, jamais une durée.
    await attendre(() => (clés[clés.length - 1] ?? '').includes(marque(1)));
    expect(clés.length, 'aucune planche réclamée : le corps ne joue plus').toBeGreaterThan(0);
    expect(clés[clés.length - 1], 'le corps joue encore la planche du cran quitté').toContain(marque(1));
  });
});

/**
 * LE SOL AUSSI EST REPOSÉ (#1376). Les accents de sol (touffes/mouchetis instanciés) sont montés sur
 * le SEMIS ; le franchissement d'un cran ne leur passe qu'une référence de `KeepEl` neuve, pour un
 * verdict identique. Les remonter là libérait leurs matériaux et géométries — un `deleteProgram` +
 * `linkProgram` et ~300 Ko de sommets ré-uploadés par quart de tour, mesurés au profil.
 */
describe('Cran franchi — les ACCENTS DE SOL survivent', () => {
  /** Les `InstancedMesh` du groupe accents : leur nom est la clé de lot (`type|couleur`). */
  function lotsAccents(): THREE.InstancedMesh[] {
    const out: THREE.InstancedMesh[] = [];
    scènes[scènes.length - 1]?.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (m.isInstancedMesh && /^(tuft|speckle)\|/.test(m.name)) out.push(m);
    });
    return out;
  }

  it('ni matériau ni géométrie libérés, mêmes meshes, mêmes comptes d’instances', async () => {
    await monter();
    const avant = lotsAccents();
    // PRÉMISSE — sans semis monté, « rien n'est libéré » serait vrai du vide.
    expect(avant.length, 'aucun lot d’accents monté : rien à mesurer').toBeGreaterThan(0);
    const comptes = avant.map((m) => m.count);
    expect(comptes.reduce((a, b) => a + b, 0), 'un semis vide ne prouverait rien').toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    // FRANCHISSEMENT tel que l'écran le sert : le dégagement est reforgé au cran (`keepEl` dépend des
    // `dims`, qui portent le lacet) — même verdict, référence NEUVE.
    await act(async () => { root!.render(vue(100, ELS, ACTEURS, anim, () => true)); });
    // Même fait qu'au banc des quads : la file du cran neuf servie jusqu'au bout — c'est pendant ce
    // service qu'un semis refait libérerait ses matériaux.
    await attendreFileVidée();
    await battreAprèsLeFait();

    expect(disposeMat, 'le semis se libère au quart de tour : c’est le relink de shader mesuré').not.toHaveBeenCalled();
    expect(disposeGeo).not.toHaveBeenCalled();
    const après = lotsAccents();
    expect(après.map((m) => m.name)).toEqual(avant.map((m) => m.name));
    expect(après.filter((m) => avant.includes(m)).length, 'les lots doivent être les MÊMES objets').toBe(avant.length);
    expect(après.map((m) => m.count)).toEqual(comptes);
  });
});

/**
 * COALESCENCE DES RELÈVES (#1376) : un board relevé demande UNE IMAGE (`demanderUneImage`), il ne
 * peint pas. Vingt boards relevés dans la même image en obtiennent une seule — là où un rendu complet
 * par board coûtait 63 rendus par franchissement en exploration (331 ms mesurés).
 */
describe('Cran franchi — N relèves, UNE image', () => {
  const DENSE: SceneBillboardEls = {
    tokens: [],
    props: Array.from({ length: 20 }, (_, i) => décor(`c${i}`, 2 + (i % 10))),
  };
  /** Câblage de PRODUCTION (`VolumetricWorld`) : aucun pilote d'images — l'écran s'abonne lui-même au
   *  battement du module, et c'est ce battement que les relèves demandent. */
  const animProd: StageWalkAnim = {
    glide: () => null,
    cam: () => ({ x: 6, y: 6 }),
  };
  /** Une image du navigateur, servie pour de bon (jsdom cadence son rAF). */
  const uneImage = async (): Promise<void> => {
    await act(async () => { await new Promise<void>((r) => requestAnimationFrame(() => r())); });
  };

  it('vingt boards relevés au cran d’arrivée ne peignent pas vingt frames', async () => {
    await monter(DENSE, SANS_ACTEUR, animProd);
    // Les vingt décors PEINTS — montés ET porteurs de leur art : c'est ce fait qui rend le cran 0
    // comparable, pas 120 ms de mur.
    await attendre(() => quads().length >= DENSE.props.length && artDes().every(Boolean));
    expect(quads().length, 'aucun décor monté : rien à mesurer').toBe(DENSE.props.length);
    const artCran0 = artDes();
    expect(artCran0.every(Boolean), 'un décor sans art : le cran 0 n’est pas servi').toBe(true);

    // Aller au cran 1 et l'attendre COMPLET : les textures des deux crans sont alors en cache, donc
    // les vingt relèves du RETOUR tombent dans la même image — c'est la rafale qu'on mesure.
    await act(async () => { root!.render(vue(100, DENSE, SANS_ACTEUR, animProd)); });
    expect(await attendreRelève(artCran0), 'le cran 1 n’est pas servi en entier : le retour ne serait pas en cache')
      .toBe(DENSE.props.length);

    const avant = scènes.length;
    await act(async () => { root!.render(vue(10, DENSE, SANS_ACTEUR, animProd)); });
    await uneImage();
    const rendus = scènes.length - avant;

    // PRÉMISSE — sans relève effective, « peu de rendus » ne dirait rien.
    expect(quads().map(mapDe), 'les vingt décors doivent être revenus au cran 0').toEqual(artCran0);
    expect(rendus, `${rendus} rendus pour ${DENSE.props.length} relèves`).toBeLessThan(DENSE.props.length);
  });
});

/** La SIGNATURE d'art d'un décor (`facing:'S'`) vu depuis un cap — le fragment `|r<cran>|<vue>|<face>|`
 *  que porte sa clé de texture. C'est par elle que le banc reconnaît, dans une clé ou une poignée, le
 *  regard qui l'a demandée. */
const signatureDuCap = (cap: Dir8): string => {
  const vm = billboardView(bbCameraDe({ rot: povArtRot(cap), facing: cap }), 'S');
  return `|r${povArtRot(cap)}|${vm.view}|${vm.mirror ? 'm' : 'd'}|`;
};

/** Décors seuls : chaque quad se compare alors à SON art d'avant, sans le corps à flipbook que la
 *  boucle d'image repeint par ailleurs. */
const DÉCORS = { tokens: [], props: ELS.props } satisfies SceneBillboardEls;

/**
 * PREMIÈRE PERSONNE (#1373) — le REGARD, pas le cran. L'art d'un quad se prend au CAP Dir8 du meneur ;
 * huit caps pour quatre crans d'art (`povArtRot` planchérise), donc deux caps voisins peuvent partager
 * leur cran tout en montrant deux vues différentes (NE : front, E : profil).
 *
 * Mêmes faits qu'au plateau, sur l'autre vue : les quads SURVIVENT au changement de cap, et leur art
 * est relevé à celui du cap d'arrivée — y compris quand le cran, lui, n'a pas bougé.
 */
describe('Cap changé (première personne) — les quads SURVIVENT', () => {
  it('ni matériau ni géométrie libérés, et pas un seul quad remplacé sur N→NE→E', async () => {
    await monterPov('N');
    const avant = quads();
    // PRÉMISSE — sans quads montés, « rien n'est libéré » serait vrai du vide.
    expect(avant.length, 'aucun board monté : rien à mesurer').toBeGreaterThan(0);
    const disposeMat = vi.spyOn(THREE.Material.prototype, 'dispose');
    const disposeGeo = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');

    await allerAuCap('NE');
    await allerAuCap('E');

    expect(disposeMat, 'le groupe entier se libère au changement de cap : c’est la panne du plateau, autre vue').not.toHaveBeenCalled();
    expect(disposeGeo, 'une géométrie de quad refaite au cap, c’est une repose ratée').not.toHaveBeenCalled();
    const après = quads();
    expect(après.length, 'le compte de quads ne change pas d’un cap à l’autre').toBe(avant.length);
    expect(après.filter((m) => avant.includes(m)).length, 'les quads doivent être les MÊMES objets').toBe(avant.length);
  });
});

describe('Cap changé — l’art est celui du NOUVEAU cap', () => {
  it('N→NE : chaque décor est relevé à l’art de son cap d’arrivée', async () => {
    await monterPov('N', DÉCORS, SANS_ACTEUR);
    const artN = quads().map(mapDe);
    expect(artN.length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);
    expect(artN.every(Boolean), 'un décor sans art : le cap N n’est pas servi').toBe(true);

    await act(async () => { root!.render(écran(cadrePov('NE'), DÉCORS, SANS_ACTEUR)); });

    expect(await attendreRelève(artN), 'tous les décors doivent finir relevés').toBe(artN.length);
  });

  it('NE→E : deux caps du MÊME cran d’art relèvent quand même (le cas piège)', async () => {
    // Les deux caps tombent sur le cran 1 (`povArtRot`), et montrent pourtant deux vues du décor —
    // une garde qui ne comparerait que le cran ne reposerait rien ici, et le décor resterait de face.
    expect(povArtRot('NE'), 'PRÉMISSE : les deux caps doivent partager leur cran').toBe(povArtRot('E'));
    const vueNE = billboardView({ kind: 'perspective', ...dir8Basis('NE') }, 'S');
    const vueE = billboardView({ kind: 'perspective', ...dir8Basis('E') }, 'S');
    expect(vueNE, 'PRÉMISSE : cette paire de caps doit CHANGER l’art').not.toEqual(vueE);

    await monterPov('NE', DÉCORS, SANS_ACTEUR);
    const artNE = quads().map(mapDe);
    expect(artNE.length).toBe(DÉCORS.props.length);
    expect(artNE.every(Boolean)).toBe(true);

    await act(async () => { root!.render(écran(cadrePov('E'), DÉCORS, SANS_ACTEUR)); });

    expect(await attendreRelève(artNE), 'aucune relève : le décor est resté peint au cap quitté').toBe(artNE.length);
  });

  it('une texture arrivée APRÈS le changement de cap se pose au cap COURANT', async () => {
    const servies = new Map<string, Promise<THREE.Texture>>();
    const original = svgTexture.getBillboardTexture;
    vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé, faire) => {
      const p = original(clé, faire);
      servies.set(clé, p);
      return p;
    });
    await monterPov('N', DÉCORS, SANS_ACTEUR);
    expect(quads().length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);

    // RASTERISATION RETENUE : la texture d'un billboard n'arrive qu'au chargement de son image, et
    // c'est cet instant que ce contrat déplace de l'autre côté du changement de cap. Sans cette
    // retenue, le montage est servi avant le cap et la mesure ne porterait plus sur le vol.
    const enAttente: (() => void)[] = [];
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { enAttente.push(() => this.onload?.()); }
    });
    /** Sert les images retenues jusqu'à ce que plus rien n'attende — ni image en vol, ni tâche en
     *  file. Chaque tour SORT AU FAIT (une image de plus à servir, ou la file vidée), jamais au bout
     *  d'une fenêtre de 20 ms : servir la suivante trop tôt laisserait la précédente hors de la pose. */
    const servirLesImages = async (): Promise<void> => {
      for (let i = 0; i < 8 && (enAttente.length > 0 || bakeQueueLength() > 0); i++) {
        const paquet = enAttente.splice(0);
        await act(async () => { for (const f of paquet) f(); });
        await attendre(() => enAttente.length > 0 || bakeQueueLength() === 0);
      }
    };

    // SUJETS NEUFS : le groupe se remonte (le seul chemin qui remonte encore), au cap N…
    const NEUFS: SceneBillboardEls = { tokens: [], props: [décor('n1', 5), décor('n2', 6), décor('n3', 7)] };
    await act(async () => { root!.render(écran(cadrePov('N'), NEUFS, SANS_ACTEUR)); });
    // Les rasterisations du montage passent par la file cadencée (#1372) : on attend qu'une image soit
    // EN VOL — le fait mesuré juste après — avant de changer de cap.
    await attendre(() => enAttente.length > 0);
    // PRÉMISSE — aucun quad neuf ne doit être monté quand le cap change, sinon la REPOSE ordinaire
    // suffirait et le chemin « en vol » ne serait jamais emprunté.
    expect(enAttente.length, 'les textures du montage doivent être RETENUES').toBeGreaterThan(0);
    // …et le cap change AVANT que les textures de ce montage ne soient servies : les quads entrent en
    // scène de l'autre côté du changement.
    await act(async () => { root!.render(écran(cadrePov('NE'), NEUFS, SANS_ACTEUR)); });
    await servirLesImages();

    const texturesDe = async (cap: Dir8): Promise<Set<THREE.Texture>> => new Set(
      await Promise.all([...servies.entries()].filter(([k]) => k.startsWith('prop:prop:n') && k.includes(signatureDuCap(cap))).map(([, p]) => p)),
    );
    const auCapNE = await texturesDe('NE');
    const auCapN = await texturesDe('N');
    // PRÉMISSE — les deux caps doivent avoir des textures distinctes, sinon la garde ne dirait rien.
    expect(auCapNE.size, 'aucune texture demandée au cap NE pour les décors neufs').toBe(NEUFS.props.length);
    expect([...auCapNE].some((t) => auCapN.has(t)), 'PRÉMISSE : les deux caps partagent une texture').toBe(false);

    const posées = quads().map(mapDe);
    expect(posées.length, 'les décors neufs doivent être montés').toBe(NEUFS.props.length);
    expect(posées.every((t) => t !== null && auCapNE.has(t)), 'un quad monté en vol est resté peint au cap quitté').toBe(true);
  });
});

/**
 * PRÉ-CHAUFFE des caps VOISINS (#1373) : en première personne, le temps mort réchauffe les deux caps à
 * ±45° du cap courant — un demi-tour progressif passe par eux. Ce que ce contrat tient : au cap voisin,
 * la relève ne coûte AUCUNE rasterisation (~10 ms de mur chacune), elle vient du cache.
 */
describe('Cap voisin — servi par le cache, pas par une rafale', () => {
  it('un demi-tour progressif reste CHAUD : chaque cap franchi réchauffe les siens', async () => {
    const statique = vi.spyOn(svgTexture, 'svgToTexture');
    /** Laisse la file s'épuiser, et rend le compte de rasterisations servies. Le fait de fin est la
     *  file VIDE — un compte STABLE d'une fenêtre de mur à l'autre est la même prémisse de vitesse. */
    const drainer = async (): Promise<number> => {
      await attendreFileVidée();
      return statique.mock.calls.length;
    };
    const parDécor = DÉCORS.props.length;

    await monterPov('N', DÉCORS, SANS_ACTEUR);
    // MONTAGE + PRÉ-CHAUFFE : un regard servi (N), deux réchauffés (NE, NO) — trois par décor.
    expect(await drainer(), 'la pré-chauffe des deux caps voisins n’a pas eu lieu au montage').toBe(3 * parDécor);
    const artN = artDes();
    expect(artN.length, 'aucun décor monté : rien à mesurer').toBe(parDécor);

    // CAP N→NE : la relève est servie par le cache (le cap NE était réchauffé), et le franchissement
    // réchauffe à son tour les voisins de NE — E est neuf, N vient d'être quitté.
    await act(async () => { root!.render(écran(cadrePov('NE'), DÉCORS, SANS_ACTEUR)); });
    expect(await attendreRelève(artN), 'tous les décors doivent finir relevés au cap NE').toBe(parDécor);
    expect(await drainer(), 'le cap E, voisin du cap d’arrivée, n’a pas été réchauffé').toBe(4 * parDécor);
    const artNE = artDes();

    // CAP NE→E : le cap suivant est donc CHAUD lui aussi — sa relève ne rasterise rien, et c'est SE
    // qui part au réchauffage derrière elle.
    await act(async () => { root!.render(écran(cadrePov('E'), DÉCORS, SANS_ACTEUR)); });
    expect(await attendreRelève(artNE), 'tous les décors doivent finir relevés au cap E').toBe(parDécor);
    expect(await drainer(), 'le cap SE, voisin du cap E, n’a pas été réchauffé').toBe(5 * parDécor);
  });
});

/**
 * RANGS DE LA FILE au changement de regard (#1373). La file du cuiseur sert par PRIORITÉ, et une clé
 * n'y garde son rang que tant qu'elle ATTEND : ce banc lit la carte des poignées (`poigneesEnAttente`)
 * juste après le rendu, avant qu'aucune tranche d'inactivité n'ait servi quoi que ce soit.
 */
describe('Changement de regard — ce que la caméra attend passe DEVANT', () => {
  /** Les rangs des poignées portant la signature d'un cap. */
  const rangsDuCap = (cap: Dir8): number[] =>
    [...poigneesEnAttente()].filter(([clé]) => clé.includes(signatureDuCap(cap))).map(([, rang]) => rang);

  it('le regard QUITTÉ redescend au réchauffage, le regard courant tient le rang de la vue', async () => {
    await monterPov('N', DÉCORS, SANS_ACTEUR);
    // CACHE FROID : sans cela, les caps déjà réchauffés seraient servis sans jamais entrer en file, et
    // il n'y aurait aucun rang à mesurer.
    svgTexture.clearBillboardTextures();
    resetBakeQueue();

    // Rendus SYNCHRONES : aucune tranche d'inactivité ne peut s'intercaler entre les deux changements
    // de cap, donc ce que la file a pris est encore EN ATTENTE quand le banc lit les rangs.
    // N→NE : la relève du cap NE part au rang de la VUE COURANTE (et ses voisins au réchauffage).
    act(() => { root!.render(écran(cadrePov('NE'), DÉCORS, SANS_ACTEUR)); });
    expect(rangsDuCap('NE'), 'la relève du cap d’arrivée doit être en file au rang de la vue')
      .toEqual(Array(DÉCORS.props.length).fill(PRIORITE_VUE_COURANTE));

    // NE→E AVANT que la file n'ait servi : le cap NE n'est plus attendu, il doit lâcher son rang —
    // sinon ses trois textures passent devant celles du cap qu'on regarde.
    act(() => { root!.render(écran(cadrePov('E'), DÉCORS, SANS_ACTEUR)); });

    expect(rangsDuCap('E'), 'le cap regardé doit tenir le rang de la vue courante')
      .toEqual(Array(DÉCORS.props.length).fill(PRIORITE_VUE_COURANTE));
    expect(rangsDuCap('NE'), 'le cap QUITTÉ garde son rang : il fera patienter le cap regardé')
      .toEqual(Array(DÉCORS.props.length).fill(PRIORITE_RECHAUFFAGE));
  });

  it('une clé SERVIE PAR LE CACHE ne laisse aucune poignée derrière elle', async () => {
    await monterPov('N', DÉCORS, SANS_ACTEUR);
    // La file épuisée, plus rien n'attend : toute poignée restante est un fantôme que chaque
    // `rendreAuRechauffage` reparcourt sans plus rien commander.
    await attendre(() => poigneesEnAttente().size === 0);
    expect(quads().length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);
    expect(poigneesEnAttente().size, 'poignées restées après le service complet de la file').toBe(0);

    // Trois allers-retours entre caps DÉJÀ CUITS : chaque repose redemande des clés que le cache sert
    // sans rien mettre en file.
    for (const cap of ['NE', 'N', 'NE', 'N'] as Dir8[]) {
      const avant = artDes();
      await act(async () => { root!.render(écran(cadrePov(cap), DÉCORS, SANS_ACTEUR)); });
      // Chaque aller-retour s'attend à SA relève : sous une fenêtre de 20 ms, la repose du cap
      // précédent est en vol, et la poignée cherchée naît de cette repose — donc après elle.
      expect(await attendreRelève(avant), `cap ${cap} : tous les décors doivent finir relevés`).toBe(avant.length);
    }
    // FILE VIDÉE avant de compter : une poignée dont la tâche ATTEND encore est légitime — ce que ce
    // banc traque, c'est celle qui reste quand plus rien n'attend.
    await attendreFileVidée();
    expect(poigneesEnAttente().size, 'une demande servie par le cache a posé une poignée fantôme').toBe(0);
  });
});

/**
 * FRAÎCHETÉ DE LA RELÈVE (#1373) : une texture cuite pour un regard qu'on a QUITTÉ entre-temps ne se
 * pose pas. La file est cadencée — un aller-retour rapide (A→B→A) est plus court que la cuisson de B,
 * et sans cette garde le quad se ferait repeindre au regard B alors que la caméra est revenue en A.
 */
describe('Changement de regard — une texture PÉRIMÉE ne se pose pas', () => {
  it('cap N→E→N : la texture du cap E, servie après le retour, est refusée', async () => {
    const servies = new Map<string, Promise<THREE.Texture>>();
    const original = svgTexture.getBillboardTexture;
    vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé, faire) => {
      const p = original(clé, faire);
      servies.set(clé, p);
      return p;
    });
    await monterPov('N', DÉCORS, SANS_ACTEUR);
    const artN = artDes();
    expect(artN.length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);
    expect(artN.every(Boolean), 'un décor sans art : le cap N n’est pas servi').toBe(true);

    // RASTERISATION RETENUE : la cuisson du cap E part, mais son image ne se charge qu'au moment que
    // ce banc choisit — après le retour en N.
    const enAttente: (() => void)[] = [];
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_v: string) { enAttente.push(() => this.onload?.()); }
    });

    // N→E : le cap E est FROID (ce n'est pas un voisin de N) — sa relève passe par la file.
    await act(async () => { root!.render(écran(cadrePov('E'), DÉCORS, SANS_ACTEUR)); });
    await attendre(() => enAttente.length >= DÉCORS.props.length);
    // PRÉMISSE — sans cuisson partie pour E, la garde n'aurait rien à refuser.
    expect(enAttente.length, 'aucune cuisson en vol pour le cap E : rien à périmer').toBeGreaterThanOrEqual(DÉCORS.props.length);

    // …retour en N AVANT que ces images n'arrivent : le cap N est en cache, les quads y reviennent.
    await act(async () => { root!.render(écran(cadrePov('N'), DÉCORS, SANS_ACTEUR)); });
    // Le retour en N est SERVI PAR LE CACHE : le fait attendu est que les quads y soient revenus —
    // c'est cet état, et pas 40 ms de mur, qui met la garde de fraîcheur à l'épreuve.
    await attendre(() => artDes().every((t, k) => t === artN[k]));
    // …et seulement MAINTENANT les textures du cap E finissent de cuire.
    for (let i = 0; i < 8 && (enAttente.length > 0 || bakeQueueLength() > 0); i++) {
      const paquet = enAttente.splice(0);
      await act(async () => { for (const f of paquet) f(); });
      await attendre(() => enAttente.length > 0 || bakeQueueLength() === 0);
    }

    const auCapE = new Set(await Promise.all(
      [...servies.entries()].filter(([k]) => k.includes(signatureDuCap('E'))).map(([, p]) => p),
    ));
    // PRÉMISSE — les textures du cap E ont bien été produites : « aucune n'est posée » ne serait
    // sinon vrai que du vide.
    expect(auCapE.size, 'le cap E n’a rien cuit : la garde ne serait pas mise à l’épreuve').toBe(DÉCORS.props.length);
    const posées = artDes();
    expect(posées, 'les quads doivent être revenus à l’art du cap N').toEqual(artN);
    expect(posées.some((t) => t !== null && auCapE.has(t)), 'une texture du cap quitté s’est posée après coup').toBe(false);
  });
});

/**
 * STOCK BORNÉ des textures statiques (#1374) : le cache a un budget d'OCTETS, et ce qui est POSÉ sur
 * un quad monté y est ÉPINGLÉ. La panne en face est visible à l'écran — une texture évincée alors
 * qu'elle est encore portée par un matériau laisse son décor sans art jusqu'à la recuisson.
 */
describe('Stock borné — ce qui est POSÉ est épinglé', () => {
  /** Les crans lus dans les épingles (`|r<n>|`, fragment que seule l'identité d'un décor porte). */
  const cransÉpinglés = (): string[] =>
    [...svgTexture.staticTexturePins()].map((clé) => /\|r(\d)\|/.exec(clé)?.[1] ?? clé);

  it('les épingles suivent la POSE : le cran monté, puis le cran d’arrivée', async () => {
    await monter(DÉCORS, SANS_ACTEUR);
    expect(quads().length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);
    expect(cransÉpinglés(), 'les textures posées au montage doivent être épinglées au cran 0')
      .toEqual(Array(DÉCORS.props.length).fill('0'));
    const artCran0 = artDes();

    await act(async () => { root!.render(vue(100, DÉCORS, SANS_ACTEUR)); });
    expect(await attendreRelève(artCran0), 'tous les décors doivent finir relevés').toBe(artCran0.length);

    expect(cransÉpinglés(), 'les épingles sont restées au cran quitté : le cran regardé n’est plus protégé')
      .toEqual(Array(DÉCORS.props.length).fill('1'));
  });

  it('les épingles TOMBENT au démontage des quads : plus de quad, plus rien de protégé', async () => {
    await monter(DÉCORS, SANS_ACTEUR);
    expect(svgTexture.staticTexturePins().size, 'les textures posées doivent être épinglées')
      .toBe(DÉCORS.props.length);

    // SCÈNE VIDÉE de ses sujets : les quads se démontent SANS que rien ne se remonte derrière — c'est
    // le seul geste où une épingle oubliée reste seule au stock, et y cloue pour la session les
    // textures d'un écran qui n'existe plus (le vidage de scène, lui, masquerait la fuite).
    const VIDE: SceneBillboardEls = { tokens: [], props: [] };
    await act(async () => { root!.render(vue(0, VIDE, SANS_ACTEUR)); });
    // Le démontage des quads est le FAIT qui doit tomber les épingles : on l'attend, on ne le suppose
    // pas acquis au bout de 40 ms.
    await attendre(() => quads().length === 0);

    expect(quads().length, 'PRÉMISSE : les quads doivent être démontés').toBe(0);
    expect(svgTexture.staticTexturePins().size, 'épingles survivantes après démontage des quads').toBe(0);

    // …et le démontage complet de l'écran ne les ressuscite pas.
    act(() => { root!.unmount(); });
    root = null;
    expect(svgTexture.staticTexturePins().size).toBe(0);
  });

  /** Poids RÉEL d'une texture résolue : son canevas, 4 octets par texel (le stock la pèse ainsi). */
  const octetsDe = (t: THREE.Texture | null): number => {
    const img = t?.image as { width?: number; height?: number } | undefined;
    return (img?.width ?? 0) * (img?.height ?? 0) * 4;
  };

  /** Espionne les libérations de texture (l'appel réel suit). */
  function espionnerLibérations(): Set<THREE.Texture> {
    const libérées = new Set<THREE.Texture>();
    const original = THREE.Texture.prototype.dispose;
    vi.spyOn(THREE.Texture.prototype, 'dispose').mockImplementation(function (this: THREE.Texture) {
      libérées.add(this);
      original.call(this);
    });
    return libérées;
  }

  it('budget SERRÉ : un tour complet ne libère JAMAIS une texture posée sur un quad', async () => {
    await monter(DÉCORS, SANS_ACTEUR);
    const posées0 = artDes();
    expect(posées0.length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);
    // POIDS UNITAIRE mesuré sur une entrée RÉSOLUE (le canevas d'une texture POSÉE) — jamais sur la
    // moyenne du stock, que les entrées en vol tirent vers le bas.
    const unitaire = octetsDe(posées0[0]);
    expect(unitaire, 'une texture sans canevas ne pèserait rien : le budget ne bornerait rien').toBeGreaterThan(0);
    const budget = 2 * DÉCORS.props.length * unitaire;
    svgTexture.setStaticTextureBudgetBytes(budget);

    const libérées = espionnerLibérations();

    for (const yaw of [100, 190, 280, 370]) {
      const avant = artDes();
      await act(async () => { root!.render(vue(yaw, DÉCORS, SANS_ACTEUR)); });
      expect(await attendreRelève(avant), `cran ${yaw}° : tous les décors doivent finir relevés`).toBe(avant.length);
      const posées = artDes();
      expect(posées.every(Boolean), 'un quad sans art : la relève n’a pas eu lieu').toBe(true);
      expect(posées.filter((t) => t && libérées.has(t)).length, `cran ${yaw}° : une texture POSÉE a été libérée`).toBe(0);
    }
    // PRÉMISSE — la pression a bien mordu : le budget serré a libéré des textures (celles des crans
    // quittés, dépinglées à mesure que les quads se reposent).
    expect(libérées.size, 'aucune libération : le budget n’aurait rien borné').toBeGreaterThan(0);
    // FILE ÉPUISÉE avant de peser : une entrée EN VOL n'est jamais évincée (elle n'a rien à libérer),
    // donc le stock ne retombe sous sa borne qu'une fois toutes les cuissons servies. Le fait de fin
    // est la file VIDE — un poids STABLE d'une fenêtre à l'autre est la même prémisse de vitesse.
    await attendreFileVidée();
    // BORNE RÉELLE : le budget, PLUS ce que les épingles retiennent — une épinglée n'est jamais
    // évincée, donc le stock peut légitimement dépasser d'autant (invariant du cache borné).
    const marge = svgTexture.staticTexturePins().size * unitaire;
    expect(svgTexture.staticTextureStats().bytes).toBeLessThanOrEqual(budget + marge);
  });

  /**
   * PLANCHE IMPOSSIBLE (#1374) : à très petit `mpt`, le palier de cuisson atteint son plafond et la
   * CELLULE le dépasse (gouttière comprise) — `bakeAtlas` REJETTE alors sa promesse, et la demande
   * différée l'avale SANS BRUIT (`GameStage3D.tsx:1209`, `.catch(() => undefined)`) : le corps garde
   * la planche qu'il joue, et rien n'est écrit en console. L'ESTIMATION de poids, elle, court
   * SYNCHRONEMENT au site d'appel : si elle levait, l'erreur ne serait plus celle d'une promesse
   * traitée mais une EXCEPTION NON GÉRÉE (mesurée : `atlasLayout: cellule 1642×2052 au-delà du
   * plafond de texture 2048`).
   */
  it('PALIER au plafond : la planche refusée ne fait AUCUNE exception non gérée', async () => {
    const nonGérées: unknown[] = [];
    const surErreur = (e: unknown): void => { nonGérées.push(e); };
    process.on('uncaughtException', surErreur);
    process.on('unhandledRejection', surErreur);
    // console.warn muselé par précaution seulement : le chemin de refus mesuré ici est SILENCIEUX.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      viderCaptures();
      hôte = document.createElement('div');
      document.body.appendChild(hôte);
      root = createRoot(hôte);
      // `mpt` minuscule ⇒ pixels par mètre énormes ⇒ palier plafonné (`atlasPxHeight`), cellule > 2048.
      await act(async () => {
        root!.render(
          <GameStage3D
            scene={SCENE} mpt={0.05} frame={cadre(0)} tintAt={TINT} keepEl={KEEP}
            els={ELS} actors={ACTEURS} gameTime={720} lightLevel={1} lights={[]} anim={anim}
          />,
        );
      });
      // FAIT qui ferme la mesure : la file du cuiseur VIDÉE — tout ce que ce montage a mis en cuisson
      // a couru, donc tout ce qui pouvait lever a levé. Une fenêtre de mur ne dirait, elle, que la
      // vitesse de la machine. Les quelques tranches qui suivent ne sont pas une prémisse de vitesse :
      // un rejet non géré ne remonte au process qu'au tour de boucle d'après.
      await attendreFileVidée();
      await respirer(60);
    } finally {
      process.off('uncaughtException', surErreur);
      process.off('unhandledRejection', surErreur);
      warn.mockRestore();
    }

    expect(nonGérées.map(String), 'l’estimation de poids a levé au site d’appel').toEqual([]);
    // PRÉMISSE — le palier atteint bien le plafond à ce `mpt` : sans cela, la garde ne mordrait pas.
    expect(atlasPxHeight(2.17, pxPerM(0.05), 2), 'palier non plafonné : le cas testé n’existe pas').toBe(2048);
    expect(atlasBytesEstimés({ w: 120, h: 150 }, 8, 2048), 'une planche hors plafond doit peser zéro').toBe(0);
  });

  it('MONTAGE sous pression : aucun quad n’entre en scène sur une texture déjà libérée', async () => {
    // Budget de 1 OCTET dès l'ouverture : tout ce qui n'est pas épinglé saute à la première pression.
    // Le montage épingle ce qu'il ATTEND avant de le demander — sans cela, les textures se font
    // libérer entre leur cuisson et leur pose, et les quads entrent en scène morts.
    svgTexture.setStaticTextureBudgetBytes(1);
    const libérées = espionnerLibérations();

    await monter(DÉCORS, SANS_ACTEUR);
    // Ce qui se fait ÉVINCER sous ce budget, c'est la pré-chauffe (non épinglée) — et elle passe par
    // la MÊME file cadencée que le montage (#1372), une tâche par tranche : on la laisse être servie
    // avant de mesurer, sinon la pression n'a encore rien eu à mordre. Budget BORNÉ.
    await attendre(() => libérées.size > 0);

    const posées = artDes();
    expect(posées.length, 'aucun décor monté : rien à mesurer').toBe(DÉCORS.props.length);
    expect(posées.every(Boolean), 'un quad monté sans art').toBe(true);
    expect(posées.filter((t) => t && libérées.has(t)).length, 'des quads montés portent une texture MORTE').toBe(0);
    // PRÉMISSE — la pression a bien mordu ailleurs (la pré-chauffe des crans voisins, non épinglée).
    expect(libérées.size, 'aucune libération : le budget d’un octet n’aurait rien borné').toBeGreaterThan(0);
  });
});
