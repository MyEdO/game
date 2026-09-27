import type { ReliefMaterialDef } from './types';
import { matieresDe } from '../../../data';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE, MISSING_TONE_DARK } from '../missing';
export type { ReliefMaterialDef } from './types';

/** Entrée de REPLI VISIBLE (#877) : un relief au ton d'alarme, jamais l'apparence d'un autre matériau. */
const MISSING: ReliefMaterialDef = {
  id: MISSING_ID,
  type: 'materials',
  label: MISSING_LABEL,
  domain: 'relief',
  face: MISSING_TONE,
  foot: MISSING_TONE_DARK,
  slopeTop: MISSING_TONE,
  shadeDark: 1,
};

/** Matériau de relief par id ; id absent du registre → repli VISIBLE + avertissement DEV. Résolution
 *  VIVANTE (`matieresDe`) : le document se mute en place à l'édition, un index cuit à l'import servirait
 *  encore l'ancien relief. */
export function reliefMaterial(id: string): ReliefMaterialDef {
  return catalogEntry((cle) => matieresDe('relief').find((m) => m.id === cle), id, 'relief', MISSING);
}
