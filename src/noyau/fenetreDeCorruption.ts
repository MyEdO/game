/**
 * LA FENÊTRE DE L'EXPOSITION À LA CORRUPTION EN DONNÉES — la nature de l'Influence que le joueur tranche quand la
 * source ne l'impose pas (LDB 19 l.29) : chaque nature offerte avec la cible du Test qu'elle ouvre, montée par la
 * ligne que le résolveur jette (`ligneDuTestNomme`), et la raison qui la ferme. Lecteur PUR.
 */
import type { Jeu } from './etat';
import type { ChoixNomme } from './reglages';
import { actorIn } from './monde/combatants';
import { libelleDuVerbe } from './libelles';
import { ligneDuTestNomme } from './rollFlowSpecs';
import { NATURES_D_INFLUENCE, type NatureDInfluence } from '../data/schemas/grammaire/valeurs';
import { testDeRegle } from '../engine/reglesChiffrees';
import { refLabel } from '../data';
import { garanti } from '../lib/garanti';
import { t } from '../i18n';

/** Une nature offerte : la valeur du choix, la cible de son Test (`ligneDuTestNomme`) et la Compétence qu'il teste. */
export type OptionDeNature = { valeur: NatureDInfluence; libelle: string; refus: string | null; cible: number; competence: string };

/** Le choix de la nature de l'Influence, chaque option avec sa cible. */
export type ChoixDeNature = Omit<ChoixNomme<NatureDInfluence>, 'options'> & { options: OptionDeNature[] };

/** Pourquoi la nature de l'exposition en attente ne se règle plus, `null` si elle s'offre : le jet est lancé. Le choix
 *  n'existe qu'en exposition à nature ouverte (`fenetreDeCorruption`). */
export function refusDeLaNature(s: Pick<Jeu, 'pendingCorruption'>): string | null {
  return s.pendingCorruption?.roll != null ? t('jet.ferme.jetLance') : null;
}

/** La fenêtre de l'exposition en attente : le choix de la nature (`corruptionSetNature`), `null` au seuil, sous une
 *  nature imposée par la source ou sans porteur ; `null` sans Corruption en attente. LDB 19 l.29, l.70 */
export function fenetreDeCorruption(s: Jeu): { nature: ChoixDeNature | null } | null {
  const pc = s.pendingCorruption;
  if (!pc) return null;
  const heros = actorIn(s, pc.heroId);
  if (pc.kind === 'seuil' || pc.natureFixee || !heros) return { nature: null };
  return {
    nature: {
      verbe: 'corruptionSetNature',
      libelle: garanti(libelleDuVerbe('corruptionSetNature'), 'corruptionSetNature', 'libellé de la nature de la Corruption'),
      choisie: pc.nature ?? null,
      options: NATURES_D_INFLUENCE.map((cle) => {
        const test = testDeRegle('influences-corruptrices', cle);
        return { valeur: cle, libelle: test.label, competence: refLabel('skills', test.skill), cible: ligneDuTestNomme(heros, test).target, refus: refusDeLaNature(s) };
      }),
    },
  };
}
