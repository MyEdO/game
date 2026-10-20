/**
 * LE BRANCHEMENT DU JEU (#2889, D7) — ce qui ferme sur le propriétaire de l'état (le store web, la
 * partie) : le hook `onGainCondition` du moteur, la clôture de cascade et les tables du jeu. Un seul
 * propriétaire par contexte JS : une seconde pose sans retrait LÈVE.
 *
 * Le moteur garde son contrat (`engine/conditions.ts`, « Absent ⇒ aucune réaction ») : c'est le noyau
 * qui garantit la pose, ici.
 */
import type { Get, Set } from './flowTypes';
import { setConditionGainedHook } from '../engine/conditions';
import { setClotureDeCascade } from './cascade';
import { dispatchCascadeDone } from './combatSlice';
import { handleConditionGained } from './combat/triggeredTest';
import { poserLesTables, retirerLesTables, type TablesDuJeu } from './tablesPosees';

let branche: { get: Get; set: Set } | null = null;

/** Branche le jeu sur son propriétaire `get`/`set`, avec ses `tables`. */
export function brancherLeJeu(get: Get, set: Set, tables: TablesDuJeu): void {
  if (branche) throw new Error('[noyau] jeu déjà branché : `debrancherLeJeu` avant une seconde pose');
  branche = { get, set };
  poserLesTables(tables);
  setConditionGainedHook((c, name) => handleConditionGained(get, set, c, name));
  setClotureDeCascade((done) => dispatchCascadeDone(get, set, done));
}

/** Retire ce que `brancherLeJeu` a posé. */
export function debrancherLeJeu(): void {
  branche = null;
  retirerLesTables();
  setConditionGainedHook(undefined);
  setClotureDeCascade(undefined);
}

/** Le propriétaire branché, ou `null`. */
export function jeuBranche(): { get: Get; set: Set } | null {
  return branche;
}
