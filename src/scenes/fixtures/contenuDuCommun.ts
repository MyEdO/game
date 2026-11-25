/** LE CONTENU DU COMMUN (#4936) : la campagne de test, le paquet de test (`defs-scenes/paquet-de-test.ts`) lu par
 *  `campagneDuPaquet`, et le contenu d'un jeu qui la remet seule à l'affichage (`ContenuDUnJeu`, `src/hote/contenu.ts`) :
 *  celui que remettent l'entrée commune du pont (`hotes/godot/pont/entree-commune.ts`) et l'hôte texte sans `--contenu`
 *  (`scripts/hote-texte.mjs`), et que les suites du commun jouent. */
import { campagneDuPaquet, type BuiltinCampaign } from '../../noyau/index';
import { file } from '../../data/schemas/defs-scenes/paquet-de-test';
import paquetDeTest from './paquet-de-test.json';

export const campagneDeTest: BuiltinCampaign = campagneDuPaquet(paquetDeTest, file);

/** Le contenu d'un jeu qui ne remet que la campagne de test, et aucun scénario hors du catalogue commun. */
export const contenu = { campagnes: [campagneDeTest], scenarios: [] };
