/**
 * L'issue d'un combat (#4411) : la défaite du dôme telle que le jeu la sert, puis le repli et l'anéantissement de la
 * bataille (ADE II 08 l.175, l.223 ; `src/noyau/issueDeCombat.ts:67-84`), chacun son titre et sa sortie au libellé du
 * jeu (`fenetre.*`, `verbe.*.fermer`, `src/i18n/messages/fr.ts:388-390`, `:503-505`), sur la cour.
 */
import { issueDuDome } from './dome';
import { BUSTES_DU_DOME, type Ecran } from './maquette';

export default {
  etats: [
    { nom: 'fin-defaite', planche: 'fin-du-combat', gabarits: ['recit'], decor: { scene: 'cour', variante: 'fin-defaite', bustes: BUSTES_DU_DOME } },
    issueDuDome('fin-repli', 'Repoussés', 'fin-repli', 'repli', 'Les héros sont soignés, la bataille continue.', 'Poursuivre la bataille'),
    issueDuDome('fin-aneantissement', 'Le groupe a péri', 'fin-aneantissement', 'aneantissement', 'Aucun héros ne tient debout.', 'Retour au menu'),
  ],
} satisfies Ecran;
