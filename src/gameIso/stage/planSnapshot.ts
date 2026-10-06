/**
 * INSTANTANÉ VOLUMIQUE D'UN PLAN (#1176, P3-4) — la MATIÈRE du plan de station (`gameIso/TopoScene`)
 * rendue par le monde volumique, en UNE frame, par un renderer ÉPHÉMÈRE.
 *
 * Pourquoi éphémère, et pas un `GameStage3D` monté : la fiche de station s'ouvre EN MODALE au-dessus
 * de l'écran de jeu, qui garde son propre contexte WebGL (`ui/CampaignView.tsx` monte `stage/MondeDeCampagne` sous
 * la modale). Un second contexte vivant à côté du premier n'a aucune raison d'exister pour une image
 * FIXE : on crée le renderer, on rend une frame, on la copie dans le canevas 2D affiché, on libère
 * tout. Le plan ne bouge pas — c'est une carte, pas une vue de jeu.
 *
 * TRAITEMENT DE PLAN, jamais le neutre d'authoring : le régime SANS SOLEIL de la POLITIQUE DE VUE
 * (`viewPolicy({ view: 'top' }).ombreSoleil`, #1176 P3-5b — le plan ne ment plus sur l'heure pour
 * éteindre le soleil : il demande le régime du dessus à la loi commune, aucune directionnelle, donc
 * AUCUNE ombre portée — un plan à ombres serait une photo zénithale) et `PLAN_PLAT` (la mise en scène
 * de lumière prime sur le palier de la scène : monde plat, pleinement éclairé). La météo authorée ne
 * teinte ni n'assombrit un plan : la lumière se décide sur la scène SANS elle.
 *
 * PÉRIMÈTRE RENDU : les SOLS de l'étage planifié, et rien d'autre. Les murs restent à la surcouche SVG
 * du plan — mesure du lot : la coiffe d'un mur volumique (0,168 m à 2 m/tuile) tombe entre 0,35 px et
 * 0,95 px de large dans un panneau de 180 px, entre 0,57 px et 1,59 px à 300 px, sur les scènes
 * hôtes réelles (barge navale 18×12, bataille de masse 22×16, Opéra 21×17, arène 50×40). Sous le
 * pixel, une cloison ne se lit pas : la structure symbolique reste au trait SVG, invariant d'échelle,
 * et le canevas porte la matière.
 */
import * as THREE from 'three';
import { affineCamera } from '../backends/webgl/cameras';
import {
  applyCutawayMask,
  applyVisibilityTint,
  bakeWorldGeometry,
  type KeepEl,
} from '../backends/webgl/sceneMeshes';
import { worldSurfaceMaterials } from '../backends/webgl/worldMaterials';
import { stageLights, type StageLights } from './stageLights';
import { viewPolicy } from './viewPolicy';
import { stage3dFramingFor, viewBoxScreen } from './stage3dCamera';
import { stageSize, type Dims } from '../../geometry/iso';
import type { Scene } from '../../state/scene';

/** HEURE d'horloge passée à la décision de lumière — INERTE sous le régime de plan, et c'est le point
 *  (#1176, P3-5b) : le plan ne demande plus l'extinction du soleil à MINUIT, il la demande à la
 *  POLITIQUE DE VUE (`viewPolicy({ view: 'top' }).ombreSoleil`), qui l'applique sur le FONDU. La valeur
 *  ci-dessous est donc MIDI — l'heure la plus solaire qui soit : si un soleil pouvait encore se lever
 *  sur un plan, il se lèverait ici. Le palier d'ambiance ne la lit pas non plus (`PLAN_PLAT` est un
 *  override, `state/vision.ambientScalar`). Invariance mesurée au banc `plan-volumique.test`. */
export const HEURE_INERTE = 12 * 60;

/** MISE EN SCÈNE de lumière du plan : pleine (`ambientScalar` prend l'override tel quel). */
export const PLAN_PLAT = 1;

/** Teinte de visibilité du plan : pleine partout — un plan n'a pas de brouillard. */
const PLEIN = () => 1;

/** RÉSOLUTION d'un instantané dont le conteneur ne mesure encore rien — la hauteur en px, la largeur
 *  suivant le rapport du plan. */
export const PLAN_PX_HORS_MESURE = 512;

/** Ce que l'instantané DEMANDE à son renderer — la surface exacte de sa dépendance à three côté
 *  sortie, sans carte d'ombre (le plan n'en a aucune) : un banc peut en fournir un sans contexte GL. */
export interface PlanRenderer {
  setPixelRatio(ratio: number): void;
  setClearColor(color: number, alpha: number): void;
  setSize(w: number, h: number, updateStyle: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
  /** PERTE DU CONTEXTE (`WEBGL_lose_context`) : `dispose` libère l'état du renderer, PAS le contexte GL
   *  du canevas — il vit jusqu'au ramasse-miettes. Une fiche de station rouverte N fois empilerait
   *  donc N contextes, et le navigateur évince LE PLUS ANCIEN : le stage de jeu sous la modale.
   *  Optionnel — un banc d'essai n'a aucun contexte à perdre. */
  forceContextLoss?(): void;
  capabilities: { getMaxAnisotropy(): number };
}

/** FABRIQUE du renderer d'instantané — REGISTRE mutable lu à l'appel, jamais un mock de module (la
 *  suite partage son graphe). `null` = le renderer de three. */
let fabriqueRenderer: ((canvas: HTMLCanvasElement) => PlanRenderer) | null = null;

/** Pose (ou retire, avec `null`) la fabrique de renderer des instantanés de plan. */
export function setPlanRendererFactory(fabrique: ((canvas: HTMLCanvasElement) => PlanRenderer) | null): void {
  fabriqueRenderer = fabrique;
}

/** Ce que le plan GARDE de la scène cuite : les SOLS de l'étage planifié. Les murs vont à la
 *  surcouche SVG, les toits ne se peignent pas sur un plan, et un étage se lit seul. PUR. */
export function planKeepEl(z: number): KeepEl {
  return (el) => el.kind === 'floor' && el.cell.z === z;
}

/** La scène telle que la LUMIÈRE du plan la lit : sans météo authorée (elle n'assombrit ni ne teinte
 *  une carte). PUR. */
function scenePourLumière(scene: Scene): Scene {
  return { ...scene, weather: undefined };
}

/** Les lampes du plan : l'ambiante seule, au traitement PLAN. `sun` y est toujours `null` — parce que
 *  le REGARD d'un plan est celui du dessus, et que ce regard n'allume pas de soleil (`viewPolicy`). */
export function planLights(scene: Scene, shadowBox = new THREE.Box3()): StageLights {
  return stageLights({
    scene: scenePourLumière(scene),
    gameTime: HEURE_INERTE,
    lightLevel: PLAN_PLAT,
    shadowBox,
    ombreSoleil: viewPolicy({ view: 'top' }).ombreSoleil,
  });
}

/** Cadre en pixels d'un instantané pour un conteneur mesuré (0 = aucune mise en page mesurable : le
 *  plan prend `PLAN_PX_HORS_MESURE`, à son propre rapport). PUR. */
export function planPixels(dims: Dims, mesuré: { w: number; h: number }): { w: number; h: number } {
  if (mesuré.w > 0 && mesuré.h > 0) return mesuré;
  const vb = stageSize(dims);
  return { w: Math.round((PLAN_PX_HORS_MESURE * vb.w) / vb.h), h: PLAN_PX_HORS_MESURE };
}

/**
 * Rend le monde du plan dans `cible` (un canevas 2D affiché) et rend la main sans laisser un seul
 * objet GL vivant. `false` = aucun contexte WebGL disponible : le canevas reste vierge, et la
 * surcouche SVG du plan continue de porter les marqueurs et la structure.
 */
export function renderPlanSnapshot(args: {
  scene: Scene;
  mpt: number;
  /** Étage PLANIFIÉ — le même que celui de la surcouche SVG. */
  z: number;
  cible: HTMLCanvasElement;
  /** Cadre en pixels CSS du rendu (`planPixels`). */
  px: { w: number; h: number };
}): boolean {
  const { scene, mpt, z, cible, px } = args;
  const éphémère = cible.ownerDocument.createElement('canvas');
  let renderer: PlanRenderer;
  try {
    renderer = fabriqueRenderer
      ? fabriqueRenderer(éphémère)
      : new THREE.WebGLRenderer({ canvas: éphémère, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return false;
  }
  // Tout ce qui suit vit et meurt dans cet appel : le `finally` rend le contexte QUOI QU'IL ARRIVE —
  // un échec en cours de cuisson laisserait sinon un contexte de plus au compteur du navigateur.
  try {
    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
    const baked = bakeWorldGeometry(scene, mpt, 'jeu');
    const lumière = planLights(scene);
    applyCutawayMask(baked, planKeepEl(z));
    // `fade` = la part de soleil allumée (0 ici) : le modelé de forme reste PLEIN, comme sous un ciel
    // qui n'éclaire pas — c'est ce qui donne au plan ses volumes sans une seule ombre portée.
    applyVisibilityTint(baked, PLEIN, lumière.fade);
    // SYNCHRONE (`enFile` par défaut) : cette cuisson hors écran n'a qu'UNE image, celle d'ici.
    const { materials: matériaux } = worldSurfaceMaterials(baked.geometry, renderer.capabilities.getMaxAnisotropy());
    const trois = new THREE.Scene();
    const maillage = new THREE.Mesh(baked.geometry, matériaux);
    trois.add(maillage, lumière.ambient);

    // CADRAGE : la convention du VIEWBOX MOBILE (`viewBoxScreen`) sur le viewBox ENTIER du plan — celui
    // que la surcouche SVG rend en `xMidYMid meet`. Les deux voies reçoivent la même boîte de pixels,
    // donc le même letterbox : les marqueurs restent sur leur case.
    const vb = stageSize(dims);
    const cadre = stage3dFramingFor({ dims, mpt, screen: viewBoxScreen({ x: 0, y: 0, w: vb.w, h: vb.h }, px), canvas: px });
    const cible3d = new THREE.Vector3(cadre.centre.x, cadre.centre.y, cadre.centre.z);
    const boîte = baked.geometry.boundingBox ?? new THREE.Box3();
    const rayon = boîte.isEmpty() ? 100 : boîte.getSize(new THREE.Vector3()).length() / 2;
    const distance = Math.max(50, rayon * 4);
    const caméra = affineCamera(cadre.kind, cadre.yawDeg, mpt, cadre.viewport, {
      target: cible3d,
      distance,
      radius: rayon + (boîte.isEmpty() ? 0 : cible3d.distanceTo(boîte.getCenter(new THREE.Vector3()))) + 8,
    }).camera;

    const ratio = Math.min(2, (cible.ownerDocument.defaultView?.devicePixelRatio ?? 1) || 1);
    renderer.setPixelRatio(ratio);
    renderer.setSize(px.w, px.h, false);
    // FOND TRANSPARENT : le panneau du plan porte sa propre matière de fond, l'instantané ne peint que
    // ce que la scène contient.
    renderer.setClearColor(0x000000, 0);
    renderer.render(trois, caméra);

    cible.width = Math.round(px.w * ratio);
    cible.height = Math.round(px.h * ratio);
    const ctx = cible.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, cible.width, cible.height);
      ctx.drawImage(éphémère, 0, 0, cible.width, cible.height);
    }

    trois.remove(maillage, lumière.ambient);
    for (const m of matériaux) m.dispose();
    baked.geometry.dispose();
    lumière.ambient.dispose();
    return true;
  } catch (e) {
    console.warn('Plan de station : instantané volumique impossible — la matière repasse au SVG.', e);
    return false;
  } finally {
    // Le CONTEXTE part avec l'état : `dispose` seul le laisserait vivant jusqu'au ramasse-miettes, et
    // c'est LUI que le navigateur compte quand il évince le plus ancien (cf. `PlanRenderer`).
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}
