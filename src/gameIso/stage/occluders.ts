/**
 * PANNEAU ÉCRAN des faces d'un élément de builder — l'emprise de culling de la voie affine
 * (`stage/layers.tsx`). Aucun peintre ici, seulement la géométrie.
 */
import type { OccluderPanel } from '../../geometry/iso';
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
