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
import { ouvrirLeProprietaire, type ProprietaireDuJeu } from './proprietaireDuJeu';
import { appliquerLInstantane, type InstantaneApplique } from './coop';
import { appliquerLIntentionDUnSiege, refusDuVerbeDHote, type IssueDIntention } from './intentionsDeSiege';
import { refuserGeste } from './refusVisible';
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
   *  l'état (`get()[type]`), celle qu'un invité a enrobée pour la demander à l'hôte (`transmettreLesIntentions`).
   *  Chez un invité, un verbe de classe `hôte` ne se joue pas : il se refuse (`refusDuVerbeDHote`, `refuserGeste`),
   *  l'issue reste `'appliquee'`. */
  envoyer: (intention: Intention) => ResultatDeLAppel;
  /** Lance un scénario construit par l'hôte (`lancerLeScenario`), comme tout appel : ce que le lancement émet
   *  et écrit revient dans SON résultat. */
  lancer: (lancement: LancementDeScenario) => ResultatDeLAppel;
  reprendre: (jeton: Jeton) => ResultatDeLAppel;
  /** L'abonnement du propriétaire (`ProprietaireDuJeu.abonner`) : `fn` après chaque écriture, appel ou réseau ;
   *  rend le désabonnement. `fn` ne rappelle pas la partie. */
  abonner: ProprietaireDuJeu['abonner'];
  /** L'appel vide : rend ce qui s'est produit hors de tout appel (événements du bus, lignes écrites). Aucun
   *  `etatGagne` n'en sort : il ne se compare qu'entre l'entrée et la sortie d'un appel. */
  relever: () => ResultatDeLAppel;
  /** Pose l'instantané de l'hôte (`appliquerLInstantane`) ; ses lignes se comptent contre le dernier instantané reçu,
   *  jamais contre l'état local : au journal, l'écart de `lignesAuJournal` (borné à la fenêtre reçue) ; au journal de
   *  combat, la queue au-delà du dernier reçu si `combatsOuverts` n'a pas changé, le journal entier d'un autre combat.
   *  Le premier instantané, ou un `lignesAuJournal` qui recule (une autre partie), devient la référence sans ligne
   *  ni `etatGagne`. `neuve` et `autreScene` (`InstantaneApplique`) servent l'écran de l'hôte. */
  recevoir: (instantane: Record<string, unknown>) => ResultatDeLAppel & { neuve: boolean; autreScene: boolean };
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
  /** Les comptes du dernier instantané reçu (`recevoir`). */
  let dernierRecu: { lignesAuJournal: number; combatsOuverts: number; longueurDuCombat: number } | null = null;
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
  /** Les États portés à l'entrée de l'appel en cours, ou à la référence qu'un premier instantané reçu pose. */
  let avant = new Map<string, Set<string>>();
  /** Chaque État qu'un combattant porte et ne portait pas `avant`. */
  const etatsGagnes = (): Evenement[] =>
    [...etatsPortes()].flatMap(([porteur, etats]) => [...etats].filter((etat) => !avant.get(porteur)?.has(etat)).map((etat): Evenement => ({ type: 'etatGagne', porteur, etat })));
  /** Un appel qui lève ne retire que les événements et les lignes venus après son entrée. */
  const appeler = (geste: string, jouer: () => IssueDeLAppel): ResultatDeLAppel => {
    ouvertePour(geste);
    avant = etatsPortes();
    const [emisAvant, ecritesAvant] = [tampon.length, lignes.length];
    try {
      const issue = jouer();
      capter();
      return { issue, evenements: [...tampon.splice(0), ...etatsGagnes()], journal: lignes.splice(0) };
    } catch (erreur) {
      capter();
      tampon.splice(emisAvant);
      lignes.splice(ecritesAvant);
      throw erreur;
    }
  };
  /** Pose l'instantané `instantane`, puis écrit aux lignes de l'appel ce qu'il apporte depuis `dernierRecu`. */
  const poserLInstantane = (instantane: Record<string, unknown>): Omit<InstantaneApplique, 'etat'> => {
    const { etat, neuve, autreScene } = appliquerLInstantane(instantane, get());
    const combat = etat.battle?.log ?? [];
    const precedent = dernierRecu;
    vuAuCombat = [...combat];
    set(etat);
    dernierRecu = { lignesAuJournal: etat.lignesAuJournal, combatsOuverts: etat.combatsOuverts, longueurDuCombat: combat.length };
    if (!precedent || etat.lignesAuJournal < precedent.lignesAuJournal) {
      avant = etatsPortes();
      return { neuve, autreScene };
    }
    const ecart = Math.min(etat.lignesAuJournal - precedent.lignesAuJournal, etat.journal.length);
    for (const texte of etat.journal.slice(etat.journal.length - ecart)) lignes.push({ de: 'journal', texte, heure: etat.gameTime });
    const depuis = etat.combatsOuverts === precedent.combatsOuverts ? precedent.longueurDuCombat : 0;
    for (const evenement of combat.slice(depuis)) lignes.push({ de: 'combat', evenement, heure: etat.gameTime });
    return { neuve, autreScene };
  };

  return {
    etat: get,
    envoyer: (intention) => appeler('envoyer', () => {
      if (LANCERS_DU_JOUEUR.has(verbeDeJetDe(intention.type))) bus.emit(EVT.DICE_ROLL);
      if (intention.siege !== undefined) return appliquerLIntentionDUnSiege(get, intention.siege, intention.type, intention.args);
      const refus = refusDuVerbeDHote(get(), intention.type);
      if (refus) {
        refuserGeste(get, set, refus);
        return 'appliquee';
      }
      (get()[intention.type] as (...args: readonly unknown[]) => unknown)(...intention.args);
      return 'appliquee';
    }),
    lancer: (lancement) => appeler('lancer', () => {
      lancerLeScenario(get, set, lancement);
      return 'appliquee';
    }),
    reprendre: (jeton) => appeler('reprendre', () => (proprietaire.reprendre(jeton) ? 'appliquee' : 'jeton-inconnu')),
    abonner: proprietaire.abonner,
    relever: () => appeler('relever', () => 'appliquee'),
    recevoir: (instantane) => {
      let drapeaux = { neuve: false, autreScene: false };
      const resultat = appeler('recevoir', () => {
        drapeaux = poserLInstantane(instantane);
        return 'appliquee';
      });
      return { ...resultat, ...drapeaux };
    },
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
