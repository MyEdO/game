/**
 * LA PARTIE (#2817 D9) — le propriétaire de l'état d'un hôte qui n'est pas le web, au même titre que le
 * store (`src/state/store.ts`) : l'état et les actions du noyau (`creerActionsDuNoyau`), le branchement
 * (`brancherLeJeu`), une plateforme dont l'appel différé rend un jeton que l'hôte rejoue par `reprendre`,
 * et les entrées de D8. Chaque appel rend son issue, les événements du bus émis pendant lui, les appels
 * différés qu'il a programmés, et les lignes de journal qu'il a écrites. Un seul propriétaire par contexte JS (`branchement.ts`) : une partie ne cohabite ni
 * avec le store ni avec une autre partie ouverte.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import type { CombatEvent } from './combatLog';
import type { EtatDeJeu, Jeu } from './etat';
import type { Get, SetDesClesReservees } from './flowTypes';
import { creerActionsDuNoyau } from './fabriquesDuNoyau';
import { brancherLeJeu, debrancherLeJeu } from './branchement';
import { tablesDuJeu } from './tablesDuJeu';
import { poserLaPlateforme, retirerLaPlateforme, type Jeton } from './plateforme';
import { transitionDuJeu } from './transitionDuJeu';
import { planifierLeTickAuto } from './combatAuto';
import { appliquerLIntentionDUnSiege, type IssueDIntention } from './intentionsDeSiege';
import { lancerLeScenario, type LancementDeScenario } from './lancementDeScenario';
import { bus, EVT } from './bus';
import { seedBattleRng } from './battleRng';
import { loadRuleOverrides } from '../engine/policy';
import { setCadence, type Cadence } from '../engine/cadence';
import { setDesFixes } from '../engine/fixedDie';
import { remettreLesSequencesAZero } from '../engine/sequences';

/** Une intention : l'appel d'une action du noyau, au nom du siège `siege` s'il est posé. */
export type Intention = {
  [K in keyof ActionsDuNoyau]: { type: K; args: Parameters<ActionsDuNoyau[K]>; siege?: number };
}[keyof ActionsDuNoyau];

/** Un nom d'événement du bus (`EVT`), hors la ligne de journal, que l'appel rend dans `journal`. */
export type NomDEvenement = Exclude<(typeof EVT)[keyof typeof EVT], typeof EVT.LIGNE_AU_JOURNAL>;

/** Ce qu'un appel de la partie rend : un événement émis sur le bus, ou un appel différé programmé, que
 *  l'hôte rejoue par `reprendre(jeton)` après `delai` millisecondes. */
export type Evenement =
  | { type: 'emis'; evt: NomDEvenement; payload: unknown }
  | { type: 'programme'; jeton: Jeton; delai: number };

/** Les entrées que l'hôte fournit (D8) : la graine des dés, les règles maison, la cadence, les dés fixés,
 *  et la persistance d'un héros. */
export interface EntreesDeLaPartie {
  graine: number;
  reglesMaison: Readonly<Record<string, unknown>>;
  cadence: Cadence;
  desFixes: boolean;
  persisterLeHeros: (heros: Combatant) => void;
}

/** Une ligne écrite pendant un appel : au journal de la partie (`journal`), ou au journal du combat
 *  (`battle.log`). */
export type LigneDuJournal =
  | { de: 'journal'; texte: string }
  | { de: 'combat'; evenement: CombatEvent };

/** L'issue d'un appel : celle d'une intention de siège (`appliquerLIntentionDUnSiege`), `'appliquee'`
 *  sinon ; `'jeton-inconnu'` pour un `reprendre` dont le jeton n'est pas en attente. */
export type IssueDeLAppel = IssueDIntention | 'jeton-inconnu';

export interface ResultatDeLAppel {
  issue: IssueDeLAppel;
  evenements: Evenement[];
  journal: LigneDuJournal[];
}

export interface Partie {
  etat: Get;
  envoyer: (intention: Intention) => ResultatDeLAppel;
  /** Lance un scénario construit par l'hôte (`lancerLeScenario`), comme tout appel : ce que le lancement émet
   *  et écrit revient dans SON résultat. */
  lancer: (lancement: LancementDeScenario) => ResultatDeLAppel;
  reprendre: (jeton: Jeton) => ResultatDeLAppel;
  fermer: () => void;
}

/** Les entrées de `courant` ajoutées depuis `vu` : le plus long suffixe de `vu` qui ouvre `courant`, comparé
 *  par identité d'objet (un journal tronqué par sa tête s'aligne encore). */
function ajoutees<T>(vu: readonly T[], courant: readonly T[]): T[] {
  for (let k = 0; k <= vu.length; k++) {
    const garde = vu.length - k;
    if (garde > courant.length) continue;
    let aligne = true;
    for (let i = 0; i < garde && aligne; i++) aligne = courant[i] === vu[k + i];
    if (aligne) return courant.slice(garde);
  }
  return [...courant];
}

/** Ouvre une partie sur `etatInitial` (`etatInitialDuJeu()`, ou l'état qu'un hôte a gardé). */
export function creerPartie(etatInitial: EtatDeJeu, entrees: EntreesDeLaPartie): Partie {
  const tampon: Evenement[] = [];
  const lignes: LigneDuJournal[] = [];
  const enVol = new Map<Jeton, () => void>();
  let ouverte = true;

  const get: Get = () => etat;
  // Le journal de la partie se capte à ses écrivains (`EVT.LIGNE_AU_JOURNAL`) ; celui du combat, dont chaque
  // entrée est un objet neuf et qui se pousse aussi en place (`battle.log.push`), par comparaison à une copie.
  let vuAuCombat = [...(etatInitial.battle?.log ?? [])];
  const capter = (): void => {
    const combat = etat.battle?.log ?? [];
    for (const evenement of ajoutees(vuAuCombat, combat)) lignes.push({ de: 'combat', evenement });
    vuAuCombat = [...combat];
  };
  // Le `set` de zustand (objet ou fonction, fusion de premier niveau), puis ce que le propriétaire déclenche
  // après chaque écriture (D7).
  const ecrire = (partiel: Partial<Jeu> | ((s: Jeu) => Partial<Jeu>)): void => {
    const prev = etat;
    const patch = typeof partiel === 'function' ? partiel(prev) : partiel;
    if (Object.is(patch, prev)) return;
    etat = { ...prev, ...patch };
    capter();
    const transition = transitionDuJeu(prev, etat);
    if (transition) ecrire(transition);
    planifierLeTickAuto(get, set);
  };
  // Le `set` brut du propriétaire : il écrit aussi les clés réservées, pour leurs seuls écrivains.
  const set = ecrire as SetDesClesReservees;
  let etat: Jeu = { ...etatInitial, ...creerActionsDuNoyau(get, set) };

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
      tampon.push({ type: 'programme', jeton, delai });
      return jeton;
    },
    enAttente: (jeton) => enVol.has(jeton),
    persisterLeHeros: entrees.persisterLeHeros,
  });
  const desabonnements = [
    bus.on(EVT.LIGNE_AU_JOURNAL, ({ texte }: { texte: string }) => lignes.push({ de: 'journal', texte })),
    ...Object.values(EVT).flatMap((evt) => (evt === EVT.LIGNE_AU_JOURNAL ? [] : [bus.on(evt, (payload: unknown) => tampon.push({ type: 'emis', evt, payload }))])),
  ];

  const ouvertePour = (geste: string): void => {
    if (!ouverte) throw new Error(`[noyau] partie fermée : \`${geste}\` après \`fermer\``);
  };
  /** Un appel qui lève ne laisse ni événement ni ligne au suivant. */
  const appeler = (geste: string, jouer: () => IssueDeLAppel): ResultatDeLAppel => {
    ouvertePour(geste);
    try {
      const issue = jouer();
      capter();
      return { issue, evenements: tampon.splice(0), journal: lignes.splice(0) };
    } catch (erreur) {
      capter();
      tampon.length = 0;
      lignes.length = 0;
      throw erreur;
    }
  };

  return {
    etat: get,
    envoyer: (intention) => appeler('envoyer', () => {
      if (intention.siege !== undefined) return appliquerLIntentionDUnSiege(get, intention.siege, intention.type, intention.args);
      (etat[intention.type] as (...args: readonly unknown[]) => unknown)(...intention.args);
      return 'appliquee';
    }),
    lancer: (lancement) => appeler('lancer', () => {
      lancerLeScenario(get, set, lancement);
      return 'appliquee';
    }),
    reprendre: (jeton) => appeler('reprendre', () => {
      const suite = enVol.get(jeton);
      if (!suite) return 'jeton-inconnu';
      enVol.delete(jeton);
      suite();
      return 'appliquee';
    }),
    fermer: () => {
      ouvertePour('fermer');
      ouverte = false;
      for (const desabonner of desabonnements) desabonner();
      retirerLaPlateforme();
      debrancherLeJeu();
      enVol.clear();
      tampon.length = 0;
      lignes.length = 0;
    },
  };
}
