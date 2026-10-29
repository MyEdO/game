/**
 * Jeton d'INVERSION de Test CONSOMMABLE « pour votre prochaine aventure » (LDB 23 l.209 « Entraînement
 * au Combat » / l.218 « Observer une cible ») : posé par l'op `grantReverseToken` (`ActiveEffect.reverseToken`,
 * `duration:{scale:'adventure'}`) — MÊME canal que `statusMod` (Réputation, l.228-234), purgé s'il n'est
 * jamais consommé à l'ouverture de l'interlude suivant (`noyau/upkeep.purgeAdventureEffects`).
 *
 * « Inverser un Test » (LDB 12 l.42) = intervertir le chiffre des unités et des dizaines du d100
 * (`reverseRoll`, engine/combat.ts) — PAS une relance. Deux VOIES, deux gates RAW DISTINCTES (#508
 * réfutation) :
 *  - le Talent PERMANENT (`talentReverseFailed`, LDB 10 — Chat de gouttière/Lecture rapide/Noctambule/
 *    Pansement de fortune/Pharmacologie/Pilote/Sociable/Studieux) : « inverser un Test RATÉ si cela
 *    entraîne un succès » — gate STRICTE (jet actuellement raté ET le renversé réussit).
 *  - le jeton d'Activité (LDB 23 l.209/218) : « vous pouvez inverser un Test [de la Compétence
 *    associée / concernant votre cible] » — AUCUNE restriction d'échec ni de conversion. Offert dès
 *    que le jeton matche le Test, réussi OU raté ; son application PERMUTE toujours, le choix
 *    appartenant au joueur (#558) — elle peut donc dégrader un succès existant, assumé par le clic.
 * `reverseAvailable` pilote l'offre du verbe (rangée d'influence, jamais un popup) ; `applyReverse`
 * l'exécute SEULEMENT sur clic, Talent d'abord (gratuit, illimité) PUIS jeton (consommé).
 */
import type { Combatant } from './types';
import { refCouvre } from '../data/schemas/grammaire/ref';
import { reverseRoll } from './combat';
import { evaluateTest } from './tests';
import { talentReverseFailed } from './combatFeatures/dispatch';
import { removeActiveEffects } from './conditions';

/** Un jeton d'inversion couvre-t-il le Test `{skill, spec}` ? `skill` absent sur le jeton = tout Test
 *  (« Observer une cible », l.218) ; sinon match STRUCTURÉ par id (comme `talentReverseFailed`). */
function tokenMatches(tok: { skill?: string; spec?: string }, q: { skill?: string; spec?: string }): boolean {
  if (tok.skill == null) return true;
  return refCouvre({ id: tok.skill, spec: tok.spec }, { id: q.skill, spec: q.spec });
}

/** Peek NON-CONSOMMANT (miroir de `consumeReverseToken`) : `c` porte-t-il un jeton applicable à
 *  `{skill, spec}` ? Pilote la disponibilité UI sans dépenser le jeton avant le clic du joueur. */
export function hasReverseToken(c: Combatant, q: { skill?: string; spec?: string }): boolean {
  const effects = c.activeEffects ?? [];
  return effects.some((e) => e.reverseToken && tokenMatches(e.reverseToken, q));
}

/** Consomme le PREMIER jeton d'inversion de `c` couvrant `{skill, spec}`, le retire de `c.activeEffects`
 *  et renvoie `true` — `false` si aucun jeton ne correspond (rien de consommé, 0 excédent = 0 effet). */
export function consumeReverseToken(c: Combatant, q: { skill?: string; spec?: string }): boolean {
  const jeton = (c.activeEffects ?? []).find((e) => e.reverseToken && tokenMatches(e.reverseToken, q));
  if (!jeton) return false;
  removeActiveEffects(c, (e) => e === jeton);
  return true;
}

/** Le TALENT permanent (LDB 10) offre-t-il l'inversion pour CE jet (`roll` vs `target`) ? Gate STRICTE
 *  RAW : un Test RATÉ que l'inversion transformerait en réussite — jamais offert sur un succès
 *  (contrairement au jeton d'Activité, `tokenReverseAvailable`). */
export function talentReverseAvailable(c: Combatant, q: { skill?: string; spec?: string }, roll: number, target: number): boolean {
  if (q.skill == null || talentReverseFailed(c, q) == null) return false;
  if (evaluateTest(roll, target).success) return false; // Talent : seulement sur un Test RATÉ
  return evaluateTest(reverseRoll(roll), target).success;
}

/** Le JETON d'Activité (LDB 23 l.209/218) offre-t-il l'inversion pour `{skill, spec}` ? LIBRE : ni
 *  restriction d'échec ni de conversion (RAW « vous pouvez inverser un Test », sans condition). */
export function tokenReverseAvailable(c: Combatant, q: { skill?: string; spec?: string }): boolean {
  return hasReverseToken(c, q);
}

/** `c` dispose-t-il d'une inversion OFFERTE (Talent OU jeton) pour ce jet ? Pure (aucune consommation) —
 *  pilote l'affichage du verbe « Inverser » dans la rangée d'influence (RollRow). */
export function reverseAvailable(c: Combatant, q: { skill?: string; spec?: string }, roll: number, target: number): boolean {
  return talentReverseAvailable(c, q, roll, target) || tokenReverseAvailable(c, q);
}

/** Résultat PUR de l'inversion (SANS consommer le jeton) — même sélection Talent/jeton qu'`applyReverse`,
 *  pour prévisualiser l'issue (dé renversé, DR, succès) AVANT le clic (rangée d'influence). `null` si
 *  aucune voie n'est offerte. */
export function reversePreview(
  c: Combatant, q: { skill?: string; spec?: string }, roll: number, target: number,
): { roll: number; sl: number; success: boolean } | null {
  const e = evaluateTest(reverseRoll(roll), target);
  if (talentReverseAvailable(c, q, roll, target)) {
    const rf = talentReverseFailed(c, q)!;
    return { roll: e.roll, sl: rf.capDR != null ? Math.min(e.sl, rf.capDR) : e.sl, success: e.success };
  }
  if (tokenReverseAvailable(c, q)) return { roll: e.roll, sl: e.sl, success: e.success };
  return null;
}

/** Applique RÉELLEMENT l'inversion (Talent d'abord — gratuit, illimité, gate stricte échec→succès —
 *  puis jeton — libre, consommé) : `null` si aucune voie n'est offerte (0 gaspillage). Le jeton permute
 *  TOUJOURS une fois offert (choix du joueur, #558) : l'issue peut rester ratée ou dégrader un succès,
 *  `success` reflète le jet RÉEL renversé (pas de succès forcé — seule la voie Talent le garantit par
 *  construction de sa gate). */
export function applyReverse(
  c: Combatant, q: { skill?: string; spec?: string }, roll: number, target: number,
): { roll: number; sl: number; success: boolean } | null {
  const viaTalent = talentReverseAvailable(c, q, roll, target);
  if (!viaTalent && !tokenReverseAvailable(c, q)) return null;
  const result = reversePreview(c, q, roll, target)!;
  if (!viaTalent) consumeReverseToken(c, q);
  return result;
}
