/**
 * La maladresse (#4411) : l'attaque d'Ilyanwe échoue sur un double, le Tableau des Oups ! à tirer puis tiré (LDB 14
 * l.17-20), sur la cour (`../../combat-suite.md`, sections `maladresse`).
 */
import { COMBATTANTS, DIT, TOUR_D_ILYANWE } from './dome.ts';
import type { Ecran, EtatDeCombat, Fenetre } from './maquette.ts';

/** L'état `nom` sur le tour d'Ilyanwe. */
const maladresse = (nom: string, fenetre: Fenetre): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: { etat: 'jet' }, combattants: COMBATTANTS, combat: TOUR_D_ILYANWE([DIT.orc, DIT.charge, 'Ilyanwe la Voilée : maladresse (66) !']), fenetre,
});
const OUPS = { tableau: 'Oups !' };

export default {
  etats: [
    maladresse('maladresse-tirage', {
      titre: 'Maladresse',
      heros: { role: 'subit', qui: 'ilyanwe', motif: { double: 66 }, des: [60, 6], issue: OUPS },
      centre: { role: 'table', nom: 'Oups !', table: 'Tableau des Oups !', tire: null, texte: 'Tout Test de combat qui est un échec et dont le résultat du jet est un double est une Maladresse, ce qui signifie que quelque chose de très déplaisant vient de se produire.' },
      gestes: [{ libelle: 'Lancer le dé', principal: true }], reserves: [],
    }),
    maladresse('maladresse', {
      titre: 'Maladresse',
      heros: { role: 'subit', qui: 'ilyanwe', motif: { double: 66 }, des: [60, 4], tire: 64, issue: OUPS },
      centre: { role: 'table', nom: 'Oups !', table: 'Tableau des Oups !', texte: 'Vous trébuchez franchement et peinez à vous redresser. Vous perdez votre prochain Mouvement.' },
      gestes: [{ libelle: 'Continuer', principal: true }], reserves: [],
    }),
  ],
} satisfies Ecran;
