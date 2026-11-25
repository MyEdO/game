// LE CONTENU DU COMMUN que les gardes et les mesures éprouvent quand on ne leur passe aucun corpus (#4936) : les
// paquets de son dossier de fixtures, trouvés par leur EMPLACEMENT (descripteur, comme `PROJETS_LIVRES`), jamais
// nommés. Un projet passe les siens à la garde qu'il rejoue sur eux.
import { cheminsDuCorpus } from './lister.mjs';

/** Le corpus du commun, en descripteur entier : le paquet de test (`src/data/schemas/defs-scenes/paquet-de-test.ts`). */
export const CORPUS_DU_COMMUN = Object.freeze({ dossier: 'src/scenes/fixtures', suffixe: '.json', recursif: false });

/** Les paquets du commun sous `racine` (le dépôt par défaut), en chemins relatifs à `racine`. Un dossier absent LÈVE. */
export const paquetsDuCommun = (racine) => cheminsDuCorpus(CORPUS_DU_COMMUN, racine);
