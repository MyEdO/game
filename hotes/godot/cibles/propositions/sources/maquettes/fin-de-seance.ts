/**
 * La fin de séance (#4411), ouverte du menu de la partie par-dessus le jeu assombri : un feuillet par héros, les deux
 * cases du groupe, « Terminer la séance » (`src/noyau/partyFlow.ts:661-716`) (`../../accueil-et-systeme.md`, section
 * `fin-de-seance`).
 */
import type { Ecran } from './maquette.ts';
import { MAINTENANT, seance } from './systeme.ts';

export default {
  etats: [
    {
      nom: 'fin-de-seance', gabarit: 'gestion', decor: 'jeu', titre: { nom: 'Fin de séance', instant: MAINTENANT },
      seance: seance('La Chance du groupe sera restaurée pour la prochaine séance.'), action: 'Terminer la séance',
    },
  ],
} satisfies Ecran;
