/**
 * Harnais de banc volumique PARTAGÉ — importé UNIQUEMENT par des fichiers `.test.` (garde structurelle
 * dans banc-volumique.test.ts).
 *
 * Ce que ce module tient, pour tout banc qui monte l'écran volumique sous jsdom :
 *  - le RENDERER de banc (jsdom n'a aucun contexte WebGL : sans lui la passe de dessin s'arrête à sa
 *    première garde) et les frames qu'il capte, en accumulateurs de MODULE — un banc peut monter
 *    PLUSIEURS écrans et compter leurs rendus ensemble ;
 *  - la RASTERISATION simulée au niveau du DOM (jamais par mock de module, cf.
 *    `src/vi-mock-isolate-guard.test.ts`), en service automatique ou RETENUE ;
 *  - l'ARDOISE : la purge des caches de MODULE que la suite partage sous `isolate: false`
 *    (`brancherArdoise`) — un cache laissé chargé par un fichier voisin fait démarrer le suivant sur
 *    des tâches et des textures d'ailleurs, et son écran se monte sans un seul quad.
 */
import { act } from 'react';
import { afterEach, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import type { StageRenderer } from './GameStage3D';
import { frameRectOf } from './boardPose';
import { BUDGET_TRANCHE_MS_DEFAUT, clearAtlasCache, resetBakeQueue, setBudgetTrancheMs } from '../backends/webgl/atlasBake';
import { clearFaceBakes } from '../backends/webgl/faceBake';
import { clearPeriodTextures } from '../backends/webgl/periodTexture';
import { clearBillboardTextures } from '../backends/webgl/svgTexture';
import { viderTexturesStatiques } from './texturesStatiques';
import { resetStageFrames } from './stageFrames';

/** Les scènes three DESSINÉES, dans l'ordre — accumulateur de MODULE : plusieurs écrans montés à la
 *  fois y versent leurs frames, et un banc peut donc compter les rendus de tout ce qui vit. */
export const scènes: THREE.Scene[] = [];
/**
 * La caméra de CHAQUE frame dessinée, appariée à `scènes` par l'index — une COPIE, pose et projection
 * figées à l'instant du rendu (#1404).
 *
 * L'écran REPOSE ses deux caméras au lieu d'en construire par image : sans copie, toutes les entrées de
 * ce tableau seraient le MÊME objet, et un banc qui relit `caméras[i].position` après coup lirait la
 * dernière image pour toutes (`gabarits-en-file`, verrou G1 : « un seul point de vue peint » y serait
 * vrai par construction). La copie porte l'`uuid` de sa SOURCE : l'identité de la caméra reste donc
 * mesurable image par image, et c'est par elle que se compte la repose.
 */
export const caméras: THREE.Camera[] = [];

/** Ardoise neuve des captures (les tableaux gardent leur identité : ils sont exportés). */
export function viderCaptures(): void {
  scènes.length = 0;
  caméras.length = 0;
}

/** Ce qu'un banc peut greffer sur chaque frame dessinée, en plus des captures (projection, horloge…). */
export type SurRendu = (scene: THREE.Scene, camera: THREE.Camera) => void;

export class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  surRendu?: SurRendu;

  constructor(surRendu?: SurRendu) {
    this.surRendu = surRendu;
  }

  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    scènes.push(scene);
    const copie = camera.clone();
    copie.uuid = camera.uuid;
    caméras.push(copie);
    this.surRendu?.(scene, camera);
  }
}

/** La rasterisation simulée d'un banc : sa file d'images EN VOL et les deux façons de les servir. */
export interface Rasterisation {
  /** Les rasterisations en vol (mode `retenue` seulement) — la file elle-même, mutable par le banc. */
  enAttente: Array<() => void>;
  /** Sert la PROCHAINE image en vol. */
  résoudreUne(): void;
  /** Sert toutes les images en vol. */
  résoudreTout(): void;
  /** PERD la prochaine image en vol : sa promesse de texture REJETTE (`rasterizeSvg`, un SVG illisible
   *  par le navigateur). L'autre issue d'une rasterisation, celle qu'un `onload` ne montre jamais. */
  rejeterUne(): void;
}

/** Ce qu'un banc tient d'une image retenue : ses DEUX issues. */
interface ImageRetenue {
  onload: (() => void) | null;
  onerror: (() => void) | null;
}

/** `URL.createObjectURL`/`revokeObjectURL` d'AVANT la première pose (jsdom ne les fournit pas : il n'y
 *  a rien à espionner, on les POSE) — rendues par `brancherArdoise`. */
let urlAvant: { create: typeof URL.createObjectURL; revoke: typeof URL.revokeObjectURL } | null = null;

/**
 * Rasterisation de billboard SIMULÉE au niveau du DOM : jsdom ne charge aucune ressource, donc
 * l'`Image` d'un blob SVG n'y déclenche ni `onload` ni `onerror` et la promesse de texture resterait
 * pendante — AUCUN board ne serait monté, et toute mesure porterait sur le vide.
 *
 * `auto` : chaque image s'achève à la microtâche suivante. `retenue` : le banc décide QUAND, en
 * servant lui-même la file rendue ici (c'est la fenêtre de montage).
 *
 * CONDITION DE MESURE, dans les deux modes : le stub de `requestIdleCallback` fait SERVIR la file du
 * cuiseur par `setTimeout(0)`. Tout banc qui appelle cette fonction mesure donc un écran dont la file
 * tourne — y compris `pas-exploration`, `entree-en-scene`, `silhouette-corps` et
 * `silhouette-sans-corps`, qui ne servent aucune rasterisation eux-mêmes.
 */
export function simulerRasterisation(mode: 'auto' | 'retenue' = 'auto'): Rasterisation {
  const enAttente: Array<() => void> = [];
  /** L'image DERRIÈRE chaque service en attente : c'est par elle que la file rend l'autre issue
   *  (`rejeterUne`) sans que `enAttente` cesse d'être la file de services que les bancs épuisent. */
  const derrière = new Map<() => void, ImageRetenue>();
  vi.stubGlobal('Image', class implements ImageRetenue {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      if (mode === 'auto') { queueMicrotask(() => this.onload?.()); return; }
      const servir = (): void => { this.onload?.(); };
      derrière.set(servir, this);
      enAttente.push(servir);
    }
  });
  // La file du cuiseur prend sa propre couture d'INACTIVITÉ, servie par les VRAIS timers : sans elle
  // elle se branche sur l'horloge d'images, qu'un banc voisin de la même suite peut tenir lui-même
  // (`isolate: false`) — la file resterait armée sans jamais être servie, et rien ne se monterait.
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => setTimeout(() => cb(), 0));
  if (!urlAvant) urlAvant = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  URL.createObjectURL = () => 'blob:banc';
  URL.revokeObjectURL = () => undefined;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: () => undefined } as unknown as CanvasRenderingContext2D);
  return {
    enAttente,
    résoudreUne(): void { enAttente.shift()?.(); },
    résoudreTout(): void { for (const f of enAttente.splice(0)) f(); },
    rejeterUne(): void {
      const servir = enAttente.shift();
      if (!servir) return;
      derrière.get(servir)?.onerror?.();
      derrière.delete(servir);
    },
  };
}

/** Les CACHES et la FILE que la suite partage sous `isolate: false`, rendus à leur point de départ :
 *  la file cadencée du cuiseur et son budget de tranche, les caches d'atlas, de textures de billboard,
 *  de gabarits de face et de périodes, et les frames captées. Aucun mock ni global n'y est touché —
 *  ceux d'un banc sont à lui, et se rendent à sa sortie. Le BATTEMENT du stage n'est pas ici : il ne
 *  se lave qu'en amont (`ardoiseAmont`). */
function ardoiseNeuve(): void {
  resetBakeQueue();
  setBudgetTrancheMs(BUDGET_TRANCHE_MS_DEFAUT);
  clearAtlasCache();
  clearBillboardTextures();
  clearFaceBakes();
  clearPeriodTextures();
  viderTexturesStatiques();
  viderCaptures();
}

/** L'ardoise du BOUT AMONT : les caches ci-dessus, PLUS le battement du stage.
 *
 *  Deux drapeaux de MODULE gouvernent le travail différé de l'écran volumique, et tous deux s'arment
 *  sur une couture que l'environnement jsdom d'un autre fichier peut emporter avec lui :
 *  `sliceArmed` (`backends/webgl/atlasBake.requestSlice`, la tranche du cuiseur) et `image`
 *  (`stageFrames.armer`, la boucle d'images). Armé sur un rappel qui ne partira jamais, l'un comme
 *  l'autre bloque son réarmement pour tous les bancs suivants — aucune rasterisation ne part, aucune
 *  image n'est peinte.
 *
 *  `resetStageFrames` ne vaut QU'ICI : il vide les sources d'images, et un écran resté monté par un
 *  banc négligent doit garder les siennes jusqu'à sa sortie, où il se voit (`stageFrames.ts:138-144`). */
function ardoiseAmont(): void {
  ardoiseNeuve();
  resetStageFrames();
}

/**
 * ARDOISE NEUVE entre deux tests, et entre deux FICHIERS — à appeler UNE fois en tête d'un banc.
 *
 * La suite partage son graphe de modules par worker (`isolate: false`, `vite.config.ts`) : la file du
 * cuiseur et SON BUDGET DE TRANCHE, le stock d'atlas, les gabarits du monde cuit (colombage,
 * périodes), les textures de billboard et les textures statiques sont des SINGLETONS
 * que deux fichiers voisins se passent en l'état. Un fichier qui les laisse chargés fait démarrer le
 * suivant sur des tâches et des textures d'ailleurs — mesuré : un écran monté sans un seul quad.
 *
 * La DÉPOSE de ce que `simulerRasterisation` pose (spy de `getContext`, globaux stubbés, `URL.*`) vit
 * ici, dans la même main : le banc appelant n'a rien à rendre lui-même.
 */
export function brancherArdoise(): void {
  // L'ardoise se lave AUX DEUX BOUTS. Le bout AMONT est le seul qui couvre la frontière de FICHIER :
  // ce qui entre dans un banc vient du fichier précédent, qui n'a pas forcément ce harnais — et il en
  // revient parfois ARMÉ SANS SERVIR, file du cuiseur comme boucle d'images (mesuré : 2 tâches en
  // file, 0 servie après 200 ms de pompe ; une boucle armée sur un rAF mort ne peint plus rien). Le
  // rouge d'un banc n'accuse plus alors qu'une machine lente.
  beforeEach(ardoiseAmont);
  afterEach(() => {
    ardoiseNeuve();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (urlAvant) {
      URL.createObjectURL = urlAvant.create;
      URL.revokeObjectURL = urlAvant.revoke;
      urlAvant = null;
    }
  });
}

/** Écart d'horloge qu'UN battement du banc fait franchir — au-delà de la fenêtre de cession de
 *  `stageFrames.armer`, qui tient deux battements plus rapprochés pour la MÊME image. */
const MS_PAR_IMAGE = 16;

/** Ce qu'un banc de BOUCLE tient de ses images : la file de rAF en vol, son compte de poses, son
 *  horloge, et le battement piloté. */
export interface ImagesPilotees {
  /** Les rappels de `requestAnimationFrame` EN VOL — la file elle-même, mutable par le banc : on y
   *  compte les boucles armées (`stageFrames` n'en arme qu'UNE pour toutes ses sources), et on en
   *  EXTRAIT un rappel nommé quand c'est LUI que le banc rejoue (le tick d'une marche, qui se
   *  reprogramme lui-même : `walk-frame-loop`, `chrome-jeton`). */
  readonly enVol: FrameRequestCallback[];
  /** Les rAF POSÉS depuis le début du test — c'est lui qui dit combien d'HORLOGES tournent : une pose
   *  par image = une seule boucle. Cumulatif ; un banc en prend l'écart entre deux points. */
  poses(): number;
  /** L'horloge du banc, telle que la production la lit (`performance.now()`) — un banc qui rejoue un
   *  rappel nommé lui passe cet horodatage, et une DURÉE mesurée s'en prend en écart. */
  maintenant(): number;
  /** AVANCE l'horloge du banc sans rien servir — l'image du navigateur passe, les rAF restent en vol. */
  avancer(ms: number): void;
  /** UNE image : l'horloge avance de `ms` (par défaut au-delà de la fenêtre de cession), puis les
   *  rappels armés sont servis avec l'horodatage de cette image. Rend le NOMBRE de rappels servis —
   *  zéro dit que plus personne ne demande d'image. */
  battre(ms?: number): number;
}

/**
 * IMAGES PILOTÉES — l'horloge du banc et son collecteur de `requestAnimationFrame`, posés dans la
 * MÊME main, à chaque test. Tout banc qui COMPTE des images du stage passe par ici : deux prémisses
 * d'ENVIRONNEMENT y sont fermées d'un coup, et aucune ne se voit depuis le banc qui rougit.
 *
 *  1. le TEMPS. La boucle CÈDE le pas à toute image déjà peinte (`stageFrames.armer` : elle ne bat que
 *     si `performance.now()` a dépassé la dernière peinte de plus de `MEME_IMAGE_MS`). Lue sur le MUR,
 *     cette fenêtre est une prémisse d'environnement, pas une propriété du code : une horloge qui
 *     n'avance pas entre le commit React et le service du rAF rend la boucle muette, et le banc rougit
 *     « 0 image » sans qu'aucune ligne de production n'ait bougé (rouge CI du 2026-09-01, run
 *     33788542747, reproduit en gelant `performance.now`). Le banc PILOTE donc son temps.
 *  2. la PORTÉE du collecteur, qui se pose À CHAQUE TEST et jamais au montage du fichier. Les espions
 *     sont rendus AVANT chaque test (`restoreMocks`, `vite.config.ts`) — donc APRÈS le `beforeAll` du
 *     fichier suivant : un voisin du worker qui a espionné `globalThis.requestAnimationFrame`
 *     (`halos-interaction.test.tsx:287`) fait rendre à ce banc le rAF de jsdom au seuil de son premier
 *     test (`isolate: false`), et un collecteur posé en `beforeAll` ne l'atteint pas. L'écran arme
 *     alors sa boucle sur un rAF que le banc ne servira jamais : `sourcesDeFrames() === 1` pour ZÉRO
 *     rappel en vol, et le banc rougit sur l'ORDRE DES FICHIERS du worker, pas sur la boucle (mesuré :
 *     vert sur le fichier seul, rouge sur la paire `halos-interaction` + ce banc, rouge sur
 *     `src/gameIso/stage` entier). L'ordre INTERNE de ce hook, lui, ne décide de rien (mesuré :
 *     collecteur posé avant l'horloge, `src/gameIso/stage` entier vert).
 *
 * `toFake` ne prend QUE l'horloge : `setTimeout` reste RÉEL pour ce que React et three planifient hors
 * de la mesure, et le rAF appartient au collecteur.
 *
 * PÉRIMÈTRE : les bancs qui COMPTENT les images de l'ÉCRAN volumique. `stageFrames.test.ts` reste sur
 * son propre collecteur : il éprouve le module de battement seul, en environnement `node` et sans une
 * ligne de React — son battement ne peut pas passer par l'`act` d'ici, et le harnais volumique
 * (renderer, caches d'atlas, react-dom, three) n'a rien à faire dans son graphe.
 */
export function brancherImagesPilotees(): ImagesPilotees {
  const enVol: FrameRequestCallback[] = [];
  let posées = 0;
  let rafAvant: typeof globalThis.requestAnimationFrame | null = null;
  let cancelAvant: typeof globalThis.cancelAnimationFrame | null = null;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['performance'] });
    enVol.length = 0;
    posées = 0;
    rafAvant = globalThis.requestAnimationFrame;
    cancelAvant = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      posées += 1;
      return enVol.push(cb);
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => undefined) as typeof globalThis.cancelAnimationFrame;
  });
  afterEach(() => {
    if (rafAvant) globalThis.requestAnimationFrame = rafAvant;
    if (cancelAvant) globalThis.cancelAnimationFrame = cancelAvant;
    vi.useRealTimers();
  });
  return {
    enVol,
    poses: () => posées,
    maintenant: () => performance.now(),
    avancer: (ms: number) => vi.advanceTimersByTime(ms),
    battre(ms = MS_PAR_IMAGE): number {
      vi.advanceTimersByTime(ms);
      const armés = enVol.splice(0);
      const horodatage = performance.now();
      act(() => armés.forEach((cb) => cb(horodatage)));
      return armés.length;
    },
  };
}

/**
 * Laisse tourner la file CADENCÉE du cuiseur (une rasterisation par tranche d'inactivité) pendant `ms`
 * de mur. `battre` = la pompe d'images du banc, quand il en tient une (`StageWalkAnim.subscribe`).
 */
export async function respirer(ms: number, battre?: () => void): Promise<void> {
  const fin = Date.now() + ms;
  do {
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    if (battre) act(() => battre());
  } while (Date.now() < fin);
}

/** Tous les quads de billboard de la dernière frame dessinée (les corps, jamais leurs jumeaux de
 *  silhouette ni la géométrie empruntée au monde cuit). */
export function quads(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  scènes[scènes.length - 1]?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !m.userData.emprunte && frameRectOf(m.material as THREE.Material)) out.push(m);
  });
  return out;
}

/**
 * PLAFOND d'attente de ces bancs, déclaré UNE fois (#1442) — la borne haute que les attentes au fait
 * accompli ne doivent jamais atteindre, même sous saturation (mesuré : 6 373 ms sous 32 brûleurs pour
 * la cuisson la plus lourde), et qui reste sous le budget de test des bancs volumiques (30 s).
 */
export const PLAFOND_ATTENTE_MS = 20_000;

/**
 * Plafond de sécurité du voile d'entrée poussé HORS D'ATTEINTE (#1442), déclaré UNE fois pour tous les
 * bancs qui établissent la cause d'une tombée de voile : armé à cette valeur sur le singleton
 * d'ambiance le temps d'un banc, le plafond ne peut plus gagner la course, et la tombée a seulement UNE cause possible — celle que le banc mesure.
 *
 * La valeur doit dépasser le plafond des attentes (`PLAFOND_ATTENTE_MS`), et sort donc du domaine que
 * le schéma d'ambiance défend au parse (`entreeEnScene.plafondMs` ≤ 10 000 ms,
 * `src/data/schemas/defs/ambiance.ts`) : c'est un levier poussé en mémoire, jamais une valeur
 * authorable. Tout banc qui le pousse le REND en première instruction de son `afterEach` — le
 * singleton est partagé par la suite (`isolate: false`), et un fichier voisin monterait sinon son
 * écran sous un voile immortel.
 */
export const PLAFOND_HORS_ATTEINTE_MS = 120_000;

/**
 * ATTENTE À CONDITION — le patron d'attente UNIQUE de ces bancs (#1442) : laisser respirer tant que le
 * fait mesuré n'est pas là, et SORTIR AU FAIT ACCOMPLI.
 *
 * Une fenêtre de mur FIXE pose en prémisse qu'une machine met moins de N ms à monter ce qu'on va
 * mesurer. Cette prémisse est fausse dès que la machine porte une suite complète et des agents
 * (mesuré : 618 ms à vide → 4 093 ms sous 16 brûleurs → 6 373 ms sous 32 pour la même cuisson) : le
 * banc rougirait alors sur la vitesse de la machine, pas sur le code.
 *
 * `limiteMs` est un PLAFOND, jamais une assertion : c'est à l'appelant d'affirmer le fait au retour.
 * `battre` = la pompe d'images du banc, quand il en tient une (même rôle que dans `respirer`).
 */
export async function attendreQue(fait: () => boolean, limiteMs = 4000, battre?: () => void): Promise<void> {
  const fin = Date.now() + limiteMs;
  while (!fait() && Date.now() < fin) await respirer(20, battre);
}

/** Attend que la file cadencée du cuiseur ait posé `n` quads — PRÉMISSE de mesure, jamais une
 *  assertion : la suite fait tourner plusieurs bancs sur le même module (`isolate: false`) et la file
 *  d'un écran chargé partage la machine avec eux. Le budget est un PLAFOND : la boucle sort au compte
 *  plein. */
export async function attendreQuads(n: number, limiteMs = 4000, battre?: () => void): Promise<void> {
  await attendreQue(() => quads().length >= n, limiteMs, battre);
}

/** Le canevas volumique monté sous `hôte`. */
export const canevas = (hôte: HTMLElement): HTMLCanvasElement => hôte.querySelector('canvas.iso-stage') as HTMLCanvasElement;

/**
 * Attend la FIN de l'entrée en scène du montage (`data-voile` absent) — PRÉMISSE de mesure pour tout
 * banc qui mesure autre chose que le voile lui-même.
 *
 * Ce que le voile attend n'est PAS ce qu'attend `attendreQuads` : les billboards proches tombent vite,
 * mais les gabarits de FACE du monde partent en file au rang le plus bas (`PRIORITE_FOND`,
 * `backends/webgl/faceBake`) et le voile les attend TOUS. Mesuré sur le hub de l'arène : 348 tâches
 * encore en file et 14 clés de face encore attendues au retour d'`attendreQuads(40)`, le voile tombant
 * 240 ms plus tard. Un banc qui mesure `data-voile` sans cette attente lit donc le voile du MONTAGE, pas
 * ce qu'il croit mesurer.
 *
 * Le budget est un PLAFOND, jamais une assertion : le voile a le sien (`AMBIANCE.entreeEnScene.plafondMs`),
 * et c'est à l'appelant d'affirmer qu'il est bien tombé.
 */
export async function attendreEntréeFinie(hôte: HTMLElement, limiteMs = 4000, battre?: () => void): Promise<void> {
  await attendreQue(() => !canevas(hôte)?.dataset.voile, limiteMs, battre);
}

/** Le compteur applicatif de rendus du canevas — ce que le renderer a REÇU (un canevas WebGL n'a pas
 *  d'arbre à interroger, et c'est par lui que la recette navigateur lit le même fait). */
export const rendus = (hôte: HTMLElement): number => Number(canevas(hôte).dataset.rendus ?? 0);
