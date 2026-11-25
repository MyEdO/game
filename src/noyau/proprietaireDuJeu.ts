/**
 * LE PROPRIÉTAIRE DE L'ÉTAT DU JEU hors du web (#2817 D7, D8, #3058) : l'état et les actions du noyau
 * (`creerActionsDuNoyau`), l'écriture de zustand suivie de la transition du jeu (`transitionDuJeu`) et du tick
 * automatique (`planifierLeTickAuto`), l'abonnement, le branchement (`brancherLeJeu`), les entrées de D8 et une
 * plateforme dont l'appel différé rend un jeton, signalé à `surProgramme` et rejoué par `reprendre`. La partie
 * (`partie.ts`) et le banc de test (`banc.testkit.ts`) le composent. Plusieurs peuvent être ouverts dans un contexte
 * JS, un seul branché (`branchement.ts`, #4862) : l'ouverture et `brancher` suspendent celui qui l'est, qui garde ses
 * singletons de module (RNG de combat, cadence, dés fixés, règles maison, registre des scènes, plateforme, écoutes) et
 * les repose à son propre `brancher`.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { JeuDuNoyau, MachinerieDuNoyau } from './machinerieDuNoyau';
import type { EtatDeJeu, Jeu } from './etat';
import type { Get, SetDesClesReservees } from './flowTypes';
import type { EntreesDeLaPartie } from './partie';
import { creerActionsDuNoyau } from './fabriquesDuNoyau';
import { brancherLeJeu, debrancherLeJeu, jeuBranche, suspendreLeJeuBranche, type Branchement } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { poserLaPlateforme, retirerLaPlateforme, type Jeton, type Plateforme } from './plateforme';
import { transitionDuJeu } from './transitionDuJeu';
import { stabiliserLesPlaiesDuPatient } from './acteDeSoin';
import { patchAvecIdsNeufs } from './idsDuMonde';
import { planifierLeTickAuto } from './combatAuto';
import { battleRng, poserBattleRng, seedBattleRng } from './battleRng';
import { loadRuleOverrides, ruleOverrides } from '../engine/policy';
import { cadence, setCadence, type Cadence } from '../engine/cadence';
import { desFixes, setDesFixes } from '../engine/fixedDie';
import type { RNG } from '../engine/dice';
import { patchDeLEquipement } from './monde/carrier';
import { poserLeRegistre, reposerPaquetDeCampagne, retirerLeRegistre } from './monde/registreDesScenes';
import type { Scene } from './monde/scene';

/** Un écrit de zustand : un objet, ou une fonction de l'état, fusionné au premier niveau. */
export type Ecrit = Partial<JeuDuNoyau> | ((s: JeuDuNoyau) => Partial<JeuDuNoyau>);

export interface ProprietaireDuJeu {
  get: Get;
  /** Le `set` brut : il écrit aussi les clés réservées, pour leurs seuls écrivains. */
  set: SetDesClesReservees;
  actions: ActionsDuNoyau & MachinerieDuNoyau;
  /** Abonne `fn`, appelée après chaque écriture (avant sa transition) avec l'état et le précédent ; rend le désabonnement. */
  abonner: (fn: (etat: Jeu, prev: Jeu) => void) => () => void;
  /** Rejoue le jeton en attente `jeton`, une fois ; faux s'il n'est pas en attente. */
  reprendre: (jeton: Jeton) => boolean;
  /** Abandonne tous les jetons en attente, sans les rejouer. */
  abandonner: () => void;
  /** Branche ce propriétaire, s'il ne l'est pas : suspend le branché, puis repose ce que celui-ci avait gardé. */
  brancher: () => void;
  /** Pose les écoutes que `poser` ouvre tant que ce propriétaire est branché ; `poser` rend leur coupure. */
  ecouterBranche: (poser: () => () => void) => void;
  fermer: () => void;
}

/** Ce qu'un propriétaire suspendu garde des singletons de module qu'il pose hors du branchement. */
interface Garde {
  rng: RNG;
  cadence: Cadence;
  desFixes: boolean;
  regles: Readonly<Record<string, unknown>>;
  scenes: Record<string, Scene>;
}

/** Ouvre le propriétaire sur `etatInitial` et les entrées `entrees` ; chaque jeton programmé est signalé à
 *  `surProgramme`. */
export function ouvrirLeProprietaire(
  etatInitial: EtatDeJeu,
  entrees: EntreesDeLaPartie,
  surProgramme: (jeton: Jeton, delai: number, apresDeplacement?: readonly string[]) => void,
): ProprietaireDuJeu {
  suspendreLeJeuBranche();
  const enVol = new Map<Jeton, () => void>();
  const abonnes = new Set<(etat: Jeu, prev: Jeu) => void>();
  const get: Get = () => etat;
  const preparerLaPublication = (s: JeuDuNoyau): JeuDuNoyau => {
    if (!s.medic || s.net.mode === 'invite') return s;
    return { ...s, ...patchAvecIdsNeufs(s, (idNeuf) => stabiliserLesPlaiesDuPatient(s, idNeuf)) };
  };
  const ecrire = (partiel: Ecrit): void => {
    const patch = typeof partiel === 'function' ? partiel(etat) : partiel;
    // Le patch de l'updater se fusionne sur l'état courant, lu après lui (zustand).
    const prev = etat;
    if (Object.is(patch, prev)) return;
    etat = preparerLaPublication({ ...prev, ...patch });
    for (const fn of abonnes) fn(etat, prev);
    const transition = transitionDuJeu(prev, etat);
    if (transition) ecrire(transition);
    planifierLeTickAuto(get, set);
  };
  const set = ecrire as SetDesClesReservees;
  const actions = creerActionsDuNoyau(get, set);
  loadRuleOverrides(entrees.reglesMaison);
  let etat = preparerLaPublication({ ...etatInitial, ...patchDeLEquipement(etatInitial), ...actions });

  const plateforme: Plateforme = {
    programmer: (suite, delai, apresDeplacement) => {
      const jeton = Object.freeze({}) as Jeton;
      enVol.set(jeton, suite);
      surProgramme(jeton, delai, apresDeplacement);
      return jeton;
    },
    enAttente: (jeton) => enVol.has(jeton),
    persisterLeHeros: entrees.persisterLeHeros,
  };
  /** Les écoutes posées tant que le propriétaire est branché, et leurs coupures quand elles le sont. */
  const ecoutes: (() => () => void)[] = [];
  let coupures: (() => void)[] = [];
  const couper = (): void => {
    for (const c of coupures) c();
    coupures = [];
  };
  /** Ce que le propriétaire a gardé à sa suspension ; `null` tant qu'il est branché. */
  let garde: Garde | null = null;
  const branchement: Branchement = {
    get,
    set,
    suspendre: () => {
      garde = { rng: battleRng(), cadence: cadence(), desFixes: desFixes(), regles: ruleOverrides(), scenes: retirerLeRegistre() };
      retirerLaPlateforme();
      couper();
    },
  };
  const poser = (): void => {
    poserLaPlateforme(plateforme);
    coupures = ecoutes.map((e) => e());
    brancherLeJeu(branchement, tablesDuJeu());
  };
  seedBattleRng(entrees.graine);
  setCadence(entrees.cadence);
  setDesFixes(entrees.desFixes);
  poser();
  reposerPaquetDeCampagne(etatInitial.campaignDoc);

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
    brancher: () => {
      if (jeuBranche() === branchement) return;
      if (!garde) throw new Error('[noyau] propriétaire débranché sans suspension : il ne se rebranche pas');
      const g = garde;
      suspendreLeJeuBranche();
      garde = null;
      loadRuleOverrides(g.regles);
      poserBattleRng(g.rng);
      setCadence(g.cadence);
      setDesFixes(g.desFixes);
      poserLeRegistre(g.scenes);
      poser();
    },
    ecouterBranche: (poserLEcoute) => {
      ecoutes.push(poserLEcoute);
      if (jeuBranche() === branchement) coupures.push(poserLEcoute());
    },
    fermer: () => {
      if (jeuBranche() === branchement) {
        retirerLaPlateforme();
        debrancherLeJeu();
        couper();
      }
      garde = null;
      ecoutes.length = 0;
      enVol.clear();
      abonnes.clear();
    },
  };
}
