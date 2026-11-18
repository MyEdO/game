/**
 * La Focalisation (#4411) : Ilyanwe focalise la magie du Dôme en Test étendu, avant le dé, tombée, le Niveau
 * d'incantation atteint, puis sur un Critique (LDB 46 l.128-136 ; `fenetre.focalisation`, `cs.focusProgress`,
 * `out.focusDone`, `cs.focusCrit`), ce que la Focalisation ouvre à côté, sur la cour (`../../combat-suite.md`, sections
 * `focalisation`).
 */
import { ligne } from '../../../../../../src/hote/elements';
import { apresLeDe, avantLeDe, cumul, enjeu, fenetreSurLeDome, ILYANWE, jet, RESERVES, reserves, TOUR_D_ILYANWE } from './dome';
import type { Ecran } from './maquette';

/** Ce que la Focalisation ouvre (LDB 46 l.132, l.136). */
const OUVRE: [string, string][] = [['7 DR cumulés', 'NI 0 au prochain Round'], ['Critique', 'lançable au prochain Round'], ['Incantation manquée', 'magie perdue']];
/** L'état `nom` : le jet tombé `tombe` ou avant le dé, le cumul, la phrase, la ligne atteinte, ce que dit le journal. */
const focaliser = (nom: string, titre: string, tombe: { resultat: string; dr: string; critique?: true } | null, cumule: number, phrase: string, atteinte: number | null, dit: string) =>
  fenetreSurLeDome(nom, titre, 'incantation', { ...TOUR_D_ILYANWE, journal: ['Orc maîtrise sa psychologie (Animosité).', 'Berta se met en Défensive.', dit] }, {
    titre: 'Focalisation',
    corps: [ligne('sort/ni', 'Test étendu · Niveau d’incantation 7'), jet('jet', ILYANWE, 'Focalisation', '≤ 62', tombe ? { resultat: tombe.resultat, dr: tombe.dr, reussite: true, ...(tombe.critique ? { verdict: 'critique' } : {}) } : undefined),
      ligne('sort', 'Dôme'), cumul(cumule, 7), ligne('issue', phrase), enjeu('Ce que la Focalisation ouvre', OUVRE, atteinte)],
    gestes: tombe ? apresLeDe('focalisation', { reussi: true, chance: RESERVES.ilyanwe.chance, resilience: RESERVES.ilyanwe.resilience }) : avantLeDe('focalisation', { annuler: true, resilience: RESERVES.ilyanwe.resilience }),
    reserves: reserves(RESERVES.ilyanwe),
  });

export default {
  etats: [
    focaliser('focalisation-avant-le-de', 'Focalisation avant le dé', null, 0, 'Focalisation : 0/7 DR.', null, 'Ilyanwe la Voilée focalise la magie du Dôme.'),
    focaliser('focalisation', 'Focalisation tombée', { resultat: '24', dr: '+4' }, 4, 'Focalisation : 4/7 DR.', null, 'Ilyanwe la Voilée focalise la magie du Dôme.'),
    focaliser('focalisation-atteinte', 'Focalisation, le Niveau d’incantation atteint', { resultat: '31', dr: '+3' }, 7, 'Focalisation complète — le NI du Sort est atteint.', 0, 'Ilyanwe la Voilée a focalisé assez de magie pour lancer Dôme (NI 0).'),
    focaliser('focalisation-critique', 'Focalisation sur un Critique', { resultat: '33', dr: '+3', critique: true }, 3, 'Dôme est lançable au prochain Round (NI 0) !', 1, 'Ilyanwe la Voilée — Focalisation CRITIQUE : Dôme est lançable au prochain Round (NI 0) !'),
  ],
} satisfies Ecran;
