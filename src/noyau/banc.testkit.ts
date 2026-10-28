/**
 * LE BANC DU NOYAU (#3058) : un test de règle pilote le noyau sans le store web, sur le propriétaire du jeu que compose
 * aussi la partie (`ouvrirLeProprietaire`, `proprietaireDuJeu.ts`). Le banc n'ajoute que ce que lit un test : l'état,
 * l'écriture et l'abonnement de zustand, les actions du noyau, et l'horloge virtuelle du noyau (`horlogeVirtuelle`)
 * par les trois gestes des minuteurs factices de Vitest et leur abandon, sans `setTimeout`. Il ne se joue que dans la suite du noyau (`*.hors-store.test.ts`).
 *
 * Sa fermeture s'enregistre par `onTestFinished` à son OUVERTURE : les `onTestFinished` jouent en ordre inverse, et la
 * restauration d'`avecLesTables` (`noyau.testkit.ts`), posée après, joue avant elle (`branchement.ts`).
 *
 * Écart au store : le propriétaire planifie le tick automatique à chaque écriture (`planifierLeTickAuto`), le store
 * seulement après `initCombatAuto` (`src/state/store.ts`).
 */
import { onTestFinished } from 'vitest';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import { CADENCE_DEFAULT } from '../engine/cadence';
import { DES_FIXES_DEFAULT } from '../engine/fixedDie';
import { etatInitialDuJeu, type EtatDeJeu, type Jeu } from './etat';
import { horlogeVirtuelle } from './horlogeVirtuelle';
import { ouvrirLeProprietaire, type Ecrit, type ProprietaireDuJeu } from './proprietaireDuJeu';
import type { EntreesDeLaPartie } from './partie';
import type { Jeton } from './plateforme';

/** Les entrées d'un banc : l'état de départ fusionné à `etatInitialDuJeu()`, et les entrées de D8 (`EntreesDeLaPartie`),
 *  par défaut la graine 1, aucune règle maison, la cadence et les dés fixés par défaut, le héros persisté nulle part. */
export type EntreesDuBanc = Partial<EntreesDeLaPartie> & { etat?: Partial<EtatDeJeu> };

export interface Banc {
  getState: () => Jeu;
  setState: (ecrit: Ecrit) => void;
  subscribe: (fn: (etat: Jeu, prev: Jeu) => void) => () => void;
  actions: ActionsDuNoyau;
  /** Reprend chaque jeton d'échéance au plus `ms` plus tard, ceux que les reprises programment dans la fenêtre compris
   *  (`vi.advanceTimersByTime`) ; rend le nombre de reprises. */
  avancer: (ms: number) => number;
  /** Avance jusqu'à l'échéance du dernier jeton en attente à l'appel, ceux programmés dans la fenêtre compris
   *  (`vi.runOnlyPendingTimers`). */
  reprendreLesEnAttente: () => number;
  /** Reprend toute la prochaine échéance, ex æquo compris (`vi.advanceTimersToNextTimer`). */
  jusquALaProchaine: () => number;
  /** Abandonne tous les jetons en attente, sans les reprendre (≈ `vi.clearAllTimers`). */
  abandonner: () => void;
  /** Le nombre de jetons en attente. */
  enAttente: () => number;
}

/** Ouvre un banc pour le test COURANT (dans le test ou son `beforeEach`), fermé à sa fin. */
export function ouvrirLeBanc({ etat, ...entrees }: EntreesDuBanc = {}): Banc {
  let suivant = 0;
  const jetons = new Map<number, Jeton>();
  const horloge = horlogeVirtuelle((id) => {
    const jeton = jetons.get(id)!;
    jetons.delete(id);
    proprietaire.reprendre(jeton);
    return [];
  });
  let ouvert: ProprietaireDuJeu | null = null;
  // Enregistrée AVANT la pose : hors d'un test, `onTestFinished` lève et rien n'est posé.
  onTestFinished(() => ouvert?.fermer());
  const proprietaire = ouvrirLeProprietaire({ ...etatInitialDuJeu(), ...etat }, {
    graine: 1,
    reglesMaison: {},
    cadence: CADENCE_DEFAULT,
    desFixes: DES_FIXES_DEFAULT,
    persisterLeHeros: () => {},
    ...entrees,
  }, (jeton, delai) => {
    const id = suivant++;
    jetons.set(id, jeton);
    horloge.armer([{ id, delai }]);
  });
  ouvert = proprietaire;
  return {
    getState: proprietaire.get,
    setState: proprietaire.set,
    subscribe: proprietaire.abonner,
    actions: proprietaire.actions,
    avancer: horloge.avancer,
    reprendreLesEnAttente: horloge.reprendreLesEnAttente,
    jusquALaProchaine: horloge.jusquALaProchaine,
    abandonner: () => {
      proprietaire.abandonner();
      horloge.abandonner();
      jetons.clear();
    },
    enAttente: horloge.enAttente,
  };
}
