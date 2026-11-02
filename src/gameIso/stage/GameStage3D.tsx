/**
 * MONDE VOLUMIQUE de l'écran de jeu (#1176) — la couche MONDE, rendue en three.
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
 *  - MARCHE : la boucle de rendu lit elle-même le glissement (`anim.glide`) et ne déplace que
 *    les matrices des quads concernés. Aucun rendu React, aucun sommet, aucun matériau.
 *
 * DEUX REGARDS, UN SEUL MONDE (#1176 ; #1385) : le cadre de la frame est une UNION
 * (`StageFrame`) que l'hôte unique (`stage/MondeDeCampagne`) sert selon son regard — ortho affine
 * cadrée sur la surcouche de plateau, ou PERSPECTIVE à hauteur d'homme cadrée par la pose du groupe.
 * Tout le reste de cet écran l'ignore : mêmes cuisson, teinte, lumière,
 * billboards et intempéries. La première personne n'a ni marques de sol, ni halos, ni picker inscrit —
 * ce sont des affordances de la vue de plateau, et le POV n'en a jamais porté.
 *
 * LUMIÈRE : le CANEVAS porte toute la luminosité de la scène — une ambiante au palier de lumière
 * du moment et, dehors et de jour, un SOLEIL qui suit l'heure d'horloge et le nord de la carte
 * (`stage/stageLights.ts`, décision ; cet écran ne fait que monter ses lampes et brancher les ombres).
 * FLAQUES (#1245) : les sources PONCTUELLES de la scène (brasero posé, lanterne portée — la liste que
 * le champ mécanique de vision consomme) posent leur lumière par un POOL de compte FIXE dont seules les
 * intensités bougent (`stage/stagePointLights.ts`, décision ; le pool ne se monte qu'une fois).
 * Cet écran est le SEUL propriétaire de la luminosité — deux en peindraient deux paliers l'un sur
 * l'autre. Les matériaux du monde sont TOUJOURS lambertiens : sans soleil, l'ambiante
 * seule les porte, et le lever/coucher n'a plus de régime à basculer.
 * Les BILLBOARDS, eux, ne le sont jamais : la normale d'un quad aligné écran est l'axe caméra, un
 * lambertien y mesurerait l'angle caméra↔soleil et la luminosité d'un décor suivrait la rotation
 * de la vue. Leur lumière est donc un SCALAIRE, mais un scalaire PAR SUJET (#1245, L3) : l'exposition
 * de la frame (`surfaceLuminance`) PLUS les flaques qui l'atteignent, par la même loi que le sol
 * (`billboardExposure`) — sans quoi le sol s'allume et le décor reste plat. RÉSIDU : un décor sous
 * l'ombre portée d'un bâtiment garde l'exposition de la frame, et la flaque qu'il reçoit est
 * omnidirectionnelle.
 *
 * INTEMPÉRIES (#1247) : la météo authorée de la scène a TROIS expressions dans le volume, toutes
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
 * et les BILLBOARDS du décor (invalidés à la signature de dessin des sujets).
 * Le canevas est posé SOUS le SVG du stage et sans événements de pointeur : les overlays et les voiles
 * restent au SVG, qui reçoit tous les événements. Cet écran inscrit le lanceur de rayon du décor
 * auprès de `stage/spritePicker.ts`, la couture unique où le pointeur pose la question.
 */
import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { freeYaw, type Dims, type Rot } from '../../geometry/iso';
import { hauteurDe, type LectureDArete, type Scene } from '../../noyau/monde/scene';
import type { Dir8 } from '../../geometry/dir8';
import { reposerAffineCamera, reposerPovCamera, StretchedOrthographicCamera } from '../backends/webgl/cameras';
import { fogCurveOf, povDepth } from '../pov/camera';
import { pxPerM } from '../backends/webgl/worldTris';
import {
  billboardView,
  subjectQuad,
  type BillboardCamera,
} from '../backends/webgl/billboardMath';
import { clearPeriodTextures } from '../backends/webgl/periodTexture';
import { clearFaceBakes } from '../backends/webgl/faceBake';
import { worldSurfaceMaterials, type WorldSurfaceMaterial } from '../backends/webgl/worldMaterials';
import { aretesDeCalage, materiauCalage, materiauxDeCalage } from '../backends/webgl/calageProps';
import {
  memesBillboardEls,
  applyCutawayMask,
  applyFogGamma,
  applyVisibilityTint,
  bakeWorldGeometry,
  collectBillboards,
  povBackgroundIndoor,
  povFog,
  reposerBrume,
  reposerCiel,
  skyTexture,
  stageClearColor,
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
import { memoByRefDeps } from '../../noyau/monde/sceneMemo';
import { useVersionDesDatasets } from '../../ui/useVersionDesDatasets';
import { signalerEntreeEnScene, entreeEnScene } from '../../state/entreeEnScene';
import {
  DPR_PLAFOND,
  atlasPxHeight,
  billboardMaterial,
  poseBoards,
  poserTextureStatique,
  AUCUN_CHROME,
  type Board,
  type ChromeAt,
  type FrameCamera,
  type GlideAt,
} from './boardPose';
import { bbCameraDe, cleRegard, povArtRot, regardsVoisins, type Regard } from './regard';
import { cleStatique, epinglerStatiques, rendreAuRechauffage, textureAuCran, viderTexturesStatiques } from './texturesStatiques';
import { PRIORITE_RECHAUFFAGE, PRIORITE_VUE_COURANTE, bakeQueueLength } from '../backends/webgl/atlasBake';
import { installImpactClock } from '../fx/impactClock';
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
import type { LightSource } from '../../noyau/monde/vision';
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
import { demanderUneImage, signalerImagePeinte, subscribeStageFrames, useBattementContinu } from './stageFrames';
import './iso-stage.css';


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
 * Le POV N'ENTRE PAS dans `ProjKind`/`Dims` (#1176) : la projection affine, le picking et les
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
   * Regard de PLATEAU cadré par un VIEWBOX MOBILE (#1176) — la convention de l'ÉDITEUR de scènes
   * (`ui/editor/EditorCanvas.tsx`) : aucune caméra de groupe, le viewBox rendu EST le cadrage, et
   * l'échelle se prend sur le RENDU (`viewBoxScreen`, cadre en pixels mesuré) parce que la CSS
   * rétrécit l'élément. Tout le reste de cet écran l'ignore : c'est le même regard de plateau.
   */
  | { mode: 'viewbox'; dims: Dims; viewBox: { x: number; y: number; w: number; h: number } }
  /**
   * Regard PREMIÈRE PERSONNE : la case du groupe, son cap, et le milieu (dont dépend la portée).
   * `cid` = le sujet dont le GLISSEMENT de marche déplace l'œil (`anim.glide`) : la caméra suit la
   * position CONTINUE du meneur, comme la caméra volumique affine suit `anim.cam()`. ARBITRAGE
   * D'INGÉNIERIE (#1176) : le pas-à-pas du POV SVG était une forme
   * du PEINTRE (une projection recalculée par pas), pas une intention de jeu — `makeCamera` accepte
   * une position continue, et les billboards du monde glissent déjà.
   * Le LACET, lui, reste SEC : `facing` est un `Dir8`, donc l'œil pivote de 45° d'un coup là où la
   * position, elle, glisse. Statu quo du POV SVG — même arbitrage d'ingénierie.
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
  /** Lecture des arêtes cuites (`buildWalls`) : `auteur` à l'éditeur, `jeu` en partie. EXPLICITE. */
  lecture: LectureDArete;
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
   *  mécanique de vision consomme (`noyau/visionState.ts` `sceneLightSources`) : cet écran ne les
   *  recollecte pas, il en monte les flaques (`stage/stagePointLights.ts`). */
  lights: readonly LightSource[];
  /** MARQUES DE CASES du combat (#1176) — la sortie du builder PUR `builders/highlights`. Cet
   *  écran ne les recalcule pas : il les pose à plat dans le monde. */
  highlights?: readonly HighlightEl[];
  /** MARQUES DYNAMIQUES (#1176) — lien d'engagement, contour de l'actif, repère du groupe : la
   *  dérivation pure `builders/dynamicMarks`, en cases LOGIQUES. Leur position se prend à la FRAME, sur
   *  le glissement de `anim` — jamais à un rendu React. */
  dynMarks?: DynamicMarks;
  /** HALOS D'INTERACTION (#1176 ; régime de révélation #1687) — un par entité utilisable du
   *  champ, à l'état que la frame lui donne : la dérivation pure `builders/interactHalos`. Leurs
   *  PULSATIONS sont des fonctions de la frame (`stage/interactHaloPose`). Absents ou tous MUETS =
   *  aucun halo, et pas une frame de plus. */
  halos?: readonly InteractHalo[];
  /** ALLURE des jetons (#1176) — fantôme hors Ligne de Vue, corps hors d'action, cible
   *  survolée : la dérivation pure `builders/tokenChrome`, demandée à la FRAME et posée sur le matériau
   *  des quads déjà montés. Absente = aucun jeton ne se distingue. */
  chromeAt?: ChromeAt;
  /** Cadençage de la MARCHE, quand le stage en offre un : sans lui, cet écran ne bouge
   *  qu'aux rendus du stage. */
  anim?: StageWalkAnim;
  /** PLAQUE DE DÉCALQUAGE de l'ÉDITEUR (#1176, vague B) — la planche calée sous la carte
   *  (#830), montée en QUAD MONDE : `below` sous la matière (le sol la couvre là où il en écrit),
   *  `above` par-dessus tout (rang chrome, sans test de profondeur). Absente en jeu. */
  decalque?: PlaqueDecalque | null;
  /** MODE CALAGE de l'ÉDITEUR : le décor VOLUMIQUE de la scène se rend en aplat cyan translucide,
   *  arêtes soulignées (`backends/webgl/calageProps.ts`), le temps de comparer la planche décalquée à
   *  ce qui est bâti. Surcharge de MATÉRIAU seule : ni la cuisson ni la géométrie du monde ne
   *  bougent, et sortir du mode rend aux groupes leurs matériaux d'origine. Absent en jeu. */
  calage?: boolean;
  /** Cet écran inscrit-il son lanceur de rayon auprès de la couture de picking
   *  (`stage/spritePicker.ts`) ? Défaut OUI, la vue de plateau du jeu. L'ÉDITEUR (#1176) dit
   *  NON : son picking est PUREMENT GÉOMÉTRIQUE (`screenToTileAtZ` sur le SVG d'authoring), et un
   *  picker inscrit ici écraserait celui du jeu — le registre est un singleton. */
  spritePicking?: boolean;
  /** PIONS EN DISQUES (#1176) — le verdict `pionsEnDisques` de `stage/viewPolicy`, tel que
   *  l'hôte le tranche : le pion en disque SVG porte aussi son anneau d'équipe (`dynamicMarkPose`).
   *  Absent = l'anneau se pose au monde. */
  pionsEnDisques?: boolean;
  /** ENTRÉE EN SCÈNE (#1372) — l'écran signale ici qu'il tient (ou lâche) son voile de chargement :
   *  `true` tant que les sujets dans le rayon d'entrée (`AMBIANCE.entreeEnScene`) n'ont pas leur
   *  texture, `false` ensuite (et au plafond, quoi qu'il arrive). Le VOILE lui-même est du DOM de
   *  l'hôte (`stage/VolumetricWorld.tsx`), posé par-dessus le canevas — cet écran n'ouvre aucun
   *  chemin de rendu pour lui. Absent (éditeur, planches QC) = personne n'écoute, rien ne se voile. */
  onEntreeEnScene?: (enCours: boolean) => void;
}

/**
 * MARCHE lue par la BOUCLE DE RENDU (#1176). Le stage reste la seule source d'intention : il
 * décide de la courbe de glissement et du cadrage, cet écran ne fait que les redemander à SA cadence.
 * Sans cet objet, rien ne bouge entre deux rendus React.
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

/** RÉTENTIONS PAR CONTENU des passes lourdes de cet écran (#1176) — le patron canonique du
 *  dépôt (`noyau/monde/sceneMemo.ts`), un slot par INSTANCE de stage (la clé est un jeton de composant) et
 *  par passe. Les deps sont les READ-SETS exportés par le module qui fait le travail, jamais une liste
 *  devinée ici : `worldBakeDeps` pour la cuisson et les accents, `sceneHeightDeps` pour les
 *  billboards. */
const bakeRetenu = memoByRefDeps<object, BakedWorld>();
const accentsRetenus = memoByRefDeps<object, SceneGroundAccent[]>();
const decorRetenu = memoByRefDeps<object, BillboardSubject[]>();
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

/** Vide un groupe et libère ce qu'il portait — au DÉPART DE L'ÉCRAN seulement : la passe de montage,
 *  elle, ne libère que les sortants que la succession lui rend (`succession`, #1396). */
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

export function GameStage3D({ scene, lecture, mpt, frame, tintAt, keepEl, nappeVue, els, actors, gameTime, lightLevel, lights, highlights, dynMarks, halos, chromeAt, anim, decalque, calage = false, spritePicking = true, pionsEnDisques = false, onEntreeEnScene }: GameStage3DProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const boardsRef = useRef<Board[]>([]);
  /** Clés statiques ÉPINGLÉES par SUJET monté (#1374) : celle qu'il PORTE, et celle qu'il ATTEND tant
   *  que sa cuisson court. Le montage y écrit avant même de demander sa texture, chaque repose de
   *  regard y réécrit, et le démontage la vide. */
  const clésStatiquesRef = useRef(new Map<BillboardSubject, string[]>());
  const cameraRef = useRef<THREE.Camera | null>(null);
  /** Le maillage du monde CUIT, vivant — le picking y résout les faces de décor volumique. */
  const mondeMeshRef = useRef<WorldPickMesh | null>(null);
  const pov = frame.mode === 'pov';
  // STYLE DE CE REGARD (#1176, `viewPolicy`) : ce que la vue choisit de MONTRER — les nappes de
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
  /** BASE de montage des quads (scène, échelle du monde) : elle décide si la
   *  passe de montage fait une succession ou doit tout refaire (#1396). */
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

  const three = useRef<THREE.Scene | undefined>(undefined);
  const monde = useRef<THREE.Group | undefined>(undefined);
  const touffes = useRef<THREE.Group | undefined>(undefined);
  const panneaux = useRef<THREE.Group | undefined>(undefined);
  const lampes = useRef<THREE.Group | undefined>(undefined);
  const flaques = useRef<THREE.Group | undefined>(undefined);
  const intemperies = useRef<THREE.Group | undefined>(undefined);
  const brumes = useRef<THREE.Group | undefined>(undefined);
  const marques = useRef<THREE.Group | undefined>(undefined);
  const marquesDyn = useRef<THREE.Group | undefined>(undefined);
  const halosGroupe = useRef<THREE.Group | undefined>(undefined);
  const decalques = useRef<THREE.Group | undefined>(undefined);
  /** LES DEUX CAMÉRAS DE L'ÉCRAN (#1404) — une par regard, montées avec la scène et REPOSÉES à chaque
   *  image (`reposerAffineCamera`/`reposerPovCamera`). Elles ne portent aucune ressource GPU : rien à
   *  libérer, rien à recompiler — la seule chose qu'une image en changeait était leur IDENTITÉ. */
  const camAffine = useRef<StretchedOrthographicCamera | undefined>(undefined);
  const camPov = useRef<THREE.PerspectiveCamera | undefined>(undefined);
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
    // Groupe des MARQUES : monté une fois, jamais vidé par événement de combat — ses pools ne
    // se redimensionnent qu'au PALIER de capacité, leur contenu se réécrit en place.
    marques.current = new THREE.Group();
    // Groupe FRÈRE des marques DYNAMIQUES : à part parce que ses pools ne dépendent d'AUCUNE
    // capacité d'état — ils sont montés une fois à capacité fixe, et réécrits à la FRAME (jamais à un
    // rendu React, comme les marques de case du groupe voisin).
    marquesDyn.current = new THREE.Group();
    // Groupe des HALOS D'INTERACTION : même politique que le précédent — capacité fixe, contenu
    // réécrit à la frame. À part de lui parce qu'il vit hors du combat, et que ses pools PULSENT (leur
    // opacité de matériau change à chaque frame, cf. `stage/interactHaloPose`).
    halosGroupe.current = new THREE.Group();
    // Groupe de la PLAQUE DE DÉCALQUAGE (éditeur) : à part de tout le reste — elle ne vit ni de
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
  // cuisson par tick gelait l'écran. Le patron est celui du dépôt (`memoByRefDeps`, semis,
  // nappes), keyé sur un jeton d'INSTANCE : deux stages montés côte à côte gardent leur bake
  // (contrat de propriété de `BakedWorld` — une teinte écrase l'autre sur un bake partagé).
  // Le double rendu de montage de `StrictMode` fabrique DEUX jetons, donc deux slots et deux cuissons
  // (dev seulement) : la géométrie du rendu jeté n'est montée dans aucune scène — mesuré, jamais
  // téléversée, donc rien à libérer côté GPU (`stage/gabarits-en-file.test.tsx`).
  const jeton = useRef({}).current;
  const bakeDeps = [...worldBakeDeps(scene, mpt), lecture];
  const baked = bakeRetenu(jeton, bakeDeps, () => bakeWorldGeometry(scene, mpt, lecture));
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
  const accents = accentsRetenus(jeton, bakeDeps, () => sceneGroundAccents(scene, mpt, lecture));
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
  // vient de leurs éléments. Retenus dessus, un déplacement d'entité ou de zone (édition) ne
  // re-rasterise plus la planche entière. Ce sont les seuls sujets du groupe (#3160) : aucun personnage
  // n'y est dessiné, et le clic retombe sur la CASE (`useStagePointer.pickVerdict`).
  const hauteurDeps = sceneHeightDeps(scene);
  // ÉLÉMENTS RETENUS PAR CONTENU (#1396) : les builders rendent des tableaux NEUFS à chaque calcul de
  // vue (ils prennent le champ de visibilité) et l'éditeur en reforge à chaque tick d'outil. La
  // rétention vit ICI, au socle, et non chez un hôte : les deux appelants montent le même écran.
  const elsRetenu = useRef<SceneBillboardEls | null>(null);
  if (!elsRetenu.current || !memesBillboardEls(elsRetenu.current, els)) elsRetenu.current = els;
  const elsStables = elsRetenu.current;
  // VERSION DES CATALOGUES (`useVersionDesDatasets`) : les sujets la hachent (`DrawSnapshot`), et une
  // édition au Codex (`CodexEdit`, modale au-dessus du jeu monté) doit relancer ce rendu pour la voir.
  const versionCatalogues = useVersionDesDatasets();
  // La TEINTE de visibilité n'entre PAS dans cette rétention (#1396) : elle se prend à la case du sujet,
  // par la passe de POSE, à la cadence de la frame (`stage/boardPose.poseBoards`).
  const subjects = decorRetenu(jeton, [...hauteurDeps, mpt, elsStables, versionCatalogues], () => collectBillboards(scene, mpt, elsStables));
  // ── MARQUES DE CASES : les éléments du builder, rangés par SLOT de montage. La CAPACITÉ des
  // pools ne suit que les paliers (`slotCapacity`) — un anneau de cible qui apparaît ne redimensionne
  // rien, il s'écrit dans le pool déjà là.
  const marquesGroupées = useMemo(() => groupHighlights(highlights ?? []), [highlights]);
  const capacités = useMemo(
    () => HIGHLIGHT_SLOTS.map((s) => slotCapacity(marquesGroupées.get(s)?.length ?? 0)),
    [marquesGroupées],
  );
  const clésCapacités = capacités.join(',');
  const poolsMarques = useRef(new Map<HighlightSlot, THREE.InstancedMesh>());
  // ── MARQUES DYNAMIQUES : trois pools à capacité FIXE, montés une fois (l'effet plus bas).
  // Leur contenu ne se déduit d'aucun état React — il se réécrit à la frame, dans `dessiner`.
  const poolsDyn = useRef<DynMarkPools>({});
  // ── HALOS D'INTERACTION : même politique de pool, et un contenu qui BAT (l'opacité de leurs
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

  // ── LUMIÈRE : la DÉCISION est prise en scalaires purs (`stageLights.ts`), l'écran n'en monte
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
      subjectQuad,
    ),
    [geometry, subjects],
  );
  // La boîte par sa VALEUR : ce que le montage des lampes lit d'elle, ce sont ses six nombres. Sa
  // référence, elle, suit celle des SUJETS — une liste reforgée sans qu'aucun casteur n'ait bougé
  // remontait ambiante + soleil, carte d'ombre 2048² comprise.
  const cléBoite = `${shadowBox.min.x},${shadowBox.min.y},${shadowBox.min.z},${shadowBox.max.x},${shadowBox.max.y},${shadowBox.max.z}`;

  // ── INTEMPÉRIES : ce qui TOMBE dans le monde. La PORTE est celle de toutes les vues
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

  /** UNE frame : cadre le canevas sur son élément, dérive la caméra de l'intention du stage, re-pose les
   *  quads face à elle (glissement de marche compris), dessine. Rien n'y est construit : cette passe est
   *  celle que la MARCHE rejoue soixante fois par seconde, hors de tout rendu React. */
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
    // reste. C'est elle que la passe de pose relit pour exposer les billboards — le décor au pied du
    // braséro bat donc avec sa flaque, et par UNE seule valeur : celle que three va rendre.
    applyFlicker(pool.current, flaquesÉcrites, performance.now() / 1000);
    // Quads ALIGNÉS ÉCRAN, ancrés aux PIEDS (`stage/boardPose.ts`, la passe pure) : l'EXPOSITION de
    // chaque quad à l'endroit où il est posé, et la TEINTE de visibilité de sa case (#1396 : une valeur
    // de frame, jamais une identité de sujet).
    poseBoards(boardsRef.current, camera, { pool: pool.current, surfaceLuminance: lumière.surfaceLuminance }, tintAt);
    // MARQUES DYNAMIQUES et HALOS D'INTERACTION : ils suivent la glisse de marche (`anim.glide`), à
    // la frame — un lien d'engagement posé à un rendu React
    // attendrait le marcheur à l'arrivée. Marques de sol et halos se mesurent à l'ÉCRAN d'une vue
    // affine (`kind`/`yawDeg`) : la première personne n'en pose aucun (#1176).
    if (f) {
      poseDynamicMarks(poolsDyn.current, dynMarks ?? NO_DYNAMIC_MARKS, {
        mpt,
        glide: anim ? anim.glide : AUCUN_GLISSEMENT,
        groundM: solM,
        kind: f.kind, // la compensation du pointillé d'anneau se mesure sur l'ellipse écran de la vue
        pionsEnDisques, // pion en disque SVG ⇒ son anneau d'équipe y est peint aussi
        yawDeg: f.yawDeg, // les tirets de l'anneau d'équipe se mesurent à l'ÉCRAN : ils suivent la vue
        chromeAt: chromeAt ?? AUCUN_CHROME, // l'allure du jeton (fantôme, estompé) teinte son anneau
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
    // CARTE D'OMBRE : elle ne se recuit QUE quand ce qu'elle contient a bougé — un montage (lampes,
    // monde, billboards) qui l'a demandée. Une rotation de caméra, un zoom : la carte 2048² de la frame
    // précédente reste valide. …et jamais quand RIEN NE PROJETTE (`lit` : intérieur, nuit, soleil sous
    // son fondu, regard qui n'en monte aucun) — la passe d'ombres n'a alors pas de directionnelle à rendre.
    if (lit && ombresARefaire.current) {
      renderer.shadowMap.needsUpdate = true;
      ombresARefaire.current = false;
    }
    // CHUTE : les particules avancent à la cadence RÉELLE de la frame, ici et nulle part
    // ailleurs — aucun rendu React, aucune allocation, aucune entropie. Le pas est BORNÉ : un
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
    // GAMMA de la courbe de brume : `THREE.Fog` s'arrête au smoothstep, la courbe du POV est
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

  // ── GROUPE DÉCALQUE (#1176, vague B) : la plaque de l'auteur, en QUAD MONDE — elle TOURNE donc
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
  useBattementContinu(!!champ, 'averse');
  useBattementContinu(vacille, 'vacillement');
  useBattementContinu(pulseHalos, 'halos');

  // Le rayon nomme les décors volumiques et les billboards occultent sans nommer.
  // L'inscription suit le montage du plateau ; la première personne n'offre pas de clic.
  useEffect(() => {
    if (pov || !spritePicking) return;
    setSpritePicker((clientX, clientY) => {
      const canvas = canvasRef.current;
      const camera = cameraRef.current;
      if (!canvas || !camera) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      // Seul ce qui est VU se pointe.
      const cibles: PickTarget[] = boardsRef.current.filter((b) => b.mesh.visible).map((b) => ({ object: b.mesh }));
      return pickNearestTarget(
        camera,
        cibles,
        mondeMeshRef.current,
        ndcAt({ x: clientX - rect.left, y: clientY - rect.top }, { w: rect.width, h: rect.height }),
      );
    });
    return () => setSpritePicker(null);
  }, [pov, spritePicking]);

  // HORLOGE D'IMPACT : l'écran monté l'INSTALLE — c'est elle qui émet `ANIM_IMPACT`. Installée ici, et
  // non chez un hôte de vue, parce que TOUS les hôtes du monde volumique passent par cet écran ; elle
  // dédoublonne elle-même (`fx/impactClock.installImpactClock`).
  useEffect(() => installImpactClock(), []);

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
    // Le PLAFOND vit avec le palier de rasterisation des billboards (`boardPose.DPR_PLAFOND`) : le canevas
    // se peint en pixels de DISPOSITIF, et une texture cuite en pixels CSS y serait sous-résolue d'autant.
    renderer.setPixelRatio(Math.min(DPR_PLAFOND, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    // La carte d'ombre ne se recuit PAS à chaque frame : rien ne la périme tant que ni le soleil ni un
    // casteur n'ont bougé, et la boucle de marche rend soixante fois par seconde. C'est
    // `dessiner` qui la redemande, au cas par cas (`shadowMap.needsUpdate`).
    renderer.shadowMap.autoUpdate = false;
    ombresARefaire.current = true;
    // three 0.185 ne rend plus `PCFSoftShadowMap` : le moteur le remplace lui-même par
    // `PCFShadowMap` à la première frame ombrée en criant à la console — on pose donc directement le
    // filtre réellement appliqué (rendu identique, console propre).
    renderer.shadowMap.type = THREE.PCFShadowMap;
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // ── BRUME & CIEL : la première personne a un HORIZON, la vue de plateau n'en a pas — hors
  // POV, `scene.fog` reste NUL (une brume de distance y délaverait le bord de carte, et les planches
  // QC de l'iso avec). DEUX couleurs, et c'est structurel : les SURFACES se fondent dans la brume de
  // surface du milieu (`povFog`), le FOND porte celle du ciel (`skyTexture`) — sans quoi les sols
  // lointains se relèvent vers le bleu froid (cf. le JSDoc d'`AMBIANCE.pov.fogOutdoorSurface`).
  // Les billboards de décor s'embrument AVEC le monde : three embrume tout matériau `fog` (#1176).
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
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.userData.emprunte = true;
    // Le monde caste et reçoit TOUJOURS : sans lampe à ombre, three ne compile aucun chemin d'ombre —
    // ces deux drapeaux ne coûtent alors rien, et le matériau cesse de dépendre de l'heure.
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
        // Par `dessinerRef` : cet effet est keyé sur
        // la seule cuisson, donc le `dessiner` qu'il capture est celui du montage — une image peinte
        // depuis lui rejouerait le point de vue d'alors (mesuré : 48 images sur 62 à l'ancien poste
        // après un déplacement du groupe).
        if (posé) dessinerRef.current();
      });
    }
    return () => {
      annulé = true;
      mondeMeshRef.current = null;
      viderGroupe(groupe);
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

  // ── POOLS DE MARQUES : la CAPACITÉ, et rien d'autre. Un pool ne naît, ne grandit ou ne meurt
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

  // ── POOLS DYNAMIQUES : montés UNE fois, à capacité fixe, et jamais retouchés jusqu'à la mort
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
      // SILHOUETTE À TRAVERS LES MURS (#1297) : l'anneau d'équipe seul reçoit son jumeau à test
      // de profondeur retourné — un pool de plus, pas un objet par acteur.
      if (slot === 'anneau') groupe.add(buildSilhouetteTwin(mesh));
    }
    dessiner();
    return () => {
      viderGroupe(groupe); // le jumeau y est marqué `emprunte` : sa géométrie est celle de l'original
      for (const slot of DYN_MARK_SLOTS) delete pools[slot];
    };
  }, []);

  // ── POOLS DE HALOS : même politique que les pools dynamiques ci-dessus — montés UNE fois, à
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
   * relève. Aucun `dispose`, aucune géométrie neuve, aucun matériau neuf.
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
   * changement réclamera, posées en temps mort dans la file cadencée.
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
      const pxHeight = atlasPxHeight(heightM, pxm, dpr);
      for (const v of voisins) {
        const vm = billboardView(bbCameraDe(v), sub.facing);
        void textureAuCran(sub, vm.view, vm.mirror, v.rot, pxHeight, PRIORITE_RECHAUFFAGE).catch(() => undefined);
      }
    }
  };

  // Le groupe de décor dépend des sujets ; le regard se pose par `reposerRegard`.
  useEffect(() => {
    const groupe = panneaux.current;
    if (!groupe) return;
    let annule = false;
    const pxm = pxPerM(mpt);
    // REGARD qui choisit la vue d'un décor : en première personne le CAP du meneur (8 états discrets),
    // sur la vue de plateau le cran d'art. Il se lit à la RÉFÉRENCE : cette passe ne se rejoue pas au
    // regard, donc sa fermeture le porterait périmé au premier montage qui suit une rotation.
    const monté = regardRef.current;
    const rot = monté.rot;
    const bbCam: BillboardCamera = bbCameraDe(monté);
    regardDesBoards.current = cleRegard(monté);
    const dpr = window.devicePixelRatio || 1;
    // BASE DE MONTAGE : ce dont dépend la GÉOMÉTRIE d'un quad (échelle du monde). La SCÈNE en fait
    // partie : son changement DISPOSE les textures statiques (`viderTexturesStatiques`), et un quad
    // gardé porterait une texture morte. Elle change ? il n'y a rien à garder.
    const base = `${scene.id}|${mpt}`;
    const memeBase = baseDesBoards.current === base;
    baseDesBoards.current = base;
    // SUCCESSION (#1396) : un sujet qui entre dans le champ de vision, ou qui en sort, ne coûte que son
    // propre board. Un sujet déjà monté garde son quad, sa texture et son uuid ; il reprend la
    // référence COURANTE du sujet, reforgé à chaque calcul de liste.
    const voulus = new Map<string, BillboardSubject>();
    for (const sub of subjects) voulus.set(sub.identity, sub);
    let libéré = false;
    const boards = boardsRef.current.filter((b) => {
      const neuf = memeBase ? voulus.get(b.sub.identity) : undefined;
      if (!neuf) {
        libererObjet(groupe, b.mesh);
        clésStatiquesRef.current.delete(b.sub);
        libéré = true;
        return false;
      }
      if (b.sub !== neuf) {
        clésStatiquesRef.current.set(neuf, clésStatiquesRef.current.get(b.sub) ?? []);
        clésStatiquesRef.current.delete(b.sub);
        b.sub = neuf;
      }
      return true;
    });
    boardsRef.current = boards;
    if (libéré) ombresARefaire.current = true;
    // ÉPINGLES DE TEXTURE : elles se purgent sur la POPULATION, pas sur les boards. Un sujet épinglé
    // AVANT l'arrivée de sa texture (plus bas) puis supersédé n'a jamais eu de quad — sans cette purge
    // il restait épinglé à vie, avec les closures de dessin qu'il capture.
    for (const sujet of [...clésStatiquesRef.current.keys()]) {
      if (voulus.get(sujet.identity) !== sujet) clésStatiquesRef.current.delete(sujet);
    }
    epinglerStatiques([...clésStatiquesRef.current.values()].flat());
    const déjàMontés = new Set(boards.map((b) => b.sub.identity));

    /** Le quad d'un sujet, monté DÈS QUE SA texture est là — jamais au dernier des sujets. */
    const monter = (q: { sub: BillboardSubject; quad: ReturnType<typeof subjectQuad>; clé: string }, texture: THREE.Texture): void => {
      const geo = new THREE.PlaneGeometry(q.quad.widthM, q.quad.heightM);
      // Matériau NON lambertien (`billboardMaterial`, cf. l'en-tête), monté à la couleur NEUTRE : son
      // exposition appartient à la passe de pose, qui la lui donne dans le `dessiner()` de cette même
      // passe de montage, avant toute peinture.
      const mat = billboardMaterial(texture, 1);
      const mesh = new THREE.Mesh(geo, mat);
      // IDENTITÉ DU SUJET PORTÉE PAR LE QUAD (#1401) : le `name` la porte CÔTÉ SCÈNE, pour qu'un objet
      // monté soit appariable à ce qu'il représente (garde `stage/murage-identite.test.tsx`).
      mesh.name = q.sub.identity;
      // Un quad PROJETTE son ombre même en Basic (le casteur ne connaît que sa géométrie et son alpha).
      mesh.castShadow = true;
      groupe.add(withRenderRank(mesh, 'pions'));
      const board: Board = { sub: q.sub, quad: q.quad, mesh, material: mat };
      boards.push(board);
      épinglerSujet(q.sub, [q.clé]);
      // Une texture arrivée APRÈS un changement de regard monte son quad à l'art du regard précédent :
      // il se repose comme les autres, sans attendre le changement suivant.
      if (cleRegard(regardRef.current) !== cleRegard(monté)) reposerRegard([board], regardRef.current);
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
      const quad = subjectQuad(sub);
      const { view, mirror } = billboardView(bbCam, sub.facing);
      // PALIER de la texture : le palier CSS du billboard PORTÉ AU RAPPORT DE PIXELS du rendu
      // (`atlasPxHeight`, #1328) — le renderer peint en pixels de dispositif (`setPixelRatio`).
      const pxHeight = atlasPxHeight(quad.heightM, pxm, dpr);
      const distance = centre ? Math.hypot(sub.anchor.x - centre.x * mpt, sub.anchor.z - centre.y * mpt) : Infinity;
      return { sub, quad, view, mirror, pxHeight, distance, clé: cleStatique(sub, view, mirror, rot, pxHeight) };
    });
    àMonter.sort((a, b) => a.distance - b.distance);
    // VOILE D'ENTRÉE EN SCÈNE : ce que le groupe a SOUS LES YEUX (rayon en donnée) le tient levé ; le
    // lointain arrivera derrière, en silence, par la même file.
    attendreEntrée('billboard', àMonter.filter((q) => q.distance <= AMBIANCE.entreeEnScene.rayonM).map((q) => q.clé));
    for (const q of àMonter) {
      // ÉPINGLE de ce que le montage ATTEND, posée AVANT la demande : sous pression de budget, une
      // texture non épinglée est libérable entre sa cuisson et sa pose.
      épinglerSujet(q.sub, [q.clé]);
      // RÉSOLUTION INDIVIDUELLE : chaque board entre en scène dès SA texture rasterisée ; une texture
      // rejetée ne coûte que SON quad.
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
    // PRÉ-CHAUFFE des regards VOISINS, en temps mort : le premier passage par un regard neuf trouve
    // alors sa texture au cache au lieu de la réclamer à la rotation. Le cache se vide au changement
    // de scène (`viderTexturesStatiques`).
    réchaufferVoisins(monté, subjects.map((sub) => ({ sub, heightM: subjectQuad(sub).heightM })));
    // Ce teardown court à CHAQUE changement de sujets, PAS seulement au démontage : il n'y a donc
    // rien à libérer ici (la passe suivante fait la succession). Il ne fait qu'annuler les textures en
    // vol — une texture servie après coup monterait un quad qu'aucune attente ne réclame.
    return () => { annule = true; };
  }, [subjects, mpt]);

  // ── VIDAGE FINAL : l'écran s'en va. C'est le SEUL endroit qui libère le groupe entier — la passe de
  // montage, elle, ne libère que les sortants.
  useEffect(() => () => {
    const groupe = panneaux.current;
    boardsRef.current = [];
    clésStatiquesRef.current.clear();
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
  // où chaque sujet se pose, donc elle se recalcule à la cadence de la frame (le vacillement fait battre
  // les lampes). Un changement d'exposition redessine par la
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
  }, [frame, mpt, scene, geometry, brumePov, gammaBrume, lumière.surfaceLuminance, flaquesÉcrites, chromeAt, dynMarks, halos, solM, pionsEnDisques, champ, sousCouvert, ecrete]);

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
  // `data-sujets` : le nombre de SUJETS que la frame a à peindre en billboard (le décor), avant
  // toute rasterisation — la seule trace de ce que l'hôte a donné à voir (un banc headless ne rasterise
  // rien, et le canevas n'a pas d'arbre).
  // `data-bake` : le nombre de CUISSONS payées depuis le montage. La rétention par contenu ne se
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
