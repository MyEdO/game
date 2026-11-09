/**
 * LE VÉHICULE FIGÉ DE L'ATELIER (#2987) : ce que la recette native de l'atelier (`projet/recettes/atelier-du-vehicule.gd`)
 * lit, figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sur les
 * véhicules et les pièces d'Amélioration du dossier des modèles (`figerLAtelier`), et la réponse du pont à `vehicule` sur
 * chaque entrée de `ENTREES`, sous la clé de cette entrée (`cleDEntree`), celle que la recette calcule de l'entrée que
 * l'atelier envoie.
 */
import { estObjet } from '../../../src/lib/objet.mjs';
import { figerLAtelier, type Listage } from './atelier';

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

/** Le véhicule figé : l'atelier figé sur les véhicules et les pièces d'Amélioration de `listage`, et par clé d'entrée
 *  (`cleDEntree`), la réponse de `vehicule` à chacune de `ENTREES`. */
export function figerLeVehicule(listage: Listage) {
  const { fige, appel } = figerLAtelier(listage, (_id, manifeste) => ['vehicule', 'amelioration'].includes(manifeste.categorie ?? ''));
  return { ...fige, vehicule: Object.fromEntries(ENTREES.map((e) => [cleDEntree(e), appel('vehicule', e)])) };
}
