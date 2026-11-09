/**
 * L'ATELIER FIGÉ (#2987, #3787) : ce que les recettes natives de l'atelier lisent, figé par la sonde
 * (`construire.mjs --sonde`) dans la copie du projet qu'elle importe, et que leur pont figé sert
 * (`projet/recettes/pont_fige.gd`). Le listage du dossier des modèles (`listage`, `listage.mjs`) réduit aux modèles
 * qu'une recette garde, et la réponse du pont à `catalogues`, à `vitrine` et à `modeles` sur ce listage.
 */
import { creerPont } from '../pont/pont';
import { tableTotale } from '../../../src/lib/tableTotale';

export interface Listage {
  readonly manifestes: Record<string, unknown>;
  readonly osDesRigides: Record<string, string[]>;
}

/** L'atelier figé sur les modèles de `listage` que `garde` retient (`fige`), et l'appel au pont qui l'a figé (`appel`),
 *  pour les réponses propres à une recette. */
export function figerLAtelier(listage: Listage, garde: (id: string, manifeste: { categorie?: string }) => boolean) {
  const ids = Object.keys(listage.manifestes).filter((id) => garde(id, listage.manifestes[id] as { categorie?: string }));
  const reduit = { manifestes: tableTotale(ids, (id) => listage.manifestes[id]), osDesRigides: tableTotale(ids, (id) => listage.osDesRigides[id]), erreurs: [] };
  const pont = creerPont();
  const appel = (methode: string, entree?: unknown): Record<string, unknown> => JSON.parse(pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree)));
  return { fige: { listage: reduit, catalogues: appel('catalogues'), vitrine: appel('vitrine'), modeles: appel('modeles', { manifestes: reduit.manifestes, osDesRigides: reduit.osDesRigides }) }, appel };
}

/** L'élément à seconde prise de la recette du repos (`projet/recettes/repos-de-l-atelier.gd`). */
export const ELEMENT_A_DEUX_MAINS = 'humanoide--rigide--hallebarde';

/** L'atelier figé de la recette du repos sur la base humanoïde et `ELEMENT_A_DEUX_MAINS`, qu'il nomme (`element`). */
export const figerLeRepos = (listage: Listage) => ({
  ...figerLAtelier(listage, (id) => id === 'humanoide' || id === ELEMENT_A_DEUX_MAINS).fige,
  element: ELEMENT_A_DEUX_MAINS,
});
