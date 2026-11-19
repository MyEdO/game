/**
 * Le menu de la partie (#4411) : la pause, par-dessus le jeu assombri, la colonne de l'accueil
 * (`src/hote/groupe.ts:72-75`, `ouvrirLaFinDeSeance`, `src/noyau/actionsDuNoyau.ts:224`)
 * (`../../accueil-et-systeme.md`, section `menu-de-la-partie`).
 */
import type { Ecran } from './maquette.ts';
import { MAINTENANT } from './systeme.ts';

export default {
  etats: [
    {
      nom: 'menu-de-la-partie', gabarit: 'ouverture', decor: 'jeu',
      titre: { sur: 'Partie en pause', nom: 'Menu de la partie' }, instant: MAINTENANT,
      entrees: [
        { id: 'jouer', libelle: 'Reprendre', principale: true }, { id: 'disque', libelle: 'Sauvegardes' }, { id: 'systeme', libelle: 'Options' },
        { id: 'reseau', libelle: 'Jouer en ligne' }, { id: 'plume', libelle: 'Terminer la séance' },
      ],
      quitter: { id: 'sortie', libelle: 'Quitter la partie' }, derniereAuto: '18:05',
    },
  ],
} satisfies Ecran;
