/**
 * L'incantation (#4411) : la Fléchette d'Ilyanwe tombée, puis sa Surincantation, un pas alloué sur deux (LDB 47
 * l.15-17), puis l'Incantation Critique et son effet à choisir (LDB 46 l.26-32), l'Incantation Imparfaite Mineure
 * qu'elle impose, à tirer puis tirée (LDB 46 l.28, l.36-55), sur la cour (`../../combat-suite.md`, sections
 * `surincantation` à `incantation-imparfaite`).
 */
import { apresLeDe, COMBATTANTS, DIT, RESERVES, reserves, TOUR_D_ILYANWE } from './dome.ts';
import type { Ecran, EntreeDuJournal, EtatDeCombat, Fenetre, Testeur } from './maquette.ts';

/** L'état `nom` sur le tour d'Ilyanwe, dont le journal dit `journal`, la cour marquée de `marques`. */
const incantation = (nom: string, journal: EntreeDuJournal[], fenetre: Fenetre, marques: 'cerne'[] = []): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: { etat: 'incantation', marques }, combattants: COMBATTANTS, combat: TOUR_D_ILYANWE(journal), fenetre,
});
const LANGUE: Testeur = { role: 'testeur', qui: 'ilyanwe', test: 'Langue (Magick)', seuil: 85, jet: { des: [30, 4], dr: 5, reussite: true } };
const CRITIQUE = 'Ilyanwe la Voilée incante Fléchette : Critique (33) !';
const EMBALLENT = 'Les Vents s’emballent autour d’Ilyanwe la Voilée.';

export default {
  etats: [
    incantation('incantation', [{ round: 1, commence: true }, DIT.gobelin, DIT.orc], {
      titre: 'Incantation', heros: LANGUE,
      centre: { role: 'issue', sorte: 'simple', sur: 'Fléchette · Niveau d’incantation 0', cible: 'orc', verdict: 'reussite', dr: 5, consequences: [{ genre: 'sort', cible: 'orc', ton: 'gain' }], phrase: 'Ilyanwe la Voilée lance Fléchette sur Orc.' },
      autre: { role: 'vise', qui: 'orc', comme: 'Cible du sort' },
      gestes: apresLeDe(RESERVES.ilyanwe, { survol: 'relancer' }), reserves: reserves(RESERVES.ilyanwe),
    }),
    incantation('surincantation', [DIT.gobelin, DIT.orc, 'Ilyanwe la Voilée incante Fléchette.'], {
      titre: 'Incantation', heros: LANGUE,
      centre: {
        role: 'surincantation', ni: 0, sort: 'Fléchette', supplementaires: { choisies: 1, sur: 1 }, pas: { alloues: 1, sur: 2 },
        axes: [{ nom: 'Cibles', alloues: 1, sur: 2, effet: { cibles: 2 } }, { nom: 'Portée', alloues: 0, sur: 2, effet: { facteur: 1 } }, { nom: 'Zone', sansObjet: true }, { nom: 'Durée', sansObjet: true }],
        cibles: [{ qui: 'orc', comme: 'Cible du sort' }, { qui: 'gobelin', comme: 'Cible supplémentaire' }],
      },
      gestes: apresLeDe(RESERVES.ilyanwe), reserves: reserves(RESERVES.ilyanwe),
    }, ['cerne']),
    incantation('incantation-critique', [DIT.gobelin, DIT.orc, CRITIQUE], {
      titre: 'Incantation Critique',
      heros: { role: 'testeur', qui: 'ilyanwe', test: 'Langue (Magick) · Fléchette sur Orc', seuil: 85, jet: { des: [30, 3], dr: 5, reussite: true, critique: true } },
      centre: {
        role: 'choix', groupes: [{
          cartes: [
            { nom: 'Incantation Critique', detail: ['Le Sort inflige aussi', 'une Blessure Critique'], choisie: true },
            { nom: 'Puissance totale', detail: ['Lancé quels que soient NI et DR', 'Peut être Dissipé'] },
            { nom: 'Force inéluctable', detail: ['Ne peut pas être Dissipé'] },
          ],
        }],
      },
      gestes: apresLeDe(RESERVES.ilyanwe), reserves: reserves(RESERVES.ilyanwe),
    }),
    incantation('incantation-imparfaite-tirage', [DIT.orc, CRITIQUE, EMBALLENT], {
      titre: 'Incantation Imparfaite',
      heros: { role: 'subit', qui: 'ilyanwe', motif: 'Incantation Critique', des: [30, 3], issue: { critique: 33 } },
      centre: { role: 'table', nom: 'Les Vents s’emballent', table: 'Incantation Imparfaite Mineure', tire: null, texte: 'À moins que vous n’ayez le Talent Diction instinctive, effectuez un lancer sur le Tableau des Incantations Imparfaites Mineures lorsque la puissance dépasse votre contrôle.' },
      gestes: [{ libelle: 'Lancer le dé', principal: true }], reserves: [],
    }),
    incantation('incantation-imparfaite', [DIT.orc, 'Ilyanwe la Voilée lance Fléchette sur Orc.', EMBALLENT], {
      titre: 'Incantation Imparfaite',
      heros: { role: 'subit', qui: 'ilyanwe', motif: 'Influence malfaisante', des: [10, 8], issue: { unites: 8 } },
      centre: { role: 'table', nom: 'Rupture', table: 'Incantation Imparfaite Mineure', tire: 33, texte: 'Votre nez, vos yeux et vos oreilles saignent abondamment. Gagnez 1d10 États Hémorragique.' },
      gestes: [{ libelle: 'Continuer', principal: true }], reserves: [],
    }),
  ],
} satisfies Ecran;
