/**
 * LES ÉCHANTILLONS FIGÉS DE L'ATELIER (#3802) : ce que la recette native du décor (`projet/recettes/atelier-du-decor.gd`)
 * lit, figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sur la base
 * humanoïde du dossier des modèles (`figerLAtelier`), qui l'ouvre, la réponse du pont à `echantillons`, sous la clé de
 * son entrée absente, et sa réponse à `echantillon` sur chaque entrée de `ENTREES`, sous la clé de cette entrée
 * (`cleDEntree`), celle que la recette calcule de l'entrée que l'atelier envoie.
 */
import { figerLAtelier, type Listage } from './atelier';
import { cleDEntree } from './vehicule';

/** Les entrées de `echantillon` que l'atelier envoie, dans l'ordre des gestes de la recette : un décor, la mer, une
 *  matière de relief, une matière de toit, puis un mur crénelé, dont la brèche abat la couronne. */
const ENTREES: readonly Record<string, unknown>[] = [
  { famille: 'decor', id: 'tonneau' },
  { famille: 'sol', id: 'eau' },
  { famille: 'relief', id: 'pierre' },
  { famille: 'toit', id: 'chaume' },
  { famille: 'mur', id: 'mur-en-pierre' },
];

/** Les échantillons figés : l'atelier figé sur la base humanoïde de `listage`, la réponse de `echantillons` sous la clé
 *  de l'entrée absente, et par clé d'entrée (`cleDEntree`), la réponse de `echantillon` à chacune de `ENTREES`. */
export function figerLeDecor(listage: Listage) {
  const { fige, appel } = figerLAtelier(listage, (id) => id === 'humanoide');
  return {
    ...fige,
    echantillons: { [cleDEntree(null)]: appel('echantillons') },
    echantillon: Object.fromEntries(ENTREES.map((e) => [cleDEntree(e), appel('echantillon', e)])),
  };
}
