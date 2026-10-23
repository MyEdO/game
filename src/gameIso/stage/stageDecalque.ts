/**
 * LA PLAQUE DE DÉCALQUAGE DE L'AUTEUR, POSÉE PUIS REPOSÉE (#1404).
 *
 * Ce que l'écran monte pour l'éditeur (#1176, P3-3, vague B) : la planche calée sous la carte, en QUAD
 * MONDE. Le franchissement d'un réglage est une REPOSE — même patron que `poserLampesDuCiel`
 * (`stage/stageLights.ts`) et que `reposeGroundAccents` (`backends/webgl/groundAccents.ts`).
 *
 * TROIS CADENCES, et elles ne coûtent pas la même chose :
 *  - l'IMAGE : un `data:` URL se DÉCODE (hors file de cuisson, à la charge du navigateur) et occupe une
 *    texture GPU. Elle ne se recharge qu'au changement d'URL — c'est-à-dire quand l'auteur ouvre une
 *    autre planche ;
 *  - la FORME : les quatre coins du quad, dérivés du calage, du cadrage et de l'échelle. Une géométrie
 *    de 4 sommets, rebâtie quand l'un d'eux bouge ;
 *  - les SCALAIRES : l'opacité (un CURSEUR, donc continu — `ui/editor/TraceLayerPanel`) et le régime
 *    dessus/dessous. Ils s'écrivent sur le matériau en place, sans rien libérer.
 */
import * as THREE from 'three';
import type { Dims } from '../../geometry/iso';
import { materiauPlanTransparent } from '../backends/webgl/worldMaterials';
import { withRenderRank } from '../backends/webgl/renderRanks';
import { buildTraceQuad, TRACE_LIFT_M } from '../backends/webgl/traceQuad';
import type { TraceTransform } from '../../ui/editor/traceCalibration';

/** La plaque telle que l'hôte la décrit (prop `decalque` de l'écran volumique). */
export interface PlaqueDecalque {
  imageDataUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  opacity: number;
  /** `above` (par-dessus tout, rang chrome, sans test de profondeur) ou `below` (sous la matière). */
  position: 'above' | 'below';
  transform: TraceTransform;
}

/** Ce dont la plaque a besoin pour se poser : elle-même, le cadrage et l'échelle de la carte. */
export interface ArgsDecalque {
  plaque: PlaqueDecalque;
  dims: Dims;
  mpt: number;
}

export interface DecalquePosé {
  /** Applique les arguments courants (`null` = aucune plaque). Rend `true` si quelque chose a été
   *  écrit — donc s'il faut repeindre. */
  reposer(args: ArgsDecalque | null): boolean;
  /** Retire du groupe et libère tout ce qui a été posé. */
  déposer(): void;
}

/** IDENTITÉ de cadrage d'une carte : tout ce dont une géométrie ancrée à l'ÉCRAN dépend (taille de
 *  grille, cran, edge-on, lacet libre, projection). Ce qu'elle sert : ne re-bâtir la plaque de
 *  décalquage qu'au changement de VUE, jamais à chaque rendu de l'éditeur. PUR. */
export function dimsKey(dims: Dims): string {
  return `${dims.w}x${dims.h}|${dims.rot ?? 0}|${dims.edge ? 'e' : ''}|${dims.yawDeg ?? ''}|${dims.view ?? 'iso'}`;
}

/** La CLÉ de forme : ce dont dépendent les quatre coins du quad, et rien d'autre. */
function cléForme(args: ArgsDecalque): string {
  const t = args.plaque.transform;
  return [
    t.tx, t.ty, t.scale, t.rotateDeg,
    args.plaque.naturalWidth, args.plaque.naturalHeight,
    dimsKey(args.dims), args.mpt, args.plaque.position,
  ].join('|');
}

export function poserDecalque(groupe: THREE.Group): DecalquePosé {
  let mesh: THREE.Mesh | null = null;
  let mat: THREE.MeshBasicMaterial | null = null;
  let texture: THREE.Texture | null = null;
  let urlPosée = '';
  let formePosée = '';

  const libérer = (): void => {
    if (mesh) groupe.remove(mesh);
    mesh?.geometry.dispose();
    mat?.dispose();
    texture?.dispose();
    mesh = null;
    mat = null;
    texture = null;
    urlPosée = '';
    formePosée = '';
  };

  return {
    reposer(args: ArgsDecalque | null): boolean {
      if (!args) {
        if (!mesh) return false;
        libérer();
        return true;
      }
      const { plaque } = args;
      const au_dessus = plaque.position === 'above';
      let écrit = false;

      if (!texture || urlPosée !== plaque.imageDataUrl) {
        const ancienne = texture;
        texture = new THREE.TextureLoader().load(plaque.imageDataUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        urlPosée = plaque.imageDataUrl;
        if (mat) { mat.map = texture; mat.needsUpdate = true; }
        ancienne?.dispose();
        écrit = true;
      }
      if (!mat) {
        mat = materiauPlanTransparent({
          map: texture,
          opacity: plaque.opacity,
          depthWrite: false,
          depthTest: !au_dessus,
          toneMapped: false,
        });
        écrit = true;
      }
      const forme = cléForme(args);
      if (!mesh || forme !== formePosée) {
        const geo = buildTraceQuad(
          plaque.transform,
          { width: plaque.naturalWidth, height: plaque.naturalHeight },
          args.dims,
          args.mpt,
          au_dessus ? TRACE_LIFT_M : 0,
        );
        if (mesh) {
          mesh.geometry.dispose();
          mesh.geometry = geo;
        } else {
          mesh = new THREE.Mesh(geo, mat);
          mesh.name = 'decalque';
          groupe.add(mesh);
        }
        formePosée = forme;
        écrit = true;
      }
      // Le RÉGIME (dessus/dessous) est un réglage : rang de rendu et test de profondeur s'écrivent sur
      // les objets en place — la géométrie, elle, a déjà suivi (le lift entre dans la clé de forme).
      if (mat.depthTest !== !au_dessus) { mat.depthTest = !au_dessus; écrit = true; }
      withRenderRank(mesh, au_dessus ? 'chrome' : 'decalque');
      if (mat.opacity !== plaque.opacity) { mat.opacity = plaque.opacity; écrit = true; }
      return écrit;
    },
    déposer: libérer,
  };
}
