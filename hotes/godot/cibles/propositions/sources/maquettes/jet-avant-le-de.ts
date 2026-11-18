/**
 * L'attaque avant le dé (#4411) : Ilyanwe vise la tête de l'Orc, puis Berta qui règle son arme et ses deux armes (LDB
 * 10 l.767-773), son empoignade à mains nues (LDB 14 l.159), son tir au lance-harpon (ADE II 02 l.677), et la
 * localisation qu'elle choisit pour son Critique (LDB 17 l.68), sur la cour (`../../combat.md`, sections
 * `jet-avant-le-de`).
 */
import { apresLeDe, avantLeDe, COMBATTANTS, DIT, RESERVES, reserves, TOUR_D_ILYANWE, TOUR_DE_BERTA } from './dome.ts';
import type { Bascule, Centre, Ecran, EtatDeCombat, Testeur } from './maquette.ts';

const PARADE: Testeur = { role: 'testeur', qui: 'orc', test: 'Parade', seuil: 35 };
const AU_HASARD = { libelle: 'Localisation', zone: null, malus: null, hasard: true };
const eteinte = (libelle: string): Bascule => ({ libelle, allumee: false });
/** Berta règle son attaque sur l'Orc avant le dé : son Test, ce qu'elle porte et règle, ce qu'elle vise. */
const deBerta = (nom: string, test: string, seuil: number, centre: Omit<Extract<Centre, { role: 'attaque' }>, 'role' | 'localisation'>, autre: EtatDeCombat['fenetre']['autre'] = PARADE): EtatDeCombat => ({
  nom, gabarit: 'fenetre-du-bas', cour: { etat: nom }, combattants: COMBATTANTS, combat: TOUR_DE_BERTA([DIT.gobelin, DIT.orc, 'Berta attaque Orc.']),
  fenetre: {
    titre: 'Attaque', heros: { role: 'testeur', qui: 'berta', test, seuil }, centre: { role: 'attaque', localisation: AU_HASARD, ...centre }, autre,
    gestes: avantLeDe(RESERVES.berta, { annuler: true }), reserves: reserves(RESERVES.berta),
  },
});

export default {
  etats: [
    {
      nom: 'jet-avant-le-de', gabarit: 'fenetre-du-bas', cour: { etat: 'jet-avant-le-de' }, combattants: COMBATTANTS, combat: TOUR_D_ILYANWE(),
      fenetre: {
        titre: 'Attaque',
        heros: { role: 'testeur', qui: 'ilyanwe', test: 'Corps à corps (Armes d’hast)', seuil: 28, modificateurs: [{ nom: 'Avantage', valeur: 10 }] },
        centre: { role: 'attaque', porte: { arme: 'Bâton de combat', cible: 'orc' }, localisation: { libelle: 'Localisation', zone: { id: 'tete', nom: 'Tête' }, malus: -20, hasard: true }, reglages: [], bascules: [eteinte('Retenir ses coups')] },
        autre: PARADE,
        gestes: avantLeDe(RESERVES.ilyanwe, { annuler: true }), reserves: reserves(RESERVES.ilyanwe),
      },
    },
    deBerta('jet-avant-le-de-armes', 'Corps à corps (Base)', 41, {
      porte: { arme: 'Épée', cible: 'orc' }, reglages: [{ libelle: 'Arme', valeurs: ['Épée', 'Bouclier (2nde −20)'], tenue: 0 }], bascules: [eteinte('Des deux armes'), eteinte('Retenir ses coups')],
    }),
    deBerta('jet-avant-le-de-empoigner', 'Corps à corps (Bagarre)', 41, {
      porte: { arme: 'Mains nues', cible: 'orc' }, reglages: [], bascules: [{ libelle: 'Empoigner', allumee: true }], note: 'Sur une touche : aucun Dégât ; Empoignade + Empêtré (cible).',
    }),
    deBerta('jet-avant-le-de-harpon', 'Projectiles (Arbalète)', 33, {
      porte: { arme: 'Lance-harpon', cible: 'orc' }, reglages: [], bascules: [eteinte('Tirer sans la corde (60 m, sans Immobilisante)')], note: 'Corde tenue : Immobilisante, Portée 20.',
    }, { role: 'vise', qui: 'orc', comme: 'Cible du tir' }),
    {
      nom: 'localisation-du-critique', gabarit: 'fenetre-du-bas', cour: { etat: 'localisation-du-critique' }, combattants: COMBATTANTS, combat: TOUR_DE_BERTA([DIT.gobelin, DIT.orc, 'Berta attaque Orc.']),
      fenetre: {
        titre: 'Attaque',
        heros: { role: 'testeur', qui: 'berta', test: 'Corps à corps (Base)', seuil: 41, modificateurs: [{ nom: 'Résultat choisi' }], jet: { des: [10, 1], dr: 3, reussite: true } },
        centre: { role: 'attaque', porte: { arme: 'Épée', cible: 'orc' }, localisation: { libelle: 'Localisation du Critique', zone: { id: 'tete', nom: 'Tête' }, malus: null, hasard: false }, reglages: [], bascules: [] },
        autre: { ...PARADE, jet: { des: [60, 2], dr: -3, reussite: false } },
        gestes: apresLeDe({ ...RESERVES.berta, resilience: 0 }), reserves: reserves({ ...RESERVES.berta, resilience: 0 }),
      },
    },
  ],
} satisfies Ecran;
