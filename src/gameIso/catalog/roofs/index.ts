import type { RoofMaterialDef } from './types';
import { matieresDe } from '../../../data';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE, MISSING_TONE_DARK } from '../missing';
export type { RoofMaterialDef } from './types';

/** Entrée de REPLI VISIBLE (#877) : une couverture au ton d'alarme sur tous ses pans et sur son plan vu
 *  du dessus, jamais l'apparence d'un autre matériau. */
const MISSING: RoofMaterialDef = {
  id: MISSING_ID,
  type: 'materials',
  label: MISSING_LABEL,
  domain: 'roof',
  N: MISSING_TONE,
  E: MISSING_TONE,
  S: MISSING_TONE,
  O: MISSING_TONE,
  line: MISSING_TONE_DARK,
  planBody: MISSING_TONE,
  planEdge: MISSING_TONE_DARK,
  planInner: MISSING_TONE_DARK,
  planText: MISSING_TONE,
};

/** Matériau de toit par id ; id absent du registre → repli VISIBLE + avertissement DEV. Résolution
 *  VIVANTE (`matieresDe`) : le document se mute en place à l'édition, un index cuit à l'import servirait
 *  encore l'ancienne couverture. */
export function roofMaterial(id: string): RoofMaterialDef {
  return catalogEntry((cle) => matieresDe('roof').find((m) => m.id === cle), id, 'toiture', MISSING);
}

/** ÉPAISSEUR (m) par défaut d'une planche de rive, quand la def n'en porte pas — MÊME calibrage que les
 *  saillies de mur (`wallPartRelief`, table des biais mesurés par scène) : au-dessus du décalage de la
 *  carte d'ombre le plus large des scènes-témoins (0,2118 m à l'opéra), marge comprise. */
export const FASCIA_THICK_M = 0.26;

/** ÉPAISSEUR MONDE (m) de la planche de rive d'une couverture — SOURCE UNIQUE du backend volumique. */
export function roofFasciaThickM(mat: RoofMaterialDef): number {
  return mat.fasciaThickM ?? FASCIA_THICK_M;
}
