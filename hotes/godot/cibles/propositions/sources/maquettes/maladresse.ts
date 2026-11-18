/**
 * La maladresse (#4411) : l'attaque d'Ilyanwe échoue sur un double, le Tableau des Oups ! à tirer puis tiré
 * (LDB 14 l.17-20 ; `src/data/oups.json`, `jet.maladresse`), sur la cour (`../../combat-suite.md`, sections
 * `maladresse`).
 */
import { fenetreSurLeDome, geste, gesteDeJet, ILYANWE, jet, tirage, TOUR_D_ILYANWE } from './dome';
import type { Ecran } from './maquette';

/** Le jet raté d'Ilyanwe, le double 66. */
const DOUBLE = { ...jet('jet', ILYANWE, 'Échec sur un double : 66', null, { resultat: '66', dr: '', reussite: false, verdict: 'Tableau' }), dr: 'des Oups !' };
const TOUR = { ...TOUR_D_ILYANWE, journal: ['Orc maîtrise sa psychologie (Animosité).', 'Ilyanwe la Voilée charge Orc (+1 Avantage).', 'Ilyanwe la Voilée : maladresse (66) !'] };

export default {
  etats: [
    fenetreSurLeDome('maladresse-tirage', 'maladresse, le Tableau des Oups ! à tirer', 'jet', TOUR, {
      titre: 'Maladresse',
      corps: [DOUBLE, ...tirage('Oups !', 'Tout Test de combat qui est un échec et dont le résultat du jet est un double est une Maladresse, ce qui signifie que quelque chose de très déplaisant vient de se produire.', 'Tableau des Oups !', null)],
      gestes: [geste(gesteDeJet('lancer', 'cascadeTirage'), 'Lancer le dé', { focus: true })],
    }),
    fenetreSurLeDome('maladresse', 'maladresse, le Tableau des Oups ! tiré', 'jet', TOUR, {
      titre: 'Maladresse',
      corps: [DOUBLE, ...tirage('Oups !', 'Vous trébuchez franchement et peinez à vous redresser. Vous perdez votre prochain Mouvement.', 'Tableau des Oups !', '64')],
      gestes: [geste(gesteDeJet('valider', 'cascade'), 'Continuer', { focus: true })],
    }),
  ],
} satisfies Ecran;
