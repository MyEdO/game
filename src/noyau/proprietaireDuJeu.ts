/**
 * LE PROPRIÉTAIRE DE L'ÉTAT DU JEU hors du web (#2817 D7, D8, #3058) : l'état et les actions du noyau
 * (`creerActionsDuNoyau`), l'écriture de zustand suivie de la transition du jeu (`transitionDuJeu`) et du tick
 * automatique (`planifierLeTickAuto`), l'abonnement, le branchement (`brancherLeJeu`), les entrées de D8 et une
 * plateforme dont l'appel différé rend un jeton, signalé à `surProgramme` et rejoué par `reprendre`. La partie
 * (`partie.ts`) et le banc de test (`banc.testkit.ts`) le composent ; un seul par contexte JS (`branchement.ts`).
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { EtatDeJeu, Jeu } from './etat';
import type { Get, SetDesClesReservees } from './flowTypes';
import type { EntreesDeLaPartie } from './partie';
import { creerActionsDuNoyau } from './fabriquesDuNoyau';
import { brancherLeJeu, debrancherLeJeu } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { poserLaPlateforme, retirerLaPlateforme, type Jeton } from './plateforme';
import { transitionDuJeu } from './transitionDuJeu';
import { planifierLeTickAuto } from './combatAuto';
import { seedBattleRng } from './battleRng';
import { loadRuleOverrides } from '../engine/policy';
import { setCadence } from '../engine/cadence';
import { setDesFixes } from '../engine/fixedDie';
import { remettreLesSequencesAZero } from '../engine/sequences';

/** Un écrit de zustand : un objet, ou une fonction de l'état, fusionné au premier niveau. */
export type Ecrit = Partial<Jeu> | ((s: Jeu) => Partial<Jeu>);

export interface ProprietaireDuJeu {
  get: Get;
  /** Le `set` brut : il écrit aussi les clés réservées, pour leurs seuls écrivains. */
  set: SetDesClesReservees;
  actions: ActionsDuNoyau;
  /** Abonne `fn`, appelée après chaque écriture (avant sa transition) avec l'état et le précédent ; rend le désabonnement. */
  abonner: (fn: (etat: Jeu, prev: Jeu) => void) => () => void;
  /** Rejoue le jeton en attente `jeton`, une fois ; faux s'il n'est pas en attente. */
  reprendre: (jeton: Jeton) => boolean;
  /** Abandonne tous les jetons en attente, sans les rejouer. */
  abandonner: () => void;
  fermer: () => void;
}

/** Ouvre le propriétaire sur `etatInitial` et les entrées `entrees` ; chaque jeton programmé est signalé à
 *  `surProgramme`. */
export function ouvrirLeProprietaire(
  etatInitial: EtatDeJeu,
  entrees: EntreesDeLaPartie,
  surProgramme: (jeton: Jeton, delai: number) => void,
): ProprietaireDuJeu {
  const enVol = new Map<Jeton, () => void>();
  const abonnes = new Set<(etat: Jeu, prev: Jeu) => void>();
  const get: Get = () => etat;
  const ecrire = (partiel: Ecrit): void => {
    const prev = etat;
    const patch = typeof partiel === 'function' ? partiel(prev) : partiel;
    if (Object.is(patch, prev)) return;
    etat = { ...prev, ...patch };
    for (const fn of abonnes) fn(etat, prev);
    const transition = transitionDuJeu(prev, etat);
    if (transition) ecrire(transition);
    planifierLeTickAuto(get, set);
  };
  const set = ecrire as SetDesClesReservees;
  const actions = creerActionsDuNoyau(get, set);
  let etat: Jeu = { ...etatInitial, ...actions };

  brancherLeJeu(get, set, tablesDuJeu());
  remettreLesSequencesAZero();
  seedBattleRng(entrees.graine);
  loadRuleOverrides(entrees.reglesMaison);
  setCadence(entrees.cadence);
  setDesFixes(entrees.desFixes);
  poserLaPlateforme({
    programmer: (suite, delai) => {
      const jeton = Object.freeze({}) as Jeton;
      enVol.set(jeton, suite);
      surProgramme(jeton, delai);
      return jeton;
    },
    enAttente: (jeton) => enVol.has(jeton),
    persisterLeHeros: entrees.persisterLeHeros,
  });

  return {
    get,
    set,
    actions,
    abonner: (fn) => {
      abonnes.add(fn);
      return () => { abonnes.delete(fn); };
    },
    reprendre: (jeton) => {
      const suite = enVol.get(jeton);
      if (!suite) return false;
      enVol.delete(jeton);
      suite();
      return true;
    },
    abandonner: () => enVol.clear(),
    fermer: () => {
      retirerLaPlateforme();
      debrancherLeJeu();
      enVol.clear();
      abonnes.clear();
    },
  };
}
