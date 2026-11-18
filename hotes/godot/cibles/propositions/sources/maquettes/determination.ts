/**
 * La Détermination (#4411) : Berta, À Terre, dépense son Point de Détermination (LDB 17 l.57-61 ;
 * `depenserLaDetermination`, offres `determination-*` de `src/data/actions.json`), pour l'Immunité à la Psychologie
 * puis pour retirer un État (`cs.fragGettingUp`), sur la cour (`../../combat.md`, section `determination`).
 */
import { BERTA, fenetreSurLeDome, heros, offre, reserve, RESERVES, TOUR_DE_BERTA } from './dome';
import type { Ecran } from './maquette';

const TOUR = { ...TOUR_DE_BERTA, journal: ['Tireur gobelin maîtrise sa psychologie (Animosité).', 'Orc maîtrise sa psychologie (Animosité).', 'Berta est À Terre.'] };
/** L'état `nom` de la dépense, sa valeur pressée au rang `presse`. */
const depense = (nom: string, titre: string, presse: number) => fenetreSurLeDome(nom, titre, nom, TOUR, {
  titre: 'Détermination',
  corps: [heros(BERTA, ['1 Point de Détermination'])],
  reglages: [offre('determination', 'Dépenser la Détermination', [
    ['determination-psychologie', 'Immunité Psychologie', 'jusqu’à la fin du prochain Round'],
    ['determination-critique', 'Ignorer les modificateurs de critique', 'jusqu’au début du prochain Round'],
    ['determination-etat/a-terre', 'Retirer un État', 'À Terre (+1 PB en se relevant)'],
  ], presse)],
  gestes: [],
  reserves: reserve('determination', 'Détermination de Berta', RESERVES.berta.determination),
});

export default {
  etats: [depense('determination', 'Détermination, l’Immunité à la Psychologie', 0), depense('determination-etat', 'Détermination, un État retiré', 2)],
} satisfies Ecran;
