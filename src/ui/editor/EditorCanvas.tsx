/**
 * Canvas SVG iso de l'éditeur v2 : rendu WYSIWYG (sol, toits, entités, spawns) + calques
 * d'auteur (triggers, zones de repos, points d'entrée) + interactions pointeur — peindre, poser,
 * drag-rectangle, sélection/déplacement et REDIMENSIONNEMENT par poignée (coin SE des zones).
 * Les overlays sont en `pointer-events: none` : tout le picking passe par `hitAt` (les calques
 * masqués laissent cliquer à travers). La logique de mutation vit dans `noyau/sceneEdit` (pur).
 */
import type { JSX } from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Scene, sceneMetresPerTile, isDescriptiveZone, type SceneEffectZone } from '../../noyau/monde/scene';
import { sceneZoneTiles } from '../../noyau/monde/zones';
import { Dims, diamondPath, tileCenter, tileEdge, type EdgeSide, screenToTileAtZ, screenToTileF, stageSize, depth, TH } from '../../geometry/iso';
import { buildProps } from '../../gameIso/builders/props';
import { entiteFootTiles } from '../../noyau/monde/spawn';
import { buildFloors } from '../../noyau/monde/volume/floors';
import { floorSvg } from '../../gameIso/authoring/floorsSvg';
import { buildRoofs } from '../../noyau/monde/volume/toits';
import { roofDepth, roofSvg } from '../../gameIso/authoring/roofsSvg';
import { detailPatternDefs, lodOf, LOD_ZOOM } from '../../gameIso/authoring/detailSvg';
import { editorLowerLayerFilterCss } from '../../gameIso/catalog/ambiance';
import { ViewControls } from '../ViewControls';
import { IconG } from '../Icon';
import { nearestNode, type CalibStep, type TraceTransform } from '../../noyau/edition/calage';
import type { useEditorView } from './useEditorView';
import { effectiveLowerLayerMode, gabaritTint, layerHidden, type LowerLayerMode } from './lowerLayerGabarit';
import { projectedRangeAxes } from './lampMarker';
import { gridLines } from '../../geometry/grid';
import { type Tool, type Layers, type Sel, selRect, selZ, sameSel } from '../../noyau/sceneEditLecture';
import type { Pt } from '../../noyau/sceneEdit';
import { appuyer, areteVisee, glisser, planDuPointeur, relacher, saisirLaPoignee, type ContexteDuPointeur, type EffetDuPointeur, type GesteEnCours, type PointDeCarte } from '../../noyau/edition/pointeur';
import { planFocusTiles, type PlanDefectAt } from '../../noyau/planDefects';
import { GameStage3D } from '../../gameIso/stage/GameStage3D';
import type { ActorPose, KeepEl, TintAt } from '../../gameIso/backends/webgl/sceneMeshes';
import { calageActif } from '../../gameIso/backends/webgl/calageProps';
import { mapLights, type LightSource } from '../../noyau/monde/vision';

/** Jaune d'ACCENT de SÉLECTION de l'éditeur (arêtes/zones/toits/entités sélectionnés) — même teinte que
 *  l'anneau d'unité active en combat, mais concept distinct (édition, pas tour de jeu). */
const SELECT = 'var(--iso-active-halo)';
/** Cerne d'encre des textes posés SUR la carte (libellés de zone/entrée, numéros d'aperçu) : sans lui
 *  un glyphe clair se perd sur un losange clair. */
const TEXT_INK = 'var(--shadow-ink)';
/** Filtre CSS de la couche INFÉRIEURE (pelure d'oignon) — voile ÉDITEUR distinct de celui du jeu
 *  (`editorLowerLayerFilterCss`, catalog/ambiance.ts) : la couche active reste seule éditable en
 *  pleine opacité, celle du dessous sert de gabarit d'alignement dont l'opacité RÉELLE est un
 *  réglage utilisateur (`lowerLayerOpacity` prop) — jamais une constante. */

/** Opacité de la nappe de toit posée SUR la couche active : la couverture reste repérable et cliquable,
 *  mais le plancher, les murs et le libellé de pièce qu'on est en train de tracer se lisent au travers
 *  (l'aplat de plan de `authoring/roofsSvg.ts` est déjà semi-transparent, deux couches suffisent à noyer le
 *  trait). Portée par le groupe ENGLOBANT, une seule fois. */
const ACTIVE_LAYER_ROOF_OPACITY = 0.25;

/**
 * ÉCLAIRAGE D'AUTHORING (#1176, P3-3) : le monde volumique de l'éditeur se monte en PLEIN JOUR
 * NEUTRE — midi d'horloge, palier de lumière au maximum, aucune teinte de visibilité. L'auteur juge
 * un plan, pas une heure : une nuit authorée noircirait l'écran d'édition.
 * Les SOURCES DE LUMIÈRE de la scène ne sont PAS montées, et ce n'est pas un oubli : à midi, la
 * photométrie les éteint TOUTES par construction (`extinctionDe(1) = 0`,
 * `gameIso/stage/stagePointLights.ts`) — un marqueur de lampe d'auteur est une SURCOUCHE, à faire en
 * surcouche SVG (vague B du lot), jamais une lumière qui ne s'allumerait pas.
 * Références de MODULE : elles doivent être stables d'un rendu à l'autre (rétention par contenu du
 * monde volumique).
 */
const MIDI_AUTHORING = 12 * 60;
const PLEIN_JOUR = 1;
const AUCUN_ACTEUR: readonly ActorPose[] = [];
const AUCUNE_LAMPE: readonly LightSource[] = [];
const AUCUNE_CASE: readonly Pt[] = [];

/** Teintes des zones sur la carte, par NATURE : barrière (bleu de muraille), piège (orange de
 *  hasard), pièce nommée (liseré violacé). Une seule définition par nature — remplissage et contour
 *  d'une même zone ne peuvent plus diverger. */
const BARRIER_INK = { fill: 'rgba(120,140,200,0.18)', fillSel: 'rgba(120,140,200,0.4)', line: 'rgba(120,140,200,0.95)' };
const TRAP_INK = { fill: 'rgba(226,100,30,0.15)', fillSel: 'rgba(226,100,30,0.35)', line: 'rgba(226,100,30,0.9)' };
const ROOM_LINE = 'rgba(150,150,220,0.55)';
/** Encre des MARQUEURS DE LAMPE d'auteur (#1176, P3-3) : l'ambre d'une flamme, distinct des natures de
 *  zone ci-dessus — une source lumineuse n'est ni un piège, ni une barrière, ni une pièce. */
const LAMP_INK = 'rgba(255,196,92,0.95)';
/** Encre de la GRILLE d'authoring : un gris froid DISCRET — elle borne la case sans concurrencer ni le
 *  terrain qu'on peint, ni les traits d'auteur (zones, murs, sélection) qui, eux, portent du sens. */
/** OPACITÉ de la grille d'AUTEUR (encre `--iso-grid`, la même qu'en jeu) : plus haute que celle du jeu
 *  (`gameIso/SurcoucheIso`, 0,11) — ici la grille est l'outil qui sert à poser une case, pas un fond. */
const GRILLE_OPACITE = 0.22;

/** Les 4 voisines de grille d'une case, appariées à l'ARÊTE qui les sépare (`tileEdge`). */
const ZONE_SIDES = [
  ['N', 0, -1],
  ['E', 1, 0],
  ['S', 0, 1],
  ['O', -1, 0],
] as const satisfies readonly (readonly [EdgeSide, number, number])[];

const zoneTileKey = (t: { x: number; y: number }) => `${t.x},${t.y}`;

/** Remplissage d'une emprise : UN chemin, une sous-forme par case. La Diligence porte 37 zones et
 *  739 cases de zone — un `<path>` par case rendait chaque coup de pinceau poussif. */
function zoneFillPath(tiles: readonly { x: number; y: number }[], dims: Dims, z: number): string {
  return tiles.map((t) => diamondPath(t.x, t.y, dims, z)).join(' ');
}

/** CONTOUR de l'emprise : les seules arêtes dont la voisine de grille est HORS emprise. La
 *  silhouette exacte se lit d'un trait (une pièce en L se voit en L), et deux zones mitoyennes
 *  gardent chacune la sienne. `tileEdge` est la source unique de la géométrie d'arête — le contour
 *  tourne donc avec la caméra comme les murs. */
function zoneOutlinePath(tiles: readonly { x: number; y: number }[], dims: Dims, z: number): string {
  const inside = new Set(tiles.map(zoneTileKey));
  const segs: string[] = [];
  for (const t of tiles)
    for (const [side, dx, dy] of ZONE_SIDES) {
      if (inside.has(zoneTileKey({ x: t.x + dx, y: t.y + dy }))) continue;
      const [a, b] = tileEdge(t.x, t.y, side, dims, z);
      segs.push(`M${a.cx},${a.cy} L${b.cx},${b.cy}`);
    }
  return segs.join(' ');
}

/** Case d'ANCRAGE du libellé/de l'icône d'une zone : la case de l'emprise la plus proche du centre
 *  de masse. Le centre du rectangle englobant, lui, tombe HORS d'une pièce en L. */
function zoneAnchorTile(tiles: readonly { x: number; y: number }[]): { x: number; y: number } {
  const mx = tiles.reduce((s, t) => s + t.x, 0) / tiles.length;
  const my = tiles.reduce((s, t) => s + t.y, 0) / tiles.length;
  let best = tiles[0];
  let bestD = Infinity;
  for (const t of tiles) {
    const d = (t.x - mx) ** 2 + (t.y - my) ** 2;
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}

/** Trait d'une zone selon sa NATURE et son état de sélection : barrière = trait plein (un mur),
 *  piège = pointillés (un hasard), pièce nommée = liseré discret sans aplat. */
function zoneInk(zone: SceneEffectZone, isSel: boolean) {
  if (isDescriptiveZone(zone))
    return { fill: isSel ? SELECT : 'none', fillOpacity: isSel ? 0.16 : 1, stroke: isSel ? SELECT : ROOM_LINE, width: isSel ? 2.5 : 1.5, dash: '2 3' };
  if (zone.barrier)
    return { fill: isSel ? BARRIER_INK.fillSel : BARRIER_INK.fill, fillOpacity: 1, stroke: isSel ? SELECT : BARRIER_INK.line, width: isSel ? 3 : 2, dash: undefined };
  return { fill: isSel ? TRAP_INK.fillSel : TRAP_INK.fill, fillOpacity: 1, stroke: isSel ? SELECT : TRAP_INK.line, width: isSel ? 3 : 1.5, dash: '3 2' };
}

/** Dessin prêt à poser d'une zone : son emprise RÉELLE (`sceneZoneTiles`, la même source que le
 *  combat et le cutaway) en remplissage + contour, et sa case d'ancrage. Le rectangle englobant sert
 *  à la SEULE poignée de redimensionnement. */
type ZoneDraw = {
  zone: SceneEffectZone;
  z: number;
  tiles: number;
  fill: string;
  outline: string;
  anchor: { cx: number; cy: number };
};

function buildZoneDraws(zones: readonly SceneEffectZone[] | undefined, dims: Dims): ZoneDraw[] {
  const out: ZoneDraw[] = [];
  (zones ?? []).forEach((zone) => {
    const tiles = sceneZoneTiles(zone);
    if (!tiles.length) return; // emprise entièrement effacée : plus une seule case à peindre
    const z = zone.z ?? 0;
    const a = zoneAnchorTile(tiles);
    out.push({
      zone,
      z,
      tiles: tiles.length,
      fill: zoneFillPath(tiles, dims, z),
      outline: zoneOutlinePath(tiles, dims, z),
      anchor: tileCenter(a.x, a.y, dims, z),
    });
  });
  return out;
}

export function EditorCanvas({
  scene,
  view,
  setScene,
  setSceneNoHistory,
  tool,
  brush,
  terrainRect,
  encTarget,
  setEncTarget,
  encRef,
  layers,
  sel,
  planFocus,
  stairRun,
  onStairTrace,
  onSelect,
  onHover,
  currentLayer,
  architectureMode,
  architectureBodyId,
  architectureZ,
  architectureAction,
  onArchitectureActionComplete,
  traceLayer,
  lowerLayerOpacity,
  lowerLayerMode,
  traceCalibStep,
  onTraceCalibClick,
}: {
  scene: Scene;
  view: ReturnType<typeof useEditorView>;
  setScene: (s: Scene) => void;
  setSceneNoHistory: (s: Scene) => void;
  tool: Tool;
  brush: number;
  terrainRect: boolean;
  encTarget: string;
  setEncTarget: (id: string) => void;
  /** Créature à placer (outil de placement d'ennemis) — déjà résolue (défaut bestiaire inclus). */
  encRef: string;
  layers: Layers;
  sel: Sel;
  /** Défaut de plan MIS EN ÉVIDENCE (annotation, indépendante de `sel`) : toutes ses cases s'allument. */
  planFocus: PlanDefectAt | null;
  onSelect: (s: Sel) => void;
  onHover: (p: Pt) => void;
  /** Couche en cours d'édition (z) : les outils de terrain peignent CETTE couche, et le picking la vise. */
  currentLayer: number;
  /** Cases de la volée en cours de tracé (outil Volée) — aperçu seul ; la pose vit dans la palette. */
  stairRun: readonly Pt[];
  /** Ajoute (ou retire) la case au tracé de volée. */
  onStairTrace: (p: Pt) => void;
  architectureMode: boolean;
  architectureBodyId: string | null;
  architectureZ: number | null;
  architectureAction: 'selection' | 'facade';
  onArchitectureActionComplete: () => void;
  /** Calque de référence (planche décalquée) — `position` bascule SOUS/AU-DESSUS de la scène (jamais
   *  dans la Scène/un export) ; `pointerEvents: none` TOUJOURS (le calage capte le clic en amont). */
  traceLayer: {
    imageDataUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    opacity: number;
    visible: boolean;
    position: 'above' | 'below';
    /** Mode CALAGE demandé par l'auteur — le mobilier volumique en aplat cyan contrasté + arêtes,
     *  tant que le calque est visible (`gameIso/backends/webgl/calageProps.ts`). */
    contraste: boolean;
    transform: TraceTransform;
  } | null;
  /** Opacité RÉELLE (0..1, réglage utilisateur) du gabarit de couche inférieure. */
  lowerLayerOpacity: number;
  /** Traitement des couches du dessous : `gabarit` (voilées) ou `isolee` (non émises). */
  lowerLayerMode: LowerLayerMode;
  /** Étape de calage 2 points en cours (`'idle'` = aucune) : capte le clic AVANT tout outil d'édition. */
  traceCalibStep: CalibStep;
  onTraceCalibClick: (pt: { x: number; y: number }) => void;
}) {
  const { rot, setRot, viewMode, setViewMode, view: vb, setView, zoomAt, spaceRef, panRef, canvasRef, wrapRef, stageRef } = view;
  const dims: Dims = { ...scene.dimensions, rot, view: viewMode };
  const stage = stageSize(dims);
  stageRef.current = stage; // le zoom centré (molette/boutons) lit la taille à jour
  const LOWER_LAYER_FILTER = useMemo(() => editorLowerLayerFilterCss(lowerLayerOpacity), [lowerLayerOpacity]);
  // ISOLATION DE COUCHE : en mode `isolee`, la couche active est SEULE dessinée — le dessous n'est pas
  // atténué, il n'est pas émis. Sur une couche d'étage clairsemée, le rez fournit sinon l'essentiel des
  // traits à l'écran et son tracé se confond avec celui qu'on est en train de poser (blocage auteur
  // 2026-07-26). Prédicat UNIQUE de visibilité de couche (`layerHidden`, `lowerLayerGabarit.ts`), lu
  // par TOUTES les familles rendues ici — les 14 surcouches SVG comme les canaux du monde volumique.
  const zHidden = (z: number) => layerHidden(z, currentLayer, lowerLayerMode);
  // MODE EFFECTIF du CANEVAS : sous le seuil d'opacité, le gabarit bascule en isolation, parce que le
  // volume n'a pas d'opacité à donner — il n'a qu'une teinte, et une teinte à zéro peint du NOIR
  // (raison complète au site du seuil). Le SVG, lui, garde le voile d'auteur à son réglage exact.
  const modeMonde = effectiveLowerLayerMode(lowerLayerMode, lowerLayerOpacity);
  const zHiddenMonde = (z: number) => layerHidden(z, currentLayer, modeMonde);

  // Le canevas volumique peint les sols, murs, toits et décors sous ce SVG, qui reçoit les
  // surcouches d'authoring et tous les événements pointeur. Le picking est purement GÉOMÉTRIQUE
  // (`localXY` → `screenToTileAtZ`), et cet écran n'inscrit AUCUN picker de sprite (`spritePicking={false}`).

  // ZONES : chemins bâtis 1× par (emprise, caméra) — le tableau `effectZones` est remplacé à chaque
  // coup de pinceau, donc la dépendance suffit à rendre le retour IMMÉDIAT sans recalculer les 739
  // cases de zone de La Diligence au moindre mouvement de pointeur.
  const zoneDraws = useMemo(() => buildZoneDraws(scene.effectZones, dims), [scene.effectZones, scene.dimensions, rot, viewMode]);

  // MATÉRIAUX v2 : palier de LOD dérivé du zoom de l'éditeur (WYSIWYG avec le jeu) — les memos
  // dépendent du PALIER (pas du zoom continu), l'aperçu de trait le passe au peintre d'authoring.
  const lod = lodOf(vb.zoom);
  const mpt = sceneMetresPerTile(scene);
  const detailOpts = useMemo(() => ({ zoom: LOD_ZOOM[lod], mpt }), [lod, mpt]);
  // `dims` dérive de (scene.dimensions, rot, viewMode) — deps couvertes.
  const patternDefs = useMemo(() => (lod >= 1 ? detailPatternDefs(dims, mpt) : ''), [scene, lod, rot, viewMode, mpt]);

  // ── GESTE DU POINTEUR EN COURS (`noyau/edition/pointeur`) : tenu en réf pour les événements qui se suivent avant
  // le rendu, et en état pour l'aperçu (rectangle tiré, trait de terrain, gel du monde).
  const gesteRef = useRef<GesteEnCours | null>(null);
  const [gesteEnCours, setGesteEnCours] = useState<GesteEnCours | null>(null);
  const poserGeste = (g: GesteEnCours | null) => {
    gesteRef.current = g;
    setGesteEnCours(g);
  };
  const dragRect = gesteEnCours?.sorte === 'rectangle' ? gesteEnCours.rect : null;
  const traitCases = gesteEnCours?.sorte === 'trait' ? gesteEnCours.trace : AUCUNE_CASE;
  const [hoverEdge, setHoverEdge] = useState<{ x: number; y: number; side: 'N' | 'E' } | null>(null); // aperçu de l'arête sous le curseur (outil murs)
  const [calibNode, setCalibNode] = useState<{ x: number; y: number } | null>(null); // nœud de grille accroché pendant le calage 2 points (étapes tile1/tile2)

  /** Coordonnées écran locales (viewBox) d'un événement pointeur. */
  function localXY(ev: React.PointerEvent): { x: number; y: number } {
    const svg = canvasRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: loc.x, y: loc.y };
  }

  /** Ce que l'éditeur tient autour du geste du pointeur. */
  const ctx: ContexteDuPointeur = {
    tool,
    z: currentLayer,
    brush,
    encId: encTarget,
    encRef,
    layers,
    sel,
    terrainRect,
    architecture: architectureMode ? { z: architectureZ ?? currentLayer, action: architectureAction, bodyId: architectureBodyId } : null,
  };

  /** Point écran → point de la carte : la case sur le plan de la couche éditée (projection iso, comme le jeu), et
   *  les coordonnées fractionnaires de case sur le plan du pointeur. */
  function pointDeCarte(ev: React.PointerEvent): PointDeCarte {
    const { x, y } = localXY(ev);
    return { case: screenToTileAtZ(x, y, dims, currentLayer), f: screenToTileF(x, y, dims, planDuPointeur(ctx)) };
  }

  /** L'effet d'un pas du pointeur, porté à l'éditeur. */
  function porter(effet: EffetDuPointeur) {
    poserGeste(effet.geste);
    if (effet.scene) (effet.cran ? setScene : setSceneNoHistory)(effet.scene);
    if (effet.encId) setEncTarget(effet.encId);
    if (effet.volee) onStairTrace(effet.volee);
    if (effet.sel !== undefined) onSelect(effet.sel);
    if (effet.architectureFinie) onArchitectureActionComplete();
  }

  function pointerDown(e: React.PointerEvent) {
    // Calage 2 points du calque de référence : capte le clic AVANT tout outil d'édition (paint,
    // sélection…) — le calage n'est jamais une opération de scène.
    if (traceCalibStep !== 'idle') {
      onTraceCalibClick(localXY(e));
      setCalibNode(null); // évite un repère fantôme le temps d'un prochain pointerMove
      return;
    }
    // Pan : clic du milieu OU Espace maintenu → on déplace le viewBox (pas d'édition).
    if (e.button === 1 || spaceRef.current) {
      e.preventDefault();
      panRef.current = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y };
      canvasRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    porter(appuyer(scene, ctx, pointDeCarte(e)));
  }

  function pointerMove(e: React.PointerEvent) {
    // Repère visuel du NŒUD accroché pendant le calage 2 points (étapes de clic « grille », pas
    // « image ») — l'utilisateur voit ce qu'il vise avant de cliquer (retour user 2026-07-25).
    if (traceCalibStep === 'tile1' || traceCalibStep === 'tile2') {
      const { x, y } = localXY(e);
      setCalibNode(nearestNode(screenToTileF(x, y, dims, currentLayer)));
    } else if (calibNode) {
      setCalibNode(null);
    }
    // `pan` capturé en variable LOCALE avant tout `set*` : `panRef.current` est remis à `null` par
    // `pointerUp` de façon IMPÉRATIVE (pas via `setState`), et l'updater passé à `setView` peut
    // s'exécuter APRÈS ce remise à `null` (React 18 diffère le flush du `setState` en file — un
    // `pointerUp` natif tiré juste après le `pointerMove` s'exécute AVANT que React ait rejoué cet
    // updater). Le déréférencer DANS le callback (`panRef.current!.vx`) plantait alors sur
    // `null` — capturer ICI, jamais dans le callback différé (même classe de bug que MapCanvas.tsx).
    const pan = panRef.current;
    if (pan) {
      const r = canvasRef.current!.getBoundingClientRect();
      const vw = stage.w / vb.zoom,
        vh = stage.h / vb.zoom;
      const dx = (e.clientX - pan.sx) * (vw / r.width);
      const dy = (e.clientY - pan.sy) * (vh / r.height);
      setView((v) => ({ ...v, x: pan.vx - dx, y: pan.vy - dy }));
      return;
    }
    const pt = pointDeCarte(e);
    onHover(pt.case);
    // Aperçu de l'arête ciblée (outil murs, sous-modes cloison/porte).
    const arete = areteVisee(ctx, pt);
    if (arete || hoverEdge) setHoverEdge(arete);
    if (gesteRef.current) porter(glisser(scene, ctx, gesteRef.current, pt));
  }

  function pointerUp(e: React.PointerEvent) {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    // Le relâché clôt le geste : le monde volumique reprend la scène VIVE, la cuisson se paie ICI, une fois.
    porter(relacher(scene, ctx, gesteRef.current, pointDeCarte(e)));
  }

  // Surlignage de la sélection : empreinte (entité), empreinte du toit, rect (zones).
  const selEnt = sel?.type === 'entity' ? scene.entities.find((en) => en.id === sel.id) ?? null : null;
  const zoneRect = sel?.type === 'trigger' || sel?.type === 'restZone' || sel?.type === 'effectZone' ? selRect(scene, sel) : null;
  // Arête-mur sélectionnée (N/E uniquement) sur la couche courante → segment doré (même tracé que hoverEdge).
  const selWall = sel?.type === 'wall' && sel.z === currentLayer && (sel.side === 'N' || sel.side === 'E') ? sel : null;
  // Groupe SVG du calque (image seule) — calculé UNE fois, posé SOUS (avant le sol) ou AU-DESSUS
  // (dernier enfant du SVG) selon `traceLayer.position` ; jamais les deux à la fois.
  // VOIE VOLUMIQUE (#1176, P3-3, vague B) : les DEUX modes passent au canevas, en quad posé au sol.
  // L'ancrage reste celui d'ici — l'ÉCRAN : le calage fige un `transform` de projection, et le quad
  // se rebâtit à chaque cadrage pour retomber aux mêmes pixels (cf. `backends/webgl/traceQuad.ts`).
  // Une seule voie la peint à la fois, sans quoi deux plaques se superposeraient.
  const decalque3d = useMemo(
    () => (traceLayer?.visible
      ? {
        imageDataUrl: traceLayer.imageDataUrl,
        naturalWidth: traceLayer.naturalWidth,
        naturalHeight: traceLayer.naturalHeight,
        opacity: traceLayer.opacity,
        position: traceLayer.position,
        transform: traceLayer.transform,
      }
      : null),
    [traceLayer],
  );

  // ── CE QUE L'ÉDITEUR DONNE AU MONDE VOLUMIQUE (#1176, P3-3) ─────────────────────────────────────
  // CADENCE : pendant un TRAIT d'outil GÉOMÉTRIQUE (terrain, cote, crénelure), le monde reste sur la
  // scène d'AVANT le geste. Ces trois-là mutent `layers` à chaque tick, et la cuisson coûte 100 à
  // 634 ms selon la carte : la payer par tick gelait l'écran. Elle se paie une fois, au RELÂCHÉ — un
  // à-coup ponctuel ASSUMÉ, l'incrémental par case étant un chantier ultérieur.
  // Les AUTRES gestes ne gèlent RIEN, et n'ont aucune raison de le faire : peindre une emprise de
  // zone, déplacer une entité ou GOMMER (`eraseAt` retire une ENTITÉ, jamais du terrain) ne touche
  // aucune dépendance de la cuisson — le monde suit au tick, sans une recuisson.
  const gelDuMonde = gesteEnCours?.sorte === 'trait' && (tool.mode === 'terrain' || tool.mode === 'hauteur' || tool.mode === 'crenelage');
  const gelDuTrait = useRef(scene);
  if (!gelDuMonde) gelDuTrait.current = scene;
  const sceneGelée = gelDuTrait.current;
  // PLEIN JOUR NEUTRE : l'auteur juge un plan, pas une heure ni un temps. La scène remise au monde
  // volumique n'a AUCUNE météo — champ absent, donc le REGISTRE ne montre rien (`sceneWeatherFx`) :
  // ni semis, ni nappes de brume, ni teinte d'orage sur les lampes et le fond.
  const sceneMonde = useMemo(() => ({ ...sceneGelée, weather: undefined }), [sceneGelée]);
  // DÉGAGEMENT (canal GÉOMÉTRIE) : le canevas cuit TOUTE la scène (`worldFaces` prend toutes les
  // couches). L'éditeur y applique sa propre loi de vue, celle du SVG — `zHiddenMonde` : on n'édite pas
  // ce qui flotte au-dessus, et le dessous s'ÔTE quand la couche est isolée (ou quand le gabarit passe
  // sous le seuil d'opacité, cf. `effectiveLowerLayerMode`).
  // TOITS : le canevas n'en peint AUCUN. La surcouche SVG les redessine tous en mode PLAN étiqueté
  // (nappe semi-transparente + libellé de pièce), pour TOUTES les couches non cachées : laisser en
  // plus les masses volumiques, c'était peindre chaque toit DEUX fois. Le calque « Toits » éteint,
  // il n'en reste rien nulle part — la case garde son sens sur les deux voies.
  const keepEl = useMemo<KeepEl>(
    () => (el) => (el.kind === 'roof' ? false : !zHiddenMonde(el.cell.z)),
    [currentLayer, modeMonde],
  );
  // TEINTE (canal VISIBILITÉ) : le gabarit des couches du dessous, porté par le seul canal continu que
  // le volume offre — un scalaire sur la couleur de sommet. Il ASSOMBRIT là où le SVG EFFACE (ce sont
  // deux matières différentes, cf. le seuil de bascule) ; sous le seuil, on n'y arrive plus et c'est
  // le dégagement qui prend la main, la couche disparaît au lieu de noircir.
  // Il porte les DEUX matières du monde d'un seul geste : les FACES (`applyVisibilityTint`) et les
  // billboards du décor (`stage/boardPose.poseBoards`, teinte prise à la case du sujet).
  const tintAt = useMemo<TintAt>(
    () => (_x, _y, z) => gabaritTint(z, currentLayer, lowerLayerOpacity),
    [currentLayer, lowerLayerOpacity],
  );
  // ÉLÉMENTS à billboarder : c'est l'ÉDITEUR qui les fabrique, avec SES options de couche — le monde
  // volumique n'a aucun second jeu de lois : le décor passe par le MÊME `buildProps` que le jeu.
  // Le builder n'émet AUCUNE loi d'étage (#1317) : c'est le PRÉDICAT UNIQUE du canevas qui tranche, ici
  // comme pour les 14 surcouches SVG et les deux autres canaux du monde volumique.
  const propEls3d = useMemo(
    () => buildProps(sceneMonde).filter((el) => !zHiddenMonde(el.cell.z)),
    [sceneMonde, currentLayer, modeMonde],
  );
  const els3d = useMemo(() => ({ props: propEls3d }), [propEls3d]);
  // ÉCHELLE RÉELLEMENT RENDUE : le SVG est à TAILLE DE CONTENU et la mise en page le rétrécit
  // (`.editor-iso { max-width: 100% }`), donc ce que l'auteur voit vaut `zoom × ce rétrécissement` —
  // c'est cette valeur, et pas le zoom du viewBox, que l'HUD doit annoncer (mesuré #1176 : 40,3 px de
  // pas de case pour un HUD à « 100 % »). Les deux VOIES rendent le même pas au centième (leur cadre
  // est commun, prouvé au pixel) : il n'y avait pas de divergence à corriger, seulement un affichage.
  const [echelleRendue, setEchelleRendue] = useState(1);
  useLayoutEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;
    const mesurer = () => {
      const large = svg.getBoundingClientRect().width;
      if (large > 0 && stage.w > 0) setEchelleRendue((k) => (Math.abs(k - (large / stage.w) * vb.zoom) < 1e-3 ? k : (large / stage.w) * vb.zoom));
    };
    mesurer();
    // `ResizeObserver` n'est pas universel (jsdom des bancs, navigateurs anciens) : sans lui la mesure
    // vaut celle du rendu courant, et l'HUD reste juste tant que la colonne ne change pas de largeur.
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(mesurer);
    ro.observe(svg);
    return () => ro.disconnect();
  }, [stage.w, vb.zoom, canvasRef]);
  // GRILLE D'AUTHORING : bâtie 1× par (carte, caméra, couche) — `w+h+2` segments, jamais un par case.
  const grilleAuteur = useMemo(
    () => gridLines(dims, currentLayer),
    [scene.dimensions, rot, viewMode, currentLayer],
  );
  // SOURCES LUMINEUSES POSÉES de la scène — la MÊME liste que le champ mécanique de vision consomme
  // (`mapLights`), filtrée par la loi de couche de l'éditeur. Leur marqueur est une surcouche d'auteur
  // (cf. le site de rendu) : en plein jour, aucune flaque ne les trahirait.
  const lampesAuthorees = useMemo(
    () => mapLights(scene).filter((l) => !zHidden(l.z ?? 0)),
    [scene, currentLayer, lowerLayerMode],
  );
  // APERÇU DU TRAIT (WYSIWYG) : le trait libre n'avait AUCUN aperçu — il se voyait par la scène SVG
  // repeinte, qui ne l'est plus. Les cases du geste se peignent donc par le peintre SVG d'authoring
  // (`floorSvg` sur les `FloorEl` de la scène VIVE), pas par un losange symbolique.
  const apercuTrait = useMemo(
    () => {
      if (tool.mode !== 'terrain' || !traitCases.length) return [];
      const vues = new Set(traitCases.map((c) => `${c.x},${c.y}`));
      return buildFloors(scene, undefined, { activeZ: currentLayer })
        .filter((el) => el.cell.z === currentLayer && vues.has(`${el.cell.x},${el.cell.y}`))
        .map((el) => ({ key: el.key, html: floorSvg(el, dims, detailOpts) }));
    },
    [tool.mode, traitCases, scene, currentLayer, rot, viewMode, detailOpts],
  );

  return (
    <main className="editor-canvas-wrap" ref={wrapRef}>
      <div className="editor-iso-wrap">
        {/* MONDE VOLUMIQUE (#1176, P3-3, DEV) : le MÊME composant que le jeu, cadré par le viewBox
            MOBILE de l'éditeur (`mode: 'cadre'` — l'échelle se mesure sur le rendu, la CSS rétrécit
            l'élément). Il est ÉMIS AVANT le SVG et couvre la boîte de contenu (`.iso-stage`, absolu
            inset:0 dans `.editor-iso-wrap`) : le SVG d'authoring prend son contexte d'empilement
            au-dessus (`.editor-iso-3d`). BUDGET PIXELS déclaré : le canevas couvre TOUTE la carte
            (2304×1312 px mesurés sur La Diligence en iso), pas la seule fenêtre — le défilement reste
            NATIF, sans un écouteur de plus, et `setPixelRatio` n'est posé qu'au montage. Un cadrage
            à la fenêtre est une piste tickée, pas une promesse de ce lot. */}
        <GameStage3D
          scene={sceneMonde}
          lecture="auteur"
          mpt={mpt}
          frame={{ mode: 'cadre', dims, viewBox: { x: vb.x, y: vb.y, w: stage.w / vb.zoom, h: stage.h / vb.zoom } }}
          tintAt={tintAt}
          keepEl={keepEl}
          els={els3d}
          actors={AUCUN_ACTEUR}
          gameTime={MIDI_AUTHORING}
          lightLevel={PLEIN_JOUR}
          lights={AUCUNE_LAMPE}
          decalque={decalque3d}
          calage={calageActif(traceLayer)}
          spritePicking={false}
        />
        <svg
          ref={canvasRef}
          className="editor-iso editor-iso-3d"
          viewBox={`${vb.x} ${vb.y} ${stage.w / vb.zoom} ${stage.h / vb.zoom}`}
          width={stage.w}
          height={stage.h}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={() => {
            panRef.current = null;
            poserGeste(null);
            setHoverEdge(null);
          }}
        >
          <defs dangerouslySetInnerHTML={{ __html: patternDefs }} />
          {/* Calque de RÉFÉRENCE (décalquage, #830) : `position` bascule SOUS (dessiner sur du vide,
              carte neuve) / AU-DESSUS (décalquer/comparer, défaut — le terrain est OPAQUE, « en
              dessous » y est invisible partout où il y a du sol) — jamais dans la Scène/l'export.
              `pointerEvents="none"` TOUJOURS : le calage capte le clic EN AMONT (`pointerDown`), la
              sélection/les outils doivent traverser le calque quand il est au-dessus. */}
          {/* GRILLE DE CASES (#1176, P3-3) : la voie VOLUMIQUE fusionne les faces coplanaires de même
              matériau — deux cases voisines de même terrain n'y ont plus aucune limite visible, là où
              le contour de chaque losange affine la donnait gratuitement. La grille redevient donc une
              surcouche d'AUTEUR, explicite, posée sur la couche qu'on édite. Elle ne se monte qu'en
              volumique : en affine, la doubler épaissirait un trait déjà là. */}
          <g pointerEvents="none" data-grille={grilleAuteur.length}>
            {grilleAuteur.map((l, i) => (
              <line key={`gr-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="var(--iso-grid)" strokeOpacity={GRILLE_OPACITE} strokeWidth={1} shapeRendering="crispEdges" />
            ))}
          </g>
          {/* APERÇU DU TRAIT en cours : les cases déjà peintes, par le peintre SVG d'authoring.
              SÉMANTIQUE juste — la bonne case, le bon terrain, la bonne couche — mais MATIÈRE de
              peintre : deux moteurs, deux façons d'ombrer, l'aperçu sort ~20 % plus sombre que la
              cuisson qui lui succède au relâché (mesuré : 39,79,123 contre 49,94,144). C'est un
              repère de GESTE — la bonne case tout de suite — pas un rendu final. */}
          {apercuTrait.length > 0 && (
            <g pointerEvents="none" data-apercu-trait={apercuTrait.length}>
              {apercuTrait.map((r) => (
                <g key={r.key} dangerouslySetInnerHTML={{ __html: r.html }} />
              ))}
            </g>
          )}
          <g pointerEvents="none">
            {(() => {
              const objs: { d: number; el: JSX.Element }[] = [];
              // Toits des bâtiments COMPOSÉS : le pipeline pivot (`buildRoofs` + peintre d'authoring) en mode
              // PLAN étiqueté — couverture semi-transparente teintée par le matériau + libellé, posée
              // dans le tri global. Les MURS sont peints par le canevas volumique — un toit n'est que
              // la couverture, on voit/édite les murs au travers.
              // Pelure d'oignon : `el.cell.z` = plancher SOMMET couvert par la masse. La nappe de la couche
              // ACTIVE est physiquement au-dessus de la tête de l'auteur — elle est DISCRÈTE
              // (`ACTIVE_LAYER_ROOF_OPACITY` sur son groupe), jamais retirée : le calque « Toits » garde son
              // sens au dernier étage, et le picking (`hitAt`, qui désigne la masse de `currentLayer`) porte
              // sur ce qui est affiché. Sous la couche active : gabarit voilé. Au-dessus : rien.
              // Le SVG le peint ICI (#1176, P3-3, vague B) : le plan étiqueté est une vue d'AUTHORING
              // (couverture translucide + nom de pièce), pas une matière — le canevas n'en cuit aucune
              // (`keepEl` ôte tous les toits), sinon chaque nappe serait peinte deux fois.
              if (layers.roofs)
                for (const el of buildRoofs(scene)) {
                  if (zHidden(el.cell.z)) continue;
                  const active = el.cell.z === currentLayer;
                  objs.push({
                    d: roofDepth(el, dims),
                    el: (
                      <g
                        key={el.key}
                        pointerEvents="none"
                        opacity={active ? ACTIVE_LAYER_ROOF_OPACITY : undefined}
                        style={active ? undefined : { filter: LOWER_LAYER_FILTER }}
                        dangerouslySetInnerHTML={{ __html: roofSvg(el, dims, { plan: true, label: el.label }) }}
                      />
                    ),
                  });
                }
              // Entités de COMBAT : celles enrôlées dans une rencontre (teinte rouge + empreinte).
              const memberIds = new Set(scene.encounters.flatMap((e) => (e.members ?? []).map((m) => m.entityId)));
              for (const en of scene.entities) {
                if (en.kind === 'prop') continue; // décor : billboard du canevas volumique (buildProps → els3d)
                const ez = en.z ?? 0;
                if (zHidden(ez)) continue; // dessus jamais éditable, dessous selon le mode (pelure d'oignon)
                const dimStyle = ez < currentLayer ? { filter: LOWER_LAYER_FILTER } : undefined;
                if (en.kind === 'heroStart') {
                  const { cx, cy } = tileCenter(en.pos.x, en.pos.y, dims, ez);
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims, ez) + 0.4,
                    el: (
                      <g key={en.id} style={dimStyle}>
                        <path d={diamondPath(en.pos.x, en.pos.y, dims, ez)} fill="#2ecc71" opacity={0.55} />
                        <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0a2a14">
                          H
                        </text>
                      </g>
                    ),
                  });
                  continue;
                }
                const hidden = !!en.combat?.hiddenUntilCombat;
                if (hidden && !layers.spawns) continue; // calque « Ennemis » masqué → cacher les embusqueurs
                const isCombat = memberIds.has(en.id);
                const isSel = sameSel(sel, { type: 'entity', id: en.id });
                // MARQUE DE SOL d'une entité : une entité ENRÔLÉE porte l'empreinte de sa rencontre, un
                // EMBUSQUÉ porte ses tirets — enrôlé ou NON. C'était le trou (#1176, P3-3) : la marque
                // d'embuscade ne vivait que dans la branche enrôlée, donc un embusqueur posé seul
                // n'avait AUCUN signe distinctif (mesuré : zéro pixel d'écart avec un figurant).
                const marque = isCombat || hidden;
                // AUCUN APLAT : ce SVG se peint AU-DESSUS du canevas et un losange plein y masquerait
                // le décor de la case. La marque reste au SOL — un CONTOUR, la même convention que les
                // anneaux du jeu (`builders/dynamicMarks`).
                if (marque) {
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims, ez) + 0.45,
                    el: (
                      <g key={en.id} style={dimStyle} opacity={hidden ? 0.6 : 1}>
                        {entiteFootTiles(en, mpt).map((t) => (
                          <path
                            key={`fp-${t.x}-${t.y}`}
                            d={diamondPath(t.x, t.y, dims, ez)}
                            fill="none"
                            stroke={isSel ? SELECT : '#c0392b'}
                            strokeWidth={isSel ? 2.5 : 1.5}
                            strokeDasharray={hidden ? '4 3' : undefined}
                          />
                        ))}
                        {/* Décorations d'auteur au SVG : empreinte, tirets d'embuscade, liseré de sélection. */}
                      </g>
                    ),
                  });
                } else {
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims, ez) + 0.5,
                    el: <g key={en.id} style={dimStyle} />,
                  });
                }
              }
              objs.sort((a, b) => a.d - b.d);
              return objs.map((o) => o.el);
            })()}
          </g>
          {hoverEdge && (() => {
            // Arête candidate sous le curseur (outil murs) : segment doré entre les deux coins de grille.
            const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, currentLayer);
            const [a, b] = hoverEdge.side === 'N' ? [gc(hoverEdge.x, hoverEdge.y), gc(hoverEdge.x + 1, hoverEdge.y)] : [gc(hoverEdge.x + 1, hoverEdge.y), gc(hoverEdge.x + 1, hoverEdge.y + 1)];
            return <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={SELECT} strokeWidth={4} strokeLinecap="round" opacity={0.9} pointerEvents="none" />;
          })()}
          {selWall && (() => {
            const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, currentLayer);
            const [a, b] = selWall.side === 'N' ? [gc(selWall.x, selWall.y), gc(selWall.x + 1, selWall.y)] : [gc(selWall.x + 1, selWall.y), gc(selWall.x + 1, selWall.y + 1)];
            return <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={SELECT} strokeWidth={5} strokeLinecap="round" pointerEvents="none" />;
          })()}
          {planFocus && (() => {
            // Défaut de plan mis en évidence : TOUTES ses cases fautives allumées d'un bloc (une zone en
            // porte des dizaines — les compter à la main était le blocage d'auteur), plus le segment de
            // l'arête visée s'il y en a une (elle ne porte pas forcément de mur — c'est souvent le défaut
            // lui-même). Remplissage LÉGER et bordure marquée : lisible même à 56 cases allumées.
            const tiles = planFocusTiles(planFocus).filter((t) => !zHidden(t.z));
            const edge = planFocus.kind === 'edge' && !zHidden(planFocus.z) ? planFocus : null;
            if (!tiles.length && !edge) return null;
            const gc = (gx: number, gy: number, z: number) => tileCenter(gx - 0.5, gy - 0.5, dims, z);
            const corners = !edge ? null
              : edge.side === 'N' ? [gc(edge.x, edge.y, edge.z), gc(edge.x + 1, edge.y, edge.z)]
                : edge.side === 'S' ? [gc(edge.x, edge.y + 1, edge.z), gc(edge.x + 1, edge.y + 1, edge.z)]
                  : edge.side === 'E' ? [gc(edge.x + 1, edge.y, edge.z), gc(edge.x + 1, edge.y + 1, edge.z)]
                    : [gc(edge.x, edge.y, edge.z), gc(edge.x, edge.y + 1, edge.z)];
            return (
              <g pointerEvents="none" data-plan-focus={planFocus.kind}>
                {tiles.map((t) => (
                  <path
                    key={`pf-${t.x}-${t.y}-${t.z}`}
                    d={diamondPath(t.x, t.y, dims, t.z)}
                    fill={SELECT}
                    fillOpacity={0.16}
                    stroke={SELECT}
                    strokeWidth={2.5}
                  />
                ))}
                {corners && <line x1={corners[0].cx} y1={corners[0].cy} x2={corners[1].cx} y2={corners[1].cy} stroke={SELECT} strokeWidth={5} strokeLinecap="round" />}
              </g>
            );
          })()}
          {/* MARQUEURS DE SOURCE LUMINEUSE (#1176, P3-3, vague B) : une AFFORDANCE d'auteur, jamais
              de la photométrie. L'atelier travaille en PLEIN JOUR NEUTRE, et à midi l'extinction des
              flaques vaut zéro PAR CONSTRUCTION (`stage/stagePointLights.ts`) : une lampe posée n'y
              émet rien, donc rien ne dirait à l'auteur qu'elle est là. Ce marqueur le dit — la
              position par un point, la PORTÉE authorée par son cercle (rayon en cases). Source
              UNIQUE : `mapLights`, la liste que le champ mécanique de vision consomme. */}
          {lampesAuthorees.length > 0 && (
            <g pointerEvents="none" data-lampes-auteur={lampesAuthorees.length}>
              {lampesAuthorees.map((l) => {
                const z = l.z ?? 0;
                const { cx, cy } = tileCenter(l.pos.x, l.pos.y, dims, z);
                // Le cercle de portée est un cercle de GRILLE : sa projection est une ellipse dont
                // les demi-axes se DÉRIVENT de la vue (`projectedRangeAxes`) — en vue du dessus, il
                // redevient rond, comme la portée l'est sur la carte.
                const { rx, ry } = projectedRangeAxes(l.pos.x, l.pos.y, z, l.radiusTiles, dims);
                return (
                  <g key={`lampe-${l.srcId ?? `${l.pos.x},${l.pos.y}`}`}>
                    {rx > 0 && ry > 0 && (
                      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={LAMP_INK} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.8} />
                    )}
                    <circle cx={cx} cy={cy} r={3.5} fill={LAMP_INK} stroke={TEXT_INK} strokeWidth={0.6} />
                  </g>
                );
              })}
            </g>
          )}
          {layers.triggers && (
            <g pointerEvents="none">
              {scene.triggers.map((t) => {
                const tz = t.rect.z ?? 0;
                if (zHidden(tz)) return null;
                const dim = tz < currentLayer;
                const isSel = sel?.type === 'trigger' && sel.id === t.id;
                return (
                  <g key={`tr-${t.id}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    {Array.from({ length: Math.max(0, t.rect.w * t.rect.h) }, (_, i) => {
                      const x = t.rect.x + (i % t.rect.w);
                      const y = t.rect.y + Math.floor(i / t.rect.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims, tz)}
                          fill={isSel ? 'rgba(231,76,60,0.3)' : 'rgba(231,76,60,0.12)'}
                          stroke={isSel ? SELECT : 'rgba(231,76,60,0.9)'}
                          strokeWidth={isSel ? 2.5 : 1.5}
                          strokeDasharray="4 3"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          )}
          {layers.rest && (
            <g pointerEvents="none">
              {(scene.restZones ?? []).map((z, zi) => {
                const rz = z.rect.z ?? 0;
                if (zHidden(rz)) return null;
                const dim = rz < currentLayer;
                const isSel = sel?.type === 'restZone' && sel.idx === zi;
                const { cx, cy } = tileCenter(z.rect.x, z.rect.y, dims, rz);
                return (
                  <g key={`rz-${zi}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    {Array.from({ length: Math.max(0, z.rect.w * z.rect.h) }, (_, i) => {
                      const x = z.rect.x + (i % z.rect.w);
                      const y = z.rect.y + Math.floor(i / z.rect.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims, rz)}
                          fill={isSel ? 'rgba(46,204,113,0.3)' : 'rgba(46,204,113,0.12)'}
                          stroke={isSel ? SELECT : 'rgba(46,204,113,0.9)'}
                          strokeWidth={isSel ? 2.5 : 1.5}
                          strokeDasharray="4 3"
                        />
                      );
                    })}
                    <IconG id="repos/campement" x={cx - 6} y={cy - 6} size={12} />
                  </g>
                );
              })}
            </g>
          )}
          {/* ZONES d'effet — descriptives (nom de pièce) et mécaniques (piège/barrière) sur le MÊME calque :
              c'est `zoneInk` qui tranche par la NATURE, pas un calque de plus. Une pièce se dit d'un
              liseré et de son nom, SANS aplat — un remplissage plein sur chaque nom de pièce nappe la
              bâtisse entière et rend le plan illisible ; un piège porte l'aplat et son icône.
              Une zone se dessine par ses CASES (`zoneDraws`), jamais par sa boîte englobante : ce que
              l'auteur peint au pinceau d'emprise est exactement ce qu'il voit. Pas de `roofHidden`
              (cutaway de jeu) : l'éditeur montre toujours ses zones authorées. Le libellé est ancré sur une
              case de l'EMPRISE : au centre du cadre, il flotterait hors d'une pièce en L. */}
          {layers.zones && (
            <g pointerEvents="none">
              {zoneDraws.map((zd) => {
                if (zHidden(zd.z)) return null;
                const dim = zd.z < currentLayer;
                const ink = zoneInk(zd.zone, sel?.type === 'effectZone' && sel.id === zd.zone.id);
                return (
                  <g key={`ez-${zd.zone.id}`} data-zone={zd.zone.id} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    <path d={zd.fill} fill={ink.fill} fillOpacity={ink.fillOpacity} />
                    <path d={zd.outline} fill="none" stroke={ink.stroke} strokeWidth={ink.width} strokeDasharray={ink.dash} strokeLinejoin="round" strokeLinecap="round" />
                    {isDescriptiveZone(zd.zone) ? (
                      <text x={zd.anchor.cx} y={zd.anchor.cy + TH / 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#cfd6ff" stroke={TEXT_INK} strokeWidth={0.4}>
                        {zd.zone.label}
                      </text>
                    ) : (
                      <IconG id={zd.zone.barrier ? 'outil-de-carte/mur' : 'interface/attention'} x={zd.anchor.cx - 6} y={zd.anchor.cy - 6} size={12} />
                    )}
                  </g>
                );
              })}
            </g>
          )}
          {layers.entries && (
            <g pointerEvents="none">
              {Object.entries(scene.entryPoints ?? {}).map(([name, pos]) => {
                const pz = pos.z ?? 0;
                if (zHidden(pz)) return null;
                const dim = pz < currentLayer;
                const isSel = sel?.type === 'entry' && sel.id === name;
                const { cx, cy } = tileCenter(pos.x, pos.y, dims);
                return (
                  <g key={`en-${name}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    <path d={diamondPath(pos.x, pos.y, dims)} fill="rgba(78,195,224,0.5)" stroke={isSel ? SELECT : '#4ec3e0'} strokeWidth={isSel ? 2.5 : 1.5} />
                    {/* Icône du registre en contexte SVG (IconG, ancrée coin haut-gauche) — centrée sur la case, teinte sombre lisible sur le losange. */}
                    <g color={TEXT_INK}>
                      <IconG id="navigation/point-d-entree" x={cx - 6.5} y={cy - 6.5} size={13} />
                    </g>
                    <text x={cx} y={cy - TH / 2} textAnchor="middle" fontSize="10" fill="#bfe9f5" stroke={TEXT_INK} strokeWidth={0.4}>
                      {name}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {/* Surlignage/poignée d'une sélection portée par une couche NON DESSINÉE : rien à saisir à
              l'écran, donc rien à peindre — sans quoi une poignée dorée flotte sur du vide. */}
          {selEnt && !zHidden(selEnt.z ?? 0) &&
            entiteFootTiles(selEnt, mpt).map((t) => (
              <path key={`fp-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims, selEnt.z ?? 0)} fill="none" stroke={SELECT} strokeWidth={3} pointerEvents="none" />
            ))}
          {zoneRect && !zHidden(selZ(scene, sel)) && (
            // Poignée de REDIMENSIONNEMENT (coin SE), posée à la COUCHE de la zone (`selZ`) : au sol,
            // elle tombait à côté de la zone d'étage qu'elle est censée saisir.
            <path
              d={diamondPath(zoneRect.x + zoneRect.w - 1, zoneRect.y + zoneRect.h - 1, dims, selZ(scene, sel))}
              fill={SELECT}
              fillOpacity={0.45}
              stroke={SELECT}
              strokeWidth={2}
              cursor="nwse-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                poserGeste(saisirLaPoignee(ctx));
                canvasRef.current?.setPointerCapture?.(e.pointerId);
              }}
            />
          )}
          {/* Volée en cours de TRACÉ : cases numérotées dans l'ordre du geste — aucune cote n'est
              écrite tant que le plan n'est pas validé depuis la palette. */}
          {tool.mode === 'escalier' && stairRun.length > 0 && (
            <g pointerEvents="none">
              {stairRun.map((c, i) => (
                <g key={`sr-${c.x}-${c.y}`}>
                  <path d={diamondPath(c.x, c.y, dims, currentLayer)} fill={SELECT} fillOpacity={0.3} stroke={SELECT} strokeWidth={2} />
                  {(() => {
                    const { cx, cy } = tileCenter(c.x, c.y, dims, currentLayer);
                    return (
                      <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill={SELECT} stroke={TEXT_INK} strokeWidth={0.5}>
                        {i + 1}
                      </text>
                    );
                  })()}
                </g>
              ))}
            </g>
          )}
          {dragRect && (
            <g pointerEvents="none">
              {Array.from({ length: dragRect.w * dragRect.h }, (_, i) => {
                const x = dragRect.x + (i % dragRect.w);
                const y = dragRect.y + Math.floor(i / dragRect.w);
                // Aperçu du rectangle en cours de tracé — à la couche ACTIVE : c'est là que le geste écrira.
                return <path key={`dr-${i}`} d={diamondPath(x, y, dims, currentLayer)} fill="rgba(78,195,224,0.35)" stroke="#4ec3e0" strokeWidth={1.5} />;
              })}
            </g>
          )}
          {calibNode && (() => {
            const { cx, cy } = tileCenter(calibNode.x, calibNode.y, dims, currentLayer);
            const s = 9;
            return (
              <g pointerEvents="none">
                <circle cx={cx} cy={cy} r={4} fill="none" stroke={SELECT} strokeWidth={2} />
                <line x1={cx - s} y1={cy} x2={cx + s} y2={cy} stroke={SELECT} strokeWidth={2} />
                <line x1={cx} y1={cy - s} x2={cx} y2={cy + s} stroke={SELECT} strokeWidth={2} />
              </g>
            );
          })()}
        </svg>
        <ViewControls
          zoom={vb.zoom}
          renderedScale={echelleRendue}
          onZoomIn={() => zoomAt(1.2)}
          onZoomOut={() => zoomAt(1 / 1.2)}
          onZoomReset={() => setView({ zoom: 1, x: 0, y: 0 })}
          onRotateLeft={() => setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3))}
          onRotateRight={() => setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3))}
          view={viewMode}
          onToggleView={() => setViewMode((v) => (v === 'iso' ? 'top' : 'iso'))}
        />
      </div>
    </main>
  );
}
