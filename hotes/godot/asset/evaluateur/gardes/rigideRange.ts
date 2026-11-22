/**
 * GARDE DU RIGIDE RANGÉ AU REPOS (#4351) : un objet rangé, posé où le jeu le range (`rangerLesRigides`,
 * `../rangement.ts`), se mesure au repos neutre comme une couche sous sa couverture (`lierLesCouches`, `traversee.ts`),
 * lui en sujet : une arête qui traverse l'endroit d'un vêtement en sort par un bout, percé s'il est à plus de
 * `ECART_DE_SUIVI_M` devant un triangle qui lui fait face. Les meshes de l'élément qui offre son emplacement n'y entrent
 * pas : le jeu pose l'objet dans sa case, entre ses parois (`MontageDeComposition._appuyer`). Sous un clip, il se mesure
 * comme un membre (`membreDansUnVetement.ts`).
 * `objet-dans-un-vetement` : un écart par (rigide, mesh), de valeur l'écart signé le plus négatif.
 */
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import type { PercementAuRepos } from './traversee.ts';

const GARDE = 'rigideRange';

/** `objet-dans-un-vetement` au repos neutre : un écart par percement de `percements` (`lierLesCouches`, le rigide en
 *  sujet). */
export const gardeRigideRangeAuRepos = (percements: readonly PercementAuRepos[], libelle: LibelleDeMesh): Ecart[] => percements.map((p): Ecart => ({
  garde: GARDE, code: 'objet-dans-un-vetement', mesh: libelle(p.sujet), valeur: p.pire, seuil: -ECART_DE_SUIVI_M,
  detail: `${p.sommets} sommet(s) de l'objet rangé devant ${libelle(p.couverture)} qu'il traverse au repos neutre : écart signé le plus négatif, en m`,
}));
