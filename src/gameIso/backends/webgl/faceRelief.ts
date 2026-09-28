/**
 * Résolveur de PROFONDEUR du volume : la forme qu'attend `facesGeometry` (`worldTris.ts`, PUR et sans
 * catalogue, qui ne décide que de la FORME du volume : boîte centrée sur le plan médian, croix d'un
 * montant). La profondeur elle-même vient du catalogue (`catalog/faceDepth.ts`).
 */
import { faceDepthM } from '../../catalog/faceDepth';
import type { FaceDepth } from './worldTris';

/** Le résolveur de profondeur — la forme qu'attend `facesGeometry`. Il ne dépend PAS de l'échelle de
 *  la scène : une épaisseur est une donnée du monde, pas une largeur d'écran ramenée au mètre. */
export function faceDepthOf(): FaceDepth {
  return faceDepthM;
}
