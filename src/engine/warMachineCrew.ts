/**
 * ÉQUIPE des machines de guerre (ADE II 8 « Le théâtre de la guerre » l.233) ; la pénalité d'Équipe
 * incomplète est une rangée de la règle `equipe-incomplete-machine-de-guerre`. 3ᵉ courbe de sous-effectif, DISTINCTE de
 * `crewedPenalty` (AA/MDG 12, `engine/crewedWeapon.ts` : recharge ×2 + Défauts escaladés) et
 * `undercrewPenalty` (MDG 14, `engine/crewMorale.ts` : tranches de 10 % → DR navire plafonné) — PAS de
 * réutilisation de leur mécanique, ni de la Qualité `arme-d-equipe` (qui porterait leur courbe à elles).
 * L'Équipe requise vit en DONNÉE sur l'arme via la Qualité `equipe` (Indice = effectif requis).
 */
import type { Weapon } from './types';
import { qualityIndice } from './qualities/dispatch';

/** Dégradation d'une machine de guerre ADE II en sous-effectif. */
export interface WarMachineCrewPenalty {
  /** Équipe incomplète : la pénalité de la règle `equipe-incomplete-machine-de-guerre` s'applique. */
  incomplete: boolean;
  /** Inutilisable : moins de la moitié de l'Équipe requise est présente. */
  unusable: boolean;
}

/** Pénalité de sous-effectif d'une machine de guerre (ADE II 8 l.233). `present` = effectif présent
 *  (headcount brut — le RAW ne pose ICI aucune exigence de Compétence, à la différence d'AA 10 l.230/MDG 12 l.442),
 *  `required` = Équipe requise (Indice de la Qualité `equipe`). PUR. */
export function warMachineCrewPenalty(present: number, required: number): WarMachineCrewPenalty {
  if (required <= 0) return { incomplete: false, unusable: false };
  const p = Math.max(0, present);
  return { incomplete: p < required, unusable: p < required / 2 };
}

/** Équipe REQUISE d'une machine de guerre (Indice de la Qualité `equipe`), 0 si l'arme n'en porte pas
 *  (arme normale, ou machine de guerre sans Équipe déclarée). PUR. */
export function warMachineCrewRequired(w: Pick<Weapon, 'qualities'> | undefined): number {
  return qualityIndice(w, 'equipe') ?? 0;
}

/** Arme de machine de guerre effectivement tirée/maniée : marque l'Équipe incomplète (l.233) par
 *  `crewTeamIncomplete` (lu par `attackModifiers`, DISTINCT de `crewedTohitPenalty` d'AA). N'altère PAS les
 *  Qualités/la Recharge (RAW ADE II ne prévoit ni Défaut ajouté ni recharge doublée, à la différence d'AA) —
 *  seul le malus au toucher, PLAT. Arme sans Qualité `equipe` → inchangée. PUR. */
export function warMachineFireWeapon(weapon: Weapon, present: number): Weapon {
  const required = warMachineCrewRequired(weapon);
  if (required <= 0) return weapon;
  return warMachineCrewPenalty(present, required).incomplete ? { ...weapon, crewTeamIncomplete: true } : weapon;
}
