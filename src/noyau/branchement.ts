/**
 * LE BRANCHEMENT DU JEU (#2889, D7, #4862) — ce qui ferme sur le propriétaire de l'état branché (la partie, le
 * banc) : le hook `onGainCondition` du moteur, le nommeur du texte du moteur (#4017), l'observateur des jets (#4848),
 * la clôture de cascade et les tables du jeu. Un seul propriétaire branché par contexte JS : une seconde pose sans
 * retrait LÈVE. D'autres propriétaires peuvent être ouverts, suspendus : `suspendreLeJeuBranche` débranche celui qui
 * l'est, après qu'il a gardé ce qu'il pose (`Branchement.suspendre`).
 *
 * Le moteur garde son contrat (`engine/conditions.ts`, « Absent ⇒ aucune réaction ») : c'est le noyau
 * qui garantit la pose, ici.
 */
import type { Get, Set } from './flowTypes';
import { setConditionGainedHook } from '../engine/conditions';
import { poserLeNommeur } from '../engine/nom';
import { poserLObservateurDesJets } from '../engine/tests';
import { bus, EVT } from './bus';
import { chargeDuJet } from './jetsEnVue';
import { nomEnVue } from './visionDuGroupe';
import { setClotureDeCascade } from './cascade';
import { dispatchCascadeDone } from './combatSlice';
import { handleConditionGained } from './combat/triggeredTest';
import { poserLesTables, retirerLesTables, type TablesDuJeu } from './tablesPosees';

/** Un propriétaire branché : son état, et ce qui garde et retire les singletons qu'il a posés hors du branchement. */
export interface Branchement {
  get: Get;
  set: Set;
  suspendre: () => void;
}

let branche: Branchement | null = null;

/** Branche le jeu sur son propriétaire `b`, avec ses `tables`. */
export function brancherLeJeu(b: Branchement, tables: TablesDuJeu): void {
  if (branche) throw new Error('[noyau] jeu déjà branché : `debrancherLeJeu` avant une seconde pose');
  branche = b;
  const { get, set } = b;
  poserLesTables(tables);
  setConditionGainedHook((c, name) => handleConditionGained(get, set, c, name));
  poserLeNommeur((id) => nomEnVue(get(), id));
  poserLObservateurDesJets((jet, r, origine) => bus.emit(EVT.TEST_JETE, chargeDuJet(jet, r, origine)));
  setClotureDeCascade((done) => dispatchCascadeDone(get, set, done));
}

/** Retire ce que `brancherLeJeu` a posé. */
export function debrancherLeJeu(): void {
  branche = null;
  retirerLesTables();
  setConditionGainedHook(undefined);
  poserLeNommeur(undefined);
  poserLObservateurDesJets(undefined);
  setClotureDeCascade(undefined);
}

/** Suspend le propriétaire branché, s'il y en a un : il garde ses singletons (`suspendre`), puis se débranche. */
export function suspendreLeJeuBranche(): void {
  if (!branche) return;
  branche.suspendre();
  debrancherLeJeu();
}

/** Le propriétaire branché, ou `null`. */
export function jeuBranche(): Branchement | null {
  return branche;
}
