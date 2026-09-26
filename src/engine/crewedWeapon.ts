/**
 * ARME D'ÉQUIPE (Atout/Défaut *Arme d'équipe (Indice)*, AA / MDG 12 l.440-464) — mécanique PURE et
 * GÉNÉRALE : une pièce d'artillerie servie par une équipe, qu'elle soit emplacée au SOL (sièges) ou montée
 * sur un navire (poste). L'Indice (équipage requis) est lu sur la qualité `arme-d-equipe` de l'arme ; les
 * servants au-delà de l'Indice n'améliorent pas le tir mais compensent les pertes (l.444).
 */
import type { Weapon, QualityInstance } from './types';
import { crewedTeamIndice, reloadDRTarget, isAtoutQuality } from './qualities/dispatch';

/** Dégradation d'une Arme d'équipe en sous-effectif (cumulatif). */
export interface CrewedPenalty {
  /** Facteur du temps de recharge : 1 = normal, 2 = doublé (ne se cumule pas au-delà). */
  reloadFactor: 1 | 2;
  /** Défauts AJOUTÉS par le sous-effectif (ids de qualité), dans l'ordre d'aggravation. */
  addFlaws: ('imprecise' | 'dangereuse')[];
}

/**
 * Pénalité de sous-effectif d'une Arme d'équipe (MDG 12 l.448-460). `present` = nombre de servants,
 * `indice` = équipage requis (Indice de la qualité). CUMULATIF selon le déficit = max(0, indice − présents) :
 * ≥1 manquant → temps de recharge DOUBLÉ ; ≥2 → + Défaut *Imprécise* ; ≥3 → + Défaut *Dangereuse*. PUR.
 * (Le −10 supplémentaire si l'arme possède DÉJÀ le Défaut ajouté — l.460 — est appliqué à la résolution du
 * tir, qui connaît les qualités de base de l'arme.)
 */
export function crewedPenalty(present: number, indice: number): CrewedPenalty {
  const deficit = Math.max(0, indice - Math.max(0, present));
  const addFlaws: ('imprecise' | 'dangereuse')[] = [];
  if (deficit >= 2) addFlaws.push('imprecise');
  if (deficit >= 3) addFlaws.push('dangereuse');
  return { reloadFactor: deficit >= 1 ? 2 : 1, addFlaws };
}

/** Issue d'UN Test étendu de recharge d'une Arme d'équipe (LDB 62 l.333). */
export interface CrewedReloadStep {
  /** DR cumulés après ce Test (plancher 0). */
  progress: number;
  /** Cible à atteindre = Recharge N (×2 si sous-effectif, `reloadDRTarget`). */
  target: number;
  /** La pièce est-elle rechargée (progress ≥ target) ? */
  done: boolean;
}

/**
 * Avancement d'une recharge d'Arme d'équipe par UN Test étendu de Projectiles (RAW LDB 62 l.333 : « obtenir
 * Indice DR pour être rechargée »). `progressBefore` = DR déjà cumulés ; `testDR` = DR de ce Test (le jet du
 * chef de pièce — Soutien des servants et Talent Artilleur déjà FONDUS en amont, comme tout jet ; on n'ajoute
 * AUCUNE mécanique ici). PUR. Le plancher 0 reflète qu'un Test raté ne recule pas (le RAW ne fait reculer que
 * l'INTERRUPTION → reset, géré par l'appelant). Réutilise `reloadDRTarget` (Recharge N, ×2 sous-effectif). */
export function crewedReloadStep(weapon: Weapon, progressBefore: number, testDR: number): CrewedReloadStep {
  const target = reloadDRTarget(weapon);
  const progress = Math.max(0, progressBefore + testDR);
  return { progress, target, done: progress >= target };
}

/**
 * Arme effectivement TIRÉE par une pièce servie, Défauts de sous-effectif BAKÉS selon le nombre de servants
 * `present` (MDG 12 l.448-460) : recharge ×`reloadFactor`, + Défaut *Imprécise*, + Défaut *Dangereuse*.
 * RETIRE la qualité `arme-d-equipe` — l'équipage RÉEL étant désormais résolu, l'hypothèse « maniée en solo »
 * de `dispatch.ts` (`crewedTeamIndice`) ne doit plus se cumuler ; un poste à effectif COMPLET tire donc net.
 * Un Défaut déjà porté par l'arme n'est PAS redoublé : il vaut alors **−10 au Test de tir** (l.460), baké en
 * `crewedTohitPenalty` (cumulatif par Défaut redoublé). PUR. Arme sans `arme-d-equipe` → inchangée.
 */
export function crewedFireWeapon(weapon: Weapon, present: number): Weapon {
  const indice = crewedTeamIndice(weapon);
  if (indice <= 0) return weapon;
  const pen = crewedPenalty(present, indice);
  const has = (id: string) => weapon.qualities.some((q) => q.id === id);
  const added = pen.addFlaws.filter((f) => !has(f)).map((id) => ({ id }));
  const redoubled = pen.addFlaws.filter(has).length; // Défauts déjà portés et « re-reçus » → −10 chacun (l.460)
  let qualities: QualityInstance[] = [...weapon.qualities.filter((q) => q.id !== 'arme-d-equipe'), ...added];
  // Baliste « relativement simple » (AA 10 l.148) tirée par UN SEUL servant valide (`present ≤ 1` : pas
  // d'équipe) → l'arme PERD TOUS SES ATOUTS, conserve ses Défauts. ORTHOGONAL au sous-effectif : la recharge
  // ×2 / les Défauts ajoutés s'appliquent EN PLUS (cf. `simpleSoloFireWeapon`, qui ne touche QUE les Atouts).
  if (weapon.soloSimple && present <= 1) qualities = qualities.filter((q) => !isAtoutQuality(q.id));
  return {
    ...weapon,
    qualities,
    reload: (weapon.reload ?? 0) * pen.reloadFactor,
    ...(redoubled ? { crewedTohitPenalty: (weapon.crewedTohitPenalty ?? 0) - 10 * redoubled } : null),
  };
}

/**
 * Pièce « relativement simple » tirée par UN SEUL servant valide (la baliste, AA 10 l.148) : l'arme PERD
 * TOUS SES ATOUTS (Pointue…) mais CONSERVE l'intégralité de ses Défauts (Recharge, Arme d'équipe…). PUR,
 * data-driven (Atout/Défaut lu dans `qualities.json` via `isAtoutQuality`). Le tir lui-même reste un Test de
 * Projectiles (Spé du Groupe) à la Capacité de Tir — cf. `combatValue` (la Spé s'applique normalement). Brique
 * COMPOSÉE par `crewedFireWeapon` quand l'effectif valide ≤ 1 ; exposée pour la résolution/l'éprouvé isolé.
 */
export function simpleSoloFireWeapon(weapon: Weapon): Weapon {
  return { ...weapon, qualities: weapon.qualities.filter((q) => !isAtoutQuality(q.id)) };
}
