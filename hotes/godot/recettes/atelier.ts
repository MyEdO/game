/**
 * L'ATELIER FIGÉ (#2987, #3787) : ce que les recettes natives de l'atelier lisent, figé par la sonde
 * (`construire.mjs --sonde`) dans la copie du projet qu'elle importe, et que leur pont figé sert
 * (`projet/recettes/pont_fige.gd`). Le listage du dossier des modèles (`listage`, `listage.mjs`) réduit aux modèles
 * qu'une recette garde, et la réponse du pont à `catalogues`, à `vitrine` et à `modeles` sur ce listage.
 */
import { creerPont, type Pont } from '../pont/pont';
import { tableTotale } from '../../../src/lib/tableTotale';

export interface Listage {
  readonly manifestes: Record<string, unknown>;
  readonly osDesRigides: Record<string, string[]>;
  readonly forme: string;
}

/** Ce qu'une recette garde d'un modèle de `listage` (son id et son manifeste). */
type Garde = (id: string, manifeste: { categorie?: string }) => boolean;

/** L'atelier figé, sur le pont `pont`, des modèles de `listage` que `garde` retient (`fige`), et l'appel à ce pont
 *  (`appel`), pour les réponses propres à une recette. */
function atelierSur(pont: Pont, listage: Listage, garde: Garde) {
  const ids = Object.keys(listage.manifestes).filter((id) => garde(id, listage.manifestes[id] as { categorie?: string }));
  const reduit = { manifestes: tableTotale(ids, (id) => listage.manifestes[id]), osDesRigides: tableTotale(ids, (id) => listage.osDesRigides[id]), erreurs: [], forme: listage.forme };
  const appel = (methode: string, entree?: unknown): Record<string, unknown> => JSON.parse(pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree)));
  return { fige: { listage: reduit, catalogues: appel('catalogues'), vitrine: appel('vitrine'), modeles: appel('modeles', { manifestes: reduit.manifestes, osDesRigides: reduit.osDesRigides }) }, appel };
}

/** L'atelier figé sur les modèles de `listage` que `garde` retient, sur un pont neuf, pour une recette qui ne démarre
 *  aucune partie : `demarrer` passe par `figerUnePartie`. */
export const figerLAtelier = (listage: Listage, garde: Garde) => atelierSur(creerPont(null), listage, garde);

/** Ce que `jouer` fige d'une partie qu'il démarre sur l'atelier figé de `listage` (`figerLAtelier`, ses `fige` et
 *  `appel`) ; la partie ouverte rendue au noyau, qui n'en tient qu'une par processus (`quitter`, `pont.ts`), quoi qu'il
 *  arrive ; un `demarrer` refusé n'en a ouvert aucune, et `quitter` se refuse alors sans effet. */
export function figerUnePartie<T>(listage: Listage, garde: Garde, jouer: (atelier: ReturnType<typeof atelierSur>) => T): T {
  const pont = creerPont(null);
  const atelier = atelierSur(pont, listage, garde);
  try {
    return jouer(atelier);
  } finally {
    atelier.appel('quitter');
  }
}

/** L'élément à seconde prise de la recette du repos (`projet/recettes/repos-de-l-atelier.gd`). */
export const ELEMENT_A_DEUX_MAINS = 'humanoide--rigide--hallebarde';

/** L'atelier figé de la recette du repos sur la base humanoïde et `ELEMENT_A_DEUX_MAINS`, qu'il nomme (`element`). */
export const figerLeRepos = (listage: Listage) => ({
  ...figerLAtelier(listage, (id) => id === 'humanoide' || id === ELEMENT_A_DEUX_MAINS).fige,
  element: ELEMENT_A_DEUX_MAINS,
});
