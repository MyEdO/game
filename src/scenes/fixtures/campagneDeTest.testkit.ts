/** La campagne de test du commun (#4936) : le paquet de test (`defs-scenes/paquet-de-test.ts`) lu par `campagneDuPaquet`,
 *  et le contenu d'un jeu qui la remet seule à l'affichage (`ContenuDUnJeu`, `src/hote/contenu.ts`). */
import { campagneDuPaquet, type BuiltinCampaign } from '../../noyau/index';
import { file } from '../../data/schemas/defs-scenes/paquet-de-test';
import paquetDeTest from './paquet-de-test.json';

export const campagneDeTest: BuiltinCampaign = campagneDuPaquet(paquetDeTest, file);

/** Le contenu d'un jeu qui ne remet que la campagne de test, et aucun scénario hors du catalogue commun. */
export const contenuDeTest = { campagnes: [campagneDeTest], scenarios: [] };
