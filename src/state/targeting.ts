/**
 * Ciblage au SURVOL — source unique du tooltip + réticule + ligne de visée du joueur (IsoStage).
 * Rejoue les MÊMES prédicats que le clic (via le REGISTRE DE MODES `targetingModes.ts`) pour que
 * l'affordance ne mente jamais : réticule présent = le clic aboutira, réticule interdit = il sera refusé (et pourquoi).
 * Pur (lit l'état). `hoverTargeting`/`validTargets` sont seulement des entrées qui délèguent au mode
 * courant ; les corps d'affordance/candidats vivent dans `targetingModes.ts` (source unique).
 */
import { Combatant } from '../engine/types';
import { isOutOfAction } from '../engine/conditions';
import { combatDistance } from './footprint';
import type { GameState } from './store';
import { currentTargetingMode, type HoverTargeting, type TilePreview } from './targetingModes';
import { controlsCombatant } from './netOwnership';
import { inBattleId } from './combatants';
import { canPreemptRanged } from '../engine/combatFeatures/dispatch';
import type { Pt } from './path';

// Réexports de compatibilité : le TYPE d'affordance et la dérivation du côté visé d'un sort vivent
// dans le registre de modes ; les importeurs historiques (IsoStage, tests) restent valides.
export type { HoverTargeting, TilePreview } from './targetingModes';
export { spellAffinity } from './targetingModes';

/**
 * Évalue le survol de `target` par le héros `active` selon le MODE de ciblage courant
 * (`currentTargetingMode`) : attaque implicite, incantation, soin, surincantation, bordée… Retourne
 * `none` quand le survol n'a pas de sens (mauvaise équipe, hors mode, hors combat, mode-CASE pur).
 */
export function hoverTargeting(get: () => GameState, active: Combatant, target: Combatant): HoverTargeting {
  const battle = get().battle;
  if (!battle || battle.over || !active.pos || !target.pos) return { kind: 'none' };
  // Un engin de siège INERTE (immune, RAW AA 10 l.175-193) n'est JAMAIS une cible d'attaque/sort/soin : pas de
  // réticule — on vise son équipage (combattants ordinaires), pas la pièce. (Structures/véhicules NE sont pas `inert`.)
  if (target.inert) return { kind: 'none' };
  return currentTargetingMode(get).affordance?.(get, active, target) ?? { kind: 'none' };
}

/** Le combattant qui PILOTE le curseur/ciblage : l'ACTIF si le siège local le contrôle, sinon — pendant la
 *  pause de début de Round — le TIREUR dont le Tir rapide est ARMÉ (`preemptAiming`, LDB 10). Source UNIQUE
 *  du ciblage clavier/manette/souris hors tour (il n'y a AUCUN actif à `turn:-1`). */
export function cursorActor(get: () => GameState): Combatant | undefined {
  const s = get();
  const battle = s.battle;
  if (!battle || battle.over) return undefined;
  const active = inBattleId(battle, battle.order[battle.turn]);
  if (active && controlsCombatant(s, active) && active.pos) return active;
  if (s.preemptAiming) { const sh = inBattleId(battle, s.preemptAiming); if (sh?.pos) return sh; }
  return undefined;
}

/** Héros que le siège LOCAL contrôle et qui peuvent DÉCLENCHER Tir rapide pendant la pause (LDB 10) : arme à
 *  distance chargée + pas encore tiré ce Round. Source UNIQUE de l'éligibilité (frise/badge, clavier, manette).
 *  Vide hors pause. */
export function preemptShooterIds(get: () => GameState): string[] {
  const s = get();
  const battle = s.battle;
  if (!battle || battle.over || !s.pendingRoundStart) return [];
  return battle.order.filter((id) => {
    const c = inBattleId(battle, id);
    return !!c && controlsCombatant(s, c) && canPreemptRanged(c) && !c.loseNextAction;
  });
}

/** Combattants que le TIREUR courant (actif OU visée Tir rapide armée) peut cibler au survol selon le mode
 *  courant — `candidates` du mode s'il en fournit (soin/surincantation/cleave/dual), sinon ceux dont
 *  l'affordance ≠ 'none' — triés du PLUS PROCHE au plus loin. Base du ciblage clavier (Tab). */
export function validTargets(get: () => GameState): Combatant[] {
  const battle = get().battle;
  if (!battle || battle.over) return [];
  const active = cursorActor(get);
  if (!active?.pos) return [];
  const mode = currentTargetingMode(get);
  const cands = mode.candidates
    ? mode.candidates(get, active)
    : battle.combatants.filter((c) => c.id !== active.id && c.pos && !isOutOfAction(c) && hoverTargeting(get, active, c).kind !== 'none');
  return [...cands].sort((a, b) => combatDistance(active, a) - combatDistance(active, b));
}

/** Cible SUIVANTE (Tab) : la plus proche valide, ou la suivante par distance si une est déjà visée —
 *  cycle complet sur toutes les cibles valides puis retour à la première. Null si aucune. */
export function cycleTarget(get: () => GameState, currentId: string | null): Combatant | null {
  const sorted = validTargets(get);
  if (!sorted.length) return null;
  const idx = sorted.findIndex((c) => c.id === currentId);
  return sorted[(idx + 1) % sorted.length];
}

/** Aperçu du mode-CASE courant (Pousser/Téléportation/pose de zone) à `pt` — MÊME registre que le clic
 *  (`tileValidAt`/`tilePreview` du mode courant, #198) : réticule + direction/coût au survol souris ET
 *  au déplacement du curseur clavier (`combatCursor.tile`, appelant commun). null hors mode-case ou
 *  tuile invalide (le mode ATTAQUE/CAST/HEAL/BATTERY, sans `tileValidAt`, retombe toujours à null ici —
 *  ces modes gardent l'aperçu de DÉPLACEMENT normal, `movePreviewAt`). */
export function tilePreviewAt(get: () => GameState, pt: Pt): TilePreview | null {
  const battle = get().battle;
  const active = cursorActor(get);
  if (!battle || battle.over || !active) return null;
  const mode = currentTargetingMode(get);
  if (!mode.tileValidAt || !mode.tilePreview || !mode.tileValidAt(get, active, pt)) return null;
  return mode.tilePreview(get, active, pt);
}

/** Cible PRÉCÉDENTE (Maj+Tab / gâchette gauche) : symétrique de `cycleTarget`, sens inverse. Null si aucune. */
export function cyclePrevTarget(get: () => GameState, currentId: string | null): Combatant | null {
  const sorted = validTargets(get);
  if (!sorted.length) return null;
  const idx = sorted.findIndex((c) => c.id === currentId);
  // idx === -1 (aucune cible courante) → -1-1 = -2 ; +len ramène à l'avant-dernier. On veut la DERNIÈRE
  // quand rien n'est visé → on part de 0 dans ce cas pour que (0-1+len)%len = dernière.
  const from = idx < 0 ? 0 : idx;
  return sorted[(from - 1 + sorted.length) % sorted.length];
}
