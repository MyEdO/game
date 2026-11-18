/**
 * L'issue d'un combat (#4411) : la défaite du dôme, puis le repli et l'anéantissement de la bataille (ADE II 08 l.175,
 * l.223), chacun son titre et sa sortie, sur la cour.
 */
import type { Ecran, IssueDuCombat } from './maquette.ts';

const issue = (nom: string, titre: string, suite: string | null, action: string): IssueDuCombat => ({ nom, gabarit: 'recit', cour: { etat: nom }, titre, suite, action });

export default {
  etats: [
    issue('fin-defaite', 'Défaite', null, 'Reprendre'),
    issue('fin-repli', 'Repoussés', 'Les héros sont soignés, la bataille continue.', 'Poursuivre la bataille'),
    issue('fin-aneantissement', 'Le groupe a péri', 'Aucun héros ne tient debout.', 'Retour au menu'),
  ],
} satisfies Ecran;
