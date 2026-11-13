/**
 * LA PARTIE (#2817 D9) — l'état d'un hôte qui n'est pas le web, au même titre que le store,
 * tenu par le propriétaire du jeu (`proprietaireDuJeu.ts`) : l'état et les actions du
 * noyau, le branchement, une plateforme dont l'appel différé rend un jeton que l'hôte rejoue par `reprendre`,
 * et les entrées de D8. Chaque appel rend son issue, les événements du bus émis pendant lui, les appels
 * différés qu'il a programmés, et les lignes de journal qu'il a écrites. Un seul propriétaire par contexte JS (`branchement.ts`) : une partie ne cohabite ni
 * avec le store ni avec une autre partie ouverte.
 */
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Combatant } from '../engine/types';
import type { CombatEvent } from './combatLog';
import type { EtatDeJeu } from './etat';
import type { Get } from './flowTypes';
import type { Jeton } from './plateforme';
import { ouvrirLeProprietaire } from './proprietaireDuJeu';
import { appliquerLIntentionDUnSiege, type IssueDIntention } from './intentionsDeSiege';
import { lancerLeScenario, type LancementDeScenario } from './lancementDeScenario';
import { bus, EVT, type ChargesDuBus } from './bus';
import { verbeDeJetDe, type RollVerb } from './flowVerbs';
import type { Cadence } from '../engine/cadence';

/** Une intention : l'appel d'une action du noyau, au nom du siège `siege` s'il est posé. */
export type Intention = {
  [K in keyof ActionsDuNoyau]: { type: K; args: Parameters<ActionsDuNoyau[K]>; siege?: number };
}[keyof ActionsDuNoyau];

/** Un nom d'événement du bus (`EVT`), hors la ligne de journal, que l'appel rend dans `journal`. */
export type NomDEvenement = Exclude<(typeof EVT)[keyof typeof EVT], typeof EVT.LIGNE_AU_JOURNAL>;

/** Ce qu'un appel de la partie rend : un événement émis sur le bus, un appel différé programmé, que
 *  l'hôte rejoue par `reprendre(jeton)` après `delai` millisecondes, ou un État qu'un combattant porte au sortir de
 *  l'appel et ne portait pas avant (#3834). */
export type Evenement =
  | { [E in NomDEvenement]: { type: 'emis'; evt: E; payload: ChargesDuBus[E] } }[NomDEvenement]
  | { type: 'programme'; jeton: Jeton; delai: number }
  | { type: 'etatGagne'; porteur: string; etat: string };

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
 *  (`battle.log`) ; `heure` : le temps de jeu (`gameTime`) où elle s'écrit. */
export type LigneDuJournal =
  | { de: 'journal'; texte: string; heure: number }
  | { de: 'combat'; evenement: CombatEvent; heure: number };

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
  /** Joue l'intention : au nom de son `siege` s'il est posé (`appliquerLIntentionDUnSiege`), sinon par l'action de
   *  l'état (`get()[type]`), celle qu'un invité a enrobée pour la demander à l'hôte (`transmettreLesIntentions`). */
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

/** Les verbes de jet qui lancent les dés : un hôte qui les envoie joue leur son (`EVT.DICE_ROLL`). */
const LANCERS_DU_JOUEUR = new Set<RollVerb | null>(['lancer', 'relancer']);

/** Ouvre une partie sur `etatInitial` (`etatInitialDuJeu()`, ou l'état qu'un hôte a gardé), par son propriétaire
 *  (`ouvrirLeProprietaire`). */
export function creerPartie(etatInitial: EtatDeJeu, entrees: EntreesDeLaPartie): Partie {
  const tampon: Evenement[] = [];
  const lignes: LigneDuJournal[] = [];
  let ouverte = true;

  const proprietaire = ouvrirLeProprietaire(etatInitial, entrees, (jeton, delai) => tampon.push({ type: 'programme', jeton, delai }));
  const { get, set } = proprietaire;
  // Le journal de la partie se capte à ses écrivains (`EVT.LIGNE_AU_JOURNAL`) ; celui du combat, dont chaque
  // entrée est un objet neuf et qui se pousse aussi en place (`battle.log.push`), par comparaison à une copie,
  // après chaque écriture et chaque appel.
  let vuAuCombat = [...(etatInitial.battle?.log ?? [])];
  const capter = (): void => {
    const combat = get().battle?.log ?? [];
    for (const evenement of ajoutees(vuAuCombat, combat)) lignes.push({ de: 'combat', evenement, heure: get().gameTime });
    vuAuCombat = [...combat];
  };
  proprietaire.abonner(capter);
  const desabonnements = [
    bus.on(EVT.LIGNE_AU_JOURNAL, ({ texte }: { texte: string }) => lignes.push({ de: 'journal', texte, heure: get().gameTime })),
    ...Object.values(EVT).flatMap((evt) => (evt === EVT.LIGNE_AU_JOURNAL ? [] : [bus.on(evt, (payload) => tampon.push({ type: 'emis', evt, payload } as Evenement))])),
  ];

  const ouvertePour = (geste: string): void => {
    if (!ouverte) throw new Error(`[noyau] partie fermée : \`${geste}\` après \`fermer\``);
  };
  /** Les États que porte chaque combattant du combat et du groupe, par id. */
  const etatsPortes = (): Map<string, Set<string>> =>
    new Map([...(get().battle?.combatants ?? []), ...get().party].map((c) => [c.id, new Set(c.conditions.map((e) => e.id))]));
  /** Chaque État qu'un combattant porte et ne portait pas avant l'appel (`avant`). */
  const etatsGagnes = (avant: Map<string, Set<string>>): Evenement[] =>
    [...etatsPortes()].flatMap(([porteur, etats]) => [...etats].filter((etat) => !avant.get(porteur)?.has(etat)).map((etat): Evenement => ({ type: 'etatGagne', porteur, etat })));
  /** Un appel qui lève ne laisse ni événement ni ligne au suivant. */
  const appeler = (geste: string, jouer: () => IssueDeLAppel): ResultatDeLAppel => {
    ouvertePour(geste);
    const avant = etatsPortes();
    try {
      const issue = jouer();
      capter();
      return { issue, evenements: [...tampon.splice(0), ...etatsGagnes(avant)], journal: lignes.splice(0) };
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
      if (LANCERS_DU_JOUEUR.has(verbeDeJetDe(intention.type))) bus.emit(EVT.DICE_ROLL);
      if (intention.siege !== undefined) return appliquerLIntentionDUnSiege(get, intention.siege, intention.type, intention.args);
      (get()[intention.type] as (...args: readonly unknown[]) => unknown)(...intention.args);
      return 'appliquee';
    }),
    lancer: (lancement) => appeler('lancer', () => {
      lancerLeScenario(get, set, lancement);
      return 'appliquee';
    }),
    reprendre: (jeton) => appeler('reprendre', () => (proprietaire.reprendre(jeton) ? 'appliquee' : 'jeton-inconnu')),
    fermer: () => {
      ouvertePour('fermer');
      ouverte = false;
      for (const desabonner of desabonnements) desabonner();
      proprietaire.fermer();
      tampon.length = 0;
      lignes.length = 0;
    },
  };
}
