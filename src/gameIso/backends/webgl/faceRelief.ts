/**
 * PROFONDEUR d'une `Face` du pivot — UNE résolution matériau → épaisseur MONDE (m), depuis les MÊMES
 * catalogues que la couleur (`faceColors.ts`) : structures (`wallPartDepthM`, par apparence × partie,
 * sur la matière pleine `wallMatterM` ; `uprightCrossM` pour un montant), toiture
 * (`roofFasciaThickM`). Pendant GÉOMÉTRIQUE de `faceSurface` : aucune épaisseur n'est écrite ici, elles
 * vivent toutes en DONNÉE d'apparence, authorées en MÈTRES.
 *
 * `worldTris.ts` reste PUR et sans catalogue : il reçoit cette profondeur en paramètre et ne décide que
 * de la FORME du volume (boîte centrée sur le plan médian, croix d'un montant).
 */
import { structureAppearance, uprightCrossM, wallMatterM, wallPartDepthM, type WallPart } from '../../catalog/structures';
import { roofFasciaThickM, roofMaterial } from '../../catalog/roofs';
import type { FaceDepth } from './worldTris';
import type { Face } from '../../builders/types';

/** Épaisseur MONDE (m) du volume d'une face, ou `undefined` quand la face reste un PLAN.
 *
 *  Un MONTANT (face à 2 points : poteau, jambage, pilier de surplomb) reçoit la LARGEUR de sa croix par
 *  ce même canal — c'est sa seule dimension libre.
 *
 *  Restent PLATS, et c'est leur morphologie qui le dit — pas une dette :
 *  — `roof:soffite` (`builders/roofs.ts`) : plan OBLIQUE **coplanaire au pan** qu'il prolonge ; lui
 *    donner une épaisseur le décollerait de la couverture qu'il continue ;
 *  — `terrain:wedge` (`builders/floors.ts`) : plan HORIZONTAL de raccord entre deux nappes — aucun
 *    chant à éclairer, et `faceQuadsOriented` ne volumise que les plans VERTICAUX ;
 *  — les PANS de toit (`N`/`E`/`S`/`O`) et les nappes de sol, pour la même raison.
 *  Seule la planche de rive (`roof:fascia`), verticale et de morphologie de plinthe, prend un volume. */
export function faceDepthM(face: Face): number | undefined {
  const { domain, id, part } = face.material;
  // Un DÉCOR volumique arrive déjà fermé (`builders/propVolumes.ts` en compile toutes les faces) : lui
  // donner une épaisseur d'arête doublerait sa matière.
  if (domain === 'prop') return undefined;
  if (!part) return undefined;
  const app = domain === 'structure' ? structureAppearance(id) : undefined;
  if (face.poly.length === 2) return uprightCrossM(part, wallMatterM(app));
  if (domain === 'structure') return wallPartDepthM(app!, part as WallPart, wallMatterM(app));
  if (domain === 'roof' && part === 'fascia') return roofFasciaThickM(roofMaterial(id));
  return undefined;
}

/** Le résolveur de profondeur — la forme qu'attend `facesGeometry`. Il ne dépend PLUS de l'échelle de
 *  la scène : une épaisseur est une donnée du monde, pas une largeur d'écran ramenée au mètre. */
export function faceDepthOf(): FaceDepth {
  return faceDepthM;
}
