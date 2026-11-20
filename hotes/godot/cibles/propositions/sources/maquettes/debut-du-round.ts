/**
 * Le début du round (#4411) : « Agir en premier » (LDB 17 l.25), puis avec la préemption du Tir rapide (LDB 11
 * l.97-103), sur la cour (`../../combat.md`, section `debut-du-round`).
 */
import { COMBATTANTS, DIT, RESERVES } from './dome.ts';
import type { Combat, Ecran, Fenetre } from './maquette.ts';

/** Le deuxième round qui débute : aucun combattant n'a encore la main. */
const ROUND_2: Combat = { round: 2, tour: null, ordre: ['ilyanwe', 'berta', 'gobelin', 'orc'], suivant: ['ilyanwe', 'berta'], journal: [DIT.tir, 'Orc s’avance vers Ilyanwe la Voilée.', { round: 2 }] };
/** Ce qui se dépense et se presse au début du round. */
const SUITES: Pick<Fenetre, 'gestes' | 'reserves'> = { gestes: [{ libelle: 'Commencer le round', principal: true }], reserves: [{ id: 'chance', nom: 'Chance', valeur: RESERVES.berta.chance, porteur: 'berta' }] };
const BERTA_EN_PREMIER = { qui: 'berta', detail: ['Soldate'], marque: { nom: 'Chance', valeur: 1 } };

export default {
  etats: [
    {
      nom: 'debut-du-round', gabarit: 'fenetre-du-bas', cour: { etat: 'debut-du-round' }, combattants: COMBATTANTS, combat: ROUND_2,
      fenetre: { titre: 'Début du round', centre: { role: 'choix', annonce: { round: 2, sous: 'Agir en premier' }, groupes: [{ cartes: [{ ...BERTA_EN_PREMIER, choisie: true }] }] }, ...SUITES },
    },
    {
      nom: 'debut-du-round-tir-rapide', gabarit: 'fenetre-du-bas', cour: { etat: 'debut-du-round-tir-rapide' }, combattants: COMBATTANTS, combat: ROUND_2,
      fenetre: {
        titre: 'Début du round',
        centre: {
          role: 'choix', annonce: { round: 2, sous: 'le round débute' },
          groupes: [
            { libelle: 'Agir en premier', cartes: [BERTA_EN_PREMIER] },
            { libelle: 'Préempter · Tir rapide', cartes: [{ nom: 'Aucune visée', detail: [] }, { qui: 'berta', detail: ['Arbalète chargée'], marque: { nom: 'Action et Mouvement' }, choisie: true }] },
          ],
        },
        ...SUITES,
      },
    },
  ],
} satisfies Ecran;
