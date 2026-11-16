/**
 * LES ÉCHANTILLONS FIGÉS DE L'ATELIER (#3802) : ce que la recette native du décor (`projet/recettes/atelier-du-decor.gd`)
 * lit, figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sur la base
 * humanoïde du dossier des modèles (`figerLAtelier`), qui l'ouvre, la réponse du pont à `echantillons`, sous la clé de
 * son entrée absente, et sa réponse à `echantillon` sur chaque entrée de `ENTREES`, sous la clé de cette entrée
 * (`cleDEntree`), celle que la recette calcule de l'entrée que l'atelier envoie. L'atelier garde aussi chaque élément
 * `decor` du dossier : l'échantillon d'un décor qui en a un se montre par son modèle. Pour la recette de la
 * coïncidence (`projet/recettes/decor-sur-ses-primitives.gd`), `caps` : l'échantillon de `ASYMETRIQUE` à chaque cap de
 * `CAPS`, son volume et ses décors servis comme la vue les sert (`DecorServi`).
 */
import { figerLAtelier, type Listage } from './atelier';
import { cleDEntree } from './vehicule';
import { posesDesDecors, sceneDEchantillon, volumeDuMonde } from '../../../src/noyau/index';
import type { Dir4 } from '../../../src/geometry/dir8';
import { tableTotale } from '../../../src/lib/tableTotale';

/** Les entrées de `echantillon` que l'atelier envoie, dans l'ordre des gestes de la recette : un décor, la mer, une
 *  matière de relief, une matière de toit, puis un mur crénelé, dont la brèche abat la couronne et dont la case crénelée porte la crête. */
const ENTREES: readonly Record<string, unknown>[] = [
  { famille: 'decor', id: 'tonneau' },
  { famille: 'decor', id: 'arbre-mort' },
  { famille: 'sol', id: 'eau' },
  { famille: 'relief', id: 'pierre' },
  { famille: 'toit', id: 'chaume' },
  { famille: 'mur', id: 'mur-en-pierre' },
];

/** Le décor asymétrique de la recette de la coïncidence, et les caps où elle le pose : celui de sa recette telle
 *  qu'authorée, puis un cap tourné. */
const ASYMETRIQUE = 'arbre-mort';
const CAPS: readonly Dir4[] = ['S', 'E'];

/** Les échantillons figés : l'atelier figé sur la base humanoïde et les éléments `decor` de `listage`, la réponse de
 *  `echantillons` sous la clé de l'entrée absente, par clé d'entrée (`cleDEntree`), la réponse de `echantillon` à
 *  chacune de `ENTREES`, et par cap de `CAPS`, l'échantillon de `ASYMETRIQUE` tourné à ce cap (`caps`). */
export function figerLeDecor(listage: Listage) {
  const { fige, appel } = figerLAtelier(listage, (id, manifeste) => id === 'humanoide' || manifeste.categorie === 'decor');
  const element = (fige.modeles.decors as Record<string, string>)[ASYMETRIQUE];
  const caps = tableTotale(CAPS, (cap) => {
    const scene = sceneDEchantillon('decor', ASYMETRIQUE);
    const tournee = { ...scene, entities: scene.entities.map((e) => (e.kind === 'prop' ? { ...e, facing: cap } : e)) };
    return { monde: volumeDuMonde(tournee), decors: { [ASYMETRIQUE]: { element, poses: posesDesDecors(tournee) } } };
  });
  return {
    ...fige,
    echantillons: { [cleDEntree(null)]: appel('echantillons') },
    echantillon: Object.fromEntries(ENTREES.map((e) => [cleDEntree(e), appel('echantillon', e)])),
    caps,
  };
}
