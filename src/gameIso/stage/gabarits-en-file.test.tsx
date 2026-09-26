// @vitest-environment jsdom
/**
 * GABARITS DU MONDE CUIT EN FILE (#1399) — les images de FACE (colombage `faceBake`) et de PÉRIODE
 * (`periodTexture`) ne sont plus rasterisées DANS le montage : elles partent par la file cadencée du
 * cuiseur (`atlasBake`, une cuisson par tranche d'inactivité) et se RELÈVENT en place sur des matériaux
 * déjà montés. La panne en face est le premier poste du profil de chargement : 732 ms de blocage
 * synchrone à l'ouverture d'une carte.
 *
 * Huit faits, chacun réfutable seul :
 *  1. à cache FROID, `worldSurfaceMaterials(enFile)` rend ses matériaux SANS `map` — la surface porte sa
 *     seule couleur de sommet, l'aplat de base que le masque multiplie — et annonce ses clés ;
 *  2. la file servie, chaque `map` est posée EN PLACE (mêmes matériaux, aucun remontage) ;
 *  3. le SYNCHRONE reste entier (`enFile` absent) : c'est ce dont vit la planche QC (`planSnapshot`) ;
 *  4. le VOILE d'entrée en scène attend les gabarits FROIDS du monde, et ne tombe qu'une fois servis ;
 *  5. …et il attend AUSSI la population des billboards, même quand les gabarits n'ont rien à faire
 *     attendre : une population NON DÉCLARÉE n'est pas une population sans clés ;
 *  6. la RELÈVE repeint au point de vue COURANT, jamais à celui du montage ;
 *  7. le gabarit s'enfile SOUS la vue courante : un billboard le double, même enfilé après lui ;
 *  8. une cuisson EN VOL ne survit pas au changement de scène : sa tâche ne cuit pas, et la clé
 *     ré-enfilée par la scène neuve cuit pour elle.
 */
import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { sceneMetresPerTile, type Scene } from '../../state/scene';
import { buildVitrineScene } from '../../scenes/vitrine-batiments';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import { bakeWorldGeometry } from '../backends/webgl/sceneMeshes';
import { worldSurfaceMaterials } from '../backends/webgl/worldMaterials';
import { clearFaceBakes, getFaceBake, getFaceBakeEnFile } from '../backends/webgl/faceBake';
import { clearPeriodTextures, getPeriodTexture } from '../backends/webgl/periodTexture';
import { bakeQueueLength, PRIORITE_VUE_COURANTE, queueBakeTask, setBudgetTrancheMs } from '../backends/webgl/atlasBake';
import { AMBIANCE } from '../catalog/ambiance';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, PLAFOND_ATTENTE_MS, PLAFOND_HORS_ATTEINTE_MS, attendreEntréeFinie, attendreQue, brancherArdoise, caméras, respirer as respirerBanc, scènes, simulerRasterisation, viderCaptures, type Rasterisation } from './banc-volumique';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import type { BillboardPropEl } from '../builders/types';
import { entreeEnScene } from '../../state/entreeEnScene';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
/** La VITRINE : la scène du dépôt qui porte de vrais gabarits — colombages et appareillages. */
const SCENE: Scene = buildVitrineScene();
const MPT = sceneMetresPerTile(SCENE);
const GROUPE = { x: Math.floor(SCENE.dimensions.w / 2), y: Math.floor(SCENE.dimensions.h / 2) };

const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
const SANS_ACTEUR: ActorPose[] = [];
/** AUCUN billboard : l'autre population du voile déclare un jeu VIDE, et ce qui tient l'écran voilé ne
 *  peut plus être qu'un gabarit du monde. */
const SANS_BILLBOARD: SceneBillboardEls = { tokens: [], props: [] };

/** Un décor posé à une case — même patron que `entree-en-scene.test.tsx` : de quoi donner à la
 *  population des billboards une clé à faire attendre. */
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

const cadre = (pos: { x: number; y: number } = GROUPE): StageFrame =>
  ({ mode: 'pov', partyPos: pos, facing: 'N', indoor: false, cid: null });

const respirer = (ms: number): Promise<void> => respirerBanc(ms, () => battre?.());

/**
 * PLAFOND de ce banc, déclaré UNE fois (#1442) — jamais une assertion, jamais un budget par test.
 *
 * Ce banc fait tourner la file CADENCÉE du cuiseur sur les 86 gabarits de la vitrine : sa durée suit
 * la machine, pas le code. Mesuré dos à dos sur les mêmes deux fichiers : « cache FROID » 618 ms à
 * vide, 4 093 ms sous 16 brûleurs, 6 373 ms sous 32 — le budget par défaut de Vitest (5 s) est franchi
 * par la SATURATION seule. Les attentes, elles, sortent toutes au fait accompli (`attendreQue`).
 */
vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

/** Ce qu'on laisse passer d'images APRÈS le fait attendu avant de figer ce qu'on juge : une sortie au
 *  fait accompli sort au PLUS TÔT, et un fait fautif tardif se produirait après elle. */
const IMAGES_APRES_LE_FAIT = 3;
const plafondNominal = AMBIANCE.entreeEnScene.plafondMs;

function écran(strict: boolean, pos = GROUPE, els: SceneBillboardEls = SANS_BILLBOARD): JSX.Element {
  const stage = (
    <GameStage3D
      scene={SCENE}
      mpt={MPT}
      frame={cadre(pos)}
      tintAt={TINT}
      keepEl={KEEP}
      els={els}
      actors={SANS_ACTEUR}
      gameTime={720}
      lightLevel={1}
      lights={[]}
      anim={anim}
    />
  );
  return strict ? <StrictMode>{stage}</StrictMode> : stage;
}

function monterSync(strict = false, pos = GROUPE, els: SceneBillboardEls = SANS_BILLBOARD): void {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => { root!.render(écran(strict, pos, els)); });
}

const canevas = (): HTMLCanvasElement => hôte!.querySelector('canvas')!;

/** Les matériaux du MONDE CUIT tels que la dernière image dessinée les porte (le maillage à géométrie
 *  EMPRUNTÉE, celui du monde fusionné) — jamais une liste tenue par le test. */
function matériauxDuMonde(): THREE.Material[] {
  const scène = scènes[scènes.length - 1];
  let out: THREE.Material[] = [];
  scène?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.emprunte && Array.isArray(m.material)) out = m.material as THREE.Material[];
  });
  return out;
}

const avecMap = (mats: readonly THREE.Material[]): number =>
  mats.filter((m) => (m as THREE.MeshBasicMaterial).map != null).length;

/** L'abscisse MONDE du point de vue d'une image dessinée, au centième de mètre. */
const vueX = (c: THREE.Camera): number => +c.position.x.toFixed(2);

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  simulerRasterisation('auto');
});
afterEach(() => {
  // La donnée d'ambiance est un SINGLETON de module que la suite partage (`isolate: false`) : un banc
  // qui la pousse la rend, sinon le fichier voisin monte son écran sous un voile immortel. La rendre
  // EN TÊTE, avant le démontage qui peut lever : une restauration en queue de hook est conditionnelle.
  AMBIANCE.entreeEnScene.plafondMs = plafondNominal;
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
});

describe('#1399 — les gabarits du monde cuit passent par la file', () => {
  it('cache FROID : aucune `map` au retour, une clé par gabarit — puis la file les pose EN PLACE', async () => {
    const { geometry } = bakeWorldGeometry(SCENE, MPT);
    const froids = geometry.userData.surfaceGroups.filter((g) => (g.bake && g.recipe) || (g.kind && g.recipe && g.periodM));
    // PRÉMISSE — la scène porte VRAIMENT des gabarits, sinon tout ce qui suit mesurerait le vide.
    expect(froids.length, 'aucun gabarit dans la vitrine : le banc ne dirait rien').toBeGreaterThan(10);

    const { materials, attendues, relèves } = worldSurfaceMaterials(geometry, 1, { enFile: true });

    expect(avecMap(materials), 'une `map` posée au retour = la cuisson a été payée dans l’appel').toBe(0);
    expect(attendues.length, 'chaque gabarit froid annonce sa clé').toBe(froids.length);
    expect(new Set(attendues).size, 'deux gabarits ne peuvent pas partager une clé d’attente').toBe(attendues.length);
    expect(bakeQueueLength(), 'les cuissons doivent être EN FILE, pas exécutées').toBeGreaterThan(0);

    const verdicts = await Promise.all(relèves);
    // Les mêmes matériaux, relevés en place : le test n'en a recréé aucun.
    expect(avecMap(materials), 'la file servie, les gabarits doivent être POSÉS').toBe(verdicts.filter((v) => v.posé).length);
    expect(verdicts.filter((v) => v.posé).length, 'aucune pose : la relève est débranchée').toBeGreaterThan(10);
    expect(new Set(verdicts.map((v) => v.clé))).toEqual(new Set(attendues));
    geometry.dispose();
  });

  it('SYNCHRONE (défaut) : tout est cuit au retour, et rien n’est annoncé — le chemin de la planche QC', () => {
    const { geometry } = bakeWorldGeometry(SCENE, MPT);
    const { materials, attendues, relèves } = worldSurfaceMaterials(geometry, 1, { lit: false });
    expect(attendues, 'le mode synchrone n’a rien à faire attendre').toEqual([]);
    expect(relèves, 'le mode synchrone ne relève rien').toEqual([]);
    expect(avecMap(materials), 'la planche QC n’a qu’une image : ses gabarits doivent être là').toBeGreaterThan(10);
    geometry.dispose();
  });
});

/**
 * Rend FROIDS `n` gabarits de la scène, tous les autres CHAUDS — et le compte d'images qu'un monde
 * entièrement cuit porte. Le montage n'a donc que `n` cuissons à mettre en file : le banc mesure le
 * CÂBLAGE (voile, relève) sans faire courir les 86 cuissons de la vitrine contre le plafond de
 * sécurité du voile, qui les couvrirait toutes et rendrait la mesure muette. Le jeu EXHAUSTIF des
 * gabarits froids, lui, est mesuré par le contrat d'unité ci-dessus.
 */
function froidsSauf(n: number): { images: number } {
  const { geometry } = bakeWorldGeometry(SCENE, MPT);
  const groupes = geometry.userData.surfaceGroups;
  // Passe SYNCHRONE complète : elle dit combien de groupes portent VRAIMENT une image (un masque
  // neutre n'en donne aucune) et lesquels — le test ne devine rien.
  const { materials } = worldSurfaceMaterials(geometry, 1);
  const porteurs = groupes.map((_, i) => i).filter((i) => (materials[i] as THREE.MeshBasicMaterial).map != null);
  const froids = new Set(porteurs.slice(0, n));
  clearFaceBakes();
  clearPeriodTextures();
  groupes.forEach((g, i) => {
    if (froids.has(i)) return;
    if (g.bake && g.recipe) getFaceBake(g.key, { color: g.color ?? '', recipe: g.recipe, part: g.part }, g.bake.wM, g.bake.hM, g.variant ?? 0, 1);
    else if (g.kind && g.recipe && g.periodM) getPeriodTexture(g.key, g.recipe, g.variant ?? 0, { kind: g.kind, baseColor: g.color ?? '', anisotropy: 1 });
  });
  geometry.dispose();
  return { images: porteurs.length };
}

describe('#1399 — le VOILE d’entrée en scène attend les gabarits du monde', () => {
  const FROIDS = 6;

  it('levé au montage sans un seul billboard, il tombe quand les gabarits sont posés', async () => {
    const { images } = froidsSauf(FROIDS);
    expect(images, 'PRÉMISSE : la vitrine doit porter de vraies images de gabarit').toBeGreaterThan(FROIDS);
    // Le voile a DEUX causes de tombée (`GameStage3D.tsx` : `jugerEntrée`, ou son plafond de sécurité
    // armé au montage, un vrai timer de 2 s qu'une machine saturée fait gagner la course). Le plafond
    // est poussé hors d'atteinte pour que la tombée n'ait qu'UNE cause possible : ses gabarits — sinon
    // le seul témoin du banc serait le chronomètre, donc la vitesse de la machine. Hors d'atteinte, un
    // câblage de relève débranché laisse le voile levé.
    AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
    monterSync();

    // Le voile est LEVÉ alors que la population des billboards a déjà déclaré son jeu VIDE : ce qui le
    // tient ne peut être qu'un gabarit du monde.
    expect(canevas().dataset.voile, 'le voile ne couvre pas les gabarits du monde').toBe('1');
    expect(avecMap(matériauxDuMonde()), 'un gabarit froid posé au montage = cuisson synchrone').toBe(images - FROIDS);

    await attendreEntréeFinie(hôte!, PLAFOND_ATTENTE_MS, () => battre?.());

    expect(canevas().dataset.voile, 'le voile n’est jamais tombé sur ses gabarits — et son plafond ne pouvait pas le faire tomber').toBeUndefined();
    expect(avecMap(matériauxDuMonde()), 'les gabarits ne sont pas relevés sur les matériaux montés').toBe(images);
  });

  it('gabarits tous CHAUDS : le voile tient quand même sur le billboard proche', async () => {
    // COURSE DES POPULATIONS : l'effet du monde est monté AVANT celui des billboards, et il n'a ici
    // RIEN à faire attendre. Un jeu d'attente vide à cet instant ne dit pas que la scène est prête —
    // il dit que la population des billboards reste NON DÉCLARÉE à ce moment.
    const { images } = froidsSauf(0);
    const ras: Rasterisation = simulerRasterisation('retenue');
    // Même raison qu'au banc précédent : hors d'atteinte, le plafond de sécurité ne peut pas faire
    // tomber le voile pendant les respirations, et sa tombée n'a qu'UNE cause possible — la texture
    // servie au décor proche.
    AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
    monterSync(false, GROUPE, { tokens: [], props: [décor('près', GROUPE.x + 1)] });

    expect(avecMap(matériauxDuMonde()), 'PRÉMISSE : tous les gabarits doivent être posés dès le montage').toBe(images);
    expect(canevas().dataset.voile, 'le voile est tombé avant que les billboards aient parlé').toBe('1');

    // …et il tombe dès que la texture du décor proche arrive : c'est bien ELLE qui le tenait.
    for (let i = 0; i < 40 && canevas().dataset.voile; i++) {
      const paquet = ras.enAttente.splice(0, 1);
      await act(async () => { for (const f of paquet) f(); });
      await respirer(40);
    }
    expect(canevas().dataset.voile, 'le voile n’est jamais tombé sur la texture servie').toBeUndefined();
  });

  it('#1478 — la RECETTE lit le même voile par le rendez-vous de la couche state', async () => {
    froidsSauf(FROIDS);
    monterSync();
    expect(entreeEnScene(), 'au montage : la scène est nommée et son voile est LEVÉ')
      .toEqual({ sceneId: SCENE.id, voile: true });

    await attendreEntréeFinie(hôte!, PLAFOND_ATTENTE_MS, () => battre?.());
    expect(entreeEnScene(), 'le voile tombé à l’écran est tombé pour la recette')
      .toEqual({ sceneId: SCENE.id, voile: false });

    act(() => root!.unmount());
    root = null;
    expect(entreeEnScene().sceneId, 'plus aucun monde monté').toBeNull();
  });
});

describe('#1399 — la RELÈVE repeint au point de vue COURANT', () => {
  it('le groupe déplacé pendant que la file sert : aucune image peinte à l’ancien point de vue', async () => {
    const A = { x: 4, y: 4 };
    const B = { x: 14, y: 14 };
    monterSync(false, A);
    // PRÉMISSE : une image a été peinte au point de vue A — sortie au fait accompli, jamais au bout
    // d'une fenêtre (`caméras` est l'accumulateur du renderer de banc).
    await attendreQue(() => caméras.length > 0, PLAFOND_ATTENTE_MS, () => battre?.());
    expect(caméras.length, 'aucune image peinte au montage : le banc ne dirait rien').toBeGreaterThan(0);

    const avant = vueX(caméras[caméras.length - 1]);
    // MÊME géométrie, MÊME scène : l'effet du monde ne se remonte pas, seul le point de vue bouge.
    await act(async () => { root!.render(écran(false, B)); });
    const marque = caméras.length;
    const posésAvant = avecMap(matériauxDuMonde());
    // Ce que le banc a besoin de voir arriver : des images APRÈS le déplacement, et des gabarits
    // relevés pendant qu'elles se peignent. C'est un ÉTAT, pas une durée — 400 ms de mur ne le
    // portent que sur une machine au repos.
    await attendreQue(
      () => caméras.length > marque && avecMap(matériauxDuMonde()) > posésAvant,
      PLAFOND_ATTENTE_MS,
      () => battre?.(),
    );
    // La sortie est au PLUS TÔT : une repeinte au point de vue PÉRIMÉ arriverait APRÈS elle et
    // resterait hors du jugement. On bat encore quelques images — un fait, jamais une durée — avant
    // de figer ce qu'on juge.
    const fenêtre = caméras.length + IMAGES_APRES_LE_FAIT;
    await attendreQue(() => caméras.length >= fenêtre, PLAFOND_ATTENTE_MS, () => battre?.());
    expect(caméras.length, `PRÉMISSE : la pompe d'images du banc doit battre après le fait — ${caméras.length} image(s) pour ${fenêtre} attendues`)
      .toBeGreaterThanOrEqual(fenêtre);

    const après = caméras.slice(marque).map(vueX);
    // PRÉMISSES — des images ont bien été peintes après le déplacement, et des gabarits y sont arrivés.
    expect(après.length, 'aucune image peinte après le déplacement : le banc ne dirait rien').toBeGreaterThan(0);
    expect(avecMap(matériauxDuMonde()), 'aucun gabarit relevé pendant qu’elles se peignaient : le banc ne dirait rien')
      .toBeGreaterThan(posésAvant);
    expect(new Set(après).size, `points de vue peints : ${[...new Set(après)].join(', ')}`).toBe(1);
    expect(après[0], 'le point de vue n’a pas bougé : le banc ne dirait rien').not.toBe(avant);
  });
});

/** Une demande de cuisson pour un gabarit de face de la VITRINE qui cuit vraiment (masque non neutre)
 *  — le test ne fabrique aucune recette : il prend celle d'une façade de la scène. */
function gabaritDeFace(): () => ReturnType<typeof getFaceBakeEnFile> {
  const { geometry } = bakeWorldGeometry(SCENE, MPT);
  const g = geometry.userData.surfaceGroups.find(
    (x) => x.bake && x.recipe
      && getFaceBake(x.key, { color: x.color ?? '', recipe: x.recipe, part: x.part }, x.bake.wM, x.bake.hM, x.variant ?? 0, 1) != null,
  );
  expect(g, 'PRÉMISSE : la vitrine doit porter un gabarit de face qui cuit vraiment').toBeTruthy();
  const bake = g!.bake!;
  const surface = { color: g!.color ?? '', recipe: g!.recipe, part: g!.part };
  geometry.dispose();
  return () => getFaceBakeEnFile(g!.key, surface, bake.wM, bake.hM, g!.variant ?? 0, 1);
}

describe('#1399 — le gabarit du monde s’enfile SOUS la vue courante', () => {
  it('un billboard de la vue courante double un gabarit déjà en file', async () => {
    // CADENCE STRICTE : une tâche par tranche, donc l'ordre de service se lit coup par coup.
    setBudgetTrancheMs(0);
    const demander = gabaritDeFace();
    clearFaceBakes();

    const servi: string[] = [];
    const gabarit = demander(); // enfilé EN PREMIER, et pourtant servi en DERNIER
    void gabarit.prêt.then(() => servi.push('gabarit'));
    await queueBakeTask(PRIORITE_VUE_COURANTE, async () => { servi.push('billboard'); });

    expect(servi, 'le gabarit du fond est passé devant le quad que le groupe a sous les yeux').toEqual(['billboard']);
    await gabarit.prêt;
    expect(servi, 'PRÉMISSE : le gabarit doit bien être cuit derrière').toEqual(['billboard', 'gabarit']);
  });
});

describe('#1399 — une cuisson EN VOL ne survit pas au changement de scène', () => {
  it('cache vidé pendant qu’une tâche est en file : elle ne cuit pas, la clé ré-enfilée cuit', async () => {
    const demander = gabaritDeFace();

    clearFaceBakes(); // ardoise : la cuisson de sondage ci-dessus ne doit rien laisser au cache
    const morte = demander();
    expect(bakeQueueLength(), 'PRÉMISSE : la cuisson doit être EN FILE, pas déjà faite').toBeGreaterThan(0);

    clearFaceBakes(); // la SCÈNE change : la tâche en file appartient à un monde mort
    const vive = demander();
    const [a, b] = await Promise.all([morte.prêt, vive.prêt]);

    expect(a, 'la tâche de la scène morte a cuit quand même').toBeNull();
    expect(b, 'la scène neuve n’a obtenu aucune image').not.toBeNull();
    expect(demander().cuisson, 'le cache neuf ne tient pas la cuisson de la scène neuve').toBe(b);
  });
});

describe('#1399 — StrictMode : ce que coûte le rendu JETÉ', () => {
  it('la cuisson du monde est payée DEUX fois (dev), et la géométrie jetée n’atteint aucune image', async () => {
    const cuisson = vi.spyOn(sceneMeshes, 'bakeWorldGeometry');
    monterSync(true);
    // Les DEUX cuissons du double rendu de montage et au moins une image dessinée : le fait attendu,
    // jamais une fenêtre de 60 ms.
    await attendreQue(() => cuisson.mock.calls.length >= 2 && scènes.length > 0, PLAFOND_ATTENTE_MS, () => battre?.());
    // Sortie au PLUS TÔT, encore : une TROISIÈME cuisson tardive tomberait après elle. On bat quelques
    // images de plus — un fait, jamais une durée — avant d'affirmer le compte.
    const fenêtre = scènes.length + IMAGES_APRES_LE_FAIT;
    await attendreQue(() => scènes.length >= fenêtre, PLAFOND_ATTENTE_MS, () => battre?.());
    expect(scènes.length, `PRÉMISSE : la pompe d'images du banc doit battre après le fait — ${scènes.length} image(s) pour ${fenêtre} attendues`)
      .toBeGreaterThanOrEqual(fenêtre);

    // FAIT ÉTABLI : `memoByRefDeps` est keyé sur un jeton d'INSTANCE (`useRef({}).current`), et le
    // double rendu de montage de StrictMode en fabrique DEUX — deux slots WeakMap indépendants, donc
    // deux cuissons, sans collision ni écrasement.
    expect(cuisson.mock.calls.length, 'le double rendu de StrictMode ne cuit pas deux fois : le fait a changé').toBe(2);
    const jetée = cuisson.mock.results[0].value.geometry as THREE.BufferGeometry;
    const gardée = cuisson.mock.results[1].value.geometry as THREE.BufferGeometry;
    expect(jetée, 'PRÉMISSE : deux cuissons, deux géométries distinctes').not.toBe(gardée);

    // …et la géométrie du rendu jeté n'est montée dans AUCUNE scène dessinée : elle n'est jamais
    // téléversée, donc rien n'est à libérer côté GPU — elle part au ramasse-miettes avec son jeton.
    let montée = false;
    for (const scène of scènes) scène.traverse((o) => { if ((o as THREE.Mesh).geometry === jetée) montée = true; });
    expect(montée, 'la géométrie jetée est montée : c’est une fuite GPU, elle doit être libérée').toBe(false);
    expect(scènes.length, 'PRÉMISSE : des images ont bien été dessinées').toBeGreaterThan(0);
  });
});
