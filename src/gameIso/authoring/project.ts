/**
 * FRONTIÈRE DU MODULE `gameIso/authoring` — SOURCE de la définition, citée par les peintres du dossier.
 *
 * Ce dossier tient les PEINTRES SVG D'AUTHORING : les sols, murs, toits, décors et leur détail de
 * surface, projetés en SVG pour des surfaces qui ne sont PAS l'écran de jeu. Le jeu a UN moteur, le
 * monde volumique (`gameIso/stage/GameStage3D`) ; ces peintres ne peignent plus aucune image de partie.
 *
 * Leurs trois consommateurs, et la raison de chacun :
 *  - l'APERÇU d'authoring (`ui/editor/EditorCanvas`) — aperçu de trait, plan des toits, motifs de LOD ;
 *  - le PLAN DE STATION (`gameIso/TopoScene` via `stage/layers`) — la structure au trait, coupe
 *    horizontale du volume, là où une coiffe volumique tombe sous le pixel (mesure : `stage/planSnapshot.ts`) ;
 *  - les ORACLES DE PARITÉ du monde volumique (`backends/webgl/*.test.ts`) — le SVG y sert d'étalon
 *    mesurable (semis d'accents, teintes de terrain, colombage).
 *
 * Pont MONDE→ÉCRAN de ces peintres : projette un point GRILLE+MÈTRES du pivot via la projection
 * partagée (`tileCenter` + `metricToLift`). SOURCE UNIQUE de la conversion (sols, murs…) — la rotation
 * caméra et l'élévation-écran vivent entièrement ici, jamais dans un builder.
 */
import { tileCenter, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import type { GP } from '../builders/types';

export type Pt2 = [number, number];

export function projGP(gp: GP, dims: Dims): Pt2 {
  const { cx, cy } = tileCenter(gp.x, gp.y, dims, metricToLift(gp.h));
  return [cx, cy];
}
