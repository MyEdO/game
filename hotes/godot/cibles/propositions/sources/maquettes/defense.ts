/**
 * La Défense (#4411) : la réaction de Berta avant son dé quand l'Orc l'attaque (LDB 13 l.166-167), parade au bouclier
 * et Porte-bouclier (AA 13 l.84), parade à la rapière et Riposte (LDB 10 l.1037), réaction sociale, puis le jet de
 * Défense d'Ilyanwe tombé, sur la cour (`../../combat.md`, sections `defense-avant-le-de`, `jet-de-defense`).
 */
import { apresLeDe, avantLeDe, COMBATTANTS, DIT, RESERVES, reserves, TOUR_DE_L_ORC } from './dome.ts';
import type { Centre, Ecran, EtatDeCombat, Testeur } from './maquette.ts';

/** Le coup de l'Orc, tombé. */
const COUP: Testeur = { role: 'testeur', qui: 'orc', test: 'Corps à corps (Base)', seuil: 35, jet: { des: [20, 4], dr: 1, reussite: true } };
const REACTIONS = [{ nom: 'Parade', seuil: 41 }, { nom: 'Esquive', seuil: 34 }];
/** La réaction de Berta avant son dé, sous `test`, et le centre qui la règle. */
const avant = (nom: string, test: Testeur['test'], seuil: number, centre: Omit<Extract<Centre, { role: 'defense' }>, 'role' | 'porte'>): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: { etat: nom }, combattants: COMBATTANTS,
  combat: TOUR_DE_L_ORC([DIT.tir, 'Orc s’avance vers Berta.', 'Orc attaque Berta.']),
  fenetre: {
    titre: 'Défense', heros: { role: 'testeur', qui: 'berta', test, seuil },
    centre: { role: 'defense', porte: { arme: 'Hache', cible: 'berta' }, ...centre }, autre: COUP,
    gestes: avantLeDe(RESERVES.berta), reserves: reserves(RESERVES.berta),
  },
});

export default {
  etats: [
    avant('defense-avant-le-de', 'Parade', 41, {
      reactions: REACTIONS, tenue: 0,
      reglages: [{ libelle: 'Parer avec', valeurs: ['Épée', 'Bouclier (2nde)'], tenue: 1 }, { libelle: 'Porte-bouclier (2 Av.)', valeurs: ['Aucun', 'Dégâts', 'Repousser'], tenue: 0 }],
    }),
    avant('defense-riposte', 'Parade', 41, {
      reactions: REACTIONS, tenue: 0,
      reglages: [{ libelle: 'Parer avec', valeurs: ['Rapière', 'Bouclier (2nde)'], tenue: 0 }, { libelle: 'Riposte', valeurs: ['Oui', 'Non'], tenue: 0 }],
    }),
    avant('defense-sociale', 'Intimidation', 38, { reactions: [...REACTIONS, { nom: 'Intimidation', seuil: 38 }], tenue: 2, reglages: [], sociale: 'Orc a peur de Berta' }),
    {
      nom: 'jet-de-defense', gabarit: 'fenetre-du-bas', cour: { etat: 'jet-de-defense' }, combattants: COMBATTANTS,
      combat: TOUR_DE_L_ORC([DIT.tir, 'Orc s’avance vers Ilyanwe la Voilée.', 'Orc attaque Ilyanwe la Voilée.']),
      fenetre: {
        titre: 'Défense',
        heros: { role: 'testeur', qui: 'ilyanwe', test: 'Corps à corps (Armes d’hast)', seuil: 38, jet: { des: [60, 1], dr: -3, reussite: false } },
        centre: { role: 'verdict', porte: { arme: 'Hache', cible: 'ilyanwe' }, action: 'defense', effet: 'au bras droit', drNet: 4, issue: 'Orc touche Ilyanwe la Voilée au bras droit.' },
        autre: COUP,
        gestes: apresLeDe(RESERVES.ilyanwe, { echec: true }), reserves: reserves(RESERVES.ilyanwe),
      },
    },
  ],
} satisfies Ecran;
