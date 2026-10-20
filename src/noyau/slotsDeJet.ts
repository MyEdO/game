/**
 * SLOTS DE JET — le slot `pending*` qui porte la donnée de chaque jet qu'une étape de cascade hôte,
 * et les prédicats purs qui en lisent l'état (orphelin, sans corps, en attente). Types seuls importés.
 */
import type { GameState } from '../state/store';
import type { CascadeStep } from './pendings';
import type { PendingKey } from './stateFields';

/** Les jets qu'une étape peut HÔTER — union fermée de `CascadeStepBase.jet`. */
export type HostJet = NonNullable<CascadeStep['jet']>;

/**
 * SLOT `pending*` porteur des données de CHAQUE jet hôté — table TOTALE : ajouter un `jet` à l'union
 * ne compile plus sans sa ligne ici. `fumble` est le seul à `null` : sa donnée (arme + résultat des
 * Oups !) vit SUR l'étape (`step.fumble`), il n'y a pas de `pendingFumble` à désynchroniser.
 *
 * Elle vit ICI, dans un module qui n'importe que des types : c'est une lecture du STORE, et ses deux
 * consommateurs sont aux deux bouts de la chaîne — le mint (`rollSeam.hostStep`, qui refuse d'ouvrir
 * une fenêtre sans sa donnée) et la porte du curseur (`cascade.poserLeCurseur`, qui refuse de s'y
 * poser quand la donnée a disparu). Ce module n'importe AUCUN runtime : ni l'un ni l'autre n'y
 * gagne de cycle.
 */
export const PENDING_BY_JET: Record<HostJet, PendingKey | null> = {
  attack: 'pendingAttack',
  defense: 'pendingDefense',
  fumble: null,
  cast: 'pendingCast',
  test: 'pendingTest',
  extended: 'pendingExtendedTest',
  disengage: 'pendingDisengage',
  forceDoor: 'pendingForceDoor',
};

/**
 * HÔTE ORPHELIN (#1852) — « cette étape-jet n'a PAS de quoi rendre un corps ». DÉFINITION UNIQUE,
 * partagée par la porte du curseur (`cascade.poserLeCurseur`) et par les hooks de props des jets
 * (`ui/jetProps/useXJetProps`) : c'est parce qu'elle est TOTALE que `CascadeModal` rend ses étapes-jets
 * INCONDITIONNELLEMENT (`{...props!}` sur un hook rendu `null` donne `{}` à `RollShell`, donc un crash).
 *
 * Trois causes, toutes portées ici — le slot VIDE, l'ACTEUR sorti du `battle`, et la donnée portée par
 * l'ÉTAPE (Maladresse : `PENDING_BY_JET.fumble` est `null`, son corps vit dans `step.fumble`).
 * Une étape déjà VALIDÉE (`committed`) est hors sujet : elle a rendu sa donnée et se ferme.
 * Prédicat PUR (aucun runtime importé) et TOTAL sur les `HostJet`.
 */
export function hoteOrphelin(s: Partial<GameState>, step: CascadeStep | undefined): boolean {
  return !!step && !step.committed && sansCorps(s, step);
}

/**
 * SANS CORPS (#1765) — « cette étape-jet n'a rien à rendre », validée ou non : le corps d'un jet hôte ne
 * tient qu'à son slot, à ses acteurs ou à la donnée de l'étape. Lu par `hoteOrphelin` (porte du curseur)
 * et par l'ÉLECTION de la cascade (`modalArbiter`) : une étape-jet dont le slot s'est vidé pendant
 * qu'un enchaînement hors modale tient la main (`pendingDualStrike`, `pendingCleave`) n'élit aucune
 * fenêtre.
 */
export function sansCorps(s: Partial<GameState>, step: CascadeStep | undefined): boolean {
  if (!step?.jet) return false;
  const slot = PENDING_BY_JET[step.jet];
  if (slot && s[slot] == null) return true;
  const present = (id: string | undefined): boolean => !!id && !!s.battle?.combatants.some((c) => c.id === id);
  switch (step.jet) {
    case 'attack': return !present(s.pendingAttack?.attackerId) || !present(s.pendingAttack?.targetId);
    case 'defense': return !present(s.pendingDefense?.attackerId) || !present(s.pendingDefense?.defenderId);
    case 'fumble': return !step.fumble || !present(step.actorId);
    // Épreuve étendue : hors combat, l'acteur se lit au GROUPE (même pool que `useExtendedTestJetProps`).
    case 'extended': {
      const id = s.pendingExtendedTest?.actorId;
      const pool = s.battle?.combatants ?? s.party ?? [];
      return !id || !pool.some((c) => c.id === id);
    }
    default: return false; // cast / test / disengage / forceDoor : leur corps ne tient qu'au slot
  }
}

/**
 * HÔTE EN ATTENTE (#1765) — « cette étape-jet attend que sa fenêtre rende sa donnée » : son slot vit et elle
 * n'est pas validée (`committed`). Le curseur ne la franchit pas — ni par un « Suivant », ni par « Tout
 * lancer » : c'est sa fenêtre qui la rend (`defenseConfirm` pose `committed`, `attackConfirm` vide son
 * slot). Prédicat PUR et TOTAL sur les `HostJet`, lu par `cascade.stepReady`.
 */
export function hoteEnAttente(s: Partial<GameState>, step: CascadeStep): boolean {
  if (!step.jet || step.committed) return false;
  const slot = PENDING_BY_JET[step.jet];
  return slot != null && s[slot] != null;
}
