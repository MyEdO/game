/**
 * Le début du round (#4411) : la fenêtre `debutDuRound`, « Agir en premier » telle que le dôme la sert, puis avec la
 * préemption du Tir rapide (LDB 11 l.97-103 ; `verbe.debutDuRound.viser`, `valeur.viser.aucun`,
 * `src/noyau/choixDeFenetre.ts:358-364`), sur la cour (`../../combat.md`, section `debut-du-round`).
 */
import { VERBE_DE_VALIDATION } from '../../../../../../src/noyau/index';
import { BERTA, cartes, choixDe, fenetreSurLeDome, geste, ILYANWE, ORC, reserve, RESERVES, TIREUR } from './dome';
import { BUSTES_DU_DOME, type Ecran } from './maquette';
import { ligne } from '../../../../../../src/hote/elements';

export default {
  etats: [
    { nom: 'debut-du-round', planche: 'combat-debut-du-round', gabarits: ['combat', 'fenetre-du-bas'], decor: { scene: 'cour', variante: 'debut-du-round', bustes: BUSTES_DU_DOME } },
    fenetreSurLeDome('debut-du-round-tir-rapide', 'début du round, la préemption du Tir rapide', 'debut-du-round-tir-rapide', {
      tour: 'Round 2', suite: [], round: 'Round 3', ordre: [ORC, TIREUR, BERTA, ILYANWE], sansActif: true,
      journal: ['Tireur gobelin tire sur Berta et la manque.', 'Orc s’avance vers Ilyanwe la Voilée.', 'Round 2'],
    }, {
      titre: 'Début du round',
      corps: [ligne('annonce', 'Round 2', 'neutre', 'le round débute')],
      reglages: [
        cartes(choixDe('debutDuRound', 'promouvoir'), 'Agir en premier', [[BERTA, 'Berta', 'Soldate · 1 Chance']], -1),
        cartes(choixDe('debutDuRound', 'viser'), 'Préempter · Tir rapide', [[null, 'Aucune visée', ''], [BERTA, 'Berta', 'Arbalète chargée\nAction et Mouvement']], 1),
      ],
      gestes: [geste({ verbe: VERBE_DE_VALIDATION, fenetre: 'debutDuRound' }, 'Commencer le round', { focus: true })],
      reserves: reserve('chance', 'Chance de Berta', RESERVES.berta.chance),
    }),
  ],
} satisfies Ecran;
