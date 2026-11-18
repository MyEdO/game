/**
 * L'attaque après le dé (#4411) : le jet d'attaque du dôme tombé, ses gestes après le dé et les réserves qu'ils
 * dépensent, le même relancé par la Chance (LDB 17 l.23-25), puis le second coup des deux armes (LDB 10 l.767-773) et
 * l'enchaînement de la Frappe mortelle (LDB 14 l.5-9), sur la cour (`../../combat.md`).
 */
import { apresLeDe, COMBATTANTS, DIT, RESERVES, reserves, TOUR, TOUR_D_ILYANWE, TOUR_DE_BERTA } from './dome.ts';
import type { Ecran, Testeur } from './maquette.ts';

/** La Parade de l'Orc, tombée. */
const PARADE: Testeur = { role: 'testeur', qui: 'orc', test: 'Parade', seuil: 35, jet: { des: [70, 0], dr: -4, reussite: false } };
const AVANTAGE = [{ nom: 'Avantage', valeur: 10 }];

export default {
  etats: [
    {
      nom: 'combat-jet-d-attaque', gabarit: 'fenetre-du-bas', cour: { etat: 'jet' }, combattants: COMBATTANTS, combat: TOUR_D_ILYANWE(),
      fenetre: {
        titre: 'Attaque',
        heros: { role: 'testeur', qui: 'ilyanwe', test: 'Corps à corps (Armes d’hast)', seuil: 48, modificateurs: AVANTAGE, jet: { des: [90, 8], dr: -5, reussite: false } },
        centre: { role: 'verdict', porte: { arme: 'Bâton de combat', cible: 'orc' }, drNet: 1, issue: 'Ilyanwe la Voilée rate son attaque ; Orc gagne +1 Avantage.' },
        autre: PARADE,
        gestes: apresLeDe(RESERVES.ilyanwe, { echec: true }), reserves: reserves(RESERVES.ilyanwe),
      },
    },
    {
      nom: 'relance-a-la-chance', gabarit: 'fenetre-du-bas', cour: { etat: 'jet' }, combattants: COMBATTANTS,
      combat: TOUR_D_ILYANWE([DIT.charge, 'Ilyanwe la Voilée rate son attaque (98).', 'Ilyanwe la Voilée relance son Test (Chance).']),
      fenetre: {
        titre: 'Attaque',
        heros: { role: 'testeur', qui: 'ilyanwe', test: 'Corps à corps (Armes d’hast)', seuil: 48, modificateurs: AVANTAGE, jet: { des: [20, 7], dr: 2, reussite: true } },
        centre: { role: 'verdict', porte: { arme: 'Bâton de combat', cible: 'orc' }, relance: 98, drNet: 6, issue: 'Ilyanwe la Voilée touche Orc au corps.' },
        autre: PARADE,
        gestes: apresLeDe({ ...RESERVES.ilyanwe, chance: RESERVES.ilyanwe.chance - 1 }, { relance: true, survol: 'relancer' }),
        reserves: reserves({ ...RESERVES.ilyanwe, chance: RESERVES.ilyanwe.chance - 1 }),
      },
    },
    {
      nom: 'seconde-frappe', gabarit: 'fenetre-du-bas', cour: { etat: 'seconde-frappe' }, combattants: { ...COMBATTANTS, orc: { ...COMBATTANTS.orc, blessures: 11 } },
      combat: TOUR_DE_BERTA([DIT.orc, 'Berta attaque Orc.', 'Berta touche Orc (Corps) : 10 dégâts − 7 (BE+PA) = 3 Blessures']),
      fenetre: {
        titre: 'Second coup',
        heros: { role: 'testeur', qui: 'berta', test: 'Bouclier (2nde −20)', seuil: 21, des: [0, 2], modificateurs: [{ nom: 'Jet inversé', de: 20, vers: 2 }] },
        centre: { role: 'consigne', consigne: 'Cliquez un adversaire à portée de votre seconde arme.' },
        gestes: [{ libelle: 'Renoncer au second coup' }], reserves: [],
      },
    },
    {
      nom: 'frappe-mortelle', gabarit: 'fenetre-du-bas', cour: { etat: 'frappe-mortelle' }, combattants: COMBATTANTS,
      combat: TOUR(2, 3, ['berta', 'orc'], [DIT.orc, 'Berta attaque Tireur gobelin.', 'Berta tue Tireur gobelin d’un seul coup.']),
      fenetre: {
        titre: 'Enchaînement',
        heros: { role: 'testeur', qui: 'berta', test: 'Épée', seuil: 41, modificateurs: [{ nom: 'Enchaînement', rang: 1, sur: 4 }] },
        centre: { role: 'consigne', consigne: 'Cliquez un adversaire adjacent que vous n’avez pas encore frappé.' },
        gestes: [{ libelle: 'Arrêter' }], reserves: [],
      },
    },
  ],
} satisfies Ecran;
