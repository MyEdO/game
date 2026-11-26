// LA PORTE DES PROJETS (#5037) : la seule façon légale, hors d'un projet, de lire sous `projets/<p>/` par une
// passerelle de lecture du dépôt (`lister.mjs`, `sourceCorpus.mjs`). Elle frappe les passes que la serrure
// (`serrureDesProjets.mjs`) exige ; un module qui en passe une importe ce module, et les lecteurs d'un projet sont la
// clôture d'imports statique qui l'atteint. Chaque passe dit ce qu'elle lit : tous les projets, ou un projet.
import { sceauDeLaPorte } from './serrureDesProjets.mjs';

const sceller = sceauDeLaPorte(import.meta.url);

/** La passe d'une lecture de TOUS les projets, et des racines qui contiennent `projets/`. */
export const porteDeTousLesProjets = sceller({ lit: 'tous' });

/** La passe d'une lecture du seul projet de dossier `projets/<projet>`. @param {string} projet */
export const porteDuProjet = (projet) => sceller({ lit: 'projet', projet });
