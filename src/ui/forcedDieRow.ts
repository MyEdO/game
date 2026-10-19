/**
 * COUTURE UNIQUE du sélecteur de dé d'une rangée de jet — dérivée, jamais recopiée par modale.
 *
 * `RollShell` porte déjà l'identité du flux (`flowKey`, = le PRÉFIXE des délégués de store, cf.
 * `FLOW_VERBS`) et chaque rangée porte son acteur (`row.actor`) et, en multi, l'id de son slot
 * (`row.key`). Cela suffit à dériver le sélecteur pour TOUTE modale de jet : plus aucune modale ne
 * calcule son `forcedDie` (les six qui le faisaient — attaque/défense/incantation/cascade/coup dans
 * le dos/piétinement — ne le font plus), et une modale qui n'en avait jamais l'offre désormais.
 *
 * DEUX provenances, un seul contrôle (`ForcedRollPicker`) :
 *  - **Résilience** — LDB 17 l.68 : « au lieu de lancer les dés pour un Test, vous choisissez le
 *    résultat ». Le slot est `forced` (le point est déjà dépensé par `forceSuccess`) ; le dé choisi
 *    doit rester une réussite (`maxForcedRoll`). INCONDITIONNEL : offert sur tout flux à Résilience,
 *    y compris un Test binaire (le dé y change le DR affiché, jamais l'issue).
 *  - **Dé fixé** — option de confort `des-fixes` (`engine/fixedDie.ts`), gatée par le prédicat
 *    UNIQUE `canFixDie` (option + contrôle du siège). Tout le dé, avant comme après le jet.
 *
 * DEUX PORTEURS de dé, même contrôle : un SLOT DE FLUX (`rowForcedDie`, ci-dessous) et une ÉTAPE de
 * cascade (`stepForcedDie` — pas de flux de jet : le dé vit sur l'étape, en `step.de` ou en
 * `step.table` selon sa LECTURE). Les deux dérivations vivent ICI ; une modale n'en compose JAMAIS
 * une à la main.
 *
 * L'écriture passe TOUJOURS par le délégué de store `<prefix>SetForcedRoll` (jamais
 * `FLOW_HANDLERS[k].setForcedRoll(get,set,…)` en direct) : c'est lui que le routage d'intents coop
 * intercepte côté invité.
 */
import { useRef } from 'react';
import { FLOW_HANDLERS, FLOW_VERBS } from '../state/rollFlowSpecs';
import type { FlowKey } from '../state/flowVerbs';
import { canFixDie } from '../state/netOwnership';
import { withPreRollFixedDie } from '../state/combatFlow';
import { useGame } from '../state/store';
import { FIXED_ROLL_MAX } from '../engine/fixedDie';
import { liveTableDecl, liveDeDecl, plageNaturelle, specDeEtape, tableSpec } from '../state/cascade';
import type { CascadeStep } from '../state/pendings';
import type { GameState } from '../state/store';
import type { RollRowProps } from './RollRow';

/**
 * COMMIT du dé SAISI — la GARDE partagée des hôtes qui lancent (#1117). « Fixer le dé » vit dans
 * `ForcedRollPicker` et son brouillon ne se commet qu'au geste terminal (Entrée). Or DEUX hôtes
 * rendent un CTA de lancement : le bouton de la RANGÉE (`RollRow`) et le bouton HISSÉ dans la barre
 * de la coquille (`RollShell`, cas mono — celui de TOUTE cascade). Un CTA qui lance sans consommer le
 * brouillon abandonne la saisie et roule un dé naturel : le joueur voit sa valeur à l'écran et un
 * autre dé résoudre (recette #1117, vécu au navigateur alors que le seul hôte-rangée était couvert).
 *
 * La garde vit donc ICI, avec le reste de la couture du dé fixé : un troisième hôte s'y branche, et
 * aucune copie ne doit exister ailleurs (doctrine « UN HÔTE, jamais dupliqué », #942).
 */
export type DieCommit = { current: null | (() => boolean) };

/** Poignée de commit à passer au picker (`commitRef`) et aux CTA de l'hôte. */
export function useDieCommit(): DieCommit {
  return useRef<null | (() => boolean)>(null);
}

/** Enveloppe un verbe qui (RE)LANCE : commet le brouillon d'abord ; s'il a POSÉ un dé, le verbe ne
 *  s'exécute pas (poser le dé (re)lance déjà côté flux) — un seul jet, jamais deux. */
export function withPickedDie(commit: DieCommit, run: () => void): () => void {
  return () => {
    if (commit.current?.()) return;
    run();
  };
}

/** REGISTRE des poignées, une par rangée — le TROISIÈME hôte (« Tout lancer » d'une fenêtre MULTI)
 *  lance N rangées d'un coup : il lui faut la poignée de CHACUNE, or elles sont locales à leur
 *  `RollRow`. La coquille tient le registre et le sert aux deux consommateurs (les rangées, et le
 *  verbe groupé) — jamais un état parallèle recopié côté modale. */
export interface DieCommitRegistry {
  /** Poignée STABLE de la rangée `key` (créée à la demande). */
  handle: (key: string) => DieCommit;
  /** Commet le brouillon de chaque rangée ; rend les `key` dont la saisie a POSÉ un dé (donc déjà
   *  lancées — l'appelant ne doit PAS les relancer). */
  commitAll: (keys: string[]) => Set<string>;
}

export function useDieCommitRegistry(): DieCommitRegistry {
  const map = useRef<Map<string, DieCommit>>(new Map());
  const handle = (key: string): DieCommit => {
    const known = map.current.get(key);
    if (known) return known;
    const fresh: DieCommit = { current: null };
    map.current.set(key, fresh);
    return fresh;
  };
  const commitAll = (keys: string[]): Set<string> => {
    const launched = new Set<string>();
    for (const k of keys) if (map.current.get(k)?.current?.()) launched.add(k);
    return launched;
  };
  return { handle, commitAll };
}

type SetForcedMono = (roll: number) => void;
type SetForcedMulti = (pid: string, roll: number) => void;

/**
 * Sélecteur de dé de CETTE rangée, ou `undefined`. `row.noForcedDie` = opt-out explicite du SITE
 * (cible Inconsciente : le moteur a déjà choisi le meilleur dé, seule la Localisation reste un choix).
 * `row.forcedRoll` déjà posé par un appelant reste prioritaire (aucune régression possible).
 */
export function rowForcedDie(
  s: GameState,
  flowKey: FlowKey | undefined,
  row: Pick<RollRowProps, 'actor' | 'rolled' | 'forcedRoll' | 'noForcedDie' | 'interactive'> & {
    key?: string | number;
    /** Id RÉEL du participant quand la `key` React est SCOPÉE par son site (cf. `RollRowData.pid`). */
    pid?: string;
    /** Déclencheur du jet de CETTE rangée. REQUIS et explicitement `null` quand la rangée n'est pas
     *  lançable (témoin, post-jet) : la saisie PRÉ-jet LANCE puis substitue, donc sans lui aucun dé
     *  pré-jet n'est offert. L'omettre est une erreur de compilation, jamais un champ mort. */
    onRoll: (() => void) | null;
  },
  rolled: boolean,
): { forcedRoll?: RollRowProps['forcedRoll']; fixedMark?: boolean } {
  if (row.forcedRoll) return { forcedRoll: row.forcedRoll };
  if (!flowKey || row.noForcedDie || row.interactive === false) return {};
  const flow = FLOW_HANDLERS[flowKey];
  const verbs = FLOW_VERBS[flowKey].verbs as readonly string[];
  if (!flow || !verbs.includes('setForcedRoll')) return {};
  // Un dé ne se SAISIT que là où le socle sait le RÉÉVALUER : `fixable` = l'ACCESSEUR DE DÉ du flux est
  // complet (lire où vit le dé, réécrire l'issue re-dérivée). Même gate côté fabrique (`setForcedRoll`).

  const multi = FLOW_VERBS[flowKey].kind === 'multi';
  // Le slot se résout sur le pid RÉEL : `row.pid` quand le site scope sa clé React, sinon la `key`.
  const pid = multi ? (row.pid ?? (row.key != null ? String(row.key) : undefined)) : undefined;
  const slot = flow.slotOf(() => s, pid);
  if (!slot) return {};

  const delegate = (s as unknown as Record<string, unknown>)[`${flowKey}SetForcedRoll`];
  if (typeof delegate !== 'function') return {};
  const onSet = multi
    ? (r: number) => (delegate as SetForcedMulti)(pid ?? '', r)
    : (r: number) => (delegate as SetForcedMono)(r);

  const isRolled = row.rolled ?? rolled;
  if (!flow.fixable || !flow.picker) return {};
  const pick = flow.picker(slot, row.actor, s);
  // La marque appartient au dé COURANT : une Résilience postérieure re-tire le dé, la mention s'efface.
  const mark = !!slot.fixed && !slot.forced;

  // Résilience en cours : le dé CHOISI prime (le point est dépensé, l'issue reste une réussite).
  if (slot.forced && pick) return { forcedRoll: { ...pick, onSet }, fixedMark: mark };
  if (!canFixDie(s, row.actor?.id)) return { fixedMark: mark };
  if (isRolled) return pick ? { forcedRoll: { roll: pick.roll, target: pick.target, ...(pick.max != null ? { max: pick.max } : {}), onSet, fixed: true }, fixedMark: mark } : { fixedMark: mark };
  // AVANT le jet : la saisie LANCE puis substitue — même geste que la Résilience pré-jet (`preRollForce`).
  // Sans déclencheur de jet, la rangée n'a rien à substituer : aucun champ n'est offert. Le couple
  // (jet naturel, substitution) est ATOMIQUE côté moteur (`withPreRollFixedDie`, #1029) : aucun
  // consommateur aval ne voit le résultat provisoire d'entre-deux.
  const doRoll = row.onRoll;
  if (!doRoll) return { fixedMark: mark };
  return {
    // `roll: null` — le champ est une OFFRE : rien n'est fixé tant que le joueur n'a pas saisi.
    // `commitOnBlur: false` — ICI le commit LANCE le jet : seule Entrée le pose, quitter le champ
    // (pour « Annuler », pour une autre commande) rend le brouillon sans rouler quoi que ce soit.
    forcedRoll: { roll: null, target: FIXED_ROLL_MAX, fixed: true, commitOnBlur: false, onSet: (r) => withPreRollFixedDie(useGame.getState, useGame.setState, doRoll, () => onSet(r)) },
    fixedMark: mark,
  };
}

/**
 * Sélecteur de dé d'une ÉTAPE de cascade (#942 L3, étendu aux DEUX lectures du dé en #1508) — MÊME
 * couture, MÊME contrôle (`ForcedRollPicker`), MÊME gate (`canFixDie`) que les slots de flux ci-dessus ;
 * seul le PORTEUR du dé change (`step.de` ou `step.table`, aucun flux de jet). Deux différences de
 * domaine, portées ici et pas au site :
 *  - la borne du champ est celle des DÉS de CE tirage (`plageNaturelle` : `n` dés de `sides` faces)
 *    — une table à d10 refuse 47, un 2d10 monte à 20 ; jamais un clamp en silence ;
 *  - un dé posé reste RÉ-ÉDITABLE tant que l'étape est courante (parité exacte avec la branche
 *    post-jet d'un slot : `roll` est pré-rempli, la saisie suivante re-pose).
 * `onSet` reçoit le dé NATUREL (le `mod` de la déclaration s'applique au résolveur).
 */
export function stepForcedDie(
  s: GameState,
  step: CascadeStep,
  onSet: (roll: number) => void,
): { forcedRoll?: RollRowProps['forcedRoll']; fixedMark?: boolean } {
  // Déclaration RÉSOLUE (modificateur vivant versé, `liveTableDecl`/`liveDeDecl`) : le champ annonce
  // l'opération que le tirage fera réellement, pas celle figée à l'ouverture de l'étape.
  // UN SEUL CHEMIN DE POSE pour les DEUX porteurs de dé (#1508) : `step.de` d'abord, `step.table`
  // sinon — une étape n'a jamais les deux (deux dés à jeter dans la même fenêtre n'existe pas).
  const decl = step.de ? liveDeDecl(s, step) : step.table && liveTableDecl(s, step);
  if (!decl) return {};
  const mark = !!step.fixed;
  if (!canFixDie(s, step.actorId)) return { fixedMark: mark };
  // La BORNE se lit sur les DÉS résolus, quel que soit le porteur — une seule expression, deux
  // résolutions de défaut (le dé nu porte les siens, la table donne le sien).
  const max = plageNaturelle(step.de ? specDeEtape(decl) : tableSpec(step.table!)).max;
  // Dé EFFECTIF servi au champ : le dé qui a résolu la LIGNE (table, borné au plancher par le
  // résolveur) ou le TOTAL (dé nu) — c'est la même grandeur, sous les deux noms de son porteur.
  const effective = decl.result ? ('die' in decl.result ? decl.result.die : decl.result.total) : null;
  // `roll: null` (dé non posé) = le champ est une OFFRE, vide ; sinon il porte le dé NATUREL courant,
  // éditable en place — poser un dé n'est pas un aller sans retour.
  // `mod` ET le dé EFFECTIF du résolveur (`result.die`) voyagent avec le sélecteur : le champ AFFICHE
  // l'opération et son résultat, sans jamais le recalculer (le plancher de la table n'est connu que du
  // résolveur). Le naturel seul mentirait sur la ligne résolue — même exigence que la borne `max`.
  return { forcedRoll: { roll: decl.result?.roll ?? null, target: max, max, fixed: true, mod: decl.mod ?? 0, effective, onSet }, fixedMark: mark };
}
