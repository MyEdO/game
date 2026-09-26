/**
 * MONDE VOLUMIQUE de l'écran de jeu (#1176, lots P2-2/P2-2b) — la couche MONDE, rendue en three.
 * CONSOMMATEUR
 * pur du stage : il ne lit AUCUN store, ne décide ni cadrage ni visibilité ni dégagement — `IsoStage`
 * reste la seule source d'intention, exactement comme pour le backend affine.
 *
 * QUATRE CANAUX INDÉPENDANTS, chacun avec ses propres entrées, aucun n'invalidant les autres :
 *  - CUISSON (`bakeWorldGeometry`, `sceneGroundAccents`) : la passe LOURDE, invalidée par la SEULE
 *    scène et la SEULE échelle (`[scene, mpt]`). Ni la marche ni la caméra ne la rejouent.
 *  - DÉGAGEMENT (`applyCutawayMask`, `maskGroundAccents`) : les masses qui coiffent le groupe cessent
 *    d'être dessinées — l'index du monde cuit se compacte EN PLACE (`[baked, keepEl]`). Une masse
 *    dégagée ne se rend pas, elle ne s'estompe pas.
 *  - TEINTE (`applyVisibilityTint`, `instanceColor` des accents) : la visibilité se réécrit en place
 *    sur les couleurs de sommet (`[baked, tintAt]`).
 *  - POSE : la caméra suit les crans du store (`stage3dCamera`) et, pendant une MARCHE, l'intention
 *    du stage à l'instant de la frame (`anim.cam`) — rien d'autre ne bouge la vue.
 *  - MARCHE (P2-4) : la boucle de rendu lit elle-même le glissement (`anim.glide`) et ne déplace que
 *    les matrices des quads concernés. Aucun rendu React, aucun sommet, aucun matériau.
 *
 * DEUX REGARDS, UN SEUL MONDE (#1176, P3-1a) : le cadre de la frame est une UNION (`StageFrame`) —
 * ortho affine cadrée par le stage SVG (`IsoStage`), ou PERSPECTIVE à hauteur d'homme cadrée par la
 * pose du groupe (`PovStage`). Tout le reste de cet écran l'ignore : mêmes cuisson, teinte, lumière,
 * billboards et intempéries. La première personne n'a ni marques de sol, ni halos, ni picker inscrit —
 * ce sont des affordances de la vue de plateau, et le POV n'en a jamais porté.
 *
 * LUMIÈRE (P2-5) : le CANEVAS porte toute la luminosité de la scène — une ambiante au palier de lumière
 * du moment et, dehors et de jour, un SOLEIL qui suit l'heure d'horloge et le nord de la carte
 * (`stage/stageLights.ts`, décision ; cet écran ne fait que monter ses lampes et brancher les ombres).
 * FLAQUES (#1245) : les sources PONCTUELLES de la scène (brasero posé, lanterne portée — la liste que
 * le champ mécanique de vision consomme) posent leur lumière par un POOL de compte FIXE dont seules les
 * intensités bougent (`stage/stagePointLights.ts`, décision ; le pool ne se monte qu'une fois). Une
 * lampe PORTÉE suit son porteur sur la MÊME courbe de glissement que son quad (`stage/boardPose.ts`).
 * Le voile de nuit du SVG reste à la voie affine — deux propriétaires de luminosité en peindraient deux
 * paliers l'un sur l'autre. Les matériaux du monde sont TOUJOURS lambertiens : sans soleil, l'ambiante
 * seule les porte, et le lever/coucher n'a plus de régime à basculer.
 * Les BILLBOARDS, eux, ne le sont jamais : la normale d'un quad aligné écran est l'axe caméra, un
 * lambertien y mesurerait l'angle caméra↔soleil et la luminosité d'un personnage suivrait la rotation
 * de la vue. Leur lumière est donc un SCALAIRE, mais un scalaire PAR SUJET (#1245, L3) : l'exposition
 * de la frame (`surfaceLuminance`) PLUS les flaques qui l'atteignent, par la même loi que le sol
 * (`billboardExposure`) — sans quoi le sol s'allume et les personnages restent plats. RÉSIDU ASSUMÉ :
 * un personnage sous l'ombre portée d'un bâtiment garde l'exposition de la frame — il ne s'assombrit
 * pas en entrant dans l'ombre, et la flaque qu'il reçoit est omnidirectionnelle.
 *
 * INTEMPÉRIES (P2-6, #1247) : la météo authorée de la scène a TROIS expressions dans le volume, toutes
 * dérivées de la MÊME donnée (`iso.weather`, `src/data/ambiance.json`) — la voie affine garde son voile
 * d'écran, qui ne se monte plus ici :
 *  - ce qui TOMBE (`precip`) : un semis de quads instanciés qui descend à la cadence de la frame, borné
 *    par le MÊME couvert bâti que le dégagement (`shelterField`, `builders/roofs.ts`) — rien ne tombe
 *    sous un toit, y compris sous une nappe que le cutaway a levée, et rien ne se REND au-dessus d'une
 *    nappe que la vue ne peint plus (`nappeVue`) ;
 *  - ce qui STAGNE (`brume`) : des nappes horizontales aux cotes de la donnée, sur les seules colonnes à
 *    ciel ouvert (`backends/webgl/weatherSheets.ts`) — vue de plateau seulement ;
 *  - ce qui TEINTE (`tint`/`alpha`) : l'assombrissement et la couleur des LAMPES, du fond de canevas et
 *    du ciel du POV (`weatherLightScalars`), jamais un voile posé par-dessus la scène.
 * Un type de météo qui n'a que `tint`/`alpha` (la neige) est donc servi sans une ligne de code.
 *
 * CANAUX D'AMBIANCE ENCORE ABSENTS (mesuré #1176, P2-2) — la voie SVG les
 * applique OBJET PAR OBJET, cet écran porte la teinte de visibilité (`tintAt`) et la lumière globale
 * ci-dessus. Ils font partie de ce qui reste à porter AVANT que la double voie meure (cliquet
 * `stage/double-voie-ratchet.test.ts`, qui compte les consommateurs restants de la voie affine) :
 *  - champ de LUMIÈRE par case (`tileBrightness`) ;
 *  - opacité de PIÈCE / focus de salle (`roomOpacityOf`) ;
 *  - filtres de BROUILLARD, exploré vs inconnu (`fogFilterFor`, `FogLayer`).
 * Toute mesure de performance comparant les deux voies est donc à charge INÉGALE, et ne vaut pas
 * comparaison.
 *
 * Trois GROUPES distincts sous la même scène three : le MONDE (une géométrie, un matériau par groupe de
 * surface — remonté au seul changement de cuisson), les ACCENTS de sol (instanciés, remontés à la teinte)
 * et les BILLBOARDS (invalidés à la case LOGIQUE et à la signature de dessin des sujets, jamais au
 * glissement de marche : celui-ci ne touche que les matrices, dans la boucle).
 * Le canevas est posé SOUS le SVG du stage et sans événements de pointeur : les overlays et les voiles
 * restent au SVG, qui reçoit tous les événements (lot P2-7). Le hit-test de SPRITE, lui, ne peut plus
 * s'y lire — plus aucun jeton n'y porte de `data-cid` : cet écran INSCRIT son lanceur de rayon auprès
 * de `stage/spritePicker.ts`, la couture unique où le pointeur pose la question.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { freeYaw, type ActorCapsule, type Dims, type Rot } from '../../geometry/iso';
import { heightAt, type Scene } from '../../state/scene';
import { DIR8_DELTA, DIR8_ORDER, type Dir8 } from '../../state/dir8';
import { affineCamera, povCamera } from '../backends/webgl/cameras';
import { dir8Basis, fogCurveOf, povDepth } from '../pov/camera';
import { pxPerM } from '../backends/webgl/worldTris';
import {
  billboardTextureKey,
  billboardView,
  subjectQuad,
  type BillboardCamera,
} from '../backends/webgl/billboardMath';
import { clearBillboardTextures, getBillboardTexture, svgToTexture } from '../backends/webgl/svgTexture';
import { clearPeriodTextures } from '../backends/webgl/periodTexture';
import { clearFaceBakes } from '../backends/webgl/faceBake';
import { worldSurfaceMaterials } from '../backends/webgl/worldMaterials';
import {
  actorBillboards,
  applyCutawayMask,
  applyFogGamma,
  applyVisibilityTint,
  bakeWorldGeometry,
  collectBillboards,
  contactShadow,
  povBackground,
  povFog,
  stageClearColor,
  wantsContactShadow,
  type ActorPose,
  type KeepEl,
  type SceneBillboardEls,
  type TintAt,
  sceneHeightDeps,
  worldBakeDeps,
  worldShadowBox,
  type BakedWorld,
  type BillboardSubject,
} from '../backends/webgl/sceneMeshes';
import { memoByRefDeps } from '../../state/sceneMemo';
import {
  AUCUN_CHROME,
  DPR_PLAFOND,
  atlasFrames,
  atlasPxHeight,
  attachBodySilhouette,
  billboardDepthMaterial,
  billboardMaterial,
  boardProjectedPx,
  boardTrackId,
  frameIndexAt,
  palierAtlas,
  poseBoards,
  writeBoardFrames,
  type BakeAsk,
  type Board,
  type ChromeAt,
  type FrameCamera,
  type FramePick,
  type GlideAt,
} from './boardPose';
import {
  PRIORITE_RECHAUFFAGE,
  PRIORITE_VUE_COURANTE,
  atlasKey,
  bakeAtlas,
  enqueueBake,
  getCachedAtlas,
  setAtlasPins,
  type BakedAtlas,
} from '../backends/webgl/atlasBake';
import { animCtxOf, animNow, installAnimTracks, tracksRef } from '../fx/animTracks';
import {
  COLLAPSE_MS,
  clipTotalMs,
  planAmbientDef,
  planAttackDef,
  planDyingDef,
  planFlinchDef,
  planRestDef,
  planWalkDef,
  rigAmbientDef,
  rigAttackDef,
  rigDefenseDef,
  rigHitDef,
  rigIdleDef,
  rigWalkDef,
  type ClipDef,
  type RigClipDef,
  type RigSelectCtx,
} from '../rig/anim/actorAnimSelect';
import type { View } from '../rig/facing';
import { buildGroundAccentMeshes, maskGroundAccents, sceneGroundAccents, type SceneGroundAccent } from '../backends/webgl/groundAccents';
import {
  HIGHLIGHT_SLOTS,
  buildHighlightMesh,
  groupHighlights,
  slotCapacity,
  writeHighlightInstances,
  type HighlightSlot,
} from '../backends/webgl/highlightMeshes';
import type { HighlightEl } from '../builders/highlights';
import { NO_DYNAMIC_MARKS, type DynamicMarks } from '../builders/dynamicMarks';
import { DYN_MARK_SLOTS, buildDynamicMarkMesh, buildSilhouetteTwin } from '../backends/webgl/dynamicMarkMeshes';
import { poseDynamicMarks, type DynMarkPools } from './dynamicMarkPose';
import { NO_INTERACTION_HALOS, type InteractionHalos } from '../builders/interactHalos';
import { HALO_SLOTS, buildHaloMesh } from '../backends/webgl/interactHaloMeshes';
import { poseInteractHalos, type HaloPools } from './interactHaloPose';
import { ndcAt, pickNearestCid, type PickTarget } from '../backends/webgl/spriteRaycast';
import { setSpritePicker } from './spritePicker';
import { stage3dFramingFor, stageScreen, viewBoxScreen, type Stage3dFraming } from './stage3dCamera';
import { stageLightScalars, stageLights } from './stageLights';
import { viewPolicy } from './viewPolicy';
import { applyFlicker, applyPointLights, createPointLightPool, hasFlicker, pointLightWrites, POINT_LIGHT_BUDGET, type PointLightSlots } from './stagePointLights';
import type { LightSource } from '../../state/vision';
import { sceneBrume, scenePrecip } from '../catalog/ambiance';
import { isSheltered, shelterField, shelterSectionAt } from '../builders/roofs';
import { buildBrumeSheets, retainBrumeSheets, type BrumeSlot } from '../backends/webgl/weatherSheets';
import {
  buildPrecipMesh,
  precipBasis,
  retainWeatherField,
  stepWeatherField,
  writePrecipMatrices,
  type ClippedAt,
  type PrecipSlot,
  type ShelteredAt,
} from '../backends/webgl/weatherParticles';
import { withRenderRank } from '../backends/webgl/renderRanks';
import { buildTraceQuad, TRACE_LIFT_M } from '../backends/webgl/traceQuad';
import type { TraceTransform } from '../../state/traceCalibration';
import { signalerWebglRefusé } from './webglSupport';
import { cadrePercage, materiauProfondeurPerce, percerMateriau, trousPercage, PERCAGE_MAX_HEROS } from '../backends/webgl/percageLocal';
import { centrePercage, creerPercage, type ActeurPerce, type Percage } from './percage';
import type { Lid } from './architectureVisibility';

/** Convention de taille monde des billboards retenue pour le JEU (cf. `billboardMath`). */
export const CONVENTION = 'jeu' as const;

/** Pas de temps MAXIMAL (ms) servi au fondu des trous de découpe locale. Même borne que le semis de
 *  chute et que la boucle de lacet : un onglet revenu au premier plan reprend le fondu, il ne le
 *  téléporte pas d'un bout à l'autre. */
const PERCAGE_PAS_MAX_MS = 100;

/** Clé de verdict des frames SANS découpe locale (première personne, éditeur) : constante, donc le
 *  verdict ne s'y rejoue jamais, et la liste vide y ramène toutes les cibles à zéro. */
const PERCAGE_HORS_PLATEAU = 'percage:hors-plateau';

/** DESSINS DE GRÂCE d'un héros dont le quad manque à l'appel. Les billboards se démontent et se
 *  remontent à chaque commit React qui touche les boards, et des dessins tombent DANS cette fenêtre :
 *  mesuré sur La Diligence, un re-rendu produit 5 dessins dont 4 où `boardsRef` est vide. Sans grâce,
 *  ces 4 dessins sortent le héros de la clé, le verdict se rejoue à vide, la cible retombe à 0 et le
 *  fondu redescend aussitôt — le trou ne s'ouvre jamais. Le héros absent garde donc sa dernière
 *  position connue tant que l'hôte le DIT toujours perçable et que la fenêtre tient. */
const PERCAGE_GRACE_DESSINS = 8;

/** Aucune nappe — la liste vide de ces mêmes frames, allouée UNE fois. */
const AUCUNE_NAPPE: readonly Lid[] = [];

/** Ce que cet écran DEMANDE à son renderer, et rien de plus — la surface exacte de sa dépendance à
 *  three côté sortie. Un banc d'essai peut donc en fournir un SANS contexte WebGL : jsdom n'en a
 *  aucun, et la passe de dessin s'arrêterait à sa première garde sans rien montrer de la boucle. */
export interface StageRenderer {
  setPixelRatio(ratio: number): void;
  setClearColor(color: number, alpha: number): void;
  setSize(w: number, h: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
  shadowMap: { enabled: boolean; autoUpdate: boolean; needsUpdate: boolean; type: THREE.ShadowMapType };
  capabilities: { getMaxAnisotropy(): number };
}

/** FABRIQUE du renderer — REGISTRE mutable lu à l'appel, jamais un mock de module (la suite partage
 *  son graphe, `src/vi-mock-isolate-guard.test.ts`). `null` = le renderer de three, celui du jeu. */
let fabriqueRenderer: ((canvas: HTMLCanvasElement) => StageRenderer) | null = null;

/** Pose (ou retire, avec `null`) la fabrique de renderer de cet écran. */
export function setStageRendererFactory(fabrique: ((canvas: HTMLCanvasElement) => StageRenderer) | null): void {
  fabriqueRenderer = fabrique;
}

/**
 * CADRE d'une frame : ce dont la caméra se dérive, et RIEN de plus. Une UNION, parce que les deux
 * regards n'ont aucune entrée commune — l'affine se cadre par la transformation d'écran du stage
 * (`stage3dFraming` → `affineCamera`), le POV par la pose du groupe (`povCamera`). Ce que le mode
 * n'utilise pas ne lui est donc pas fournissable : la vue première personne n'a ni cran, ni zoom, ni
 * translation de viewBox à fabriquer pour satisfaire une signature.
 *
 * Le POV N'ENTRE PAS dans `ProjKind`/`Dims` (#1176, P3-1a) : la projection affine, le picking et les
 * trois modules purs qui en dérivent (`geometry/iso`, `stage/projection`, `stage3dCamera`) resteraient
 * à couvrir un cas qu'aucun d'eux ne sait exprimer.
 */
export type StageFrame =
  /** Regard de PLATEAU (iso losange, edge-on, dessus) : le cran/lacet, la translation caméra et le
   *  zoom du stage. Le mode discrimine une VUE, pas un backend. */
  | { mode: 'plateau'; dims: Dims; cam: { x: number; y: number }; zoom: number }
  /**
   * Regard de PLATEAU cadré par un VIEWBOX MOBILE (#1176, P3-3) — la convention de l'ÉDITEUR de scènes
   * (`ui/editor/EditorCanvas.tsx`) : aucune caméra de groupe, le viewBox rendu EST le cadrage, et
   * l'échelle se prend sur le RENDU (`viewBoxScreen`, cadre en pixels mesuré) parce que la CSS
   * rétrécit l'élément. Tout le reste de cet écran l'ignore : c'est le même regard de plateau.
   */
  | { mode: 'viewbox'; dims: Dims; viewBox: { x: number; y: number; w: number; h: number } }
  /**
   * Regard PREMIÈRE PERSONNE : la case du groupe, son cap, et le milieu (dont dépend la portée).
   * `cid` = le sujet dont le GLISSEMENT de marche déplace l'œil (`anim.glide`) : la caméra suit la
   * position CONTINUE du meneur, comme la caméra volumique affine suit `anim.cam()`. ARBITRAGE
   * D'INGÉNIERIE (#1176, P3-1a, révisable au goût final) : le pas-à-pas du POV SVG était une forme
   * du PEINTRE (une projection recalculée par pas), pas une intention de jeu — `makeCamera` accepte
   * une position continue, et les billboards du monde glissent déjà.
   * Le LACET, lui, reste SEC : `facing` est un `Dir8`, donc l'œil pivote de 45° d'un coup là où la
   * position, elle, glisse. Statu quo du POV SVG — même arbitrage d'ingénierie, révisable au goût.
   */
  | { mode: 'pov'; partyPos: { x: number; y: number; z?: number }; facing: Dir8; indoor: boolean; cid: string | null };

/**
 * ENTRÉES du verdict de DÉCOUPE LOCALE (#1176, M3), fournies par l'hôte de plateau. Le `cid` est ce
 * qui relie un héros à son BILLBOARD : le centre du trou se prend sur le quad POSÉ de la frame — donc
 * sur la position qui GLISSE avec la marche —, jamais sur la case logique.
 *
 * INDEX DES TROUS : les quatre emplacements d'uniforme sont remplis dans l'ordre des héros AYANT un
 * quad monté. Un quad qui naît ou qui meurt (rasterisation, jeton écarté par le builder) DÉCALE donc
 * les emplacements suivants, et deux trous peuvent échanger le leur le temps d'un fondu.
 */
export interface PercageEntrees {
  /** Clé ÉVÉNEMENTIELLE du verdict (`clePercage`) : pas franchi, cran/vue, étage. */
  cle: string;
  /** Nappes projetées de la carte — les MÊMES que consomme `lidCutaway`. */
  lids: readonly Lid[];
  /** Alliés candidats au trou, à leur case VISUELLE (arrondie), dans un ordre stable. */
  heros: readonly { cid: string; capsule: ActorCapsule; z: number }[];
}

export interface GameStage3DProps {
  scene: Scene;
  /** Mètres par tuile. */
  mpt: number;
  /** D'où la caméra de la frame se dérive (cf. `StageFrame`). */
  frame: StageFrame;
  /** Teinte de visibilité par case. */
  tintAt: TintAt;
  /** Verdict de dégagement d'architecture (canal GÉOMÉTRIE). */
  keepEl: KeepEl;
  /** La nappe de cette SECTION de toiture est-elle DESSINÉE dans la frame ? Le même verdict de vue
   *  que `keepEl` rend sur les éléments de toit (`cutawayForSection`, `seenSections` compris), rendu
   *  ici par la clé de section — c'est ce que la pluie doit savoir pour ne pas s'arrêter en l'air
   *  au-dessus d'un toit qu'on ne peint plus (#1247). Absent = tout se dessine (POV, QC). */
  nappeVue?: (sectionId: string) => boolean;
  /** Éléments de scène à billboarder — la sortie des BUILDERS du stage, donc les mêmes filtres que la
   *  voie affine (embuscade, enrôlé, couverture, étage, hors-vue). Cet écran ne les recalcule PAS. */
  els: SceneBillboardEls;
  /** Acteurs à leur case LOGIQUE — le glissement de marche passe par `anim`, pas par cette liste. */
  actors: readonly ActorPose[];
  /** Horloge de jeu (minutes) — SEULE entrée de la course du soleil, avec le nord de la scène. */
  gameTime: number;
  /** Mise en scène de lumière (`state.lightLevel`, 0..1) : prime sur le palier authoré de la scène,
   *  exactement comme pour les voiles du SVG. */
  lightLevel: number | null | undefined;
  /** Sources de lumière PONCTUELLES de la scène (posées + portées) — la MÊME liste que le champ
   *  mécanique de vision consomme (`state/visionState.ts` `sceneLightSources`) : cet écran ne les
   *  recollecte pas, il en monte les flaques (`stage/stagePointLights.ts`). */
  lights: readonly LightSource[];
  /** MARQUES DE CASES du combat (#1176, P3-0c) — la sortie du builder PUR `builders/highlights`, la
   *  même que la voie affine projette en losanges. Cet écran ne les recalcule pas : il les pose à plat
   *  dans le monde. */
  highlights?: readonly HighlightEl[];
  /** MARQUES DYNAMIQUES (#1176, P3-0d) — lien d'engagement, contour de l'actif, repère du groupe : la
   *  MÊME dérivation pure que la voie affine (`builders/dynamicMarks`), en cases LOGIQUES. Leur
   *  position se prend à la FRAME, sur le glissement de `anim` — jamais à un rendu React. */
  dynMarks?: DynamicMarks;
  /** HALOS D'INTERACTION (#1176, P3-0g) — affordance de fouille d'un décor, halo de survol d'un PNJ
   *  interlocuteur : la MÊME dérivation pure que la voie affine (`builders/interactHalos`). Leurs
   *  PULSATIONS sont des fonctions de la frame (`stage/interactHaloPose`), là où la voie affine les
   *  laisse à ses keyframes CSS. Absents = aucun halo, et pas une frame de plus. */
  halos?: InteractionHalos;
  /** ALLURE des jetons (#1176, P3-0f) — fantôme hors Ligne de Vue, corps hors d'action, cible
   *  survolée : la même dérivation pure que la voie affine (`builders/tokenChrome`), demandée à la
   *  FRAME et posée sur le matériau des quads déjà montés. Absente = aucun jeton ne se distingue. */
  chromeAt?: ChromeAt;
  /** Cadençage de la MARCHE, quand le stage en offre un (lot P2-4) : sans lui, cet écran ne bouge
   *  qu'aux rendus du stage. */
  anim?: StageWalkAnim;
  /** PLAQUE DE DÉCALQUAGE de l'ÉDITEUR (#1176, P3-3, vague B) — la planche calée sous la carte
   *  (#830), montée en QUAD MONDE : `below` sous la matière (le sol la couvre là où il en écrit),
   *  `above` par-dessus tout (rang chrome, sans test de profondeur). Absente en jeu. */
  decalque?: {
    imageDataUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    opacity: number;
    position: 'above' | 'below';
    transform: TraceTransform;
  } | null;
  /** Cet écran inscrit-il son lanceur de rayon auprès de la couture de picking de sprite
   *  (`stage/spritePicker.ts`) ? Défaut OUI, la vue de plateau du jeu. L'ÉDITEUR (#1176, P3-3) dit
   *  NON : son picking est PUREMENT GÉOMÉTRIQUE (`screenToTileAtZ` sur le SVG d'authoring), et un
   *  picker inscrit ici écraserait celui du jeu — le registre est un singleton. */
  spritePicking?: boolean;
  /** DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) — les entrées du verdict, telles que l'hôte de plateau
   *  les tient déjà pour le dégagement (`IsoStage` : nappes projetées + capsules d'alliés). Cet écran
   *  n'en dérive AUCUNE : deux jeux de nappes/capsules divergeraient de la loi de `lidCutaway`, et le
   *  trou s'ouvrirait là où rien n'est caché. Absent (POV, éditeur) = aucun trou. */
  percage?: PercageEntrees | null;
}

/**
 * MARCHE lue par la BOUCLE DE RENDU (#1176, P2-4). Le stage reste la seule source d'intention : il
 * décide de la courbe de glissement et du cadrage, cet écran ne fait que les redemander à SA cadence.
 * Sans cet objet, rien ne bouge entre deux rendus React — le contrat d'avant le lot.
 */
export interface StageWalkAnim {
  /** Abonne une callback au battement de la marche (une passe par frame tant qu'un glissement dure). */
  subscribe: (onFrame: () => void) => () => void;
  /** Décalage MONDE (mètres) du sujet `cid` à l'instant de l'appel — `null` s'il ne marche pas. */
  glide: (cid: string) => { dx: number; dy: number; dz: number } | null;
  /** Translation caméra à l'instant de l'appel (mêmes unités que `cam`). */
  cam: () => { x: number; y: number };
}

/** Rien ne glisse : la pose d'une frame hors marche (la boucle ne demande alors que l'orientation). */
const AUCUN_GLISSEMENT: GlideAt = () => null;

/** RÉTENTIONS PAR CONTENU des passes lourdes de cet écran (#1176, P3-3) — le patron canonique du
 *  dépôt (`state/sceneMemo.ts`), un slot par INSTANCE de stage (la clé est un jeton de composant) et
 *  par passe. Les deps sont les READ-SETS exportés par le module qui fait le travail, jamais une liste
 *  devinée ici : `worldBakeDeps` pour la cuisson et les accents, `sceneHeightDeps` pour les
 *  billboards. */
const bakeRetenu = memoByRefDeps<object, BakedWorld>();
const accentsRetenus = memoByRefDeps<object, SceneGroundAccent[]>();
const decorRetenu = memoByRefDeps<object, BillboardSubject[]>();
const acteursRetenus = memoByRefDeps<object, BillboardSubject[]>();

/** Vide un groupe et libère ce qu'il portait — un groupe se reconstruit ENTIER, jamais par différence.
 *  La géométrie marquée `emprunte` appartient à un autre (le bake de `bakeWorldGeometry`, le corps
 *  d'un jumeau de silhouette) : elle survit au groupe. La descente est RÉCURSIVE — ce qu'un objet
 *  porte en enfant (le jumeau de silhouette d'un quad, #1297) a son propre matériau à libérer. */
function viderGroupe(groupe: THREE.Group): void {
  for (const enfant of [...groupe.children]) {
    groupe.remove(enfant);
    enfant.traverse((o) => {
      const porteur = o as THREE.Mesh;
      if (porteur.material) {
        const mats = Array.isArray(porteur.material) ? porteur.material : [porteur.material];
        for (const m of mats) m.dispose();
      }
      if (porteur.geometry && !porteur.userData.emprunte) porteur.geometry.dispose();
    });
  }
}

/** CRAN d'ART d'une vue. La CAMÉRA suit le lacet continu (`stage3dFraming` lit `Dims.yawDeg`), mais
 *  l'art des billboards est DISCRET — l'atlas de décor n'existe qu'aux quarts de tour, et une identité
 *  de texture qui suivrait le lacet réel recuirait toute la planche à chaque frame de rotation.
 *  Le lacet se PLANCHÉRISE, il ne s'arrondit pas : l'edge-on est le losange à `+45` (`geometry/iso.ts`),
 *  donc les huit vues de production tombent aux lacets `r·90` et `r·90+45` — un arrondi au plus proche
 *  donnerait `r+1` aux quatre vues de face, et l'atlas y peindrait le cran voisin. PUR. */
export function artRot(dims: Dims): Rot {
  return ((Math.floor((freeYaw(dims) ?? (dims.rot ?? 0) * 90) / 90) % 4 + 4) % 4) as Rot;
}

/** IDENTITÉ de cadrage d'une carte : tout ce dont une géométrie ancrée à l'ÉCRAN dépend (taille de
 *  grille, cran, edge-on, lacet libre, projection). Ce qu'elle sert : ne re-bâtir la plaque de
 *  décalquage qu'au changement de VUE, jamais à chaque rendu de l'éditeur. PUR. */
function dimsKey(dims: Dims): string {
  return `${dims.w}x${dims.h}|${dims.rot ?? 0}|${dims.edge ? 'e' : ''}|${dims.yawDeg ?? ''}|${dims.view ?? 'iso'}`;
}

/** LACET (degrés, convention de `freeYaw`/`artRot`) du regard PREMIÈRE PERSONNE de cap `facing`.
 *  La caméra affine du cran `r` regarde la diagonale `DIR8_ORDER[(7 + 2r) % 8]` : à ce cap, `povView`
 *  rend exactement ce que rend `project(·, r)` sur les huit orientations (parité mesurée,
 *  `billboards-pov.test.tsx`). Les huit caps se répartissent donc tous les 45°, le cap N à 45°. PUR. */
export function povYawDeg(facing: Dir8): number {
  return ((DIR8_ORDER.indexOf(facing) + 1) * 45) % 360;
}

/** CRAN d'ART d'un regard première personne (#1176, P3-1b) : le lacet de son cap, PLANCHÉRISÉ par la
 *  MÊME loi qu'`artRot` — l'atlas de décor n'existe qu'aux quarts de tour (`propSvg(ref, dir, camRot)`),
 *  et les quatre caps CARDINAUX tombent entre deux crans. Sans lui, les props d'une vue première
 *  personne gardent le cran de la dernière vue de plateau. PUR. */
export function povArtRot(facing: Dir8): Rot {
  return (Math.floor(povYawDeg(facing) / 90) % 4) as Rot;
}

// ————————————————————————————————————————————————————————————————
// FLIPBOOK des sujets à UN corps (#1176, L3/L4) — ce que l'écran CUIT, et ce qu'il CHOISIT par image
// ————————————————————————————————————————————————————————————————
//
// L'écran ne lit AUCUN store et ne connaît AUCUN `BodyPlan` : la voie de corps, l'état au sol, le bond
// et l'ambiance authorée voyagent avec le sujet (`BillboardSubject.anim`), l'arme tenue lui vient du
// registre de pistes (`fx/animTracks.animCtxOf`), et le DESSIN d'une frame reste derrière
// `BillboardSubject.frameSvg`. Le reste (planche, cellule, palier) se dérive des boards et de la caméra.
//
// DEUX populations jouent : les COMBATTANTS (`cid` — marche, gestes de combat, effondrement) et les
// FIGURANTS à ambiance authorée (`eid`, `SceneEntity.anim` — une boucle, sur l'horloge du registre).
// Le DÉCOR n'entre pas : son sujet n'a ni identité de piste ni couture de frame.

/** Un sujet à flipbook : de quoi CUIRE ses planches et CHOISIR sa cellule. */
interface FlipbookSujet {
  sub: BillboardSubject;
  /** Vue/miroir du MONTAGE — le repli quand la vue du segment de marche n'est pas cuite. */
  view: View;
  mirror: boolean;
  /** Palier de cuisson du montage (px, rapport de pixels du rendu compris). */
  pxHeight: number;
  /** Voie de corps : elle décide du VOCABULAIRE de gestes (clips bipèdes / modes de gabarit). */
  voie: 'rig' | 'plan';
  rig: RigSelectCtx;
  /** Marche par BOND d'un gabarit (`SubjectAnim.leap`). */
  leap?: boolean;
  /** Geste d'AMBIANCE authoré du figurant, quand il en joue un — il n'a alors ni marche ni piste. */
  ambient?: ClipDef;
  /** L'acteur est-il connu du résolveur du registre (donc ENRÔLÉ dans un combat) ? */
  enrolé: boolean;
  /** ORIGINE DE L'EFFONDREMENT sur l'horloge du registre : l'instant où l'état au sol est APPARU pour
   *  cet acteur (`chutesRef`, par id, survit aux rebuilds). Le board se reconstruit à chaque pas commité
   *  et à chaque quart de tour : pris au montage du board, un quart de tour rejouerait la chute. */
  chute: number;
}

/** Une planche à cuire : sa clé et la recette de ses frames. */
interface Recette {
  key: string;
  s: FlipbookSujet;
  def: ClipDef;
  view: View;
  mirror: boolean;
  pxHeight: number;
  frames: number;
  /** Effondrement d'un BIPÈDE : l'état au sol visé (le geste n'est pas un clip, c'est une
   *  interpolation). Un gabarit porte le sien dans son def (`planDyingDef`). */
  ground?: 'corpse' | 'prone';
}

/** Nombre de frames de l'effondrement — même cadence que les clips, sur `COLLAPSE_MS`. */
const FRAMES_EFFONDREMENT = atlasFrames({ voie: 'plan', key: 'rig:collapse', kind: 'dying', durationMs: COLLAPSE_MS });

/** CLÉ de la planche d'un geste — la LECTURE d'une image : elle répond « cette planche est-elle
 *  servie ? » sans rien inscrire ni construire de recette. La clé s'y compose une seule fois, et de la
 *  MÊME façon pour les trois usages (lecture, cuisson, choix d'image) — deux compositions divergentes
 *  ne se rateraient qu'au cache. */
function clePlanche(s: FlipbookSujet, def: ClipDef, view: View, mirror: boolean, pxHeight: number, ground?: 'corpse' | 'prone'): { key: string; frames: number } {
  const frames = ground ? FRAMES_EFFONDREMENT : atlasFrames(def);
  const parts = { signature: s.sub.identity, clip: def.key, view, mirror, pxHeight, frames };
  return { key: ground ? atlasKey({ ...parts, ground }) : atlasKey(parts), frames };
}

/** Recette d'une planche : ce qu'il faut pour la CUIRE. Une image n'en construit que pour la vue
 *  qu'elle retient — la vue candidate, elle, ne passe que par la clé. */
function recette(s: FlipbookSujet, def: ClipDef, view: View, mirror: boolean, pxHeight: number, ground?: 'corpse' | 'prone'): Recette {
  const { key, frames } = clePlanche(s, def, view, mirror, pxHeight, ground);
  return { key, s, def, view, mirror, pxHeight, frames, ground };
}

/** Durée JOUÉE d'une recette : celle de l'effondrement quand elle en est un, sinon celle du geste. */
function dureeDeRecette(r: Recette): number {
  return r.ground ? COLLAPSE_MS : clipTotalMs(r.def);
}

/** Cuisson d'une planche par la file cadencée du cuiseur — mémoïsée sur sa clé. Le DESSIN d'une frame
 *  appartient au SUJET (`frameSvg`) : ni la pose, ni la prise d'arme, ni le gabarit n'entrent ici. */
function cuire(r: Recette, priorité: number): Promise<BakedAtlas> {
  return enqueueBake(
    r.key,
    (p) => bakeAtlas(
      (k) => r.s.sub.frameSvg!(r.view, r.mirror, r.def, k, r.frames, r.ground ? { ground: r.ground } : undefined),
      r.s.sub.box,
      r.frames,
      r.pxHeight,
      { priority: p },
    ),
    priorité,
  );
}

/** Les trois vues d'un corps, et le profil MIROIR — le réchauffage d'un quart de tour. */
const VUES_REGARD: readonly { view: View; mirror: boolean }[] = [
  { view: 'front', mirror: false },
  { view: 'back', mirror: false },
  { view: 'profile', mirror: false },
  { view: 'profile', mirror: true },
];

/** Le geste d'ambiance d'un acteur au repos — un par VOIE de corps (respiration du bipède, idle du
 *  gabarit : battement d'ailes, ondulation, dodelinement). */
const REPOS = rigIdleDef();
const REPOS_PLAN = planRestDef();

/** Caméra de billboard du regard courant — la MÊME dérivation qu'au montage des quads : en première
 *  personne le CAP du meneur, sur la vue de plateau le cran d'art. */
function bbCameraDe(povFacing: Dir8 | null, camRot: Rot): BillboardCamera {
  return povFacing ? { kind: 'perspective', ...dir8Basis(povFacing) } : { kind: 'ortho', yawDeg: camRot * 90 };
}

/** Orientation MONDE la plus proche d'un déplacement (dx = est, dz = sud, repère de `walkGlideM`) —
 *  `null` si le pas est nul. C'est le SEGMENT que le marcheur suit à cette image, jamais son cap
 *  d'authoring : un chemin qui tourne changerait sinon de vue seulement à l'arrivée. */
function dir8DuSegment(dx: number, dz: number): Dir8 | null {
  const n = Math.hypot(dx, dz);
  if (n < 1e-6) return null;
  let best: Dir8 | null = null;
  let score = -Infinity;
  for (const d of DIR8_ORDER) {
    const delta = DIR8_DELTA[d];
    const s = (delta.gx * dx + delta.gy * dz) / n;
    if (s > score) { score = s; best = d; }
  }
  return best;
}

export function GameStage3D({ scene, mpt, frame, tintAt, keepEl, nappeVue, els, actors, gameTime, lightLevel, lights, highlights, dynMarks, halos, chromeAt, anim, decalque, spritePicking = true, percage }: GameStage3DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const boardsRef = useRef<Board[]>([]);
  // FLIPBOOK (#1176, L3) — l'état que la boucle d'image lit et écrit, hors de tout rendu React.
  /** Les acteurs à flipbook montés, par `cid` — écrit au montage des quads. */
  const flipRef = useRef(new Map<string, FlipbookSujet>());
  /** Palier de cuisson COURANT par `cid` : il monte quand le quad grossit, redescend sous hystérésis. */
  const paliersRef = useRef(new Map<string, number>());
  /** ENTRÉE AU SOL par acteur : l'instant où son état au sol est apparu. Cette réf SURVIT au rebuild des
   *  boards (c'est tout son office) et se purge des acteurs qui se relèvent ou quittent la scène. */
  const chutesRef = useRef(new Map<string, number>());
  /** Glissement de l'image PRÉCÉDENTE : sa dérivée est la direction du segment de marche en cours. */
  const glissePrecRef = useRef(new Map<string, { dx: number; dy: number; dz: number }>());
  /** Recettes des planches réclamées par une image — ce que la demande différée retrouve. */
  const recettesRef = useRef(new Map<string, Recette>());
  /** Demandes de cuisson déjà postées : une image n'en repose jamais une seconde. */
  const demandéesRef = useRef(new Set<string>());
  /** Clés à ÉPINGLER (planches des boards montés) — jamais évincées tant qu'elles sont à l'écran. */
  const épinglesRef = useRef(new Map<string, string[]>());
  const cameraRef = useRef<THREE.Camera | null>(null);
  /** PILOTE de la découpe locale (#1176, M3) — un par écran monté, comme sa scène three. Il tient la
   *  clé du dernier verdict et le fondu des rayons ; les quatre trous qu'il écrit sont, eux, partagés
   *  par tous les matériaux percés du module. La fonction qu'il reçoit est SA demande de frame (le
   *  fondu n'a pas d'horloge à lui) : elle CÈDE le pas comme les boucles d'averse et de flamme — une
   *  image déjà rendue par l'une d'elles ne se redessine pas. */
  const percageRef = useRef<Percage | null>(null);
  if (!percageRef.current) {
    percageRef.current = creerPercage(() => {
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
    });
  }
  useEffect(() => () => percageRef.current?.arreter(), []);
  /** Acteurs du verdict, RÉUTILISÉS d'une frame à l'autre : la passe n'alloue ni tableau ni vecteur. */
  const acteursPercésRef = useRef<ActeurPerce[]>([]);
  /** DERNIÈRE POSITION MONDE connue d'un héros perçable, et le nombre de dessins consécutifs où son
   *  quad a manqué à l'appel. Cf. `PERCAGE_GRACE_DESSINS`. */
  const memoirePercéeRef = useRef(new Map<string, { monde: THREE.Vector3; absences: number }>());
  const pov = frame.mode === 'pov';
  // STYLE DE CE REGARD (#1176, P3-5, `viewPolicy`) : ce que la vue choisit de MONTRER — les nappes de
  // brume et le soleil ci-dessous en descendent. La GÉOMÉTRIE de la frame (cadrage, cran d'art,
  // projection) ne passe pas par là : elle se dérive de `frame` comme avant.
  const politique = viewPolicy(frame.mode === 'pov' ? { pov: true } : { view: frame.dims.view });
  // CAP du regard première personne — 8 états DISCRETS, et la SEULE entrée d'art de cette vue : la vue
  // d'entité s'y branche (`billboardView` perspective), et le cran de l'atlas de décor s'en dérive.
  // Les deux sortent du MÊME examen du cadre : le cap est la source du cran, pas un second calcul.
  const { povFacing, camRot } = frame.mode === 'pov'
    ? { povFacing: frame.facing, camRot: povArtRot(frame.facing) }
    : { povFacing: null, camRot: artRot(frame.dims) };
  // MILIEU de la première personne (`null` = vue de plateau) : la SEULE entrée de la brume et du fond.
  // La portée de rendu s'en dérive déjà (`povDepth`) — même donnée, même verdict d'intérieur.
  const povIndoor = frame.mode === 'pov' ? frame.indoor : null;
  // GAMMA de la courbe de brume du milieu (`AMBIANCE.pov.depth`), posé au shader dans la frame.
  const gammaBrume = povIndoor === null ? null : fogCurveOf(povIndoor).gamma;
  // BRUME authorée de la scène (#1247) — même porte que le semis (`sceneWeatherFx` : une météo
  // authorée, jamais en intérieur). Elle a DEUX expressions selon le regard, jamais les deux à la
  // fois : des NAPPES dans le volume sur la vue de plateau, le resserrement de la brume de distance
  // en première personne.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const brume = useMemo(() => sceneBrume(scene), [scene.weather, scene.ambiance]);
  // La brume ne MODULE le POV que DEHORS : entré dans un bâtiment (verdict par FRAME, `povIndoor`), on
  // bascule sur la courbe intérieure et la tempête cesse de déteindre dans la taverne.
  const brumePov = povIndoor === false ? brume : null;
  // NAPPES réellement montées — la trace du canevas les compte (`data-brume`) : une carte entièrement
  // coiffée n'en reçoit aucune, quelle que soit la donnée.
  const [nappesMontées, setNappesMontées] = useState(0);
  // NAPPES AU MONDE (verdict `nappesMonde` de la politique de vue) : la vue de plateau, sauf le
  // DESSUS. À 90° de tangage (`affineScales`, pitch mesuré 25,2° en losange et de face contre 90,0°
  // au-dessus), les nappes se projettent l'une sur l'autre : l'empilement dégénère en voile plein
  // écran, à rebours de la lisibilité de plateau que demande cette vue. La première personne n'en
  // monte aucune non plus — elle a la brume de distance. C'est l'ÉCRÊTAGE météo de #1247, une raison
  // à lui : il coïncide avec le découvert des toits sur cette vue, il n'en descend pas.
  const nappesAuMonde = politique.nappesMonde ? brume : null;
  // Le PLAN de nappes SURVIT aux mutations de scène, exactement comme le semis : il est retenu sur ce
  // qui le DÉTERMINE (`retainBrumeSheets`), jamais sur la référence de l'objet scène — un pas de
  // combattant en produit une par frame, et re-bâtir là-dessus recalculait tout le couvert (6,9 ms
  // mesurés sur 60×60 à 81 masses) pour une géométrie identique.
  const planRetenu = useRef<BrumeSlot | null>(null);
  planRetenu.current = nappesAuMonde ? retainBrumeSheets(planRetenu.current, scene, mpt, nappesAuMonde) : null;
  const planNappes = planRetenu.current?.plan ?? null;

  const three = useRef<THREE.Scene>();
  const monde = useRef<THREE.Group>();
  const touffes = useRef<THREE.Group>();
  const panneaux = useRef<THREE.Group>();
  const lampes = useRef<THREE.Group>();
  const flaques = useRef<THREE.Group>();
  const intemperies = useRef<THREE.Group>();
  const brumes = useRef<THREE.Group>();
  const marques = useRef<THREE.Group>();
  const marquesDyn = useRef<THREE.Group>();
  const halosGroupe = useRef<THREE.Group>();
  const decalques = useRef<THREE.Group>();
  if (!three.current) {
    three.current = new THREE.Scene();
    monde.current = new THREE.Group();
    touffes.current = new THREE.Group();
    panneaux.current = new THREE.Group();
    lampes.current = new THREE.Group();
    // Groupe à part de `lampes` : celui-là se VIDE et se reconstruit (l'ambiante et le soleil suivent
    // l'heure), le pool de flaques ne se monte QU'UNE fois — un vidage partagé le démonterait avec lui,
    // et ferait varier le compte de lampes ponctuelles que le pool existe justement pour figer.
    flaques.current = new THREE.Group();
    intemperies.current = new THREE.Group();
    // Groupe FRÈRE des NAPPES DE BRUME (#1247) : à part du semis parce qu'il vit sur d'autres entrées
    // — le semis se remonte au CHAMP (météo), les nappes à la scène, à la météo et au REGARD (aucune
    // en vue du dessus). Un groupe partagé démonterait l'un en remontant l'autre.
    brumes.current = new THREE.Group();
    // Groupe des MARQUES (P3-0c) : monté une fois, jamais vidé par événement de combat — ses pools ne
    // se redimensionnent qu'au PALIER de capacité, leur contenu se réécrit en place.
    marques.current = new THREE.Group();
    // Groupe FRÈRE des marques DYNAMIQUES (P3-0d) : à part parce que ses pools ne dépendent d'AUCUNE
    // capacité d'état — ils sont montés une fois à capacité fixe, et réécrits à la FRAME (jamais à un
    // rendu React, comme les marques de case du groupe voisin).
    marquesDyn.current = new THREE.Group();
    // Groupe des HALOS D'INTERACTION (P3-0g) : même politique que le précédent — capacité fixe, contenu
    // réécrit à la frame. À part de lui parce qu'il vit hors du combat, et que ses pools PULSENT (leur
    // opacité de matériau change à chaque frame, cf. `stage/interactHaloPose`).
    halosGroupe.current = new THREE.Group();
    // Groupe de la PLAQUE DE DÉCALQUAGE (éditeur, P3-3) : à part de tout le reste — elle ne vit ni de
    // la scène, ni de la lumière, ni du combat, mais du calage de l'auteur et du cran de vue.
    decalques.current = new THREE.Group();
    three.current.add(monde.current, touffes.current, panneaux.current, lampes.current, flaques.current, intemperies.current, brumes.current, marques.current, marquesDyn.current, halosGroupe.current, decalques.current);
  }

  // Le cache de textures est GLOBAL au module : changer de SCÈNE rend ses entrées mortes (les clés
  // portent l'identité des sujets de l'ancienne carte). Même vidange que les planches QC — sur
  // l'IDENTITÉ de la scène, pas sa référence : un hôte qui la reforge à chaque geste (l'éditeur, une
  // par `pointermove`) vidait sinon toutes les textures du décor à chaque coup de pinceau.
  useEffect(() => () => { clearBillboardTextures(); clearPeriodTextures(); clearFaceBakes(); }, [scene.id]);

  // ── CUISSON : la passe LOURDE (100 à 634 ms selon la carte), RETENUE PAR CONTENU — sur le read-set
  // réel de `worldFaces` (`worldBakeDeps`, `backends/webgl/sceneMeshes.ts`), jamais sur la référence
  // de l'objet scène. En jeu la référence est stable ; à l'ÉDITION elle se reforge au tick, et une
  // cuisson par tick gelait l'écran. Le patron est celui du dépôt (`memoByRefDeps`, semis P2-6,
  // nappes P3-2), keyé sur un jeton d'INSTANCE : deux stages montés côte à côte gardent leur bake
  // (contrat de propriété de `BakedWorld` — une teinte écrase l'autre sur un bake partagé).
  const jeton = useRef({}).current;
  const bakeDeps = worldBakeDeps(scene, mpt);
  const baked = bakeRetenu(jeton, bakeDeps, () => bakeWorldGeometry(scene, mpt));
  const geometry = baked.geometry;
  useEffect(() => () => baked.geometry.dispose(), [baked]);
  // CUISSONS RÉELLEMENT PAYÉES depuis le montage — la trace `data-bake` du canevas (un canevas n'a pas
  // d'arbre à interroger) : c'est par elle que la rétention se mesure à l'écran comme au banc.
  const cuissons = useRef(0);
  const dernierBake = useRef<BakedWorld | null>(null);
  if (dernierBake.current !== baked) {
    dernierBake.current = baked;
    cuissons.current += 1;
  }
  // Les accents de sol sont semés sur les MÊMES faces : même read-set, donc mêmes deps.
  const accents = accentsRetenus(jeton, bakeDeps, () => sceneGroundAccents(scene, mpt));
  // ── DÉGAGEMENT : compactage de l'index du monde cuit (aucun sommet touché, aucun matériau refait).
  useEffect(() => { applyCutawayMask(baked, keepEl); }, [baked, keepEl]);
  // ── TEINTE : elle vit plus bas, avec la lumière — son read-set contient le fondu du soleil (#1300).
  // Les touffes d'une nappe dégagée partent avec elle — MÊME loi, appliquée sur le MÊME semis cuit.
  const accentsVus = useMemo(() => maskGroundAccents(accents, keepEl), [accents, keepEl]);
  // BILLBOARDS : leur seule lecture de scène est `heightAt` (`sceneHeightDeps`) — tout le reste leur
  // vient de leurs éléments. Retenus dessus, un pas de combattant (jeu) comme un déplacement d'entité
  // ou de zone (édition) ne re-rasterise plus la planche entière.
  const hauteurDeps = sceneHeightDeps(scene);
  const decor = decorRetenu(jeton, [...hauteurDeps, mpt, tintAt, els], () => collectBillboards(scene, mpt, tintAt, els));
  const acteurs = acteursRetenus(jeton, [...hauteurDeps, actors, mpt, tintAt], () => actorBillboards(actors, scene, mpt, tintAt));
  const subjects = useMemo(() => [...decor, ...acteurs], [decor, acteurs]);
  // ── MARQUES DE CASES (P3-0c) : les éléments du builder, rangés par SLOT de montage. La CAPACITÉ des
  // pools ne suit que les paliers (`slotCapacity`) — un anneau de cible qui apparaît ne redimensionne
  // rien, il s'écrit dans le pool déjà là.
  const marquesGroupées = useMemo(() => groupHighlights(highlights ?? []), [highlights]);
  const capacités = useMemo(
    () => HIGHLIGHT_SLOTS.map((s) => slotCapacity(marquesGroupées.get(s)?.length ?? 0)),
    [marquesGroupées],
  );
  const clésCapacités = capacités.join(',');
  const poolsMarques = useRef(new Map<HighlightSlot, THREE.InstancedMesh>());
  // ── MARQUES DYNAMIQUES (P3-0d) : trois pools à capacité FIXE, montés une fois (l'effet plus bas).
  // Leur contenu ne se déduit d'aucun état React — il se réécrit à la frame, dans `dessiner`.
  const poolsDyn = useRef<DynMarkPools>({});
  // ── HALOS D'INTERACTION (P3-0g) : même politique de pool, et un contenu qui BAT (l'opacité de leurs
  // matériaux est une fonction de la frame — la conversion des keyframes CSS vit dans la passe de pose).
  const poolsHalos = useRef<HaloPools>({});
  // Le SOL d'une case, la même convention que le builder de marques (0 au rez, la surface réelle en
  // hauteur) : c'est la hauteur d'où le glissement vertical de la marche se compte.
  const solM = (x: number, y: number, z: number) => (z ? heightAt(scene, Math.round(x), Math.round(y), z) : 0);

  // ── LUMIÈRE (P2-5) : la DÉCISION est prise en scalaires purs (`stageLights.ts`), l'écran n'en monte
  // que les conséquences. `lit` = un soleil éclaire RÉELLEMENT (il est levé, au-dessus du fondu, et le
  // REGARD en veut un) : ombres portées branchées, disque de contact rendu inutile. La même passe
  // rejoue au montage des lampes.
  // Dépendances = le read-set de `stageLightScalars` (`Pick<Scene, 'ambiance'|'northDeg'|
  // 'ambientLight'|'weather'>`) plus le verdict de vue, jamais la référence de scène : c'est l'IDENTITÉ
  // de ce résultat qui remonte les lampes plus bas, et une référence par tick d'édition les redémontait
  // toutes.
  const lumière = useMemo(
    () => stageLightScalars({ scene, gameTime, lightLevel, ombreSoleil: politique.ombreSoleil }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene.ambiance, scene.northDeg, scene.ambientLight, scene.weather, gameTime, lightLevel, politique.ombreSoleil],
  );
  const { course, lit, fade } = lumière;
  // ── TEINTE : réécriture en place des couleurs de sommet (elle ne retriangule rien). Son read-set
  // porte le FONDU du soleil (#1300) : c'est la porte du modelé de forme — plein sous un ciel qui
  // n'éclaire pas (intérieur, nuit), effacé sous le soleil qui modèle lui-même, et CONTINU entre les
  // deux. Un nombre, donc une dépendance d'effet stable : deux frames de même fondu ne repeignent rien.
  // PORTÉE de ce modelé : les faces du monde CUIT. Les accents de sol (`buildGroundAccentMeshes`) et
  // les billboards sont des maillages à part, hors `spans` : ils gardent l'exposition horizontale de la
  // frame — ce qui est la bonne famille pour une touffe posée au sol, et un écart déclaré pour un
  // billboard, dont la normale est l'axe caméra et qu'aucune famille d'orientation ne décrit.
  useEffect(() => { applyVisibilityTint(baked, tintAt, fade); }, [baked, tintAt, fade]);
  // FOND du canevas sous cette météo — un NOMBRE, donc une dépendance d'effet stable (deux frames de
  // même météo ne réappliquent rien).
  const fondCanevas = stageClearColor(lumière.meteo);
  // ── FLAQUES (#1245, L1) : ce que les sources de lumière de la scène écrivent sur le pool de lampes
  // ponctuelles. Décision PURE (`stagePointLights.ts`), appliquée plus bas sur un pool de compte FIXE.
  // `prev` = la table de la frame précédente, par quoi une source GARDE son slot tant qu'elle vit :
  // l'index d'une lampe ne dépend jamais de l'ordre de la liste de sources.
  const slotsPrécédents = useRef<PointLightSlots | null>(null);
  const flaquesÉcrites = useMemo(
    () => pointLightWrites(lights, { scene, mpt, ambianceLum: lumière.ambianceLum, prev: slotsPrécédents.current ?? undefined }),
    [lights, scene, mpt, lumière.ambianceLum],
  );
  // Le POOL de lampes ponctuelles monté (rempli par l'effet de montage plus bas) : la passe de pose s'en
  // sert pour emmener une lampe PORTÉE avec son porteur qui glisse, et l'exposition d'un billboard se
  // mesure dessus — c'est la lampe montée, jamais la table, qui dit ce qui éclaire à cet instant.
  const pool = useRef<THREE.PointLight[]>([]);
  // Demande de recuisson de la carte d'ombre, honorée par la prochaine frame (cf. `dessiner`).
  const ombresARefaire = useRef(true);
  // Boîte des CASTEURS (géométrie + quads de billboard) : c'est elle qui serre le frustum d'ombre.
  const shadowBox = useMemo(
    () => worldShadowBox(
      geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)),
      subjects,
      (s) => subjectQuad(CONVENTION, s),
    ),
    [geometry, subjects],
  );

  // ── INTEMPÉRIES (P2-6) : ce qui TOMBE dans le monde. La PORTE est celle des DEUX voies
  // (`scenePrecip` → `sceneWeatherFx` : une météo authorée, et jamais en intérieur) ; densité, vitesse
  // de chute, vent, taille et teinte viennent tous de la donnée — aucun type de météo n'est nommé ici.
  // `null` = rien ne tombe, et pas une frame ne s'en occupe. Le REGARD ferme cette porte à son tour
  // (`viewPolicy.precipitations`) : au-dessus, une particule vue dans son axe de chute est un point.
  const precip = useMemo(
    () => (politique.precipitations ? scenePrecip(scene) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene.weather, scene.ambiance, politique.precipitations],
  );
  // Le semis SURVIT aux mutations de scène : il est retenu sur ce qui le DÉTERMINE (scène, type de
  // météo, emprise du volume — `retainWeatherField`), pas sur la référence de l'objet scène. Un pas de
  // combattant produit une référence de scène par frame ; re-semer là-dessus téléporterait l'averse
  // entière (1459/1459 particules mesurées sur La Diligence).
  const semisRetenu = useRef<PrecipSlot | null>(null);
  semisRetenu.current = precip ? retainWeatherField(semisRetenu.current, scene, precip, 'meteo') : null;
  const champ = semisRetenu.current?.champ ?? null;
  // SOUS COUVERT : le MÊME champ que le dégagement d'architecture interroge (`builders/roofs.ts`) —
  // une seule vérité de « suis-je sous un toit ? ». Il ignore la vue : une nappe levée par le cutaway
  // abrite toujours ; le couvert suit le PLAN, et se recalcule avec la scène qui le porte.
  // Retenu sur le read-set de la CUISSON (`worldBakeDeps`) : le couvert se déduit des masses bâties,
  // donc d'un sous-ensemble de ce que lit `worldFaces` — 6,9 ms sur 60×60 à 81 masses, qu'une
  // référence de scène par tick repayait pour un couvert identique.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const abris = useMemo(() => shelterField(scene), bakeDeps);
  const sousCouvert = useMemo<ShelteredAt>(
    () => (xM, zM, yM) => isSheltered(abris, xM / mpt, zM / mpt, yM),
    [abris, mpt],
  );
  // ÉCRÊTAGE AU CUTAWAY (#1247) : la pluie s'arrête sous le couvert du PLAN (ci-dessus, qui ignore la
  // vue) — donc au-dessus d'une nappe que la VUE ne peint plus, elle s'arrêtait EN L'AIR. La colonne
  // entière cesse alors de se rendre : pas « à partir du faîte », sinon la pluie réapparaîtrait entre
  // l'égout et le faîte du toit levé. La question posée est celle du VERDICT DE VUE de la section qui
  // coiffe la colonne (`nappeVue`, la même loi que `keepEl` sert aux éléments de toit) — jamais un
  // second calcul d'abri, et jamais l'emprise du semis : changer `area` changerait `precipFieldKey`,
  // donc re-sèmerait les 1459 particules à chaque pas du cutaway.
  const ecrete = useMemo<ClippedAt>(
    () => (nappeVue
      ? (xM, zM) => {
        const section = shelterSectionAt(abris, xM / mpt, zM / mpt);
        return section !== null && !nappeVue(section);
      }
      : () => false),
    [abris, mpt, nappeVue],
  );
  const precipMesh = useRef<THREE.InstancedMesh | null>(null);
  const precipBase = useRef<Float32Array | null>(null);
  const dernierPas = useRef(0); // horodatage du dernier pas de chute
  const dernierRendu = useRef(0); // horodatage de la dernière frame dessinée

  /**
   * LA FRAME QU'UN BOARD DOIT MONTRER, à l'instant de l'image (#1176, L3/L4).
   *
   * QUATRE sources, dans cet ordre : l'AMBIANCE authorée d'un figurant (il ne fait que ça), sinon
   * l'EFFONDREMENT quand le corps est au sol, sinon la MARCHE (le sujet glisse), sinon la PISTE DE
   * GESTE du registre (attaque/parade/touché), sinon le repos. Rien n'est piloté par transition —
   * l'état courant se recalcule à chaque image et l'écrivain ne touche au matériau qu'à l'écart.
   *
   * Les GESTES se prennent dans le vocabulaire de la VOIE du corps : clips bipèdes (`rigWalkDef`…) ou
   * modes de gabarit (`planWalkDef`…). Un def de l'autre voie ne se joue pas — il ne se dessinerait
   * pas non plus (`frameSvg`).
   *
   * PHASE DE MARCHE : elle se compte sur le SOL, pas sur une horloge — la distance qu'il reste à
   * parcourir (`glide`, mètres) donne la fraction de cycle. Deux marcheurs à la même vitesse battent
   * donc du même pas, et une image sautée ne décale pas les appuis.
   *
   * ORIENTATION PAR SEGMENT : la vue du marcheur se reprend sur la DIRECTION du pas en cours (dérivée
   * du glissement entre deux images), et le swap n'a lieu QUE si cette planche-là est déjà cuite.
   * NON-DÉTERMINISME ASSUMÉ : à cache froid, le marcheur garde la vue de son montage jusqu'à ce que la
   * cuisson rattrape — le rendu d'une image dépend donc de ce que le cuiseur a eu le temps de servir.
   */
  const choisirFrame = (b: Board, camera: FrameCamera, hCanevas: number): FramePick | null => {
    const id = boardTrackId(b.sub);
    const s = id ? flipRef.current.get(id) : undefined;
    if (!id || !s) return null;
    // PALIER : la hauteur PROJETÉE décide, sous hystérésis — un quad qui grossit réclame la planche du
    // dessus, et ne redescend qu'une fois nettement plus petit (sinon il oscille sur la frontière).
    const courant = paliersRef.current.get(id) ?? s.pxHeight;
    const px = palierAtlas(courant, boardProjectedPx(b, camera, hCanevas, window.devicePixelRatio || 1));
    if (px !== courant) paliersRef.current.set(id, px);
    // LECTURE et ÉCRITURE séparées : `servie` répond « cette planche est-elle au cache ? » sans rien
    // inscrire — la vue candidate d'un segment de marche est examinée à CHAQUE image, et une seule des
    // deux est retenue. `poser` n'entre en jeu que pour la planche réellement choisie.
    const servie = (def: ClipDef, v: View, m: boolean): boolean => !!getCachedAtlas(clePlanche(s, def, v, m, px).key);
    const poser = (def: ClipDef, v: View, m: boolean, ground?: 'corpse' | 'prone'): Recette => {
      const r = recette(s, def, v, m, px, ground);
      recettesRef.current.set(r.key, r);
      return r;
    };

    // AMBIANCE AUTHORÉE : le figurant BOUCLE sur l'horloge du registre. Aucune piste, aucun glissement
    // (une entité de scène ne marche pas), aucune orientation par segment.
    if (s.ambient) {
      const r = poser(s.ambient, s.view, s.mirror);
      return { key: r.key, frame: frameIndexAt(animNow(), dureeDeRecette(r), r.frames, true) };
    }

    const g = anim ? anim.glide(id) : null;
    const précédent = glissePrecRef.current.get(id);
    if (g) glissePrecRef.current.set(id, g);
    else glissePrecRef.current.delete(id);

    let def: ClipDef | null = null;
    let elapsed = 0;
    let loop = true;
    // EFFONDREMENT : il se compte depuis l'ENTRÉE AU SOL de l'acteur (`chutesRef`), pas depuis le
    // montage de son board — celui-ci se reconstruit à chaque quart de tour. Geste joué une fois : la
    // dernière cellule est la pose au sol, et elle y reste.
    const ground = s.sub.anim?.ground;
    if (ground) {
      def = s.voie === 'plan' ? planDyingDef(ground) : REPOS;
      elapsed = animNow() - s.chute;
      loop = false;
    } else if (g) {
      def = s.voie === 'plan' ? planWalkDef(s.leap) : rigWalkDef(s.rig);
      const cycles = Math.hypot(g.dx, g.dz) / mpt / 2; // un cycle de marche = deux cases
      const phase = ((-cycles % 1) + 1) % 1;
      elapsed = def ? phase * clipTotalMs(def) : 0;
    } else {
      const piste = tracksRef().get(id);
      if (piste) {
        def = piste.def;
        elapsed = animNow() - piste.start;
        loop = piste.def.voie === 'rig' ? !!piste.def.clip.loop : !!piste.def.loop;
      } else {
        def = s.voie === 'plan' ? REPOS_PLAN : REPOS;
        elapsed = animNow();
      }
    }
    if (!def || def.voie !== s.voie) return null;

    let { view, mirror } = s;
    if (g && précédent) {
      const d8 = dir8DuSegment(g.dx - précédent.dx, g.dz - précédent.dz);
      if (d8) {
        const vm = billboardView(bbCameraDe(povFacing, camRot), d8);
        if (servie(def, vm.view, vm.mirror)) ({ view, mirror } = vm);
      }
    }
    const r = poser(def, view, mirror, ground);
    return { key: r.key, frame: frameIndexAt(elapsed, dureeDeRecette(r), r.frames, loop) };
  };

  /** Cuisson d'une planche qu'une image a réclamée sans la trouver — DIFFÉRÉE hors de l'image (la
   *  file du cuiseur est déjà cadencée, mais poster depuis la boucle y allouerait par board). */
  const demanderCuisson: BakeAsk = (pick) => {
    if (demandéesRef.current.has(pick.key)) return;
    const r = recettesRef.current.get(pick.key);
    if (!r) return;
    demandéesRef.current.add(pick.key);
    queueMicrotask(() => {
      void cuire(r, PRIORITE_VUE_COURANTE)
        .then(() => dessinerRef.current())
        .catch(() => undefined)
        .finally(() => demandéesRef.current.delete(pick.key));
    });
  };
  /** UNE frame : cadre le canevas sur son élément, dérive la caméra de l'intention du stage, re-pose les
   *  quads face à elle (glissement de marche compris), dessine. Rien n'y est construit : cette passe est
   *  celle que la MARCHE rejoue soixante fois par seconde, hors de tout rendu React (P2-4). */
  const dessiner = () => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer || !three.current) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    // CAMÉRA DE LA FRAME : l'union de cadre (`StageFrame`) dit laquelle des deux se dérive, et rien
    // au-delà de ces quelques lignes ne connaît le regard employé.
    let camera: FrameCamera;
    let f: Stage3dFraming | null = null;
    if (frame.mode === 'pov') {
      // La caméra GLISSE avec le marcheur : la case logique du groupe plus le décalage MONDE de
      // l'instant (`anim.glide`, mètres → cases). Repère de `walkGlideM` : dx = est, dz = sud.
      const g = frame.cid && anim ? anim.glide(frame.cid) : null;
      const pos = g
        ? { x: frame.partyPos.x + g.dx / mpt, y: frame.partyPos.y + g.dz / mpt, z: frame.partyPos.z }
        : frame.partyPos;
      // PORTÉE : la distance de rendu du milieu (`povDepth`, donnée d'ambiance, resserrée par la
      // météo), jamais un far généreux. Le ratio near/far d'un far de 4 km quantifie la profondeur au
      // point que la séparation coplanaire ne survit plus (`backends/webgl/cameras.ts`,
      // `orthoDepthRange`). La brume du milieu s'éteint EXACTEMENT à cette portée (`povFog`, montée
      // plus bas, sur le MÊME `povDepth`) : rien n'arrive à la coupure autrement qu'entièrement
      // délavé, et l'horizon n'est jamais tranché.
      const portee = povDepth(frame.indoor, brumePov?.povTightenK).farTiles;
      camera = povCamera(scene, pos, frame.facing, { w, h }, portee * mpt);
    } else {
      // CADRE D'ÉCRAN de l'hôte : les deux conventions du dépôt (`stage3dCamera.ts`) — caméra de
      // groupe sur viewBox FIXE (le jeu), ou viewBox MOBILE mesuré sur le rendu (l'éditeur).
      const écran = frame.mode === 'viewbox'
        ? viewBoxScreen(frame.viewBox, { w, h })
        : stageScreen(anim ? anim.cam() : frame.cam, frame.zoom, { w, h });
      f = stage3dFramingFor({ dims: frame.dims, mpt, screen: écran, canvas: { w, h } });
      const cible = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
      const boite = geometry.boundingBox;
      const rayon = boite ? boite.getSize(new THREE.Vector3()).length() / 2 : 100;
      const distance = Math.max(50, rayon * 4);
      camera = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
        target: cible,
        distance,
        radius: rayon + (boite ? cible.distanceTo(boite.getCenter(new THREE.Vector3())) : 0) + 8,
      }).camera;
    }
    // VACILLEMENT (#1245, L4) : l'intensité de l'INSTANT, posée sur les lampes montées avant tout le
    // reste. C'est elle que la passe de pose relit pour exposer les billboards — le personnage au pied
    // du braséro bat donc avec sa flaque, et par UNE seule valeur : celle que three va rendre.
    applyFlicker(pool.current, flaquesÉcrites, performance.now() / 1000);
    // Quads ALIGNÉS ÉCRAN, ancrés aux PIEDS — exactement ce que fait le backend affine du sprite ; le
    // glissement de marche de l'instant y entre (`stage/boardPose.ts`, la passe pure), les lampes qu'un
    // marcheur PORTE avec lui, et l'EXPOSITION de chaque quad à l'endroit où il vient de se poser.
    const aGlissé = poseBoards(boardsRef.current, camera, anim ? anim.glide : AUCUN_GLISSEMENT, {
      pool: pool.current,
      slots: flaquesÉcrites,
      surfaceLuminance: lumière.surfaceLuminance,
    }, chromeAt ?? AUCUN_CHROME);
    // FLIPBOOK (#1176, L3) : la CELLULE que chaque quad montre à cette image. Passe sœur de la pose,
    // au même endroit et sur les mêmes boards — deux écritures de matériau, aucune rasterisation. La
    // planche absente du cache est DEMANDÉE, jamais attendue : le quad garde la sienne d'ici là.
    writeBoardFrames(boardsRef.current, (b) => choisirFrame(b, camera, h), getCachedAtlas, demanderCuisson);
    // MARQUES DYNAMIQUES (P3-0d) et HALOS D'INTERACTION (P3-0g) : ils suivent la MÊME glisse que les
    // quads, à la même frame et sur le même canal — un lien d'engagement posé à un rendu React
    // attendrait le marcheur à l'arrivée. Marques de sol et halos se mesurent à l'ÉCRAN d'une vue
    // affine (`kind`/`yawDeg`) : la première personne n'en pose aucun (#1176, P3-1a).
    if (f) {
      poseDynamicMarks(poolsDyn.current, dynMarks ?? NO_DYNAMIC_MARKS, {
        mpt,
        glide: anim ? anim.glide : AUCUN_GLISSEMENT,
        groundM: solM,
        kind: f.kind, // l'anneau d'équipe n'a ni le même rayon ni la même compensation selon la vue
        yawDeg: f.yawDeg, // les tirets de l'anneau d'équipe se mesurent à l'ÉCRAN : ils suivent la vue
        chromeAt: chromeAt ?? AUCUN_CHROME, // l'anneau d'un corps estompé s'estompe avec lui (P3-0f)
      });
      // La PULSATION d'un halo est une fonction de l'horloge, donc elle ne s'écrit que dans la frame.
      // `camQuat` : l'étincelle est un quad aligné écran, et son décalage se mesure en pixels d'écran.
      poseInteractHalos(poolsHalos.current, halos ?? NO_INTERACTION_HALOS, {
        mpt,
        groundM: solM,
        kind: f.kind,
        yawDeg: f.yawDeg,
        camQuat: camera.quaternion,
        tSec: performance.now() / 1000,
      });
    }
    // CARTE D'OMBRE : elle ne se recuit QUE quand ce qu'elle contient a bougé — un casteur qui glisse,
    // ou un montage (lampes, monde, billboards) qui l'a demandée. Une rotation de caméra, un zoom, une
    // frame de marche où personne ne glisse : la carte 2048² de la frame précédente reste valide.
    if (aGlissé || ombresARefaire.current) {
      renderer.shadowMap.needsUpdate = true;
      ombresARefaire.current = false;
    }
    // CHUTE (P2-6) : les particules avancent à la cadence RÉELLE de la frame, ici et nulle part
    // ailleurs — aucun rendu React, aucune allocation, aucun `Math.random`. Le pas est BORNÉ : un
    // onglet revenu au premier plan reprend l'averse, il ne la téléporte pas d'un bout à l'autre.
    // Seule la TRANSLATION de chaque instance se réécrit ; la base (orientation × taille) est commune
    // au semis et ne se reconstruit qu'au changement d'axe de caméra.
    const maintenant = performance.now();
    const semis = precipMesh.current;
    if (champ && semis) {
      const dt = Math.min(0.1, Math.max(0, (maintenant - dernierPas.current) / 1000));
      dernierPas.current = maintenant;
      stepWeatherField(champ, dt, sousCouvert);
      const base = precipBasis(champ.def, camera.getWorldDirection(new THREE.Vector3()));
      const memeBase = precipBase.current !== null && base.every((v, i) => v === precipBase.current![i]);
      writePrecipMatrices(semis.instanceMatrix.array as Float32Array, champ, base, !memeBase, ecrete);
      precipBase.current = base;
      semis.instanceMatrix.needsUpdate = true;
    }
    // DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) — TROIS cadences, et c'est tout le dessin de cette
    // passe : le VERDICT à la CLÉ (pas franchi, quart de tour, étage — `Percage.majVerdict` le refuse
    // de lui-même tant qu'elle ne bouge pas), le RAYON en fondu à la frame, et le CADRE D'ÉCRAN à la
    // frame lui aussi. Ce dernier n'est pas un luxe : sous lacet LIBRE (#1176), un demi-tour de caméra
    // ne franchit aucun cran, donc ne change aucune clé — la matrice et le centre du trou doivent
    // suivre le regard sans attendre un verdict.
    const pasPercage = Math.min(PERCAGE_PAS_MAX_MS, Math.max(0, maintenant - dernierRendu.current));
    const pilote = percageRef.current!;
    const acteursPercés = acteursPercésRef.current;
    acteursPercés.length = 0;
    // Les héros RÉELLEMENT perçables de cette frame entrent dans la clé : leurs quads naissent APRÈS
    // le montage (rasterisation asynchrone), et une clé qui ne dirait que la case laisserait le
    // verdict du premier instant — celui où aucun quad n'existait — valoir jusqu'au pas suivant.
    // Un quad DÉJÀ VU qui manque momentanément ne les en sort PAS (`PERCAGE_GRACE_DESSINS`).
    let cidsPercés = '';
    const memoirePercée = memoirePercéeRef.current;
    if (percage && f) {
      for (const hp of percage.heros) {
        if (acteursPercés.length >= PERCAGE_MAX_HEROS) break;
        // Le centre du trou se prend sur le QUAD POSÉ de cette frame : un héros sans billboard monté
        // (rasterisation en cours, jeton écarté par le builder) n'a aucun point où percer.
        const board = boardsRef.current.find((b) => b.sub.cid === hp.cid);
        let mémoire = memoirePercée.get(hp.cid) ?? null;
        if (board) {
          if (!mémoire) { mémoire = { monde: new THREE.Vector3(), absences: 0 }; memoirePercée.set(hp.cid, mémoire); }
          mémoire.monde.copy(board.mesh.position);
          mémoire.absences = 0;
        } else if (mémoire && mémoire.absences < PERCAGE_GRACE_DESSINS) {
          mémoire.absences++;
        } else {
          if (mémoire) memoirePercée.delete(hp.cid);
          continue;
        }
        acteursPercés.push({ capsule: hp.capsule, z: hp.z, monde: mémoire.monde });
        cidsPercés += `${hp.cid}|`;
      }
    }
    // Un héros que l'hôte ne dit plus perçable (sorti du groupe, écran quitté) n'a plus de mémoire à
    // garder : la fenêtre de grâce ne couvre QUE l'absence de quad, jamais l'absence d'entrée.
    if (memoirePercée.size > 0) {
      const dits = percage && f ? new Set(percage.heros.map((hp) => hp.cid)) : null;
      for (const cid of memoirePercée.keys()) if (!dits || !dits.has(cid)) memoirePercée.delete(cid);
    }
    // La passe d'OMBRE partage le discard et n'a aucun autre moyen de savoir où le trou tombe à
    // l'écran du joueur : son propre raster est celui du soleil (cf. `percageLocal`).
    cadrePercage(camera, w, h);
    // Hors vue de plateau (première personne, éditeur), la clé est CONSTANTE et la liste vide : les
    // trous ouverts se REFERMENT au même fondu, ils ne s'éteignent pas d'un coup.
    pilote.majVerdict({
      cle: percage && f ? `${percage.cle}@${cidsPercés}` : PERCAGE_HORS_PLATEAU,
      lids: percage && f ? percage.lids : AUCUNE_NAPPE,
      acteurs: acteursPercés,
      camera,
      largeurPx: w,
      hauteurPx: h,
    });
    pilote.avancer(pasPercage);
    // CENTRE À LA FRAME : le rayon appartient au pilote, mais le point où le trou tombe se reprend ici
    // — le quad du héros a glissé et la caméra a pu tourner depuis le dernier verdict.
    const trous = trousPercage();
    for (let i = 0; i < acteursPercés.length; i++) {
      if (trous[i].w <= 0) continue;
      const centre = centrePercage(camera, acteursPercés[i].monde, w, h);
      trous[i].set(centre.x, centre.y, centre.z, trous[i].w);
    }
    dernierRendu.current = maintenant;
    // GAMMA de la courbe de brume (P3-1c) : `THREE.Fog` s'arrête au smoothstep, la courbe du POV est
    // smoothstep^gamma (`fogAt`, `pov/camera.ts`). Le `#define` se pose ici, et pas à un montage : les
    // quads de billboard naissent APRÈS coup (rasterisation asynchrone) et un matériau neuf arriverait
    // sans gamma. La passe ne réécrit que ce qui a changé — hors POV elle ne court pas du tout.
    if (gammaBrume !== null) applyFogGamma(three.current, gammaBrume);
    cameraRef.current = camera; // la caméra de la DERNIÈRE frame : celle que le rayon de picking doit emprunter
    renderer.render(three.current, camera);
  };

  /** La frame COURANTE, pour les boucles qui battent HORS des rendus React. Elles lisent la réf, jamais
   *  une closure : `dessiner` capture les props de SON rendu, et une boucle abonnée sur le semis
   *  peindrait au cadrage du rendu où le semis a changé — une caméra qui tourne sous la pluie s'y
   *  dessine au zoom périmé. Même patron que `repaintRef` (`fx/useWalkAnim.ts`). */
  const dessinerRef = useRef(dessiner);
  dessinerRef.current = dessiner;

  // ── GROUPE INTEMPÉRIES : un `InstancedMesh` unique (un appel de dessin), remonté au seul changement
  // de SEMIS — c'est-à-dire à la météo de la scène, jamais à la caméra ni au pas du groupe.
  useEffect(() => {
    const groupe = intemperies.current;
    if (!groupe || !champ) return;
    const semis = buildPrecipMesh(champ);
    precipMesh.current = semis;
    precipBase.current = null;
    dernierPas.current = performance.now();
    groupe.add(semis);
    dessiner();
    return () => {
      precipMesh.current = null;
      viderGroupe(groupe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ]);

  // ── GROUPE DÉCALQUE (#1176, P3-3, vague B) : la plaque de l'auteur, en QUAD MONDE — elle TOURNE donc
  // avec la carte, là où la surcouche SVG qu'elle remplace restait clouée au repère de contenu (le
  // changement de sémantique est déclaré dans `backends/webgl/traceQuad.ts`). Deux régimes, une seule
  // géométrie : SOUS le monde, la plaque garde le test de profondeur — le sol la couvre là où il en
  // écrit un, et elle ne se voit que sur le vide (l'usage « carte neuve ») ; AU-DESSUS, elle passe au
  // rang du chrome SANS test de profondeur, donc par-dessus tout ce que la carte porte déjà.
  useEffect(() => {
    const groupe = decalques.current;
    if (!groupe || !decalque || frame.mode === 'pov') return;
    const au_dessus = decalque.position === 'above';
    const geo = buildTraceQuad(
      decalque.transform,
      { width: decalque.naturalWidth, height: decalque.naturalHeight },
      frame.dims,
      mpt,
      au_dessus ? TRACE_LIFT_M : 0,
    );
    const texture = new THREE.TextureLoader().load(decalque.imageDataUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: decalque.opacity,
      depthWrite: false,
      depthTest: !au_dessus,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'decalque';
    groupe.add(withRenderRank(mesh, au_dessus ? 'chrome' : 'decalque'));
    dessiner();
    return () => {
      groupe.remove(mesh);
      geo.dispose();
      mat.dispose();
      texture.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decalque, mpt, frame.mode === 'pov' ? null : dimsKey(frame.dims)]);

  // ── GROUPE BRUME (#1247) : les nappes de la météo, montées au seul changement de PLAN — c'est-à-dire
  // à la scène, à la météo, au bâti et au regard, jamais au pas du groupe (le plan est retenu plus haut).
  // Leur géométrie ne dépend NI du cutaway NI de la marche : elle ne couvre que les colonnes à CIEL
  // OUVERT (`shelterField`, la vérité d'abri du dépôt), donc l'intérieur qu'un dégagement révèle est
  // propre sans qu'aucune passe n'ait à l'y nettoyer.
  useEffect(() => {
    const groupe = brumes.current;
    if (!groupe || !nappesAuMonde || !planNappes) return;
    const nappes = buildBrumeSheets(planNappes, nappesAuMonde);
    for (const nappe of nappes) groupe.add(nappe);
    setNappesMontées(nappes.length); // la trace `data-brume` dit ce qui est MONTÉ, jamais ce qui est authoré
    dessiner();
    return () => {
      setNappesMontées(0);
      viderGroupe(groupe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planNappes, nappesAuMonde]);

  // BOUCLE DE CHUTE : une averse vit hors des rendus React — tant qu'un semis existe, la frame se
  // rejoue. Elle CÈDE le pas à la boucle de MARCHE (P2-4) quand celle-ci vient de dessiner : une même
  // image ne se rend jamais deux fois, quelle que soit celle des deux boucles qui bat la première.
  useEffect(() => {
    if (!champ) return;
    let vivant = true;
    let image = 0;
    const battre = () => {
      if (!vivant) return;
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champ]);

  // BOUCLE DE VACILLEMENT (#1245, L4) : une flamme vit hors des rendus React, comme l'averse. Elle ne
  // bat QUE si une lampe qui vacille est allumée — de jour les flaques s'éteignent, et une scène sans
  // feu (lanternes, lueurs magiques) ne rejoue pas une frame de plus qu'avant ce lot. Même politique
  // de CESSION que la chute : une image déjà rendue par la marche ou l'averse ne se redessine pas.
  const vacille = hasFlicker(flaquesÉcrites);
  useEffect(() => {
    if (!vacille) return;
    let vivant = true;
    let image = 0;
    const battre = () => {
      if (!vivant) return;
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
    };
  }, [vacille]);

  // BOUCLE DE PULSATION DES HALOS (P3-0g) : un halo d'affordance bat hors des rendus React, comme la
  // flamme et l'averse — c'est ce que la voie affine obtient de ses keyframes CSS. Elle ne bat QUE si
  // un halo est à l'écran : une scène sans décor fouillable et sans PNJ survolé ne rejoue pas une frame
  // de plus qu'avant ce lot. Même politique de CESSION que les deux autres boucles.
  const pulseHalos = !!halos && (halos.fouilles.length > 0 || halos.pnjs.length > 0);
  useEffect(() => {
    if (!pulseHalos) return;
    let vivant = true;
    let image = 0;
    const battre = () => {
      if (!vivant) return;
      if (performance.now() - dernierRendu.current > 4) dessinerRef.current();
      image = requestAnimationFrame(battre);
    };
    image = requestAnimationFrame(battre);
    return () => {
      vivant = false;
      cancelAnimationFrame(image);
    };
  }, [pulseHalos]);

  // HIT-TEST DE SPRITE (lot P2-3, règle #1297 « ce qui se voit se clique ») : la voie volumique répond
  // au pointeur par un RAYON — cibles = les quads montés, ceux d'un combattant portant son id, ceux du
  // décor aucun (un décor touché le premier rend le clic à la tuile). La masse du monde n'est PAS
  // inscrite : un jeton qu'elle occulte se lit en silhouette, donc se clique
  // (`backends/webgl/spriteRaycast`). L'inscription vit et meurt avec ce composant, monté en volumique.
  // En PREMIÈRE PERSONNE, aucun picker n'est inscrit : cette vue n'a jamais eu d'affordance de clic
  // (le SVG du POV n'en portait aucune) — l'inscrire en ouvrirait une par le seul changement de voie.
  useEffect(() => {
    if (pov || !spritePicking) return;
    setSpritePicker((clientX, clientY) => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const cibles: PickTarget[] = boardsRef.current.map((b) => ({ cid: b.sub.cid ?? null, object: b.mesh }));
      return pickNearestCid(
        camera,
        cibles,
        ndcAt({ x: clientX - rect.left, y: clientY - rect.top }, { w: rect.width, h: rect.height }),
      );
    });
    return () => setSpritePicker(null);
  }, [pov, spritePicking]);

  // REGISTRE DE PISTES D'ANIMATION (#1176, L3) : l'écran monté INSTALLE le registre — c'est lui qui
  // porte le geste de chaque acteur et qui émet `ANIM_IMPACT` sur son horloge propre. Installé ici, et
  // non chez un hôte de vue, parce que TOUS les hôtes du monde volumique passent par cet écran.
  // Le registre lui-même dédoublonne abonnements et horloge : deux écrans montés côte à côte
  // n'émettent pas deux fois (`fx/animTracks.installAnimTracks`).
  useEffect(() => installAnimTracks(), []);

  // Renderer UNIQUE (le canevas ne se remonte jamais).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Aucun contexte WebGL (GPU sur liste noire, machine virtuelle, budget de contextes épuisé, jsdom
    // des tests de montage) : la voie volumique n'a plus de surface où peindre, et depuis C5a il n'y a
    // plus de second peintre du monde. Le verdict se DIT donc au joueur — les hôtes de monde montent
    // `stage/SansWebgl` à la place de leur canevas. Le signal est LATCHÉ (cf. `stage/webglSupport`) :
    // il ne se retente pas, un échec par rendu bouclerait.
    let renderer: StageRenderer;
    try {
      renderer = fabriqueRenderer ? fabriqueRenderer(canvas) : new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch (e) {
      console.warn('GameStage3D: aucun contexte WebGL — le monde ne peut pas être peint.', e);
      signalerWebglRefusé();
      return;
    }
    // Le PLAFOND vit avec le palier de cuisson des flipbooks (`boardPose.DPR_PLAFOND`) : le canevas se
    // peint en pixels de DISPOSITIF, et une planche cuite en pixels CSS y serait sous-résolue d'autant.
    renderer.setPixelRatio(Math.min(DPR_PLAFOND, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    // La carte d'ombre ne se recuit PAS à chaque frame : rien ne la périme tant que ni le soleil ni un
    // casteur n'ont bougé, et la boucle de marche (P2-4) rend soixante fois par seconde. C'est
    // `dessiner` qui la redemande, au cas par cas (`shadowMap.needsUpdate`).
    renderer.shadowMap.autoUpdate = false;
    ombresARefaire.current = true;
    // `PCFSoftShadowMap` est DÉPRÉCIÉ depuis three 0.185 : le moteur le remplace lui-même par
    // `PCFShadowMap` à la première frame ombrée en criant à la console — on pose donc directement le
    // filtre réellement appliqué (rendu identique, console propre).
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ── BRUME & CIEL (P3-1c) : la première personne a un HORIZON, la vue de plateau n'en a pas — hors
  // POV, `scene.fog` reste NUL (une brume de distance y délaverait le bord de carte, et les planches
  // QC de l'iso avec). DEUX couleurs, et c'est structurel : les SURFACES se fondent dans la brume de
  // surface du milieu (`povFog`), le FOND porte celle du ciel (`povBackground`) — sans quoi les sols
  // lointains se relèvent vers le bleu froid (cf. le JSDoc d'`AMBIANCE.pov.fogOutdoorSurface`).
  // Les sprites d'entité s'embrument AVEC le monde (three embrume tout matériau `fog`), là où le POV
  // SVG les laissait nets — réf juge de design P3-1.
  // MÉTÉO (#1247) : dehors, la brume authorée REMPLACE la couleur du milieu et resserre la portée ; le
  // FOND suit la même dérivation de teinte que les lampes (`weatherLightScalars`), sans quoi le ciel
  // reste clair au-dessus d'un monde éteint par l'orage. Dedans, rien : `brumePov` y est nul.
  // AMBIANCE (#1176) : ciel ET brume prennent le PALIER de la scène (`lumière.ambianceLum`, le scalaire
  // même qui dose les lampes) — sans lui, une scène de nuit gardait un horizon de plein jour au-dessus
  // d'un sol obéissant, et les sols lointains se relevaient vers une brume diurne.
  useEffect(() => {
    const scène3d = three.current!;
    const fond = povIndoor === null ? null : povBackground(povIndoor, lumière.meteo, lumière.ambianceLum);
    scène3d.fog = povIndoor === null ? null : povFog(mpt, povIndoor, brumePov, lumière.ambianceLum);
    scène3d.background = fond;
    dessiner();
    return () => {
      if (fond instanceof THREE.DataTexture) fond.dispose();
      scène3d.background = null;
      scène3d.fog = null;
      // Le gamma part AVEC la brume : les matériaux du monde survivent à cet effet (leur montage a sa
      // propre clé) et garderaient un `#define` sans brume au retour en vue de plateau — une clé de
      // programme de plus, pour un exposant que plus personne n'applique.
      applyFogGamma(scène3d, null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [povIndoor, mpt, brumePov, lumière.meteo, lumière.ambianceLum]);

  // ── FOND DU CANEVAS (#1247) : effet À PART de la création du renderer, qui n'a AUCUNE dépendance —
  // une couleur d'effacement posée là-bas ne serait plus jamais réappliquée, et le fond resterait au
  // gris de beau temps sous l'orage. Il suit la MÊME dérivation que les lampes et que le ciel du POV
  // (`weatherLightScalars` → `stageClearColor`) : une seule donnée, trois surfaces d'accord.
  useEffect(() => {
    rendererRef.current?.setClearColor(fondCanevas, 1);
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fondCanevas]);

  // ── GROUPE MONDE : la géométrie fusionnée, un matériau par groupe de surface.
  useEffect(() => {
    const groupe = monde.current;
    const renderer = rendererRef.current;
    if (!groupe || !renderer) return;
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    // UN MATÉRIAU PAR GROUPE DE SURFACE (`backends/webgl/worldMaterials.ts`, source unique) : la
    // géométrie reste fusionnée, seul le dessin se scinde. Le régime NE BASCULE PLUS avec la lumière :
    // toujours lambertien, même sans soleil — l'ambiante porte alors la scène à elle seule
    // (`stageLights`), et le crépuscule n'a plus de marche d'escalier.
    const materials = worldSurfaceMaterials(geometry, anisotropy);
    // DÉCOUPE LOCALE (#1176, M3) : chaque matériau du monde SAIT se trouer — une seule référence de
    // fonction pour tous (`percerMateriau`), donc une seule clé de programme et aucun texte de shader
    // touché. Sans le `#define`, les chunks surchargés rendent le shader d'origine.
    for (const mat of materials) percerMateriau(mat);
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.userData.emprunte = true;
    // Le monde caste et reçoit TOUJOURS : sans lampe à ombre, three ne compile aucun chemin d'ombre —
    // ces deux drapeaux ne coûtent alors rien, et le matériau cesse de dépendre de l'heure.
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // La passe d'OMBRE partage le discard : three ne recopie ni les `defines` ni l'`onBeforeCompile`
    // du matériau de surface vers le matériau de profondeur qu'il fabrique, et sans celui-ci le toit
    // troué projetterait encore son ombre sur le héros dégagé.
    const profondeurPercée = materiauProfondeurPerce();
    mesh.customDepthMaterial = profondeurPercée;
    groupe.add(withRenderRank(mesh, 'monde'));
    ombresARefaire.current = true;
    dessiner();
    return () => {
      viderGroupe(groupe); // `viderGroupe` ne connaît que `material` : le matériau de profondeur se libère ici
      profondeurPercée.dispose();
    };
    // Les MATÉRIAUX ne dépendent QUE de la cuisson : ni la teinte (elle vit dans les couleurs de sommet),
    // ni le dégagement (il vit dans l'index), ni l'heure (le régime lambertien ne bascule plus) n'en
    // refont un seul. Remettre `tintAt` ici reconstruisait les 76 matériaux de l'arène à chaque pas
    // (mesuré #1176).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  // ── GROUPE ACCENTS : les instances de touffes/mouchetis. Séparé du monde car il porte la teinte
  // AUTREMENT (par `instanceColor`, cuit au montage) : lui seul se remonte quand la visibilité change.
  useEffect(() => {
    const groupe = touffes.current;
    if (!groupe) return;
    // Toujours lambertiens eux aussi — même régime que les faces du monde, dont ils prolongent le sol.
    for (const m of buildGroundAccentMeshes(accentsVus, { lit: true, tintAt })) {
      m.castShadow = true;
      m.receiveShadow = true;
      groupe.add(withRenderRank(m, 'monde'));
    }
    ombresARefaire.current = true;
    dessiner();
    return () => viderGroupe(groupe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accentsVus, tintAt]);

  // ── POOLS DE MARQUES (P3-0c) : la CAPACITÉ, et rien d'autre. Un pool ne naît, ne grandit ou ne meurt
  // qu'au changement de palier — c'est la seule passe qui alloue une géométrie ou un matériau de marque.
  // Le contenu, lui, s'écrit dans la passe suivante ; le patron est celui du pool de flaques (#1245).
  useEffect(() => {
    const groupe = marques.current;
    if (!groupe) return;
    HIGHLIGHT_SLOTS.forEach((slot, i) => {
      const voulue = capacités[i];
      const courant = poolsMarques.current.get(slot);
      if (courant && courant.instanceMatrix.count === voulue) return;
      if (courant) {
        groupe.remove(courant);
        courant.geometry.dispose();
        (courant.material as THREE.Material).dispose();
        poolsMarques.current.delete(slot);
      }
      if (voulue <= 0) return;
      const mesh = buildHighlightMesh(slot, voulue);
      poolsMarques.current.set(slot, mesh);
      groupe.add(mesh);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clésCapacités]);

  // ── ÉCRITURE des marques : matrices et teintes réécrites EN PLACE dans des pools déjà montés. Aucun
  // montage, aucun démontage, aucune allocation — un tour de combat ne fait que repasser ici.
  useEffect(() => {
    for (const slot of HIGHLIGHT_SLOTS) {
      const mesh = poolsMarques.current.get(slot);
      if (mesh) writeHighlightInstances(mesh, marquesGroupées.get(slot) ?? [], mpt);
    }
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marquesGroupées, mpt]);

  // Le groupe des marques ne se vide qu'à la MORT de l'écran (un `viderGroupe` par changement de
  // dépendance rendrait le pool inutile).
  useEffect(() => {
    const groupe = marques.current;
    const pools = poolsMarques.current;
    return () => {
      for (const mesh of pools.values()) {
        groupe?.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      pools.clear();
    };
  }, []);

  // ── POOLS DYNAMIQUES (P3-0d) : montés UNE fois, à capacité fixe, et jamais retouchés jusqu'à la mort
  // de l'écran. Aucune dépendance : ni le combat, ni la scène, ni l'échelle n'en refont un — leur
  // contenu ENTIER se réécrit à chaque frame (`poseDynamicMarks`), y compris le compte dessiné.
  useEffect(() => {
    const groupe = marquesDyn.current;
    if (!groupe) return;
    const pools = poolsDyn.current;
    for (const slot of DYN_MARK_SLOTS) {
      const mesh = buildDynamicMarkMesh(slot);
      pools[slot] = mesh;
      groupe.add(mesh);
      // SILHOUETTE À TRAVERS LES MURS (#1297, LOT A) : l'anneau d'équipe seul reçoit son jumeau à test
      // de profondeur retourné — un pool de plus, pas un objet par acteur.
      if (slot === 'anneau') groupe.add(buildSilhouetteTwin(mesh));
    }
    dessiner();
    return () => {
      viderGroupe(groupe); // le jumeau y est marqué `emprunte` : sa géométrie est celle de l'original
      for (const slot of DYN_MARK_SLOTS) delete pools[slot];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── POOLS DE HALOS (P3-0g) : même politique que les pools dynamiques ci-dessus — montés UNE fois, à
  // capacité fixe, contenu et OPACITÉ réécrits à chaque frame (`poseInteractHalos`).
  useEffect(() => {
    const groupe = halosGroupe.current;
    if (!groupe) return;
    const pools = poolsHalos.current;
    for (const slot of HALO_SLOTS) {
      const mesh = buildHaloMesh(slot);
      pools[slot] = mesh;
      groupe.add(mesh);
    }
    dessiner();
    return () => {
      for (const slot of HALO_SLOTS) {
        const mesh = pools[slot];
        if (!mesh) continue;
        groupe.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        delete pools[slot];
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GROUPE BILLBOARDS : décor + acteurs. Rebâti quand les SUJETS changent — l'identité d'un sujet
  // porte sa case logique et sa signature de dessin, jamais le glissement de la marche : celui-ci
  // décale des quads déjà montés, dans `dessiner` (P2-4).
  useEffect(() => {
    const groupe = panneaux.current;
    if (!groupe) return;
    let annule = false;
    const pxm = pxPerM(mpt);
    // REGARD qui choisit la vue d'une entité : en première personne le CAP du meneur (8 états
    // discrets, repère `dir8Basis`), sur la vue de plateau le cran d'art. Le repère se prend au cap et
    // NON à la caméra de la frame : fwd/right recalculés par frame recuiraient toute la planche de
    // textures à chaque frame (le piège que documente `artRot`).
    const bbCam: BillboardCamera = bbCameraDe(povFacing, camRot);
    const dpr = window.devicePixelRatio || 1;
    flipRef.current.clear();
    épinglesRef.current.clear();
    // PURGE des états PAR ACTEUR qui survivent au rebuild : un acteur absent des sujets de ce montage
    // (sorti de la scène, hors du cadre) laisse son palier et son heure de chute derrière lui. Les deux
    // cartes refaites à neuf ci-dessus (sujets montés, épingles) n'ont, elles, rien à purger.
    const joués = new Set<string>();
    for (const sub of subjects) {
      const id = boardTrackId(sub);
      if (id) joués.add(id);
    }
    for (const id of [...paliersRef.current.keys()]) if (!joués.has(id)) paliersRef.current.delete(id);
    for (const id of [...chutesRef.current.keys()]) if (!joués.has(id)) chutesRef.current.delete(id);
    for (const id of [...glissePrecRef.current.keys()]) if (!joués.has(id)) glissePrecRef.current.delete(id);
    const boards: Board[] = [];
    boardsRef.current = boards;

    /**
     * PRÉ-CUISSON d'un sujet (#1176, L3/L4). Politique du design, chiffrée par la sonde (~10 ms de
     * rasterisation par frame) : ce que la caméra regarde MAINTENANT passe devant tout le reste.
     *  - HAUTE : repos + marche, à la vue COURANTE ;
     *  - BASSE : les autres vues, et l'EFFONDREMENT (`corpse` ET `prone` — la pose au sol est un état
     *    du RENDU, une seule planche rendrait le cadavre là où le rendu veut l'affaissé) ;
     *  - COMBAT : le set de gestes des ENRÔLÉS (attaque, touché, défense) — un acteur connu du
     *    résolveur du registre EST en combat, c'est la même lecture qui sert aux pistes.
     * Le set de gestes est celui de la VOIE du corps ; un FIGURANT à ambiance authorée n'en a qu'UN
     * (sa boucle, à sa vue de montage : une entité de scène ne tourne pas, ne marche pas, ne se bat pas).
     * Les planches ainsi posées sont ÉPINGLÉES : le cache LRU ne les évince pas tant que le quad est
     * à l'écran.
     */
    const précuire = (s: FlipbookSujet, id: string): void => {
      const clés: string[] = [];
      const poser = (def: ClipDef, view: View, mirror: boolean, prio: number, ground?: 'corpse' | 'prone') => {
        const r = recette(s, def, view, mirror, s.pxHeight, ground);
        recettesRef.current.set(r.key, r);
        clés.push(r.key);
        void cuire(r, prio).catch(() => undefined);
      };
      if (s.ambient) {
        poser(s.ambient, s.view, s.mirror, PRIORITE_VUE_COURANTE);
      } else if (s.voie === 'plan') {
        const marche = planWalkDef(s.leap);
        // `planAttackDef()` sans arme naturelle nommée : les attaques d'un record qui en porte une
        // (`creatureAttack` de l'évènement) se cuisent à la demande, comme une arme inhabituelle.
        const gestes = s.enrolé ? [planAttackDef(), planFlinchDef()] : [];
        for (const def of [REPOS_PLAN, marche, ...gestes]) poser(def, s.view, s.mirror, PRIORITE_VUE_COURANTE);
        for (const v of VUES_REGARD) {
          if (v.view === s.view && v.mirror === s.mirror) continue;
          for (const def of [REPOS_PLAN, marche]) poser(def, v.view, v.mirror, PRIORITE_RECHAUFFAGE);
        }
        for (const ground of ['corpse', 'prone'] as const) poser(planDyingDef(ground), s.view, s.mirror, PRIORITE_RECHAUFFAGE, ground);
      } else {
        const marche = rigWalkDef(s.rig);
        const parade = s.enrolé ? rigDefenseDef({ defense: 'parade' }, s.rig) : null;
        const gestes: RigClipDef[] = s.enrolé
          ? [rigAttackDef({ weapon: s.rig.mainWeapon }, s.rig), rigHitDef(s.rig), ...(parade ? [parade] : [])]
          : [];
        for (const def of [REPOS, ...(marche ? [marche] : []), ...gestes]) poser(def, s.view, s.mirror, PRIORITE_VUE_COURANTE);
        for (const v of VUES_REGARD) {
          if (v.view === s.view && v.mirror === s.mirror) continue;
          for (const def of [REPOS, ...(marche ? [marche] : [])]) poser(def, v.view, v.mirror, PRIORITE_RECHAUFFAGE);
        }
        for (const ground of ['corpse', 'prone'] as const) poser(REPOS, s.view, s.mirror, PRIORITE_RECHAUFFAGE, ground);
      }
      épinglesRef.current.set(id, clés);
      setAtlasPins([...épinglesRef.current.values()].flat());
    };

    /** Le quad d'un sujet, monté DÈS QUE SA texture est là — jamais au dernier des sujets. */
    const monter = (q: { sub: BillboardSubject; quad: ReturnType<typeof subjectQuad>; view: View; mirror: boolean; pxHeight: number }, texture: THREE.Texture): void => {
      const geo = new THREE.PlaneGeometry(q.quad.widthM, q.quad.heightM);
      // Matériau NON lambertien (`billboardMaterial`, cf. l'en-tête), monté à la couleur NEUTRE : son
      // exposition appartient à la passe de pose, qui la lui donne dans le `dessiner()` de cette même
      // passe de montage, avant toute peinture — une seconde loi ici en ferait deux à tenir d'accord.
      const mat = billboardMaterial(texture, 1);
      const mesh = new THREE.Mesh(geo, mat);
      // Un quad PROJETTE son ombre même en Basic (le casteur ne connaît que sa géométrie et son alpha) ;
      // `receiveShadow` n'aurait, lui, aucun effet sous ce matériau. La passe d'ombres rend un matériau
      // de PROFONDEUR, jamais celui-ci : le cadre de frame ne l'atteint que par `customDepthMaterial`
      // (#1334) — à défaut, l'ombre se découpe sur la planche ENTIÈRE (une grille de corps au sol).
      mesh.castShadow = true;
      mesh.customDepthMaterial = billboardDepthMaterial(mat);
      groupe.add(withRenderRank(mesh, 'pions'));
      const board: Board = { sub: q.sub, quad: q.quad, mesh, material: mat };
      boards.push(board);
      // SILHOUETTE À TRAVERS LES MURS (#1297, LOT C) : le corps d'un jeton occulté par la matière
      // du monde garde un JUMEAU à test de profondeur retourné, teinté de sa couleur d'équipe —
      // enfant du quad, donc porté par la MÊME pose (aucune écriture de plus par frame). Les deux
      // regards du cadre en héritent : c'est le montage des quads, pas une passe de vue.
      // Un sujet sans équipe (décor, figurant) n'en reçoit aucun : il n'y a rien à y signaler.
      if (q.sub.teamColor) attachBodySilhouette(board, q.sub.teamColor);
      // Ombre de CONTACT : le rig ne porte aucune ellipse au pied (le décor, si). Elle entre dans le
      // board — donc dans la passe de pose, donc elle suit le sujet qui glisse. Sous le soleil, c'est
      // l'ombre PROJETÉE qui fait foi (`wantsContactShadow`) — sinon le personnage en porte deux.
      if (wantsContactShadow(q.sub.kind, lit)) {
        const disque = contactShadow(q.sub, q.quad);
        disque.material.opacity *= q.sub.tint;
        board.shadow = disque;
        groupe.add(withRenderRank(disque, 'pions'));
      }
      // FLIPBOOK : les sujets à UN corps en portent la couture (`frameSvg`) et leur identité de piste
      // (`boardTrackId`) — combattant ou figurant à ambiance authorée (cf. l'en-tête de section).
      const piste = boardTrackId(q.sub);
      const ctx = q.sub.cid ? animCtxOf(q.sub.cid) : undefined;
      if (piste && q.sub.frameSvg) {
        const rig = ctx?.rig ?? {};
        const voie = q.sub.anim?.voie ?? ctx?.voie ?? 'rig';
        const authoré = q.sub.anim?.ambient;
        // AMBIANCE : le MÊME clip que le jeton affine joue en repos (`RigToken`, `ambientClip`) pour
        // un bipède, l'idle du gabarit pour une bête. Une clé sans clip rig laisse le corps statique.
        const ambient = authoré ? (voie === 'plan' ? planAmbientDef(authoré) : rigAmbientDef(authoré)) : null;
        if (!authoré || ambient) {
          // ENTRÉE AU SOL : l'heure retenue est celle du PREMIER montage où cet acteur est au sol. Un
          // acteur debout n'en a pas — et la relève d'un À Terre efface la sienne, sinon sa chute
          // suivante partirait déjà finie.
          const auSol = q.sub.anim?.ground;
          const chute = auSol ? (chutesRef.current.get(piste) ?? animNow()) : animNow();
          if (auSol) chutesRef.current.set(piste, chute);
          else chutesRef.current.delete(piste);
          const s: FlipbookSujet = {
            sub: q.sub,
            view: q.view,
            mirror: q.mirror,
            pxHeight: q.pxHeight,
            voie,
            rig,
            ...(q.sub.anim?.leap ? { leap: true } : {}),
            ...(ambient ? { ambient } : {}),
            enrolé: !!ctx,
            chute,
          };
          flipRef.current.set(piste, s);
          précuire(s, piste);
        }
      }
      ombresARefaire.current = true;
      dessiner();
    };

    for (const sub of subjects) {
      // Le quad se taille sur la BOÎTE du sujet : un composite plus haut que la boîte canonique
      // (couple monté) gagne du quad au lieu d'être tranché à la rasterisation.
      const quad = subjectQuad(CONVENTION, sub);
      // L'art de décor n'existe qu'AUX crans (`propSvg(ref, dir, camRot)`) ; celui d'un personnage
      // l'ignore — l'y mettre rasteriserait quatre fois la MÊME image.
      const identity = sub.kind === 'prop' ? `${sub.identity}|r${camRot}` : sub.identity;
      const { view, mirror } = billboardView(bbCam, sub.facing);
      // PALIER de la texture de MONTAGE : le palier CSS du billboard PORTÉ AU RAPPORT DE PIXELS du rendu
      // (`atlasPxHeight`, #1328) — le renderer peint en pixels de dispositif (`setPixelRatio`), et une
      // texture cuite en pixels CSS y est sous-résolue d'autant. C'est le MÊME palier que celui des
      // planches de flipbook du sujet (`FlipbookSujet.pxHeight` le reprend) : un acteur ne change pas de
      // netteté en passant de sa texture de montage à sa première planche.
      const pxHeight = atlasPxHeight(quad.heightM, pxm, dpr);
      const key = billboardTextureKey(identity, view, mirror, pxHeight);
      const q = { sub, quad, view, mirror, pxHeight };
      // RÉSOLUTION INDIVIDUELLE : chaque board entre en scène dès SA texture rasterisée. Sous un
      // `allSettled`, le groupe entier attendait le dernier sujet — et un sujet rejeté n'y laissait
      // rien du tout. Ici, une texture rejetée ne coûte que SON quad, et le reste est déjà à l'écran.
      void getBillboardTexture(key, () => svgToTexture(sub.svg(view, mirror, camRot), sub.box, pxHeight)).then(
        (texture) => { if (!annule) monter(q, texture); },
        (raison: unknown) => { if (!annule) console.warn(`GameStage3D: billboard « ${sub.identity} » sauté — texture non rasterisée :`, raison); },
      );
    }
    return () => {
      annule = true;
      boardsRef.current = [];
      // Les deux cartes du MONTAGE se vident (elles se refont avec les boards). Les états PAR ACTEUR
      // qui doivent traverser un rebuild — palier, entrée au sol, glissement précédent — restent : ce
      // teardown court à CHAQUE changement de sujets, pas seulement au démontage. Leur borne est la
      // purge d'entrée d'effet (les acteurs absents des sujets en sortent).
      flipRef.current.clear();
      épinglesRef.current.clear();
      setAtlasPins([]);
      viderGroupe(groupe);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects, mpt, camRot, povFacing, lit]);

  // L'EXPOSITION des billboards appartient à la passe de POSE (`poseBoards`) : elle dépend de l'endroit
  // où chaque sujet se pose, donc elle se recalcule à la cadence de la frame — c'est ainsi qu'un
  // personnage entre dans une flaque en marchant. Tout rendu de cet écran dessine (l'effet sans
  // dépendances plus bas) : l'heure et le palier la portent aux matériaux déjà montés, sans rerasteriser.

  // ── GROUPE LAMPES : ce que `stageLights` décide, monté tel quel. Groupe à part des trois autres car
  // il vit sur d'autres entrées (l'heure, le palier de lumière, la boîte des casteurs) et ne coûte ni
  // géométrie ni matériau : une lampe se remplace, elle ne se reconstruit pas avec le monde.
  useEffect(() => {
    const groupe = lampes.current;
    if (!groupe) return;
    const { ambient, sun } = stageLights({ scene, gameTime, lightLevel, shadowBox, ombreSoleil: politique.ombreSoleil });
    groupe.add(ambient);
    if (sun) groupe.add(sun, sun.target);
    ombresARefaire.current = true;
    dessiner();
    return () => {
      for (const enfant of [...groupe.children]) groupe.remove(enfant);
      ambient.dispose();
      sun?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Même read-set que les scalaires ci-dessus (`stageLightScalars`) : une référence de scène par
    // tick remontait ambiante et soleil — et redemandait la carte d'ombre — sans qu'aucune entrée de
    // lumière ait bougé. Plus le verdict de STYLE du regard, seule entrée de vue de cette passe.
  }, [scene.ambiance, scene.northDeg, scene.ambientLight, scene.weather, gameTime, lightLevel, shadowBox, politique.ombreSoleil]);

  // ── POOL DE FLAQUES (#1245, L1) : monté UNE fois, jamais reconstruit (la réf `pool` est déclarée avec
  // la décision, plus haut). Le compte de lampes ponctuelles entre dans la clé de cache de programme de
  // three (`numPointLights`) : le faire varier recompilerait les 76 matériaux du monde. L'écran ne fait
  // donc plus qu'écrire des intensités.
  useEffect(() => {
    const groupe = flaques.current;
    if (!groupe) return;
    const lampesPonctuelles = createPointLightPool();
    pool.current = lampesPonctuelles;
    for (const l of lampesPonctuelles) groupe.add(l);
    return () => {
      pool.current = [];
      for (const l of lampesPonctuelles) { groupe.remove(l); l.dispose(); }
    };
  }, []);

  // ── ÉCRITURE des flaques : la SEULE chose qui bouge d'une frame à l'autre (intensité, position,
  // portée). Aucun montage, aucun démontage, aucun `visible`. La table appliquée devient celle que la
  // décision suivante relira pour rendre à chaque source SON slot.
  useEffect(() => {
    slotsPrécédents.current = flaquesÉcrites;
    applyPointLights(pool.current, flaquesÉcrites);
    dessiner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaquesÉcrites]);

  // La frame se rejoue à CHAQUE rendu du stage — et, pendant une MARCHE, au battement de celle-ci :
  // c'est la boucle de rendu qui lit alors la position visuelle, pas React (P2-4). L'effet n'a pas de
  // dépendances par CONSTRUCTION : il court après chaque rendu, donc `dessiner` réabonné est toujours
  // celui des props courantes.
  useEffect(() => {
    dessiner();
    return anim?.subscribe(dessiner);
  });

  // Le canevas OCCUPE la boîte du stage : c'est la MÊME boîte que le SVG, donc la même classe
  // (`.iso-stage` — aucun sélecteur de domaine de plus, cf. cliquet CSS `ui-ratchets` xii). Les deux
  // seules choses qui l'en distinguent sont posées ici : il ne reçoit aucun pointeur (les événements
  // restent au SVG, qui interroge ce monde par le rayon inscrit ci-dessus), et il se peint SOUS lui
  // (ordre du DOM).
  // `data-sun` : la SEULE trace lisible du soleil réellement MONTÉ (azimut/élévation, degrés) — un
  // canevas WebGL n'a pas d'arbre à interroger, et la recette navigateur comme les tests de montage ont
  // besoin de savoir SI une directionnelle est là et OÙ elle est. Absent = aucune directionnelle
  // (intérieur, nuit, soleil encore sous son fondu de lever/coucher, ou regard qui n'en monte aucun).
  // `data-lum` : l'EXPOSITION de la frame (luminance d'une surface horizontale, en part d'albédo). C'est
  // par elle que la parité avec la voie affine et la continuité du crépuscule se mesurent à l'écran.
  // `data-lampes` : les flaques ALLUMÉES sur le budget MONTÉ (`allumées/budget`) — le compte de droite
  // ne bouge jamais (c'est tout l'intérêt du pool), celui de gauche tombe à 0 de jour.
  // `data-precip` : le COMPTE de particules du semis d'intempéries — même raison que les deux autres
  // (le canevas n'a pas d'arbre), et la seule trace par laquelle la recette et les tests de montage
  // voient qu'il tombe quelque chose. Absent = rien ne tombe (météo claire, ou scène d'intérieur).
  // `data-vue` : le REGARD de la frame (`affine` | `viewbox` | `pov`) — même raison que les autres traces.
  // `data-sujets` : le nombre de SUJETS que la frame a à peindre en billboard (décor + acteurs), avant
  // toute rasterisation — la seule trace de ce que l'hôte a donné à voir (un banc headless ne rasterise
  // rien, et le canevas n'a pas d'arbre).
  // `data-bake` : le nombre de CUISSONS payées depuis le montage. La rétention par contenu (P3-3) ne se
  // lit nulle part ailleurs : c'est cette trace qui dit qu'un geste d'édition n'a PAS recuit le monde.
  // `data-bg` : la COULEUR D'EFFACEMENT réellement posée sur le renderer. Un banc headless stubbe
  // `setClearColor` en no-op — sans cette trace, la teinte du fond ne serait mesurable nulle part.
  // `data-brume` : le nombre de NAPPES de brume montées dans le volume. Absent = aucune (météo sans
  // brume authorée, intérieur, vue du dessus, première personne).
  return (
    <canvas
      ref={canvasRef}
      className="iso-stage"
      style={{ pointerEvents: 'none' }}
      aria-hidden="true"
      data-sun={lit && course ? `${course.azimuthDeg.toFixed(1)},${course.elevationDeg.toFixed(1)}` : undefined}
      data-lum={lumière.surfaceLuminance.toFixed(4)}
      data-lampes={`${flaquesÉcrites.filter((f) => f && f.intensity > 0).length}/${POINT_LIGHT_BUDGET}`}
      data-precip={champ ? champ.n : undefined}
      data-vue={frame.mode}
      data-bake={cuissons.current}
      data-sujets={subjects.length}
      data-bg={`#${fondCanevas.toString(16).padStart(6, '0')}`}
      data-brume={nappesMontées || undefined}
    />
  );
}
