/**
 * LE VÉHICULE FIGÉ DE L'ATELIER (#2987) : ce que la recette native de l'atelier (`projet/recettes/atelier-du-vehicule.gd`)
 * lit, figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. Le listage des véhicules et
 * des pièces d'Amélioration du dossier des modèles (`listage`, `servir.mjs`, réduit à ces deux catégories), la réponse du
 * pont à `catalogues` et à `modeles` sur ce listage, et sa réponse à `vehicule` sur chaque entrée de `ENTREES`, sous la clé
 * de cette entrée (`cleDEntree`), celle que la recette calcule de l'entrée que l'atelier envoie.
 */
import { creerPont } from '../pont/pont';
import { estObjet } from '../../../src/lib/objet.mjs';
import { tableTotale } from '../../../src/lib/tableTotale';

/** Les entrées de `vehicule` que l'atelier envoie, dans l'ordre des gestes de la recette : la caraque choisie, un canon
 *  moyen à la première place de tribord, le Sabord installé, la Figure de proue installée, le Sabord retiré, une couleur
 *  posée à l'emplacement `vet1`, puis l'emblème de ses voiles. */
export const ENTREES: readonly Record<string, unknown>[] = (() => {
  const canon = [{ definition: 'canon-moyen', bord: 'tribord' }];
  const couleurs = { vet1: { id: 'peau-brune' } };
  return [
    { definition: 'caraque', postes: [], ameliorations: [] },
    { definition: 'caraque', postes: canon, ameliorations: [] },
    { definition: 'caraque', postes: canon, ameliorations: ['sabord'] },
    { definition: 'caraque', postes: canon, ameliorations: ['figure-de-proue', 'sabord'] },
    { definition: 'caraque', postes: canon, ameliorations: ['figure-de-proue'] },
    { definition: 'caraque', postes: canon, ameliorations: ['figure-de-proue'], couleurs },
    { definition: 'caraque', postes: canon, ameliorations: ['figure-de-proue'], couleurs, embleme: { id: 'taureau-rouge' } },
  ];
})();

/** `valeur` en JSON, les clés de chaque objet triées, comme `JSON.stringify` de Godot les écrit. */
export const cleDEntree = (valeur: unknown): string =>
  JSON.stringify(valeur, (_cle, v: unknown) => (estObjet(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));

/** Le véhicule figé : le listage réduit de `listage` (le listage du dossier des modèles), les réponses de `catalogues` et
 *  de `modeles`, et par clé d'entrée (`cleDEntree`), la réponse de `vehicule` à chacune de `ENTREES`. */
export function figerLeVehicule(listage: { manifestes: Record<string, unknown>; osDesRigides: Record<string, string[]> }) {
  const ids = Object.keys(listage.manifestes).filter((id) => ['vehicule', 'amelioration'].includes((listage.manifestes[id] as { categorie?: string }).categorie ?? ''));
  const reduit = { manifestes: tableTotale(ids, (id) => listage.manifestes[id]), osDesRigides: tableTotale(ids, (id) => listage.osDesRigides[id]), erreurs: [] };
  const pont = creerPont();
  const appel = (methode: string, entree?: unknown): Record<string, unknown> => JSON.parse(pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree)));
  const catalogues = appel('catalogues');
  const modeles = appel('modeles', { manifestes: reduit.manifestes, osDesRigides: reduit.osDesRigides });
  return { listage: reduit, catalogues, modeles, vehicule: Object.fromEntries(ENTREES.map((e) => [cleDEntree(e), appel('vehicule', e)])) };
}
