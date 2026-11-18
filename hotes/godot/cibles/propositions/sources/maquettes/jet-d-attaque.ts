/**
 * L'attaque après le dé (#4411) : le jet d'attaque du dôme tombé tel que le jeu le sert, ses gestes après le dé et les
 * réserves qu'ils dépensent, le même relancé par la Chance (LDB 17 l.23-25), puis le second coup des deux armes
 * (LDB 10 l.767-773 ; `fenetre.secondeFrappe`) et l'enchaînement de la Frappe mortelle (LDB 14 l.5-9), sur la cour
 * (`../../combat.md`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import { VERBE_DE_SORTIE } from '../../../../../../src/noyau/index';
import { apresLeDe, BERTA, fenetreSurLeDome, geste, ILYANWE, jet, ORC, RESERVES, reserves, TOUR_D_ILYANWE, TOUR_DE_BERTA } from './dome';
import { BUSTES_DU_DOME, type Ecran } from './maquette';

export default {
  etats: [
    { nom: 'combat-jet-d-attaque', planche: 'attaque-jet-tombe', gabarits: ['combat', 'fenetre-du-bas'], decor: { scene: 'cour', variante: 'jet', bustes: BUSTES_DU_DOME } },
    fenetreSurLeDome('relance-a-la-chance', 'jet d’attaque relancé par la Chance', 'jet', {
      ...TOUR_D_ILYANWE, journal: ['Ilyanwe la Voilée charge Orc (+1 Avantage).', 'Ilyanwe la Voilée rate son attaque (98).', 'Ilyanwe la Voilée relance son Test (Chance).'],
    }, {
      titre: 'Attaque',
      corps: [ligne('arme', 'Bâton de combat'), ligne('cible', 'Cible : Orc'), ligne('relance', 'relancé, 98'),
        jet('jet', ILYANWE, 'Corps à corps (Armes d’hast)', '≤ 48', { resultat: '27', dr: '+2', reussite: true }, [['Avantage', '+10']]),
        jet('defense', ORC, 'Parade', '≤ 35', { resultat: '70', dr: '−4', reussite: false }), ligne('drNet', 'DR net +6'), ligne('issue', 'Ilyanwe la Voilée touche Orc au corps.')],
      gestes: apresLeDe('attaque', { reussi: true, relance: true, chance: RESERVES.ilyanwe.chance - 1 }), reserves: reserves({ ...RESERVES.ilyanwe, chance: RESERVES.ilyanwe.chance - 1 }),
    }),
    fenetreSurLeDome('seconde-frappe', 'le second coup, la seconde arme à diriger', 'seconde-frappe', {
      ...TOUR_DE_BERTA, journal: ['Orc maîtrise sa psychologie (Animosité).', 'Berta attaque Orc.', 'Berta touche Orc (Corps) : 10 dégâts − 7 (BE+PA) = 3 Blessures'],
    }, {
      titre: 'Second coup',
      corps: [jet('jet', BERTA, 'Bouclier (2nde −20)', '≤ 21', undefined, [['Jet inversé : 20 → 02', '']]), ligne('consigne', 'Cliquez un adversaire à portée de votre seconde arme.')],
      gestes: [geste({ verbe: VERBE_DE_SORTIE, fenetre: 'secondeFrappe' }, 'Renoncer au second coup')],
    }),
    fenetreSurLeDome('frappe-mortelle', 'l’enchaînement de la Frappe mortelle', 'frappe-mortelle', {
      tour: 'Round 1 · tour 2 sur 3', suite: [ILYANWE, BERTA], round: 'Round 2', ordre: [ORC, BERTA],
      journal: ['Orc maîtrise sa psychologie (Animosité).', 'Berta attaque Tireur gobelin.', 'Berta tue Tireur gobelin d’un seul coup.'],
    }, {
      titre: 'Enchaînement',
      corps: [jet('jet', BERTA, 'Épée', '≤ 41', undefined, [['Enchaînement 1 sur 4', '']]), ligne('consigne', 'Cliquez un adversaire adjacent que vous n’avez pas encore frappé.')],
      gestes: [geste({ verbe: VERBE_DE_SORTIE, fenetre: 'frappeMortelle' }, 'Arrêter')],
    }),
  ],
} satisfies Ecran;
