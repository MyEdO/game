/**
 * La Défense (#4411) : la réaction de Berta avant son dé quand l'Orc l'attaque (LDB 13 l.166-167), parade au bouclier
 * et Porte-bouclier (AA 13 l.84), parade à la rapière et Riposte (LDB 10 l.1037), réaction sociale, puis le jet de
 * Défense du dôme tombé tel que le jeu le sert (`src/noyau/fenetreDeDefense.ts`), sur la cour (`../../combat.md`,
 * sections `defense-avant-le-de`, `jet-de-defense`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import { avantLeDe, BERTA, fenetreSurLeDome, jet, ORC, puce, reglage, RESERVES, reserves, TOUR_DE_L_ORC } from './dome';
import { BUSTES_DU_DOME, type Ecran } from './maquette';

/** Le coup de l'Orc, déjà tombé, et la réaction de Berta avant son dé. */
const corps = (libelle: string, seuil: string) => [ligne('defense/qui', 'Hache · Cible : Berta'), jet('defense/jet', BERTA, libelle, seuil), jet('jets/0/0', ORC, 'Corps à corps (Base)', '≤ 35', { resultat: '24', dr: '+1', reussite: true })];
const REACTION: [unknown, string, string][] = [['parade', 'Parade', '≤ 41'], ['esquive', 'Esquive', '≤ 34']];

export default {
  etats: [
    fenetreSurLeDome('defense-avant-le-de', 'Défense avant le dé, la parade au bouclier et Porte-bouclier', 'defense-avant-le-de', TOUR_DE_L_ORC, {
      titre: 'Défense', corps: corps('Parade', '≤ 41'),
      reglages: [reglage('defense', 'reaction', 'Réaction', REACTION, 0), reglage('defense', 'armeDeParade', 'Parer avec', [['epee', 'Épée'], ['bouclier', 'Bouclier (2nde)']], 1),
        reglage('defense', 'porteBouclier', 'Porte-bouclier (2 Av.)', [[null, 'Aucun'], ['degats', 'Dégâts'], ['repousser', 'Repousser']], 0)],
      gestes: avantLeDe('defense'), reserves: reserves(RESERVES.berta),
    }),
    fenetreSurLeDome('defense-riposte', 'Défense avant le dé, la parade à la rapière et la Riposte', 'defense-riposte', TOUR_DE_L_ORC, {
      titre: 'Défense', corps: corps('Parade', '≤ 41'),
      reglages: [reglage('defense', 'reaction', 'Réaction', REACTION, 0), reglage('defense', 'armeDeParade', 'Parer avec', [['rapiere', 'Rapière'], ['bouclier', 'Bouclier (2nde)']], 0),
        reglage('defense', 'riposte', 'Riposte', [[true, 'Oui'], [false, 'Non']], 0)],
      gestes: avantLeDe('defense'), reserves: reserves(RESERVES.berta),
    }),
    fenetreSurLeDome('defense-sociale', 'Défense avant le dé, Intimidation à la place de Corps à corps', 'defense-sociale', TOUR_DE_L_ORC, {
      titre: 'Défense', corps: [...corps('Intimidation', '≤ 38'), puce('sociale', 'À la place de Corps à corps :', 'Orc a peur de Berta')],
      reglages: [reglage('defense', 'reaction', 'Réaction', [...REACTION, ['intimidation', 'Intimidation', '≤ 38']], 2)],
      gestes: avantLeDe('defense'), reserves: reserves(RESERVES.berta),
    }),
    { nom: 'jet-de-defense', planche: 'defense-jet-tombe', gabarits: ['combat', 'fenetre-du-bas'], decor: { scene: 'cour', variante: 'jet-de-defense', bustes: BUSTES_DU_DOME } },
  ],
} satisfies Ecran;
