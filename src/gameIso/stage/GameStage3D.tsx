/**
 * MONDE VOLUMIQUE de l'écran de jeu (#1176, lots P2-2/P2-2b) — la couche MONDE, rendue en three.
 * CONSOMMATEUR
 * pur du stage : il ne lit AUCUN store, ne décide ni cadrage ni visibilité ni dégagement — l'hôte du
 * monde (`stage/MondeDeCampagne`) reste la seule source d'intention.
 *
 * QUATRE CANAUX INDÉPENDANTS, chacun avec ses propres entrées, aucun n'invalidant les autres :
 *  - CUISSON (`bakeWorldGeometry`, `sceneGroundAccents`) : la passe LOURDE, invalidée par la SEULE
 *    scène et la SEULE échelle (`[scene, mpt]`). Ni la marche ni la caméra ne la rejouent.
 *  - DÉGAGEMENT (`applyCutawayMask`, `reposeGroundAccents`) : les masses qui coiffent le groupe cessent
 *    d'être dessinées — l'index du monde cuit se compacte EN PLACE (`[baked, keepEl]`). Une masse
 *    dégagée ne se rend pas, elle ne s'estompe pas.
 *  - TEINTE (`applyVisibilityTint`, `instanceColor` des accents) : la visibilité se réécrit en place
 *    sur les couleurs de sommet (`[baked, tintAt]`).
 *  - POSE : la caméra suit les crans du store (`stage3dCamera`) et, pendant une MARCHE, l'intention
 *    du stage à l'instant de la frame (`anim.cam`) — rien d'autre ne bouge la vue.
 *  - MARCHE (P2-4) : la boucle de rendu lit elle-même le glissement (`anim.glide`) et ne déplace que
 *    les matrices des quads concernés. Aucun rendu React, aucun sommet, aucun matériau.
 *
 * DEUX REGARDS, UN SEUL MONDE (#1176, P3-1a ; #1385) : le cadre de la frame est une UNION
 * (`StageFrame`) que l'hôte unique (`stage/MondeDeCampagne`) sert selon son regard — ortho affine
 * cadrée sur la surcouche de plateau, ou PERSPECTIVE à hauteur d'homme cadrée par la pose du groupe.
 * Tout le reste de cet écran l'ignore : mêmes cuisson, teinte, lumière,
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
 * Cet écran est le SEUL propriétaire de la luminosité — deux en peindraient deux paliers l'un sur
 * l'autre. Les matériaux du monde sont TOUJOURS lambertiens : sans soleil, l'ambiante
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
 * dérivées de la MÊME donnée (`iso.weather`, `src/data/ambiance.json`) :
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
 * Trois GROUPES distincts sous la même scène three : le MONDE (une géométrie, un matériau par groupe de
 * surface — remonté au seul changement de cuisson), les ACCENTS de sol (instanciés, remontés à la teinte)
 * et les BILLBOARDS (invalidés à la case LOGIQUE et à la signature de dessin des sujets, jamais au
 * glissement de marche : celui-ci ne touche que les matrices, dans la boucle).
 * Le canevas est posé SOUS le SVG du stage et sans événements de pointeur : les overlays et les voiles
 * restent au SVG, qui reçoit tous les événements (lot P2-7). Le hit-test de SPRITE, lui, ne peut plus
 * s'y lire — plus aucun jeton n'y porte de `data-cid` : cet écran INSCRIT son lanceur de rayon auprès
 * de `stage/spritePicker.ts`, la couture unique où le pointeur pose la question.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { freeYaw, type ActorCapsule, type Dims, type Rot } from '../../geometry/iso';
import { hauteurDe, type Scene } from '../../state/scene';
import { DIR8_DELTA, DIR8_ORDER, type Dir8 } from '../../state/dir8';
import { reposerAffineCamera, reposerPovCamera, StretchedOrthographicCamera } from '../backends/webgl/cameras';
import { fogCurveOf, povDepth } from '../pov/camera';
import { pxPerM } from '../backends/webgl/worldTris';
import {
  CONVENTION,
  billboardView,
  subjectQuad,
  type BillboardCamera,
} from '../backends/webgl/billboardMath';
import { clearPeriodTextures } from '../backends/webgl/periodTexture';
import { clearFaceBakes } from '../backends/webgl/faceBake';
import { worldSurfaceMaterials, type WorldSurfaceMaterial } from '../backends/webgl/worldMaterials';
import { aretesDeCalage, materiauCalage, materiauxDeCalage } from '../backends/webgl/calageProps';
import {
  actorBillboards,
  actorIdentityKey,
  memesBillboardEls,
  reposerActeurs,
  applyCutawayMask,
  applyFogGamma,
  applyVisibilityTint,
  bakeWorldGeometry,
  collectBillboards,
  contactShadow,
  povBackgroundIndoor,
  povFog,
  reposerBrume,
  reposerCiel,
  skyTexture,
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
import { signalerEntreeEnScene, entreeEnScene } from '../../state/entreeEnScene';
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
  poserTextureStatique,
  writeBoardFrames,
  type BakeAsk,
  type Board,
  type ChromeAt,
  type FrameCamera,
  type FramePick,
  type GlideAt,
} from './boardPose';
import { bbCameraDe, cleRegard, povArtRot, regardsVoisins, type Regard } from './regard';
import { cleStatique, epinglerStatiques, rendreAuRechauffage, textureAuCran, viderTexturesStatiques } from './texturesStatiques';
import {
  PRIORITE_RECHAUFFAGE,
  PRIORITE_VUE_COURANTE,
  atlasBytesEstimés,
  atlasKey,
  bakeAtlas,
  bakeQueueLength,
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
import { mountGroundAccentLots, reposeGroundAccents, sceneGroundAccents, type GroundAccentLot, type SceneGroundAccent } from '../backends/webgl/groundAccents';
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
import { NO_INTERACTION_HALOS, type InteractHalo } from '../builders/interactHalos';
import { HALO_SLOTS, buildHaloMesh } from '../backends/webgl/interactHaloMeshes';
import { poseInteractHalos, type HaloPools } from './interactHaloPose';
import { ndcAt, pickNearestTarget, type PickTarget, type WorldPickMesh } from '../backends/webgl/spriteRaycast';
import { setSpritePicker } from './spritePicker';
import { stage3dFramingFor, stageScreen, viewBoxScreen, type Stage3dFraming } from './stage3dCamera';
import { poserLampesDuCiel, stageLightScalars, type LampesDuCiel } from './stageLights';
import { viewPolicy } from './viewPolicy';
import { applyFlicker, applyPointLights, createPointLightPool, hasFlicker, pointLightWrites, POINT_LIGHT_BUDGET, type PointLightSlots } from './stagePointLights';
import type { LightSource } from '../../state/vision';
import { AMBIANCE, sceneBrume, scenePrecip } from '../catalog/ambiance';
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
import { dimsKey, poserDecalque, type DecalquePosé, type PlaqueDecalque } from './stageDecalque';
import { signalerWebglRefusé } from './webglSupport';
import { materiauProfondeurPerce, percerMateriau, PERCAGE_MAX_HEROS } from '../backends/webgl/percageLocal';
import { creerPercage, type ActeurPerce, type Percage } from './percage';
import type { Lid } from './architectureVisibility';
import { demanderUneImage, signalerImagePeinte, subscribeStageFrames, useBattementContinu } from './stageFrames';
import './iso-stage.css';

/** Clé de verdict des frames SANS découpe locale (première personne, éditeur) : constante, donc le
 *  verdict ne s'y rejoue jamais, et la liste vide y ramène toutes les cibles à zéro. */
const PERCAGE_HORS_PLATEAU = 'percage:hors-plateau';

/** Populations VIDES du verdict `pionsEnDisques` — des singletons de MODULE, et pas des littéraux de
 *  rendu : la rétention des billboards compare des IDENTITÉS (`decorRetenu`/`acteursRetenus`), et un
 *  tableau neuf par rendu démonterait puis remonterait tous les quads du décor à chaque tick. */
const AUCUN_TOKEN: SceneBillboardEls['tokens'] = Object.freeze([]);
const AUCUN_SUJET: BillboardSubject[] = [];

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
  | {
      mode: 'plateau';
      dims: Dims;
      cam: { x: number; y: number };
      /** LACET À L'IMAGE (#1403) : sous rotation continue, l'angle réel se REDEMANDE dans la passe de
       *  dessin — celui de `dims` est celui du dernier commit, donc le cran. Absent chez l'hôte qui ne
       *  tourne pas en continu (l'éditeur). */
      yawAt?: () => number;
      zoom: number;
    }
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
  | {
      mode: 'pov';
      partyPos: { x: number; y: number; z?: number };
      facing: Dir8;
      indoor: boolean;
      cid: string | null;
      /** Hauteur d'œil AU-DESSUS DU SOL (mètres) — absente = le regard DEBOUT (`EYE_H`). Le meneur
       *  ATTABLé la reçoit de sa place (`pov/camera.seatedEyeH`) : assis, on ne voit pas la salle de
       *  la même hauteur. */
      eyeH?: number;
    };

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
  /** Nappes projetées de la carte — la géométrie d'occlusion (`Lid`, `elOccluder`). */
  lids: readonly Lid[];
  /** Alliés candidats au trou, à leur case VISUELLE (arrondie), dans un ordre stable. */
  heros: readonly { cid: string; capsule: ActorCapsule; z: number }[];
}

/**
 * CENTRE DE PROXIMITÉ du montage (#1372) — la position du GROUPE, en CASES, celle dont l'entrée en
 * scène juge ce qui est « proche ». En première personne, c'est la case du meneur, que le cadre porte
 * déjà ; sur la vue de plateau, le BARYCENTRE des héros posés (le seul point qui tienne en combat
 * comme en exploration — le jeton de groupe hors combat entre dans les acteurs, `VolumetricWorld`).
 *
 * `null` quand aucun héros n'est monté : l'éditeur et les planches QC regardent un décor sans groupe,
 * et il n'y a alors ni proximité à trier ni voile à tenir. PURE.
 */
export function centreDuGroupe(frame: StageFrame, actors: readonly ActorPose[]): { x: number; y: number } | null {
  if (frame.mode === 'pov') return { x: frame.partyPos.x, y: frame.partyPos.y };
  const héros = actors.filter((a) => a.c.kind === 'hero');
  if (héros.length === 0) return null;
  return {
    x: héros.reduce((s, a) => s + a.x, 0) / héros.length,
    y: héros.reduce((s, a) => s + a.y, 0) / héros.length,
  };
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
  /** Éléments de scène à billboarder — la sortie des BUILDERS du stage, filtres compris (embuscade,
   *  enrôlé, couverture, étage, hors-vue). Cet écran ne les recalcule PAS. */
  els: SceneBillboardEls;
  /** Acteurs à leur case LOGIQUE — le glissement de marche passe par `anim`, pas par cette liste. */
  actors: readonly ActorPose[];
  /** Horloge de jeu (minutes) — SEULE entrée de la course du soleil, avec le nord de la scène. */
  gameTime: number;
  /** Mise en scène de lumière (`state.lightLevel`, 0..1) : prime sur le palier authoré de la scène,
   *  exactement comme pour le palier authoré de la scène. */
  lightLevel: number | null | undefined;
  /** Sources de lumière PONCTUELLES de la scène (posées + portées) — la MÊME liste que le champ
   *  mécanique de vision consomme (`state/visionState.ts` `sceneLightSources`) : cet écran ne les
   *  recollecte pas, il en monte les flaques (`stage/stagePointLights.ts`). */
  lights: readonly LightSource[];
  /** MARQUES DE CASES du combat (#1176, P3-0c) — la sortie du builder PUR `builders/highlights`. Cet
   *  écran ne les recalcule pas : il les pose à plat dans le monde. */
  highlights?: readonly HighlightEl[];
  /** MARQUES DYNAMIQUES (#1176, P3-0d) — lien d'engagement, contour de l'actif, repère du groupe : la
   *  dérivation pure `builders/dynamicMarks`, en cases LOGIQUES. Leur position se prend à la FRAME, sur
   *  le glissement de `anim` — jamais à un rendu React. */
  dynMarks?: DynamicMarks;
  /** HALOS D'INTERACTION (#1176, P3-0g ; régime de révélation #1687) — un par entité utilisable du
   *  champ, à l'état que la frame lui donne : la dérivation pure `builders/interactHalos`. Leurs
   *  PULSATIONS sont des fonctions de la frame (`stage/interactHaloPose`). Absents ou tous MUETS =
   *  aucun halo, et pas une frame de plus. */
  halos?: readonly InteractHalo[];
  /** ALLURE des jetons (#1176, P3-0f) — fantôme hors Ligne de Vue, corps hors d'action, cible
   *  survolée : la dérivation pure `builders/tokenChrome`, demandée à la FRAME et posée sur le matériau
   *  des quads déjà montés. Absente = aucun jeton ne se distingue. */
  chromeAt?: ChromeAt;
  /** Cadençage de la MARCHE, quand le stage en offre un (lot P2-4) : sans lui, cet écran ne bouge
   *  qu'aux rendus du stage. */
  anim?: StageWalkAnim;
  /** PLAQUE DE DÉCALQUAGE de l'ÉDITEUR (#1176, P3-3, vague B) — la planche calée sous la carte
   *  (#830), montée en QUAD MONDE : `below` sous la matière (le sol la couvre là où il en écrit),
   *  `above` par-dessus tout (rang chrome, sans test de profondeur). Absente en jeu. */
  decalque?: PlaqueDecalque | null;
  /** MODE CALAGE de l'ÉDITEUR : le décor VOLUMIQUE de la scène se rend en aplat cyan translucide,
   *  arêtes soulignées (`backends/webgl/calageProps.ts`), le temps de comparer la planche décalquée à
   *  ce qui est bâti. Surcharge de MATÉRIAU seule : ni la cuisson ni la géométrie du monde ne
   *  bougent, et sortir du mode rend aux groupes leurs matériaux d'origine. Absent en jeu. */
  calage?: boolean;
  /** Cet écran inscrit-il son lanceur de rayon auprès de la couture de picking de sprite
   *  (`stage/spritePicker.ts`) ? Défaut OUI, la vue de plateau du jeu. L'ÉDITEUR (#1176, P3-3) dit
   *  NON : son picking est PUREMENT GÉOMÉTRIQUE (`screenToTileAtZ` sur le SVG d'authoring), et un
   *  picker inscrit ici écraserait celui du jeu — le registre est un singleton. */
  spritePicking?: boolean;
  /** DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) — les entrées du verdict, telles que l'hôte de plateau
   *  les dérive une seule fois (`stage/MondeDeCampagne` : nappes projetées + capsules d'alliés). Cet écran n'en
   *  dérive AUCUNE : deux jeux de nappes/capsules divergeraient de la géométrie d'occlusion, et le
   *  trou s'ouvrirait là où rien n'est caché. Absent (POV, éditeur) = aucun trou. */
  percage?: PercageEntrees | null;
  /** PIONS EN DISQUES (#1176, P3-5c) — le verdict `pionsEnDisques` de `stage/viewPolicy`, tel que
   *  l'hôte le tranche. EXIGÉ chez l'hôte, et pas re-déduit ici de la projection : c'est celui qui
   *  PEINT les disques qui doit éteindre les billboards, jamais l'inverse. L'écran de JEU
   *  (`stage/MondeDeCampagne` → `stage/TokenChromeOverlay`) le passe ; l'ÉDITEUR, lui, regarde aussi son plateau du
   *  dessus mais ne monte AUCUNE surcouche de jeton — il garde donc ses corps en billboard, sans quoi
   *  l'auteur perdrait de vue ses figurants (mesuré : `ui/editor/editeur-monde-volumique.test.tsx`).
   *  Absent = billboards, le régime historique. */
  pionsEnDisques?: boolean;
  /** ENTRÉE EN SCÈNE (#1372) — l'écran signale ici qu'il tient (ou lâche) son voile de chargement :
   *  `true` tant que les sujets dans le rayon d'entrée (`AMBIANCE.entreeEnScene`) n'ont pas leur
   *  texture, `false` ensuite (et au plafond, quoi qu'il arrive). Le VOILE lui-même est du DOM de
   *  l'hôte (`stage/VolumetricWorld.tsx`), posé par-dessus le canevas — cet écran n'ouvre aucun
   *  chemin de rendu pour lui. Absent (éditeur, planches QC) = personne n'écoute, rien ne se voile. */
  onEntreeEnScene?: (enCours: boolean) => void;
}

/**
 * MARCHE lue par la BOUCLE DE RENDU (#1176, P2-4). Le stage reste la seule source d'intention : il
 * décide de la courbe de glissement et du cadrage, cet écran ne fait que les redemander à SA cadence.
 * Sans cet objet, rien ne bouge entre deux rendus React — le contrat d'avant le lot.
 */
export interface StageWalkAnim {
  /** PILOTE D'IMAGES ALTERNATIF — optionnel, et la production n'en fournit AUCUN : l'écran s'abonne
   *  lui-même au battement du module pour son propre dessin. Seuls les bancs s'en servent, pour tenir
   *  la cadence à la main.
   *  INTERDIT d'y passer `subscribeStageFrames` : l'écran y est déjà abonné, et le doublon peint
   *  chaque image deux fois. */
  subscribe?: (onFrame: () => void) => () => void;
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
const abrisRetenus = memoByRefDeps<object, ReturnType<typeof shelterField>>();

/** Les deux populations de textures que le VOILE d'entrée en scène attend : les GABARITS du monde cuit
 *  (colombage, périodes — le sol visuel de la carte, #1399) et les BILLBOARDS du décor. Chacune donne
 *  son jeu de clés à son montage ; le voile ne tombe qu'une fois les deux servies. */
const POPULATIONS_ENTRÉE = ['gabarit', 'billboard'] as const;
type PopulationEntrée = (typeof POPULATIONS_ENTRÉE)[number];

/** LIBÈRE un objet monté et sa descendance : matériaux et géométries, sauf celles marquées
 *  `emprunte` (le bake de `bakeWorldGeometry`, le corps d'un jumeau de silhouette), qui appartiennent
 *  à un autre. La descente est RÉCURSIVE — ce qu'un objet porte en enfant (le jumeau de silhouette
 *  d'un quad, #1297) a son propre matériau à libérer. */
function libererObjet(groupe: THREE.Group, objet: THREE.Object3D): void {
  groupe.remove(objet);
  objet.traverse((o) => {
    const porteur = o as THREE.Mesh;
    if (porteur.material) {
      const mats = Array.isArray(porteur.material) ? porteur.material : [porteur.material];
      for (const m of mats) m.dispose();
    }
    if (porteur.geometry && !porteur.userData.emprunte) porteur.geometry.dispose();
  });
}

/** Libère UN quad et tout ce qu'il porte : son jumeau de silhouette (enfant du quad) et son disque
 *  d'ombre de contact (frère dans le groupe). C'est le geste du SORTANT dans la différence de montage
 *  (#1396) — le groupe entier, lui, ne se vide qu'au départ de l'écran (`viderGroupe`). */
function libererBoard(groupe: THREE.Group, b: Board): void {
  libererObjet(groupe, b.mesh);
  if (b.shadow) libererObjet(groupe, b.shadow as THREE.Object3D);
}

/** Vide un groupe et libère ce qu'il portait — au DÉPART DE L'ÉCRAN seulement : la passe de montage,
 *  elle, travaille par DIFFÉRENCE (#1396). */
function viderGroupe(groupe: THREE.Group): void {
  for (const enfant of [...groupe.children]) libererObjet(groupe, enfant);
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
   *  cet acteur (`chutesRef`, par id, survit aux rebuilds). Le board se reconstruit à chaque pas
   *  commité : pris au montage du board, un pas de plus rejouerait la chute. */
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
    // POIDS ESTIMÉ : la planche connaît sa géométrie avant sa première frame, et le stock est BORNÉ —
    // sans lui, une rafale de cuissons ne pèse rien tant qu'elle n'est pas servie.
    atlasBytesEstimés(r.s.sub.box, r.frames, r.pxHeight),
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

export function GameStage3D({ scene, mpt, frame, tintAt, keepEl, nappeVue, els, actors, gameTime, lightLevel, lights, highlights, dynMarks, halos, chromeAt, anim, decalque, calage = false, spritePicking = true, percage, pionsEnDisques = false, onEntreeEnScene }: GameStage3DProps): JSX.Element {
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
  /** Clés statiques ÉPINGLÉES par SUJET monté (#1374) : celle qu'il PORTE, et celle qu'il ATTEND tant
   *  que sa cuisson court. Le montage y écrit avant même de demander sa texture, chaque repose de
   *  regard y réécrit, et le démontage la vide. */
  const clésStatiquesRef = useRef(new Map<BillboardSubject, string[]>());
  const cameraRef = useRef<THREE.Camera | null>(null);
  /** Le maillage du monde CUIT, vivant — le picking y résout les faces de décor volumique. */
  const mondeMeshRef = useRef<WorldPickMesh | null>(null);
  /** PILOTE de la découpe locale (#1176, M3) — un par écran monté, comme sa scène three. Il tient la
   *  clé du dernier verdict, l'horloge et le fondu des rayons ; les quatre trous qu'il écrit sont, eux,
   *  partagés par tous les matériaux percés du module. Tant qu'un rayon court après sa cible, il tient
   *  une source du battement unique (`stageFrames`) — l'écran y est abonné, et c'est sa passe de dessin
   *  qui fait avancer le fondu. */
  const percageRef = useRef<Percage | null>(null);
  if (!percageRef.current) percageRef.current = creerPercage();
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
  // REGARD COURANT ({cran, cap}) lu par les passes qui NE SE REJOUENT PAS au regard : le montage des
  // quads (dont les textures se résolvent après coup, parfois de l'autre côté d'un changement de
  // regard) et la REPOSE elle-même, qui vérifie à la relève que le regard qu'elle sert est toujours
  // celui qu'on regarde.
  const regard: Regard = { rot: camRot, facing: povFacing };
  const regardRef = useRef(regard);
  regardRef.current = regard;
  // REGARD dont les quads montés portent l'art, par sa CLÉ. Il avance à la repose comme au montage :
  // c'est lui qui distingue « ce regard vient d'être monté » de « le regard a changé ».
  const regardDesBoards = useRef(cleRegard(regard));
  /** BASE de montage des quads (échelle du monde, présence d'ombre de contact) : elle décide si la
   *  passe de montage peut faire une DIFFÉRENCE ou doit tout refaire (#1396). */
  const baseDesBoards = useRef('');
  // MILIEU de la première personne (`null` = vue de plateau) : la SEULE entrée de la brume et du fond.
  // La portée de rendu s'en dérive déjà (`povDepth`) — même donnée, même verdict d'intérieur.
  const povIndoor = frame.mode === 'pov' ? frame.indoor : null;
  // GAMMA de la courbe de brume du milieu (`AMBIANCE.pov.depth`), posé au shader dans la frame.
  const gammaBrume = povIndoor === null ? null : fogCurveOf(povIndoor).gamma;
  // BRUME authorée de la scène (#1247) — même porte que le semis (`sceneWeatherFx` : une météo
  // authorée, jamais en intérieur). Elle a DEUX expressions selon le regard, jamais les deux à la
  // fois : des NAPPES dans le volume sur la vue de plateau, le resserrement de la brume de distance
  // en première personne.
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
  /** LES DEUX CAMÉRAS DE L'ÉCRAN (#1404) — une par regard, montées avec la scène et REPOSÉES à chaque
   *  image (`reposerAffineCamera`/`reposerPovCamera`). Elles ne portent aucune ressource GPU : rien à
   *  libérer, rien à recompiler — la seule chose qu'une image en changeait était leur IDENTITÉ. */
  const camAffine = useRef<StretchedOrthographicCamera>();
  const camPov = useRef<THREE.PerspectiveCamera>();
  /** Le CIEL de la première personne (#1404) : une `DataTexture` montée pour la vie de l'écran, dont
   *  les texels se réécrivent au palier (`reposerCiel`). */
  const cielRef = useRef<THREE.DataTexture | null>(null);
  /** La plaque de décalquage de l'auteur, posée dans son groupe (`stageDecalque.poserDecalque`). */
  const plaqueRef = useRef<DecalquePosé | null>(null);
  if (!three.current) {
    three.current = new THREE.Scene();
    monde.current = new THREE.Group();
    touffes.current = new THREE.Group();
    panneaux.current = new THREE.Group();
    lampes.current = new THREE.Group();
    // Groupe à part de `lampes` : les deux se montent une fois et se REPOSENT, mais ils ne vivent pas
    // des mêmes entrées — le ciel suit l'heure et le palier, les flaques suivent les sources de la
    // scène à la frame. Un groupe partagé ferait varier le compte de lampes ponctuelles que le pool
    // existe justement pour figer.
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
    camAffine.current = new StretchedOrthographicCamera();
    camPov.current = new THREE.PerspectiveCamera();
    three.current.add(monde.current, touffes.current, panneaux.current, lampes.current, flaques.current, intemperies.current, brumes.current, marques.current, marquesDyn.current, halosGroupe.current, decalques.current);
  }

  // Le cache de textures est GLOBAL au module : changer de SCÈNE rend ses entrées mortes (les clés
  // portent l'identité des sujets de l'ancienne carte). Même vidange que les planches QC — sur
  // l'IDENTITÉ de la scène, pas sa référence : un hôte qui la reforge à chaque geste (l'éditeur, une
  // par `pointermove`) vidait sinon toutes les textures du décor à chaque coup de pinceau.
  useEffect(() => () => { viderTexturesStatiques(); clearPeriodTextures(); clearFaceBakes(); }, [scene.id]);

  // ── ENTRÉE EN SCÈNE (#1372) : un voile bref, puis le progressif. Le montage d'une scène demande
  // toutes ses textures à la file cadencée (une par tranche d'inactivité) : sans voile, la carte
  // s'ouvrirait sur des quads qui poppent l'un après l'autre sous les yeux du groupe. Le voile tient
  // donc tant que les sujets DANS LE RAYON (donnée, `AMBIANCE.entreeEnScene`) n'ont pas leur texture,
  // et le lointain arrive derrière, en silence, par la même file.
  const [entréeEnScène, setEntréeEnScène] = useState(true);
  /** Ce que le voile ATTEND (clés préfixées par leur population) — la lecture des résolutions de
   *  texture, hors rendu. */
  const attenteEntréeRef = useRef(new Set<string>());
  /** Les populations qui ont DÉCLARÉ leur jeu de clés pour cette scène. */
  const déclaréesEntréeRef = useRef(new Set<string>());
  /** Le voile est-il encore levé ? (la réf, parce que les résolutions de texture ne rendent pas). */
  const entréeRef = useRef(true);
  const plafondEntréeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** TOMBÉE du voile — une seule fois par scène, quelle qu'en soit la cause (dernière texture proche
   *  posée, ou plafond de sécurité atteint). */
  const finirEntrée = (): void => {
    if (!entréeRef.current) return;
    entréeRef.current = false;
    attenteEntréeRef.current.clear();
    if (plafondEntréeRef.current !== null) clearTimeout(plafondEntréeRef.current);
    plafondEntréeRef.current = null;
    setEntréeEnScène(false);
  };

  /** Le voile a-t-il fini de couvrir ? Un jeu d'attente vide ne suffit pas : il faut que TOUTES les
   *  populations aient parlé — une population encore muette n'a pas de clés parce qu'elle n'a pas
   *  encore monté, pas parce qu'elle n'a rien à faire attendre. */
  const jugerEntrée = (): void => {
    if (attenteEntréeRef.current.size > 0) return;
    if (!POPULATIONS_ENTRÉE.every((p) => déclaréesEntréeRef.current.has(p))) return;
    finirEntrée();
  };

  /** Le jeu de clés qu'une POPULATION donne à attendre, tel que son montage vient de l'établir : il
   *  REMPLACE le sien (un montage suivant ne reprend que ce qui est encore en vol) et laisse celui des
   *  autres intact. Aucune clé nulle part (éditeur sans groupe, scène sans décor proche, monde sans
   *  gabarit) = rien à couvrir, le voile tombe. */
  const attendreEntrée = (population: PopulationEntrée, clés: readonly string[]): void => {
    if (!entréeRef.current) return;
    déclaréesEntréeRef.current.add(population);
    for (const k of [...attenteEntréeRef.current]) if (k.startsWith(`${population}|`)) attenteEntréeRef.current.delete(k);
    for (const k of clés) attenteEntréeRef.current.add(`${population}|${k}`);
    jugerEntrée();
  };

  /** Une texture attendue est arrivée — ou perdue (un sujet sauté n'entrera jamais en scène, il ne
   *  peut pas retenir le voile). */
  const servirEntrée = (population: PopulationEntrée, clé: string): void => {
    if (!entréeRef.current) return;
    attenteEntréeRef.current.delete(`${population}|${clé}`);
    jugerEntrée();
  };

  // ARMEMENT à l'ouverture d'une SCÈNE (montage compris) : le voile se relève, et son PLAFOND part.
  // Sans lui, un SVG qui ne se charge jamais tiendrait l'écran voilé pour toute la session.
  useEffect(() => {
    entréeRef.current = true;
    attenteEntréeRef.current.clear();
    déclaréesEntréeRef.current.clear();
    setEntréeEnScène(true);
    plafondEntréeRef.current = setTimeout(finirEntrée, AMBIANCE.entreeEnScene.plafondMs);
    return () => {
      // Le voile s'ÉTEINT ici, et c'est le seul lieu qui l'éteigne au démontage (#1680) : toute sa
      // file (`finirEntrée`, `attendreEntrée`, `servirEntrée`) ne s'exécute que voile LEVÉ, donc une
      // texture qui arrive — ou qui échoue — après coup ne sert plus rien et ne pose plus
      // `setEntréeEnScène` sur un composant démonté. Sans lui, le rejet tardif d'un billboard
      // (`textureAuCran`, plus bas) faisait tomber le voile hors de la vie du composant.
      entréeRef.current = false;
      if (plafondEntréeRef.current !== null) clearTimeout(plafondEntréeRef.current);
      plafondEntréeRef.current = null;
    };
  }, [scene.id]);

  // La RECETTE apprend le même état par le rendez-vous de la couche state (#1478, `__wfrp.ready`).
  // Il lit la RÉF, pas l'état : au commit qui change `scene.id`, l'armement ci-dessus a déjà reposé
  // `entréeRef.current = true` alors que l'état `entréeEnScène` porte encore la valeur du rendu
  // précédent — signaler l'état ferait passer la scène neuve pour « voile tombé ».
  useEffect(() => {
    signalerEntreeEnScene(scene.id, entréeRef.current);
    // Le démontage n'efface QUE son propre état : un second stage monté depuis (éditeur, planche QC)
    // a déjà posé le sien, et un effacement aveugle le rendrait « aucun monde monté ».
    return () => { if (entreeEnScene().sceneId === scene.id) signalerEntreeEnScene(null, false); };
  }, [scene.id, entréeEnScène]);

  // L'hôte apprend l'état du voile par ce seul canal (il en est le seul rendu, `VolumetricWorld`).
  useEffect(() => {
    onEntreeEnScene?.(entréeEnScène);
  }, [entréeEnScène, onEntreeEnScene]);

  // ── CUISSON : la passe LOURDE (100 à 634 ms selon la carte), RETENUE PAR CONTENU — sur le read-set
  // réel de `worldFaces` (`worldBakeDeps`, `backends/webgl/sceneMeshes.ts`), jamais sur la référence
  // de l'objet scène. En jeu la référence est stable ; à l'ÉDITION elle se reforge au tick, et une
  // cuisson par tick gelait l'écran. Le patron est celui du dépôt (`memoByRefDeps`, semis P2-6,
  // nappes P3-2), keyé sur un jeton d'INSTANCE : deux stages montés côte à côte gardent leur bake
  // (contrat de propriété de `BakedWorld` — une teinte écrase l'autre sur un bake partagé).
  // Le double rendu de montage de `StrictMode` fabrique DEUX jetons, donc deux slots et deux cuissons
  // (dev seulement) : la géométrie du rendu jeté n'est montée dans aucune scène — mesuré, jamais
  // téléversée, donc rien à libérer côté GPU (`stage/gabarits-en-file.test.tsx`).
  const jeton = useRef({}).current;
  const bakeDeps = worldBakeDeps(scene, mpt);
  const baked = bakeRetenu(jeton, bakeDeps, () => bakeWorldGeometry(scene, mpt));
  const geometry = baked.geometry;
  useEffect(() => () => baked.geometry.dispose(), [baked]);
  // CUISSONS RÉELLEMENT PAYÉES depuis le montage — la trace `data-bake` du canevas (un canevas n'a pas
  // d'arbre à interroger) : c'est par elle que la rétention se mesure à l'écran comme au banc.
  const cuissons = useRef(0);
  // PASSES DE DESSIN réellement peintes depuis le montage — la trace `data-rendus` du canevas, écrite
  // par la passe elle-même (une boucle d'image ne commit rien, donc aucun attribut de rendu React ne la
  // verrait). C'est le témoin par lequel « une image, un rendu » se mesure, au banc comme à la recette.
  const rendus = useRef(0);
  const dernierBake = useRef<BakedWorld | null>(null);
  if (dernierBake.current !== baked) {
    dernierBake.current = baked;
    cuissons.current += 1;
  }
  // Les accents de sol sont semés sur les MÊMES faces : même read-set, donc mêmes deps.
  const accents = accentsRetenus(jeton, bakeDeps, () => sceneGroundAccents(scene, mpt));
  // ── DÉGAGEMENT : compactage de l'index du monde cuit (aucun sommet touché, aucun matériau refait).
  // Cette passe PEINT ce qu'elle vient de changer : elle mute une géométrie déjà montée, qu'aucune
  // dépendance du redessin ne voit (l'objet `baked` est le même). Un verdict inchangé n'écrit rien et
  // ne peint rien — c'est le cas courant, un franchissement de cran passant un `KeepEl` neuf pour le
  // même dégagement. Une masse retirée cesse de caster : la carte d'ombre se redemande avec l'image.
  useEffect(() => {
    if (!applyCutawayMask(baked, keepEl).bouge) return;
    ombresARefaire.current = true;
    dessiner();
  }, [baked, keepEl]);
  // ── TEINTE : elle vit plus bas, avec la lumière — son read-set contient le fondu du soleil (#1300).
  // Les touffes d'une nappe dégagée partent avec elle — MÊME loi, appliquée par la REPOSE du semis
  // instancié (deux passes plus bas), jamais par un remontage.
  // BILLBOARDS : leur seule lecture de scène est `heightAt` (`sceneHeightDeps`) — tout le reste leur
  // vient de leurs éléments. Retenus dessus, un pas de combattant (jeu) comme un déplacement d'entité
  // ou de zone (édition) ne re-rasterise plus la planche entière.
  //
  // PIONS EN DISQUES (#1176, P3-5c) : sous ce verdict le monde ne monte AUCUN sujet `kind:'personnage'`
  // — ni combattant, ni meneur de groupe, ni figurant ; ils sont peints en disques par la surcouche SVG
  // (`stage/TokenChromeOverlay`). Le décor (`kind:'prop'`) reste billboard. C'est le SEUL geste : toute
  // la cascade tombe avec la population, par construction — plus de jumeau de silhouette ni d'ombre de
  // contact (montés PAR sujet, plus bas), plus de quad à percer (`percage` cherche un board par `cid`),
  // et plus aucune cible portant un `cid` sous le rayon, donc le clic retombe sur la CASE, où le disque
  // est centré (`useStagePointer.pickVerdict`).
  const hauteurDeps = sceneHeightDeps(scene);
  const elsMonde = useMemo(
    () => (pionsEnDisques ? { tokens: AUCUN_TOKEN, props: els.props } : els),
    [pionsEnDisques, els],
  );
  // ÉLÉMENTS RETENUS PAR CONTENU (#1396) : les builders rendent des tableaux NEUFS à chaque calcul de
  // vue (ils prennent le champ de visibilité) et l'éditeur en reforge à chaque tick d'outil. La
  // rétention vit ICI, au socle, et non chez un hôte : les deux appelants montent le même écran.
  const elsRetenu = useRef<SceneBillboardEls | null>(null);
  if (!elsRetenu.current || !memesBillboardEls(elsRetenu.current, elsMonde)) elsRetenu.current = elsMonde;
  const elsStables = elsRetenu.current;
  // IDENTITÉ des acteurs — qui ils sont et quel art ils portent, JAMAIS où ils sont (`actorIdentityKey`) :
  // la case logique appartient à la pose, que la repose ci-dessous porte aux sujets déjà montés.
  const acteursCle = actors.map(actorIdentityKey).join('|');
  // La TEINTE de visibilité n'entre PAS dans ces rétentions (#1396) : elle se prend à la case du sujet,
  // par la passe de POSE, à la cadence de la frame (`stage/boardPose.poseBoards`).
  const decor = decorRetenu(jeton, [...hauteurDeps, mpt, elsStables], () => collectBillboards(scene, mpt, elsStables));
  const acteurs = acteursRetenus(jeton, [...hauteurDeps, acteursCle, mpt, pionsEnDisques], () => (pionsEnDisques ? AUCUN_SUJET : actorBillboards(actors, scene, mpt)));
  const subjects = useMemo(() => [...decor, ...acteurs], [decor, acteurs]);
  // REPOSE DE POSITION : un acteur qui change de case suit sa case, en place. C'est la passe sœur de
  // la repose de regard — même loi, autre entrée. Elle PEINT sa propre écriture (aucune référence ne
  // bouge sous elle) et redemande la carte d'ombre : le casteur, lui, a bougé.
  useEffect(() => {
    const { ancres, caps } = reposerActeurs(acteurs, actors, scene, mpt);
    // Un cap qui tourne se relève comme un quart de tour : par la repose de regard, sur les seuls
    // quads concernés. Un corps ANIMÉ n'y passe pas — il choisit sa vue par image (`choisirFrame`).
    if (caps.length) reposerRegard(boardsRef.current.filter((b) => caps.includes(b.sub)), regardRef.current);
    if (!ancres && !caps.length) return;
    ombresARefaire.current = true;
    dessiner();
  }, [acteurs, actors, scene, mpt]);
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
  // matériaux est une fonction de la frame, écrite par la passe de pose).
  const poolsHalos = useRef<HaloPools>({});
  // Le SOL d'une case : la hauteur MÉTRIQUE de sa surface, celle où le monde volumique bâtit sa dalle
  // (`builders/floors.ts`) — la couche 0 porte du relief comme les autres, et c'est de là que le
  // glissement vertical de la marche se compte. RETENU sur la scène : c'est une DÉPENDANCE du redessin
  // (la passe de frame le lit), et une fonction neuve par rendu y ferait peindre une image à chaque
  // commit de l'hôte.
  const solM = useCallback(
    (x: number, y: number, z: number) => hauteurDe(scene, { x, y, z }),
    [scene],
  );

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
    [scene.ambiance, scene.northDeg, scene.ambientLight, scene.weather, gameTime, lightLevel, politique.ombreSoleil],
  );
  const { course, lit, fade } = lumière;
  // ── TEINTE : réécriture en place des couleurs de sommet (elle ne retriangule rien). Son read-set
  // porte le FONDU du soleil (#1300) : c'est la porte du modelé de forme — plein sous un ciel qui
  // n'éclaire pas (intérieur, nuit), effacé sous le soleil qui modèle lui-même, et CONTINU entre les
  // deux. Un nombre, donc une dépendance d'effet stable : deux frames de même fondu ne repeignent rien.
  // PORTÉE de ce modelé : les faces du monde CUIT. Les accents de sol (`mountGroundAccentLots`) et
  // les billboards sont des maillages à part, hors `spans` : ils gardent l'exposition horizontale de la
  // frame — ce qui est la bonne famille pour une touffe posée au sol, et un écart déclaré pour un
  // billboard, dont la normale est l'axe caméra et qu'aucune famille d'orientation ne décrit.
  // Elle PEINT sa propre écriture, comme le dégagement : les couleurs de sommet d'un maillage déjà
  // monté ne sont vues par aucune dépendance du redessin. Rien d'écrit, rien de peint — à une
  // exception près, et c'est la MÊME porte : les BILLBOARDS relisent le champ à la POSE (#1396), donc
  // un champ NEUF les concerne même si aucun sommet du monde n'a bougé.
  const champTeinte = useRef<TintAt | null>(null);
  useEffect(() => {
    const bougé = applyVisibilityTint(baked, tintAt, fade).bouge;
    const neuf = champTeinte.current !== tintAt;
    champTeinte.current = tintAt;
    if (bougé || neuf) dessiner();
  }, [baked, tintAt, fade]);
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
  /** Les lampes du CIEL posées dans leur groupe (`stageLights.poserLampesDuCiel`) — la repose de
   *  l'heure écrit dessus, elle ne les remonte pas. */
  const lampesDuCiel = useRef<LampesDuCiel | null>(null);
  // Boîte des CASTEURS (géométrie + quads de billboard) : c'est elle qui serre le frustum d'ombre.
  const shadowBox = useMemo(
    () => worldShadowBox(
      geometry.boundingBox ?? new THREE.Box3(new THREE.Vector3(), new THREE.Vector3(1, 1, 1)),
      subjects,
      (s) => subjectQuad(CONVENTION, s),
    ),
    [geometry, subjects],
  );
  // La boîte par sa VALEUR : ce que le montage des lampes lit d'elle, ce sont ses six nombres. Sa
  // référence, elle, suit celle des SUJETS — une liste reforgée sans qu'aucun casteur n'ait bougé
  // remontait ambiante + soleil, carte d'ombre 2048² comprise.
  const cléBoite = `${shadowBox.min.x},${shadowBox.min.y},${shadowBox.min.z},${shadowBox.max.x},${shadowBox.max.y},${shadowBox.max.z}`;

  // ── INTEMPÉRIES (P2-6) : ce qui TOMBE dans le monde. La PORTE est celle de toutes les vues
  // (`scenePrecip` → `sceneWeatherFx` : une météo authorée, et jamais en intérieur) ; densité, vitesse
  // de chute, vent, taille et teinte viennent tous de la donnée — aucun type de météo n'est nommé ici.
  // `null` = rien ne tombe, et pas une frame ne s'en occupe. Le REGARD ferme cette porte à son tour
  // (`viewPolicy.precipitations`) : au-dessus, une particule vue dans son axe de chute est un point.
  const precip = useMemo(
    () => (politique.precipitations ? scenePrecip(scene) : null),
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
  // Ce read-set est à longueur VARIABLE (une entrée par recette volumique EMPLOYÉE et par matériau qu'elles nomment) : il se porte au
  // retenteur du dépôt, jamais à un hook React, dont le jeu de dépendances doit être de longueur
  // CONSTANTE (`memoByRefDeps` compare longueur PUIS identité, position par position).
  const abris = abrisRetenus(jeton, bakeDeps, () => shelterField(scene));
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
    /**
     * VUE de ce corps À CETTE IMAGE. Le regard a pu tourner depuis le montage du quad : c'est ICI que
     * le franchissement d'un quart se paie, en choisissant une autre planche DÉJÀ CUITE — jamais en
     * rebâtissant le quad. La planche du nouveau cran manque-t-elle ? le corps garde la sienne et sa
     * cuisson est demandée : la relève se fera à l'image où elle arrive (les quatre vues du regard sont
     * réchauffées au montage, `précuire` — ce repli est le cas du cache froid, pas le cas courant).
     */
    const vueDuCran = (def: ClipDef, ground?: 'corpse' | 'prone'): { view: View; mirror: boolean } => {
      const vm = billboardView(bbCameraDe(regard), s.sub.facing);
      if (vm.view === s.view && vm.mirror === s.mirror) return vm;
      if (servie(def, vm.view, vm.mirror)) return vm;
      demanderCuisson({ key: poser(def, vm.view, vm.mirror, ground).key, frame: 0 }, b);
      return { view: s.view, mirror: s.mirror };
    };

    // AMBIANCE AUTHORÉE : le figurant BOUCLE sur l'horloge du registre. Aucune piste, aucun glissement
    // (une entité de scène ne marche pas), aucune orientation par segment.
    if (s.ambient) {
      const vue = vueDuCran(s.ambient);
      const r = poser(s.ambient, vue.view, vue.mirror);
      return { key: r.key, frame: frameIndexAt(animNow(), dureeDeRecette(r), r.frames, true) };
    }

    const g = anim ? anim.glide(id) : null;
    const précédent = glissePrecRef.current.get(id);
    if (g) glissePrecRef.current.set(id, g);
    else glissePrecRef.current.delete(id);

    let def: ClipDef | null;
    let elapsed: number;
    let loop = true;
    // EFFONDREMENT : il se compte depuis l'ENTRÉE AU SOL de l'acteur (`chutesRef`), pas depuis le
    // montage de son board — celui-ci se reconstruit à chaque pas commité. Geste joué une fois : la
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

    let { view, mirror } = vueDuCran(def, ground);
    if (g && précédent) {
      const d8 = dir8DuSegment(g.dx - précédent.dx, g.dz - précédent.dz);
      if (d8) {
        const vm = billboardView(bbCameraDe(regard), d8);
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
      camera = reposerPovCamera(camPov.current!, scene, pos, frame.facing, { w, h }, portee * mpt, frame.eyeH);
    } else {
      // CADRE D'ÉCRAN de l'hôte : les deux conventions du dépôt (`stage3dCamera.ts`) — caméra de
      // groupe sur viewBox FIXE (le jeu), ou viewBox MOBILE mesuré sur le rendu (l'éditeur).
      const écran = frame.mode === 'viewbox'
        ? viewBoxScreen(frame.viewBox, { w, h })
        : stageScreen(anim ? anim.cam() : frame.cam, frame.zoom, { w, h });
      // Le lacet de l'IMAGE quand l'hôte en sert un (#1403) : la même valeur que celle dont sa caméra
      // (`camAt`) vient d'être tirée, sans quoi le sujet cadré dériverait au lieu de tourner.
      const yawImage = frame.mode === 'plateau' ? frame.yawAt : undefined;
      const dimsCadre = yawImage ? { ...frame.dims, yawDeg: yawImage() } : frame.dims;
      f = stage3dFramingFor({ dims: dimsCadre, mpt, screen: écran, canvas: { w, h } });
      const cible = new THREE.Vector3(f.centre.x, f.centre.y, f.centre.z);
      const boite = geometry.boundingBox;
      const rayon = boite ? boite.getSize(new THREE.Vector3()).length() / 2 : 100;
      const distance = Math.max(50, rayon * 4);
      camera = reposerAffineCamera(camAffine.current!, f.kind, f.yawDeg, mpt, f.viewport, {
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
    // marcheur PORTE avec lui, l'EXPOSITION de chaque quad à l'endroit où il vient de se poser, et la
    // TEINTE de visibilité de sa case (#1396 : une valeur de frame, jamais une identité de sujet).
    const aGlissé = poseBoards(boardsRef.current, camera, anim ? anim.glide : AUCUN_GLISSEMENT, {
      pool: pool.current,
      slots: flaquesÉcrites,
      surfaceLuminance: lumière.surfaceLuminance,
    }, chromeAt ?? AUCUN_CHROME, tintAt);
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
        kind: f.kind, // la compensation du pointillé d'anneau se mesure sur l'ellipse écran de la vue
        pionsEnDisques, // pion en disque SVG ⇒ son anneau d'équipe y est peint aussi
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
    // …et jamais quand RIEN NE PROJETTE (`lit` : intérieur, nuit, soleil sous son fondu, regard qui
    // n'en monte aucun) — la passe d'ombres n'a alors pas de directionnelle à rendre, et un pas y
    // demandait tout de même une recuisson par image de glissement (mesuré : 15 par pas).
    if (lit && (aGlissé || ombresARefaire.current)) {
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
    // DÉCOUPE LOCALE PAR OCCLUSION (#1176, M3) — DEUX cadences, et c'est tout le dessin de cette
    // passe : le VERDICT à la CLÉ (pas franchi, quart de tour, étage — `Percage.majVerdict` le refuse
    // de lui-même tant qu'elle ne bouge pas), puis le RAYON et le CENTRE à la frame, tenus par le
    // pilote. Le centre n'est pas un luxe : sous lacet LIBRE (#1176), un demi-tour de caméra ne
    // franchit aucun cran, donc ne change aucune clé.
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
    // Hors vue de plateau (première personne, éditeur), la clé est CONSTANTE et la liste vide : les
    // trous ouverts se REFERMENT au même fondu, ils ne s'éteignent pas d'un coup.
    pilote.majVerdict({
      cle: percage && f ? `${percage.cle}@${cidsPercés}` : PERCAGE_HORS_PLATEAU,
      lids: percage && f ? percage.lids : AUCUNE_NAPPE,
      acteurs: acteursPercés,
    });
    // Le rayon comme le CENTRE appartiennent au pilote : il tient les positions monde par référence et
    // les reprojette avec la caméra de CETTE frame (`Percage.avancer`). Le PAS DE TEMPS aussi lui
    // appartient : il reçoit l'horodatage de l'image, jamais un écart calculé ici.
    pilote.avancer(maintenant, camera, w, h);
    // GAMMA de la courbe de brume (P3-1c) : `THREE.Fog` s'arrête au smoothstep, la courbe du POV est
    // smoothstep^gamma (`fogAt`, `pov/camera.ts`). Le `#define` se pose ici, et pas à un montage : les
    // quads de billboard naissent APRÈS coup (rasterisation asynchrone) et un matériau neuf arriverait
    // sans gamma. La passe ne réécrit que ce qui a changé — hors POV elle ne court pas du tout.
    if (gammaBrume !== null) applyFogGamma(three.current, gammaBrume);
    cameraRef.current = camera; // la caméra de la DERNIÈRE frame : celle que le rayon de picking doit emprunter
    renderer.render(three.current, camera);
    rendus.current++;
    canvas.dataset.rendus = String(rendus.current);
    // `data-file` : ce qui ATTEND encore dans la file cadencée du cuiseur (#1372). Écrit ici, avec le
    // compteur d'images, parce qu'une file se vide entre deux commits React et qu'un attribut de rendu
    // resterait à la valeur du dernier. 0 = cuiseur au repos.
    canvas.dataset.file = String(bakeQueueLength());
    // L'horloge de cession du module voit CETTE image : la boucle ne repeindra pas ce qu'un commit
    // React vient de peindre.
    signalerImagePeinte();
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
  }, [champ]);

  // ── GROUPE DÉCALQUE (#1176, P3-3, vague B) : la plaque de l'auteur, en QUAD MONDE — elle TOURNE donc
  // avec la carte, là où la surcouche SVG qu'elle remplace restait clouée au repère de contenu (le
  // changement de sémantique est déclaré dans `backends/webgl/traceQuad.ts`). Deux régimes, une seule
  // géométrie : SOUS le monde, la plaque garde le test de profondeur — le sol la couvre là où il en
  // écrit un, et elle ne se voit que sur le vide (l'usage « carte neuve ») ; AU-DESSUS, elle passe au
  // rang du chrome SANS test de profondeur, donc par-dessus tout ce que la carte porte déjà.
  // POSÉE UNE FOIS pour la vie de l'écran (`poserDecalque`), puis REPOSÉE (#1404) : l'opacité de la
  // plaque est un CURSEUR, et chaque cran en re-décodait l'image.
  useEffect(() => {
    const groupe = decalques.current;
    if (!groupe) return;
    const posée = poserDecalque(groupe);
    plaqueRef.current = posée;
    return () => { plaqueRef.current = null; posée.déposer(); };
  }, []);

  useEffect(() => {
    const posée = plaqueRef.current;
    if (!posée) return;
    const écrit = posée.reposer(
      decalque && frame.mode !== 'pov' ? { plaque: decalque, dims: frame.dims, mpt } : null,
    );
    if (écrit) dessiner();
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
  }, [planNappes, nappesAuMonde]);

  // MOTIFS CONTINUS (#1378) — une averse qui tombe, une flamme qui vacille, un halo qui pulse vivent
  // hors des rendus React. Chacun TIENT le battement unique du stage (`stageFrames`) tant qu'il est à
  // l'écran, sous une clé d'instance qui lui est propre, et le relâche en s'éteignant : une scène sans
  // pluie, sans feu et sans décor fouillable ne rejoue aucune image. Aucune horloge ici — la cadence
  // comme la cession d'une même image vivent au module, et nulle part ailleurs.
  const vacille = hasFlicker(flaquesÉcrites);
  const pulseHalos = !!halos && halos.some((h) => h.etat !== 'muet');
  // Un CORPS ANIMÉ est un motif comme les autres (#1396) : sa planche de flipbook se choisit PAR IMAGE
  // (`choisirFrame` : respiration au repos, cycle de marche, effondrement d'un corps à terre, et la vue
  // que le regard courant demande). Sans battement, ces gestes n'avancent qu'aux commits React — l'idle
  // se joue par à-coups, un effondrement se fige à mi-chute (corps en l'air) et la vue d'un quart de
  // tour ne se relève qu'au prochain rendu venu d'ailleurs. Le remontage complet des quads à chaque pas
  // le masquait : il peignait une image par quad.
  const corpsAnimés = subjects.some((s) => !!s.frameSvg);
  useBattementContinu(!!champ, 'averse');
  useBattementContinu(vacille, 'vacillement');
  useBattementContinu(pulseHalos, 'halos');
  useBattementContinu(corpsAnimés, 'corps-animés');

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
      return pickNearestTarget(
        camera,
        cibles,
        mondeMeshRef.current,
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
  // surface du milieu (`povFog`), le FOND porte celle du ciel (`skyTexture`) — sans quoi les sols
  // lointains se relèvent vers le bleu froid (cf. le JSDoc d'`AMBIANCE.pov.fogOutdoorSurface`).
  // Les sprites d'entité s'embrument AVEC le monde (three embrume tout matériau `fog`), là où le POV
  // SVG les laissait nets — réf juge de design P3-1.
  // MÉTÉO (#1247) : dehors, la brume authorée REMPLACE la couleur du milieu et resserre la portée ; le
  // FOND suit la même dérivation de teinte que les lampes (`weatherLightScalars`), sans quoi le ciel
  // reste clair au-dessus d'un monde éteint par l'orage. Dedans, rien : `brumePov` y est nul.
  // AMBIANCE (#1176) : ciel ET brume prennent le PALIER de la scène (`lumière.ambianceLum`, le scalaire
  // même qui dose les lampes) — sans lui, une scène de nuit gardait un horizon de plein jour au-dessus
  // d'un sol obéissant, et les sols lointains se relevaient vers une brume diurne.
  // CIEL MONTÉ UNE FOIS (#1404) : la texture du dégradé vit pour l'écran, et un palier d'heure n'en
  // réécrit que les texels (`reposerCiel`). Déclaré AVANT l'effet qui l'emprunte : les effets courent
  // dans l'ordre de déclaration — le ciel est donc monté quand l'atmosphère se pose, et c'est lui qui
  // rend le fond, la brume et le gamma quand l'écran s'en va.
  useEffect(() => {
    const ciel = skyTexture();
    cielRef.current = ciel;
    return () => {
      cielRef.current = null;
      // L'écran s'en va : l'atmosphère qu'il portait s'en va avec son ciel. Le GAMMA en fait partie —
      // les matériaux du monde survivent à cet écran (leur montage a sa propre clé) et garderaient un
      // `#define` sans brume au retour en vue de plateau, une clé de programme de plus pour un
      // exposant que plus personne n'applique.
      const scène3d = three.current;
      if (scène3d) {
        scène3d.background = null;
        scène3d.fog = null;
        applyFogGamma(scène3d, null);
      }
      ciel.dispose();
    };
  }, []);

  useEffect(() => {
    const scène3d = three.current!;
    const ciel = cielRef.current;
    if (!ciel) return;
    // DEHORS : le dégradé de ciel, réécrit EN PLACE dans la texture montée. DEDANS : une couleur, qui
    // ne coûte rien à fabriquer (aucune ressource GPU derrière).
    const cielRéécrit = povIndoor === false ? reposerCiel(ciel, lumière.meteo, lumière.ambianceLum) : false;
    const fond = povIndoor === null ? null : povIndoor ? povBackgroundIndoor(lumière.ambianceLum) : ciel;
    const fondAvant = scène3d.background;
    const brumeAvant = scène3d.fog as THREE.Fog | null;
    // Ciel et brume vivent pour la durée du regard : ni l'un ni l'autre ne se rend à chaque reprise de
    // cet effet (c'est le ciel qui les rend, au démontage de l'écran). `fondAvant`/`brumeAvant` sont
    // donc l'état RÉEL de la scène, et une brume déjà posée se REPOSE au lieu d'être réallouée.
    const brumeRéécrite = povIndoor !== null && brumeAvant !== null
      && reposerBrume(brumeAvant, mpt, povIndoor, brumePov, lumière.ambianceLum);
    if (povIndoor === null) scène3d.fog = null;
    else if (!brumeAvant) scène3d.fog = povFog(mpt, povIndoor, brumePov, lumière.ambianceLum);
    scène3d.background = fond;
    // Un gamma ne survit pas à sa brume (une clé de programme de plus, pour un exposant que plus
    // personne n'applique) : sortir de la première personne le retire des matériaux du monde, qui
    // survivent à cet effet. Le POSER, lui, appartient à la passe de dessin — les quads de billboard
    // naissent après coup.
    const gammaRetiré = !scène3d.fog && applyFogGamma(scène3d, null);
    // On peint sur un changement RÉEL de l'état de la scène, et chaque canal a son témoin : les deux
    // comparaisons de référence voient l'ENTRÉE et la SORTIE de la première personne (fond du ciel ou
    // nappe d'intérieur, brume posée ou retirée) ; les verdicts de repose et de gamma voient ce
    // qu'elles ne peuvent pas voir — mêmes objets, contenu neuf (texels du ciel, paramètres de la
    // brume, `#define` des matériaux du monde).
    if (cielRéécrit || brumeRéécrite || gammaRetiré || fond !== fondAvant || scène3d.fog !== brumeAvant) dessiner();
  }, [povIndoor, mpt, brumePov, lumière.meteo, lumière.ambianceLum]);

  // ── FOND DU CANEVAS (#1247) : effet À PART de la création du renderer, qui n'a AUCUNE dépendance —
  // une couleur d'effacement posée là-bas ne serait plus jamais réappliquée, et le fond resterait au
  // gris de beau temps sous l'orage. Il suit la MÊME dérivation que les lampes et que le ciel du POV
  // (`weatherLightScalars` → `stageClearColor`) : une seule donnée, trois surfaces d'accord.
  useEffect(() => {
    rendererRef.current?.setClearColor(fondCanevas, 1);
    dessiner();
  }, [fondCanevas]);

  // ── GROUPE MONDE : la géométrie fusionnée, un matériau par groupe de surface.
  useEffect(() => {
    const groupe = monde.current;
    const renderer = rendererRef.current;
    if (!groupe || !renderer) {
      // Aucun monde à monter : cette population n'a rien à faire attendre, et le voile ne doit pas
      // rester accroché à une déclaration qui ne viendra pas.
      attendreEntrée('gabarit', []);
      return;
    }
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    // UN MATÉRIAU PAR GROUPE DE SURFACE (`backends/webgl/worldMaterials.ts`, source unique) : la
    // géométrie reste fusionnée, seul le dessin se scinde. Le régime NE BASCULE PLUS avec la lumière :
    // toujours lambertien, même sans soleil — l'ambiante porte alors la scène à elle seule
    // (`stageLights`), et le crépuscule n'a plus de marche d'escalier.
    // EN FILE (#1399) : les gabarits FROIDS (colombage, périodes) partent par la file cadencée du
    // cuiseur au lieu d'être rasterisés dans cet effet — 732 ms de blocage mesurés au chargement. Les
    // matériaux sortent tout de suite, sur la seule couleur de sommet de leur surface, et se RELÈVENT
    // en place (aucun matériau, aucun maillage refait) à mesure que la file sert.
    const { materials, attendues, relèves } = worldSurfaceMaterials(geometry, anisotropy, { enFile: true });
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
    // Le picking d'ENTITÉ lit ce maillage : les plages de décor volumique voyagent dans SA GÉOMÉTRIE,
    // où la cuisson les a posées — rien n'est recopié ici, il n'y a qu'une source.
    mondeMeshRef.current = mesh;
    ombresARefaire.current = true;
    dessiner();
    // VOILE D'ENTRÉE EN SCÈNE : les faces du monde sont le SOL VISUEL de la carte — TOUTES les cuissons
    // froides du montage le tiennent levé, sans filtre de distance (le rayon de proximité ne trie que
    // les billboards : une face n'a pas de position, elle en a autant que le groupe en porte).
    let annulé = false;
    attendreEntrée('gabarit', attendues);
    for (const relève of relèves) {
      void relève.then(({ clé, posé }) => {
        if (annulé) return;
        // Servie RÉSOLUE OU PERDUE : un gabarit qui ne cuira jamais ne peut pas tenir l'écran voilé.
        servirEntrée('gabarit', clé);
        // La relève a muté un matériau DÉJÀ MONTÉ : personne d'autre ne redemandera cette image. Les
        // ombres, elles, ne bougent pas — une `map` de masque ne change ni la géométrie ni l'alpha.
        // Par `dessinerRef` (même raison qu'au flipbook, `demanderCuisson`) : cet effet est keyé sur
        // la seule cuisson, donc le `dessiner` qu'il capture est celui du montage — une image peinte
        // depuis lui rejouerait le point de vue d'alors (mesuré : 48 images sur 62 à l'ancien poste
        // après un déplacement du groupe).
        if (posé) dessinerRef.current();
      });
    }
    return () => {
      annulé = true;
      mondeMeshRef.current = null;
      viderGroupe(groupe); // `viderGroupe` ne connaît que `material` : le matériau de profondeur se libère ici
      profondeurPercée.dispose();
    };
    // Les MATÉRIAUX ne dépendent QUE de la cuisson : ni la teinte (elle vit dans les couleurs de sommet),
    // ni le dégagement (il vit dans l'index), ni l'heure (le régime lambertien ne bascule plus) n'en
    // refont un seul. Remettre `tintAt` ici reconstruisait les 76 matériaux de l'arène à chaque pas
    // (mesuré #1176).
  }, [geometry]);

  // ── MODE CALAGE (ÉDITEUR) : le décor VOLUMIQUE en aplat cyan + arêtes, le temps de comparer la
  // planche décalquée à ce qui est bâti. SURCHARGE de matériau sur le maillage DÉJÀ MONTÉ (les
  // matériaux d'origine sont tenus ici et remis à la sortie) : aucune cuisson, aucune géométrie de
  // monde refaite — un basculement de la case du panneau ne repaie rien de la passe lourde. Les
  // arêtes, elles, sont un maillage de LIGNES à part, bâti des seuls triangles de décor RÉELLEMENT
  // dessinés : d'où le dégagement dans les dépendances (un étage qui s'ôte emporte ses arêtes).
  useEffect(() => {
    // Le maillage du monde, vu par son MATÉRIAU (la référence partagée le type par ce qu'en lit le
    // picking : une géométrie et une matrice monde, rien d'autre).
    const mesh = mondeMeshRef.current as unknown as THREE.Mesh<THREE.BufferGeometry, WorldSurfaceMaterial[]> | null;
    const groupe = monde.current;
    if (!mesh || !groupe || !calage) return;
    const origines = mesh.material;
    const aplat = materiauCalage();
    const surcharge = materiauxDeCalage(origines, geometry, aplat);
    if (!surcharge) {
      aplat.dispose(); // aucune scène de décor volumique : rien à contraster
      return;
    }
    mesh.material = surcharge;
    const aretes = aretesDeCalage(geometry);
    if (aretes) groupe.add(withRenderRank(aretes, 'monde'));
    dessiner();
    return () => {
      mesh.material = origines;
      if (aretes) libererObjet(groupe, aretes);
      aplat.dispose();
      dessiner();
    };
  }, [geometry, calage, keepEl]);

  // ── GROUPE ACCENTS — SEMIS : les instances de touffes/mouchetis, un `InstancedMesh` par lot
  // (type × couleur), montées UNE fois par semis. Séparé du monde car il porte la teinte AUTREMENT
  // (par `instanceColor`) : ni le dégagement ni la teinte n'y refont un mesh, ils s'y REPOSENT (passe
  // suivante). Le CRAN de vue n'entre pas ici (#1376).
  const lotsAccents = useRef<GroundAccentLot[]>([]);
  useEffect(() => {
    const groupe = touffes.current;
    if (!groupe) return;
    // Toujours lambertiens eux aussi — même régime que les faces du monde, dont ils prolongent le sol.
    const lots = mountGroundAccentLots(accents, { lit: true });
    lotsAccents.current = lots;
    for (const { mesh } of lots) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      groupe.add(withRenderRank(mesh, 'monde'));
    }
    return () => {
      lotsAccents.current = [];
      viderGroupe(groupe);
    };
  }, [accents]);

  // ── GROUPE ACCENTS — REPOSE : dégagement par COMPACTION des instances retenues, teinte par
  // `instanceColor`. Un franchissement de cran passe une référence de `KeepEl` neuve pour un verdict
  // identique (le sol n'obéit qu'au dégagement, jamais au lacet) : rien n'est réécrit, donc ni carte
  // d'ombre à recuire ni image à peindre.
  useEffect(() => {
    const { dégagement, teinte } = reposeGroundAccents(lotsAccents.current, keepEl, tintAt);
    if (!dégagement && !teinte) return;
    ombresARefaire.current = true;
    dessiner();
  }, [accents, keepEl, tintAt]);

  // ── POOLS DE MARQUES (P3-0c) : la CAPACITÉ, et rien d'autre. Un pool ne naît, ne grandit ou ne meurt
  // qu'au changement de palier — c'est la seule passe qui alloue une géométrie ou un matériau de marque.
  // Le contenu, lui, s'écrit dans la passe suivante ; le patron est celui du pool de flaques (#1245).
  useEffect(() => {
    const groupe = marques.current;
    if (!groupe) return;
    let bougé = false;
    HIGHLIGHT_SLOTS.forEach((slot, i) => {
      const voulue = capacités[i];
      const courant = poolsMarques.current.get(slot);
      if (courant && courant.instanceMatrix.count === voulue) return;
      if (courant) {
        groupe.remove(courant);
        courant.geometry.dispose();
        (courant.material as THREE.Material).dispose();
        poolsMarques.current.delete(slot);
        bougé = true;
      }
      if (voulue <= 0) return;
      const mesh = buildHighlightMesh(slot, voulue);
      poolsMarques.current.set(slot, mesh);
      groupe.add(mesh);
      bougé = true;
    });
    // Un pool RETIRÉ ne repassera pas par l'écriture qui suit : sa disparition est peinte ici, sans
    // quoi ses marques resteraient à l'écran jusqu'à la prochaine image.
    if (bougé) dessiner();
  }, [clésCapacités]);

  // ── ÉCRITURE des marques : matrices et teintes réécrites EN PLACE dans des pools déjà montés. Aucun
  // montage, aucun démontage, aucune allocation — un tour de combat ne fait que repasser ici. La passe
  // rend son VERDICT par pool : une mise à jour d'état qui laisse les marques où elles sont (survol
  // sans rapport, recalcul d'une même portée) ne peint pas d'image.
  useEffect(() => {
    let bougé = false;
    for (const slot of HIGHLIGHT_SLOTS) {
      const mesh = poolsMarques.current.get(slot);
      if (mesh && writeHighlightInstances(mesh, marquesGroupées.get(slot) ?? [], mpt)) bougé = true;
    }
    if (!bougé) return;
    dessiner();
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
  }, []);

  /** ÉPINGLE, pour un sujet, la texture statique qu'il PORTE et celle qu'il ATTEND (#1374). Le stock
   *  est BORNÉ : évincer la POSÉE laisserait son quad sans art jusqu'à la recuisson, et évincer
   *  l'ATTENDUE la libérerait entre sa cuisson et sa pose — le quad recevrait une texture morte. Deux
   *  clés par sujet au plus : la relevée remplace les deux dès qu'elle est posée.
   *
   *  La carte est keyée par SUJET et non par board : le MONTAGE épingle ce qu'il attend AVANT que le
   *  quad n'existe, exactement comme la repose. */
  const épinglerSujet = (sub: BillboardSubject, clés: readonly string[]): void => {
    clésStatiquesRef.current.set(sub, [...clés]);
    epinglerStatiques([...clésStatiquesRef.current.values()].flat());
  };

  /** La clé de la texture qu'un sujet PORTE (la première de ses épingles). */
  const cléPortée = (sub: BillboardSubject): string | undefined => clésStatiquesRef.current.get(sub)?.[0];

  /**
   * REPOSE d'un changement de REGARD (quart de tour sur la vue de plateau, cap Dir8 en première
   * personne) : les quads montés SURVIVENT, seule leur texture change — échangée EN PLACE, à la
   * relève, exactement comme l'écrivain de frames échange une planche de flipbook. Aucun `dispose`,
   * aucune géométrie neuve, aucun matériau neuf.
   *
   * DEUX POPULATIONS, une seule ici : un corps à FLIPBOOK est déjà servi par le chemin par-frame
   * (`vueDuCran`, qui choisit la planche du regard courant à chaque image) — le reprendre ici lui
   * poserait une image d'UNE frame sur un matériau que la passe d'images réécrit aussitôt. Restent le
   * DÉCOR (dont l'art n'existe qu'aux quarts de tour) et les corps sans couture de frame.
   *
   * La rasterisation d'un regard jamais visité passe par la file CADENCÉE du cuiseur : l'ancienne
   * texture reste à l'écran jusqu'à la relève, et le changement ne coûte pas une rafale de blobs. Ce
   * que la caméra attend passe DEVANT — `PRIORITE_VUE_COURANTE`, poignée RELEVÉE même sur une clé
   * déjà en file (une clé pré-chauffée redemandée sans cela restait servie en dernier).
   */
  const reposerRegard = (bs: readonly Board[], vers: Regard): void => {
    const pxm = pxPerM(mpt);
    const dpr = window.devicePixelRatio || 1;
    const cam = bbCameraDe(vers);
    const clé = cleRegard(vers);
    for (const b of bs) {
      const piste = boardTrackId(b.sub);
      if (piste && flipRef.current.has(piste)) continue;
      const { view, mirror } = billboardView(cam, b.sub.facing);
      const pxHeight = atlasPxHeight(b.quad.heightM, pxm, dpr);
      const cléCible = cleStatique(b.sub, view, mirror, vers.rot, pxHeight);
      const portée = cléPortée(b.sub);
      épinglerSujet(b.sub, portée ? [portée, cléCible] : [cléCible]);
      void textureAuCran(b.sub, view, mirror, vers.rot, pxHeight, PRIORITE_VUE_COURANTE).then(
        (texture) => {
          // Le quad démonté entre-temps (`parent` tombe à `null` au vidage du groupe) et le regard déjà
          // dépassé (une rotation plus rapide que la file) n'ont plus rien à recevoir.
          if (!b.mesh.parent || cleRegard(regardRef.current) !== clé) return;
          poserTextureStatique(b, texture);
          épinglerSujet(b.sub, [cléCible]);
          // UNE image demandée, pas un rendu : N boards relevés dans la même image en obtiennent une
          // seule (`demanderUneImage`, #1376).
          demanderUneImage();
        },
        (raison: unknown) => console.warn(`GameStage3D: billboard « ${b.sub.identity} » gardé au regard précédent — texture non rasterisée :`, raison),
      );
    }
  };

  /**
   * RÉCHAUFFAGE des regards VOISINS d'un regard (`regardsVoisins`) : les textures que le PROCHAIN
   * changement réclamera, posées en temps mort dans la file cadencée — le DÉCOR seul (l'art d'un corps
   * ignore le cran, et ses quatre vues passent par `précuire`).
   *
   * Il court au montage ET à chaque repose : sans le second, une rotation continue trouve chaque
   * deuxième regard FROID (un demi-tour en première personne, N→NE→E→SE, ne réchaufferait jamais que
   * les voisins du cap de départ).
   *
   * PRIORITÉ : `PRIORITE_RECHAUFFAGE`, et l'appel suit la repose — une clé que la relève courante vient
   * de demander garde son rang (`textureAuCran` ne fait que RELEVER une poignée, jamais l'abaisser).
   */
  const réchaufferVoisins = (regard: Regard, sujets: readonly { sub: BillboardSubject; heightM: number }[]): void => {
    const pxm = pxPerM(mpt);
    const dpr = window.devicePixelRatio || 1;
    const voisins = regardsVoisins(regard);
    for (const { sub, heightM } of sujets) {
      if (sub.kind !== 'prop') continue;
      const pxHeight = atlasPxHeight(heightM, pxm, dpr);
      for (const v of voisins) {
        const vm = billboardView(bbCameraDe(v), sub.facing);
        void textureAuCran(sub, vm.view, vm.mirror, v.rot, pxHeight, PRIORITE_RECHAUFFAGE).catch(() => undefined);
      }
    }
  };

  // ── GROUPE BILLBOARDS : décor + acteurs. Rebâti quand les SUJETS changent — l'identité d'un sujet
  // porte sa SIGNATURE DE DESSIN, et elle seule (`actorIdentityKey`) : ni sa case, ni son cap, ni le
  // glissement de la marche n'y entrent. Tous trois se REPOSENT sur des quads déjà montés — la case et
  // le cap par `reposerActeurs` (#1396), le glissement par frame dans `dessiner` (P2-4). Le REGARD n'y
  // entre pas non plus : un quart de tour est une REPOSE (`reposerRegard`), et rebâtir le groupe mesurait
  // 7 matériaux et 6 géométries libérés pour 4 quads sur un banc de trois décors (vue de plateau),
  // 10 matériaux au changement de cap sur le même banc (première personne).
  useEffect(() => {
    const groupe = panneaux.current;
    if (!groupe) return;
    let annule = false;
    const pxm = pxPerM(mpt);
    // REGARD qui choisit la vue d'une entité : en première personne le CAP du meneur (8 états
    // discrets, repère `dir8Basis`), sur la vue de plateau le cran d'art. Le repère se prend au cap et
    // NON à la caméra de la frame : fwd/right recalculés par frame recuiraient toute la planche de
    // textures à chaque frame (le piège que documente `artRot`).
    // Il se lit à la RÉFÉRENCE : cette passe ne se rejoue plus au regard, donc sa fermeture le
    // porterait périmé au premier montage qui suit une rotation ou un changement de cap.
    const monté = regardRef.current;
    const rot = monté.rot;
    const bbCam: BillboardCamera = bbCameraDe(monté);
    regardDesBoards.current = cleRegard(monté);
    const dpr = window.devicePixelRatio || 1;
    // BASE DE MONTAGE : ce dont dépend la GÉOMÉTRIE d'un quad (échelle du monde) et sa composition
    // (ombre de contact sous un soleil qui n'éclaire pas). Elle change ? il n'y a rien à garder.
    // La SCÈNE en fait partie : son changement DISPOSE les textures statiques
    // (`viderTexturesStatiques`), et un survivant garderait une texture morte.
    const base = `${scene.id}|${mpt}|${lit ? 1 : 0}`;
    const memeBase = baseDesBoards.current === base;
    baseDesBoards.current = base;
    // ── DIFFÉRENCE (#1396) : le groupe ne se reconstruit PLUS quand la POPULATION change. Un sujet qui
    // ENTRE dans le champ de vision — ou qui en sort — changeait l'identité de la liste, et les 63
    // quads de l'arène se libéraient pour un seul entrant (mesuré en recette : 0/63 survivants,
    // ~250 buffers, 2 `linkProgram`). Ce qui persiste garde son quad, sa texture et son uuid.
    const voulus = new Map<string, BillboardSubject>();
    for (const sub of subjects) voulus.set(sub.identity, sub);
    const boards: Board[] = [];
    for (const b of boardsRef.current) {
      const neuf = memeBase ? voulus.get(b.sub.identity) : undefined;
      if (!neuf) {
        libererBoard(groupe, b);
        const piste = boardTrackId(b.sub);
        if (piste) { flipRef.current.delete(piste); épinglesRef.current.delete(piste); }
        clésStatiquesRef.current.delete(b.sub);
        continue;
      }
      // Le SUJET est reforgé à chaque calcul de liste (closures de dessin, ancre, case) : le board
      // reprend la référence COURANTE, sinon il poserait la case et l'art d'un tour précédent.
      clésStatiquesRef.current.set(neuf, clésStatiquesRef.current.get(b.sub) ?? []);
      clésStatiquesRef.current.delete(b.sub);
      b.sub = neuf;
      boards.push(b);
    }
    const déjàMontés = new Set(boards.map((b) => b.sub.identity));
    // ÉPINGLES DE TEXTURE : elles se purgent sur la POPULATION, pas sur les boards. Un sujet épinglé
    // AVANT l'arrivée de sa texture (plus bas) puis supersédé n'a jamais eu de quad — sans cette purge
    // il restait épinglé à vie, avec les closures de dessin qu'il capture (mesuré : 20 épingles pour
    // 5 quads après six passes).
    for (const sujet of [...clésStatiquesRef.current.keys()]) {
      if (voulus.get(sujet.identity) !== sujet) clésStatiquesRef.current.delete(sujet);
    }
    setAtlasPins([...épinglesRef.current.values()].flat());
    epinglerStatiques([...clésStatiquesRef.current.values()].flat());
    // PURGE des états PAR ACTEUR : un acteur absent des sujets de ce montage (sorti de la scène, hors
    // du cadre) laisse son palier et son heure de chute derrière lui.
    const joués = new Set<string>();
    for (const sub of subjects) {
      const id = boardTrackId(sub);
      if (id) joués.add(id);
    }
    for (const id of [...paliersRef.current.keys()]) if (!joués.has(id)) paliersRef.current.delete(id);
    for (const id of [...chutesRef.current.keys()]) if (!joués.has(id)) chutesRef.current.delete(id);
    for (const id of [...glissePrecRef.current.keys()]) if (!joués.has(id)) glissePrecRef.current.delete(id);
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

    // ── PISTES DE FLIPBOOK DES SURVIVANTS : le contexte d'animation d'un acteur VIT (un héros entre
    // en combat, un corps tombe). Un sujet gelé au montage garderait `enrolé: false` et un `rig` vide —
    // ses gestes de combat ne seraient jamais cuits, et sa marche perdrait sa monture. Ce qui reste du
    // montage est ce qui décrit l'ART POSÉ (vue, miroir, palier) : la relève de celui-là est l'affaire
    // du regard (`reposerRegard`) et de l'image (`choisirFrame`).
    for (const b of boards) {
      const piste = boardTrackId(b.sub);
      const flip = piste ? flipRef.current.get(piste) : undefined;
      if (!piste || !flip) continue;
      const ctx = b.sub.cid ? animCtxOf(b.sub.cid) : undefined;
      const voie = b.sub.anim?.voie ?? ctx?.voie ?? 'rig';
      const enrolé = !!ctx;
      const auSol = b.sub.anim?.ground;
      const chute = auSol ? (chutesRef.current.get(piste) ?? animNow()) : flip.chute;
      if (auSol) chutesRef.current.set(piste, chute);
      else chutesRef.current.delete(piste);
      const gestesNeufs = flip.enrolé !== enrolé || flip.voie !== voie;
      flip.sub = b.sub;
      flip.voie = voie;
      flip.rig = ctx?.rig ?? {};
      flip.enrolé = enrolé;
      flip.chute = chute;
      if (b.sub.anim?.leap) flip.leap = true; else delete flip.leap;
      // Le SET DE GESTES a changé (entrée en combat, changement de voie) : il se cuit, comme au montage.
      if (gestesNeufs) précuire(flip, piste);
    }

    /** Le quad d'un sujet, monté DÈS QUE SA texture est là — jamais au dernier des sujets. */
    const monter = (q: { sub: BillboardSubject; quad: ReturnType<typeof subjectQuad>; view: View; mirror: boolean; pxHeight: number }, texture: THREE.Texture): void => {
      const geo = new THREE.PlaneGeometry(q.quad.widthM, q.quad.heightM);
      // Matériau NON lambertien (`billboardMaterial`, cf. l'en-tête), monté à la couleur NEUTRE : son
      // exposition appartient à la passe de pose, qui la lui donne dans le `dessiner()` de cette même
      // passe de montage, avant toute peinture — une seconde loi ici en ferait deux à tenir d'accord.
      const mat = billboardMaterial(texture, 1);
      const mesh = new THREE.Mesh(geo, mat);
      // IDENTITÉ DU SUJET PORTÉE PAR LE QUAD (#1401) : la rétention des boards se fait sur
      // `sub.identity` (un quad survit exactement tant que son identité est voulue) ; le `name` la
      // porte CÔTÉ SCÈNE, dans la même veine que le jumeau de silhouette
      // (`boardPose.attachBodySilhouette`), pour qu'un objet monté soit appariable à ce qu'il
      // représente (garde `stage/murage-identite.test.tsx`). Elle est INVARIANTE pour un quad donné :
      // la relève du sujet plus haut (`b.sub = neuf`) ne change que la référence, jamais l'identité —
      // le nom se pose donc UNE fois, au montage.
      mesh.name = q.sub.identity;
      // Un quad PROJETTE son ombre même en Basic (le casteur ne connaît que sa géométrie et son alpha) ;
      // `receiveShadow` n'aurait, lui, aucun effet sous ce matériau. La passe d'ombres rend un matériau
      // de PROFONDEUR, jamais celui-ci : le cadre de frame ne l'atteint que par `customDepthMaterial`
      // (#1334) — à défaut, l'ombre se découpe sur la planche ENTIÈRE (une grille de corps au sol).
      mesh.castShadow = true;
      mesh.customDepthMaterial = billboardDepthMaterial(mat);
      groupe.add(withRenderRank(mesh, 'pions'));
      const board: Board = { sub: q.sub, quad: q.quad, mesh, material: mat };
      boards.push(board);
      épinglerSujet(q.sub, [cleStatique(q.sub, q.view, q.mirror, rot, q.pxHeight)]);
      // SILHOUETTE À TRAVERS LES MURS (#1297, LOT C) : le corps d'un jeton occulté par la matière
      // du monde garde un JUMEAU à test de profondeur retourné, teinté de sa couleur d'équipe —
      // enfant du quad, donc porté par la MÊME pose (aucune écriture de plus par frame). Les deux
      // regards du cadre en héritent : c'est le montage des quads, pas une passe de vue.
      // Un sujet sans équipe (décor, figurant) n'en reçoit aucun : il n'y a rien à y signaler.
      if (q.sub.teamColor) attachBodySilhouette(board, q.sub.teamColor);
      // Ombre de CONTACT : le rig ne porte aucune ellipse au pied (le décor, si). Elle entre dans le
      // board — donc dans la passe de pose, donc elle suit le sujet qui glisse, et c'est là que sa
      // teinte de visibilité s'applique (#1396). Sous le soleil, c'est l'ombre PROJETÉE qui fait foi
      // (`wantsContactShadow`) — sinon le personnage en porte deux.
      if (wantsContactShadow(q.sub.kind, lit)) {
        const disque = contactShadow(q.sub, q.quad);
        // Le disque est un FRÈRE du quad dans le groupe (jamais son enfant : sa pose est propre) — il
        // porte donc l'identité de son sujet lui-même, sinon rien ne le rattacherait à ce qu'il ombre.
        disque.name = q.sub.identity;
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
        // AMBIANCE : le clip de repos du corps (`rig/anim/ambientClips`) pour
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
      // Une texture arrivée APRÈS un changement de regard monte son quad à l'art du regard précédent :
      // il se repose comme les autres, sans attendre le changement suivant.
      if (cleRegard(regardRef.current) !== cleRegard(monté)) {
        reposerRegard([board], regardRef.current);
      }
      ombresARefaire.current = true;
      dessiner();
    };

    // ORDRE DE PROXIMITÉ (#1372) : le montage sert les sujets du plus PROCHE du groupe au plus
    // lointain. La file range par priorité PUIS par rang d'entrée (`queueBakeTask`) — à priorité
    // égale, l'ordre d'enfilement EST l'ordre de service, et c'est lui, seul, que ce tri fixe.
    // Sans centre de groupe (éditeur, planche QC), aucune proximité n'a de sens : l'ordre reste celui
    // des sujets, et la distance INFINIE qui en découle ne tient aucun voile d'entrée en scène.
    const centre = centreDuGroupe(frame, actors);
    const àMonter = subjects.filter((sub) => !déjàMontés.has(sub.identity)).map((sub) => {
      // Le quad se taille sur la BOÎTE du sujet : un composite plus haut que la boîte canonique
      // (couple monté) gagne du quad au lieu d'être tranché à la rasterisation.
      const quad = subjectQuad(CONVENTION, sub);
      const { view, mirror } = billboardView(bbCam, sub.facing);
      // PALIER de la texture de MONTAGE : le palier CSS du billboard PORTÉ AU RAPPORT DE PIXELS du rendu
      // (`atlasPxHeight`, #1328) — le renderer peint en pixels de dispositif (`setPixelRatio`), et une
      // texture cuite en pixels CSS y est sous-résolue d'autant. C'est le MÊME palier que celui des
      // planches de flipbook du sujet (`FlipbookSujet.pxHeight` le reprend) : un acteur ne change pas de
      // netteté en passant de sa texture de montage à sa première planche.
      const pxHeight = atlasPxHeight(quad.heightM, pxm, dpr);
      const distance = centre ? Math.hypot(sub.anchor.x - centre.x * mpt, sub.anchor.z - centre.y * mpt) : Infinity;
      return { sub, quad, view, mirror, pxHeight, distance, clé: cleStatique(sub, view, mirror, rot, pxHeight) };
    });
    àMonter.sort((a, b) => a.distance - b.distance);
    // VOILE D'ENTRÉE EN SCÈNE : ce que le groupe a SOUS LES YEUX (rayon en donnée) le tient levé ; le
    // lointain arrivera derrière, en silence, par la même file.
    attendreEntrée('billboard', àMonter.filter((q) => q.distance <= AMBIANCE.entreeEnScene.rayonM).map((q) => q.clé));
    for (const q of àMonter) {
      // ÉPINGLE de ce que le montage ATTEND, posée AVANT la demande — même geste que la repose : sous
      // pression de budget, une texture non épinglée est libérable entre sa cuisson et sa pose, et le
      // quad entrerait en scène sur une texture morte.
      épinglerSujet(q.sub, [q.clé]);
      // RÉSOLUTION INDIVIDUELLE : chaque board entre en scène dès SA texture rasterisée. Sous un
      // `allSettled`, le groupe entier attendait le dernier sujet — et un sujet rejeté n'y laissait
      // rien du tout. Ici, une texture rejetée ne coûte que SON quad, et le reste est déjà à l'écran.
      void textureAuCran(q.sub, q.view, q.mirror, rot, q.pxHeight, PRIORITE_VUE_COURANTE).then(
        (texture) => {
          if (!annule) monter(q, texture);
          servirEntrée('billboard', q.clé);
        },
        (raison: unknown) => {
          if (!annule) console.warn(`GameStage3D: billboard « ${q.sub.identity} » sauté — texture non rasterisée :`, raison);
          servirEntrée('billboard', q.clé);
        },
      );
    }
    // PRÉ-CHAUFFE des regards VOISINS, en temps mort (même patron que `précuire` pour les acteurs, et
    // la même file) : le premier passage par un regard neuf trouve alors sa texture au cache au lieu
    // de la réclamer à la rotation. COÛT : quatre textures par décor au lieu d'une sur la vue de
    // plateau (le plafond qu'un tour complet atteignait déjà, atteint plus tôt), trois en première
    // personne sur huit caps possibles. Le cache se vide au changement de scène
    // (`viderTexturesStatiques`).
    réchaufferVoisins(monté, subjects.map((sub) => ({ sub, heightM: subjectQuad(CONVENTION, sub).heightM })));
    // Ce teardown court à CHAQUE changement de sujets, PAS seulement au démontage : il n'y a donc
    // rien à libérer ici (la passe suivante fait la différence). Il ne fait qu'annuler les textures en
    // vol — une texture servie après coup monterait un quad que la différence n'a pas voulu.
    return () => { annule = true; };
  }, [subjects, mpt, lit]);

  // ── VIDAGE FINAL : l'écran s'en va. C'est le SEUL endroit qui libère le groupe entier — la passe de
  // montage, elle, ne libère que les sortants.
  useEffect(() => () => {
    const groupe = panneaux.current;
    boardsRef.current = [];
    flipRef.current.clear();
    épinglesRef.current.clear();
    clésStatiquesRef.current.clear();
    setAtlasPins([]);
    epinglerStatiques([]);
    if (groupe) viderGroupe(groupe);
  }, []);

  // ── CHANGEMENT DE REGARD (quart de tour de plateau, cap Dir8 en première personne) : la REPOSE, et
  // rien d'autre. Le montage ci-dessus vient-il de poser CE regard (sujets changés) ? alors il n'y a
  // rien à reprendre — c'est le seul office de `regardDesBoards`. La comparaison porte sur la CLÉ du
  // regard, jamais sur le seul cran : deux caps voisins partagent le même cran (`povArtRot`
  // planchérise huit caps sur quatre), et le cap N→NE ne reposerait alors rien.
  useEffect(() => {
    const clé = cleRegard(regard);
    if (regardDesBoards.current === clé) return;
    regardDesBoards.current = clé;
    // Les relèves du regard QUITTÉ redescendent d'abord au réchauffage : la caméra ne les attend plus,
    // et laissées en tête de file elles feraient patienter celles du regard courant (une rotation
    // tenue en pose trois jeux avant de s'arrêter). Ce geste précède la repose, qui relève ce qu'elle
    // demande.
    rendreAuRechauffage();
    reposerRegard(boardsRef.current, regard);
    // …puis les VOISINS du regard d'arrivée, DERRIÈRE la relève : une rotation continue trouve ainsi
    // son regard suivant déjà cuit, et le regard quitté — rabaissé juste au-dessus — redevient un
    // voisin réchauffé.
    réchaufferVoisins(regard, boardsRef.current.map((b) => ({ sub: b.sub, heightM: b.quad.heightM })));
  }, [camRot, povFacing]);

  // L'EXPOSITION des billboards appartient à la passe de POSE (`poseBoards`) : elle dépend de l'endroit
  // où chaque sujet se pose, donc elle se recalcule à la cadence de la frame — c'est ainsi qu'un
  // personnage entre dans une flaque en marchant. Un changement d'exposition redessine par la
  // dépendance qui le porte (`lumière.surfaceLuminance`) : l'heure et le palier la portent aux
  // matériaux déjà montés, sans rerasteriser.

  // ── GROUPE LAMPES : posé UNE fois pour la vie de l'écran (`poserLampesDuCiel`). Groupe à part des
  // trois autres car il vit sur d'autres entrées (l'heure, le palier de lumière, la boîte des
  // casteurs) et ne coûte ni géométrie ni matériau.
  useEffect(() => {
    const groupe = lampes.current;
    if (!groupe) return;
    const pose = poserLampesDuCiel(groupe);
    lampesDuCiel.current = pose;
    return () => { lampesDuCiel.current = null; pose.déposer(); };
  }, []);

  // ── REPOSE DES LAMPES (#1401) : une heure qui avance ÉCRIT des intensités, une teinte et une
  // direction sur les lampes POSÉES au-dessus. Aucune lampe ne se remonte ; le seul montage qui reste
  // est le franchissement du régime solaire, et il vit dans `poserLampesDuCiel`. Garde :
  // `stage/murage-identite.test.tsx`, geste « une heure ».
  useEffect(() => {
    const pose = lampesDuCiel.current;
    if (!pose) return;
    pose.reposer({ scene, gameTime, lightLevel, shadowBox, ombreSoleil: politique.ombreSoleil });
    ombresARefaire.current = true;
    dessiner();
    // Dépendances = le read-set des scalaires ci-dessus (`stageLightScalars`), CHAMP PAR CHAMP et
    // jamais la référence de scène (un hôte qui la reforge par tick redemanderait la carte d'ombre
    // sans qu'aucune entrée de lumière ait bougé) ; plus le verdict de STYLE du regard, seule entrée
    // de vue de cette passe, et la boîte des casteurs par sa VALEUR (`cléBoite`) — jamais par sa
    // référence, qui suit les sujets.
  }, [scene.ambiance, scene.northDeg, scene.ambientLight, scene.weather, gameTime, lightLevel, cléBoite, politique.ombreSoleil]);

  // ── POOL DE FLAQUES (#1245, L1) : monté UNE fois, jamais reconstruit (la réf `pool` est déclarée avec
  // la décision, plus haut). Le compte de lampes ponctuelles entre dans la clé de cache de programme de
  // three (`numPointLights`) : le faire varier recompilerait les 76 matériaux du monde. L'écran fait
  // donc seulement écrire des intensités.
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
  }, [flaquesÉcrites]);

  // ABONNEMENT AU BATTEMENT (`stage/stageFrames`) : l'écran tient SON dessin du battement unique, quel
  // que soit l'hôte qui le monte et sans aucune prop — l'éditeur en monte un sans `anim`, et sa pluie
  // doit tomber comme en jeu. La frame rejouée lit `dessinerRef`, donc toujours les props courantes.
  useEffect(() => subscribeStageFrames(() => dessinerRef.current()), []);
  // PILOTE D'IMAGES ALTERNATIF (bancs) : une horloge tenue à la main, en plus du battement. Il ne se
  // rebranche qu'au changement de SOURCE, jamais à chaque rendu — l'objet `anim` que l'hôte reforge
  // par rendu n'en est pas une.
  const battement = anim?.subscribe;
  useEffect(() => battement?.(() => dessinerRef.current()), [battement]);

  // REDESSIN : une image par CAUSE, jamais par commit (#1371). Le tableau ci-dessous est l'INVENTAIRE
  // des lectures de `dessiner` qui ne sont pas des réfs — cadre (le REGARD comme le cadrage en
  // descendent), échelle, scène, monde cuit, brume du milieu et son gamma, exposition, flaques, allure
  // des quads, marques dynamiques, halos, sol, verdict de pions, semis, couvert, écrêtage, entrées de
  // découpe. Ce qu'il ne nomme pas n'est pas dessiné d'ici : ce sont les MUTATIONS d'objets déjà
  // montés — dégagement de l'index, teinte des sommets, pools, groupes — dont chaque effet peint sa
  // propre écriture (aucune référence ne bouge sous elles, donc aucune dépendance ne les verrait).
  // Le PILOTE d'images (`anim`) n'y entre PAS, et c'est structurel : ce qu'il porte (glissement,
  // cadrage vivant) se relit à la cadence de la FRAME, par le battement, sur `dessinerRef` — donc
  // toujours à sa valeur courante ; l'hôte en reforge un objet par rendu, et l'inscrire ici rendrait
  // ce tableau inopérant.
  useEffect(() => {
    dessiner();
  }, [frame, mpt, scene, geometry, brumePov, gammaBrume, lumière.surfaceLuminance, flaquesÉcrites, chromeAt, dynMarks, halos, solM, pionsEnDisques, champ, sousCouvert, ecrete, percage]);

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
  // par elle que la continuité du crépuscule se mesure à l'écran.
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
  // `data-rendus` : le compte de passes DESSINÉES depuis le montage. Il n'est pas posé ici mais par la
  // passe elle-même (`dessiner`) : une boucle d'image ne commit rien, donc un attribut de rendu React
  // resterait à la valeur du dernier commit.
  // `data-file` : même famille, même raison — ce qui attend dans la file du cuiseur, écrit par la passe.
  // `data-voile` : l'ENTRÉE EN SCÈNE en cours (#1372). Absent = le voile est tombé. Le voile lui-même
  // est du DOM de l'hôte : cet attribut est ce que la garde et la recette lisent sur le canevas.
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
      data-voile={entréeEnScène ? '1' : undefined}
    />
  );
}
