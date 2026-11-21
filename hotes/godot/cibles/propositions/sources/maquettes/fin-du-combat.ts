/**
 * L'issue d'un combat (#4411) : la victoire et son butin (dépeçage : ZI 13 l.304-316), la défaite du dôme, puis le repli
 * et l'anéantissement de la bataille (ADE II 08 l.175, l.223), chacun son titre et sa sortie, sur la cour.
 */
import type { Ecran, IssueDuCombat } from './maquette.ts';

const issue = (nom: string, titre: string, suite: string | null, action: string): IssueDuCombat => ({ nom, gabarit: 'recit', cour: { etat: nom }, titre, suite, action });

export default {
  etats: [
    {
      ...issue('fin-victoire', 'Victoire', null, 'Reprendre'),
      butin: {
        experience: 20, argent: { shillings: 14, pence: 6 },
        vaincus: [{ nom: 'Orc', nombre: 1 }, { nom: 'Tireur gobelin', nombre: 1 }, { nom: 'Grand Loup', nombre: 1, depecer: true }],
        objets: ['Hache', 'Arc', 'Bouclier'].map((nom) => ({ nom, pour: ['ilyanwe', 'berta'] })),
      },
    },
    issue('fin-defaite', 'Défaite', 'Le combat est perdu, la compagnie reprend pied sur les lieux.', 'Reprendre'),
    issue('fin-repli', 'Repoussés', 'Les héros sont soignés, la bataille continue.', 'Poursuivre la bataille'),
    issue('fin-aneantissement', 'Le groupe a péri', 'Aucun héros ne tient debout.', 'Retour au menu'),
  ],
} satisfies Ecran;
