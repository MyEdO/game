/**
 * GARDE DU RIGIDE RANGÉ AU REPOS (#4351, #4746) : un objet rangé, posé où le jeu le range (`rangerLesRigides`,
 * `../rangement.ts`) sous les facteurs et les silhouettes de l'évaluation, se pose devant les vêtements. Au repos, il
 * se mesure en sujet sous chaque vêtement (`lierLesCouches`, `traversee.ts`) : une arête qui traverse l'endroit d'un
 * vêtement y enfonce un bout, fautif s'il est à plus de `ECART_DE_SUIVI_M` derrière le triangle traversé, quelle que
 * soit la longueur qui ressort devant. Tout entier derrière un vêtement, comme sous une cape, il ne le traverse pas. Les
 * meshes de l'élément qui offre son emplacement n'y entrent pas : le jeu pose l'objet dans sa case, entre ses parois
 * (`MontageDeComposition._appuyer`). Sous un clip, il se mesure comme un membre (`membreDansUnVetement.ts`).
 * `objet-dans-un-vetement` : un écart par (rigide, mesh), de valeur l'enfoncement le plus profond.
 */
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import type { PercementAuRepos } from './traversee.ts';

const GARDE = 'rigideRange';

/** `objet-dans-un-vetement` au repos : un écart par enfoncement de `enfoncements` (`lierLesCouches`, le rigide en
 *  sujet). */
export const gardeRigideRangeAuRepos = (enfoncements: readonly PercementAuRepos[], libelle: LibelleDeMesh): Ecart[] => enfoncements.map((p): Ecart => ({
  garde: GARDE, code: 'objet-dans-un-vetement', mesh: libelle(p.sujet), valeur: p.pire, seuil: ECART_DE_SUIVI_M,
  detail: `${p.sommets} sommet(s) de l'objet rangé enfoncé(s) derrière ${libelle(p.couverture)} qu'il traverse au repos : enfoncement le plus profond, en m`,
}));
