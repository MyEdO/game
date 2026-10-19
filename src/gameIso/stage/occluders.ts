/**
 * PROJECTION ÉCRAN des faces d'un élément de builder — emprise de culling de la voie affine, et
 * géométrie d'occlusion des nappes (`Lid`, `stage/architectureVisibility.ts`) que consomme la découpe
 * locale (`stage/percage.ts`), que le monde soit peint en SVG ou en volumique. Partagé, donc hors
 * des couches de projection : aucun peintre ici, seulement la géométrie.
 */
import { projectOccluder, type Dims, type OccluderPanel } from '../../geometry/iso';
import { metricToLift } from '../../noyau/monde/relief';

export function panelOf(faces: readonly { poly: readonly { x: number; y: number; h: number }[] }[]): OccluderPanel {
  return {
    polygons: faces.map((face) => face.poly.map((point) => ({
      x: point.x,
      y: point.y,
      lift: metricToLift(point.h),
    }))),
  };
}

export function elOccluder(el: { faces: readonly { poly: readonly { x: number; y: number; h: number }[] }[] }, d: Dims) {
  return projectOccluder(panelOf(el.faces), d);
}
