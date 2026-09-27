/** Matières de RENDU des recettes volumiques de décor (les entrées de domaine `prop` de
 *  `src/data/materials.json`), vues par le catalogue gameIso — MÊME accès que
 *  `reliefMaterial`/`roofMaterial` : le registre par id vit dans `src/data`, le REPLI VISIBLE (#877)
 *  vit ici, avec les autres catalogues de rendu. */
import { matieresDe, type PropMaterialData } from '../../data';
import { catalogEntry, MISSING_ID, MISSING_LABEL, MISSING_TONE } from './missing';

/** Entrée de REPLI VISIBLE (#877) : une matière de décor au ton d'alarme, jamais l'apparence d'un
 *  autre matériau. Sa réponse à la lumière est NEUTRE (diffus pur, aucun métal) — le repli ne peint
 *  pas un vernis ni un bronze qu'aucune donnée n'a authorés. */
const MISSING: PropMaterialData = {
  id: MISSING_ID,
  type: 'materials',
  label: MISSING_LABEL,
  domain: 'prop',
  color: MISSING_TONE,
  roughness: 1,
  metalness: 0,
};

/** Matériau de décor par id ; id absent du registre → repli VISIBLE + avertissement DEV. Résolution
 *  VIVANTE (`matieresDe`) : le document se mute en place à l'édition, un index cuit à l'import servirait
 *  encore l'ancienne matière. */
export function propMaterial(id: string): PropMaterialData {
  return catalogEntry((cle) => matieresDe('prop').find((m) => m.id === cle), id, 'matière de décor', MISSING);
}
