/**
 * SLOTS DE JET — le slot `pending*` qui porte la donnée de chaque jet qu'une étape de cascade hôte,
 * et les prédicats purs qui en lisent l'état (orphelin, sans corps, en attente). Types seuls importés.
 */
import type { Jeu } from './etat';
import type { CascadeStep } from './pendings';
import type { PendingKey } from './stateFields';

/** Les jets qu'une étape peut HÔTER — union fermée de `CascadeStepBase.jet`. */
export type HostJet = NonNullable<CascadeStep['jet']>;

/**
 * SLOT `pending*` porteur des données de CHAQUE jet hôté — table TOTALE : ajouter un `jet` à l'union
 * ne compile plus sans sa ligne ici. `maladresse` est le seul à `null` : sa donnée (arme + résultat des
 * Oups !) vit SUR l'étape (`step.maladresse`), il n'y a pas de `pendingFumble` à désynchroniser.
 *
 * Elle vit ICI, dans un module qui n'importe que des types : c'est une lecture du STORE, et ses deux
 * consommateurs sont aux deux bouts de la chaîne — le mint (`rollSeam.hostStep`, qui refuse d'ouvrir
 * une fenêtre sans sa donnée) et la porte du curseur (`cascade.poserLeCurseur`, qui refuse de s'y
 * poser quand la donnée a disparu). Ce module n'importe AUCUN runtime : ni l'un ni l'autre n'y
 * gagne de cycle.
 */
export const PENDING_BY_JET = {
  attaque: 'pendingAttack',
  defense: 'pendingDefense',
  maladresse: null,
  incantation: 'pendingCast',
  test: 'pendingTest',
  testEtendu: 'pendingExtendedTest',
  desengagement: 'pendingDisengage',
  enfoncerLaPorte: 'pendingForceDoor',
} as const satisfies Record<HostJet, PendingKey | null>;

/** Les pendings porteurs d'une étape-jet : l'arbitre les rend sous la cascade, et leur annulation
 *  ferme aussi la cascade-hôte (`rollFlowFactory`, teardown de `annuler`). */
export type PorteurDEtape = Exclude<(typeof PENDING_BY_JET)[HostJet], null>;
export const PORTEURS_D_ETAPE: readonly PorteurDEtape[] = Object.values(PENDING_BY_JET).filter((k): k is PorteurDEtape => k != null);

/**
 * HÔTE ORPHELIN (#1852) — « cette étape-jet n'a PAS de quoi rendre un corps ». DÉFINITION UNIQUE,
 * partagée par la porte du curseur (`cascade.poserLeCurseur`) et par les hooks de props des jets
 * (`useXJetProps`) : c'est parce qu'elle est TOTALE que `CascadeModal` rend ses étapes-jets
 * INCONDITIONNELLEMENT (`{...props!}` sur un hook rendu `null` donne `{}` à `RollShell`, donc un crash).
 *
 * Trois causes, toutes portées ici — le slot VIDE, l'ACTEUR absent de son ensemble, et la donnée portée par
 * l'ÉTAPE (Maladresse : `PENDING_BY_JET.maladresse` est `null`, son corps vit dans `step.maladresse`).
 * Une étape déjà VALIDÉE (`committed`) est hors sujet : elle a rendu sa donnée et se ferme.
 * Prédicat PUR (aucun runtime importé) et TOTAL sur les `HostJet`.
 */
export function hoteOrphelin(s: Partial<Jeu>, step: CascadeStep | undefined): boolean {
  return !!step && !step.committed && sansCorps(s, step);
}

/**
 * SANS CORPS (#1765) — « cette étape-jet n'a rien à rendre », validée ou non : le corps d'un jet hôte ne
 * tient qu'à son slot, à ses acteurs ou à la donnée de l'étape. Lu par `hoteOrphelin` (porte du curseur)
 * et par l'ÉLECTION de la cascade (`modalArbiter`) : une étape-jet dont le slot s'est vidé pendant
 * qu'un enchaînement hors modale tient la main (`pendingDualStrike`, `pendingCleave`) n'élit aucune
 * fenêtre.
 */
export function sansCorps(s: Partial<Jeu>, step: CascadeStep | undefined): boolean {
  if (!step?.jet) return false;
  const slot = PENDING_BY_JET[step.jet];
  if (slot && s[slot] == null) return true;
  // Les acteurs : la file de combat, hors combat le groupe et l'assaillant de la série d'attaques subies (`serieSubie`).
  const pool = s.battle?.combatants ?? [...(s.party ?? []), ...(s.serieSubie ? [s.serieSubie.assaillant] : [])];
  const present = (id: string | undefined): boolean => !!id && pool.some((c) => c.id === id);
  switch (step.jet) {
    case 'attaque': return !present(s.pendingAttack?.attackerId) || !present(s.pendingAttack?.targetId);
    case 'defense': return !present(s.pendingDefense?.attackerId) || !present(s.pendingDefense?.defenderId);
    case 'maladresse': return !step.maladresse || !present(step.actorId);
    case 'testEtendu': return !present(s.pendingExtendedTest?.actorId);
    default: return false; // cast / test / disengage / forceDoor : leur corps ne tient qu'au slot
  }
}

/**
 * HÔTE EN ATTENTE (#1765) — « cette étape-jet attend que sa fenêtre rende sa donnée » : elle n'est pas validée
 * (`committed`) et sa donnée manque — le slot vit encore, ou, pour la Maladresse (#3982), dont la donnée vit SUR
 * l'étape, les Oups ! ne sont pas tirés (`step.maladresse.result`). Le curseur ne la franchit pas — ni par un
 * « Suivant », ni par « Tout lancer » : c'est sa fenêtre qui la rend (`jetValider('defense')` pose `committed`,
 * `jetValider('attaque')` vide son slot, `jetLancer('maladresse')` tire les Oups !). Prédicat PUR et TOTAL sur les
 * `HostJet`, lu par `cascade.stepReady`.
 */
export function hoteEnAttente(s: Partial<Jeu>, step: CascadeStep): boolean {
  if (!step.jet || step.committed) return false;
  if (step.jet === 'maladresse') return step.maladresse?.result == null;
  const slot = PENDING_BY_JET[step.jet];
  return slot != null && s[slot] != null;
}
