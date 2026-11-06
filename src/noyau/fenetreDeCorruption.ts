/**
 * LA FENÊTRE DE L'EXPOSITION À LA CORRUPTION EN DONNÉES — la nature de l'Influence que le joueur tranche quand la
 * source ne l'impose pas (LDB 19 l.29) : chaque nature offerte avec la cible du Test qu'elle ouvre, montée par la
 * ligne que le résolveur jette (`ligneDuTestNomme`), et la raison qui la ferme. Lecteur PUR.
 */
import type { Jeu } from './etat';
import { gesteDuReglage, type ChoixNomme } from './reglages';
import { actorIn } from './monde/combatants';
import { libelleDeLaFermeture, libelleDuReglage } from './libelles';
import { fermetureDuReglage, ligneDuTestNomme } from './rollFlowSpecs';
import { NATURES_D_INFLUENCE, type NatureDInfluence } from '../data/schemas/grammaire/valeurs';
import { testDeRegle } from '../engine/reglesChiffrees';
import { refLabel } from '../data';

/** Une nature offerte : la valeur du choix, la cible de son Test (`ligneDuTestNomme`) et la Compétence qu'il teste. */
export type OptionDeNature = { valeur: NatureDInfluence; libelle: string; refus: string | null; cible: number; competence: string };

/** Le choix de la nature de l'Influence, chaque option avec sa cible. */
export type ChoixDeNature = Omit<ChoixNomme<NatureDInfluence>, 'options'> & { options: OptionDeNature[] };

/** Pourquoi la nature de l'exposition en attente ne se règle plus, `null` si elle s'offre. La fermeture est celle que
 *  `jetRegler` applique (`fermetureDuReglage`). Le choix n'existe qu'en exposition à nature ouverte
 *  (`fenetreDeCorruption`). */
export function refusDeLaNature(s: Jeu): string | null {
  const f = fermetureDuReglage(() => s, 'corruption', 'nature');
  return f ? libelleDeLaFermeture(f) : null;
}

/** La fenêtre de l'exposition en attente : le choix de la nature (`jetRegler('corruption', 'nature', …)`), `null` au seuil, sous une
 *  nature imposée par la source ou sans porteur ; `null` sans Corruption en attente. LDB 19 l.29, l.70 */
export function fenetreDeCorruption(s: Jeu): { nature: ChoixDeNature | null } | null {
  const pc = s.pendingCorruption;
  if (!pc) return null;
  const heros = actorIn(s, pc.heroId);
  if (pc.kind === 'seuil' || pc.natureFixee || !heros) return { nature: null };
  return {
    nature: {
      geste: gesteDuReglage('corruption', 'nature'),
      libelle: libelleDuReglage('corruption', 'nature'),
      choisie: pc.nature ?? null,
      options: NATURES_D_INFLUENCE.map((cle) => {
        const test = testDeRegle('influences-corruptrices', cle);
        return { valeur: cle, libelle: test.label, competence: refLabel('skills', test.skill), cible: ligneDuTestNomme(heros, test).target, refus: refusDeLaNature(s) };
      }),
    },
  };
}
