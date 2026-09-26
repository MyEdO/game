/**
 * DIALOGUE — ce qu'une réponse OFFRE et ce qu'elle ANNONCE viennent de sa DONNÉE (#1869).
 *
 * Trois fonctions PURES (elles LISENT l'état, n'en écrivent aucun), source UNIQUE des deux surfaces
 * qui servent une réponse — la fenêtre (`ui/DialogueBox`) et les touches `dialogue-choice-N`
 * (`state/keybindings`) :
 *  · `ouvrirDialogue` — la SEULE fabrique d'un état de conversation : tout ouvreur y passe, et la
 *    conversation naît avec sa `session`, l'id MONOTONE qui regroupe SES tours à la relecture ;
 *  · `reponsesDuNoeud` — la liste VISIBLE des réponses : filtre `when`, rang d'affichage 1..n,
 *    verdict d'offre (le siège qui décide, la bourse du groupe). Le RANG est celui de la liste
 *    visible, l'INDEX celui de la donnée (c'est lui que reçoit `chooseDialogue`) ;
 *  · `testAnnonce` — le Test que le flux d'une réponse DÉCLENCHE, en ids STABLES (jamais un libellé
 *    recopié dans la donnée : l'affichage résout les libellés au registre).
 */
import type { CharKey, Difficulty } from '../engine/types';
import type { SkillRef } from '../engine/skills';
import { canAfford, toMoney } from '../engine/money';
import { evalCondition, flowTestGateOpen, resolveTestDifficulty, type ConditionCtx } from '../engine/flowCore';
import type { Flow } from './flow';
import type { Dialogue } from './scene';
import type { DialogueTurn } from './dialogueHistory';
import type { EtatDialogue } from './pendings';
import { condCtx, partyMoneyTotal } from './bourseFlow';
import { ownsGroupDecision } from './netOwnership';
import { modalHolds } from './modalArbiter';
import type { GameState } from './store';

/**
 * OUVRE une conversation : l'état de dialogue AVEC sa `session`. Couture UNIQUE de tous les ouvreurs
 * (capacité « parler » d'une entité, Effet `startDialogue`) — un ouvreur qui bâtirait l'objet à la
 * main naîtrait sans session, et ses tours se confondraient avec ceux de la visite précédente.
 *
 * L'id est DÉRIVÉ de l'ARCHIVE, sans aucun état de module : `1 + max(session archivée)`. Il survit
 * donc au rechargement (`dialogueHistory` voyage en save et en snapshot coop) là où un compteur
 * reparti à 1 après un F5 réattribuerait le numéro d'une conversation passée ; et la fenêtre
 * glissante `DIALOGUE_HISTORY_CAP` évince les PLUS VIEUX tours, jamais le max.
 *
 * Deux ouvertures SANS tour archivé entre elles rendent le même id — sans conséquence atteignable :
 * une conversation qu'on quitte sans répondre n'archive rien, donc rien ne porte cet id à la
 * relecture (épinglé par `dialogue.test.ts`).
 */
export function ouvrirDialogue(
  etat: { dialogueHistory: DialogueTurn[] },
  dialogue: Dialogue,
  speakerId?: string,
): EtatDialogue {
  const session = etat.dialogueHistory.reduce((max, t) => Math.max(max, t.session), 0) + 1;
  return { dialogue, nodeId: dialogue.start, ...(speakerId ? { speakerId } : {}), session };
}

/**
 * LA CONVERSATION RÉPOND-ELLE ? Prédicat NOMMÉ, UNIQUE, de toutes les portes par lesquelles une
 * réponse se choisit — le VERBE `chooseDialogue` (donc aussi l'intent coop appliqué par l'hôte) et
 * les touches `dialogue-choice-N`. Trois termes, aucun recopié ailleurs :
 *  · une conversation est OUVERTE ;
 *  · CE siège décide pour le groupe (décision de groupe, #1262) ;
 *  · aucune modale ne tient la main (`modalHolds`, l'arbitre) — la fenêtre de jet qu'une réponse à
 *    Test vient d'ouvrir SUSPEND la conversation : répondre par-dessus écraserait le `dialogueNext`
 *    du pending, archiverait un second tour et repaierait le coût.
 */
export function conversationRepond(s: GameState): s is GameState & { dialogue: EtatDialogue } {
  return !!s.dialogue && ownsGroupDecision(s) && !modalHolds(s);
}

/** Pourquoi une réponse VISIBLE n'est pas offerte. Fermé : la fenêtre en rend le texte, la touche
 *  s'en tait — les deux lisent le MÊME verdict `enabled`. */
export type RefusDeReponse =
  /** Ce siège ne décide pas pour le groupe (coop) — le dialogue est une décision de groupe (#1262). */
  | 'siege'
  /** Réponse payante que la bourse du groupe ne couvre pas. */
  | 'argent';

/** Le Test qu'un flux de réponse DÉCLENCHE, en ids STABLES — `targetDR` n'est porté que par un Test
 *  ÉTENDU (le DR CUMULÉ à atteindre, donnée du flux). */
export interface TestAnnonce {
  skill?: SkillRef;
  characteristic?: CharKey;
  difficulty: Difficulty;
  targetDR?: number;
}

/** Une réponse VISIBLE du nœud courant. */
export interface ReponseDeDialogue {
  /** Position dans la DONNÉE (`node.choices`) — l'argument de `chooseDialogue`. */
  index: number;
  /** Rang 1..n dans la liste VISIBLE — le numéro affiché, et la touche qui l'adresse. */
  rang: number;
  label: string;
  icon?: string;
  /** Coût normalisé de la réponse payante (affiché, et payé par `chooseDialogue`). */
  cost?: ReturnType<typeof toMoney>;
  /** La réponse est-elle OFFERTE ? Verdict PARTAGÉ par le clic et par la touche. */
  enabled: boolean;
  refus?: RefusDeReponse;
  test?: TestAnnonce;
}

/**
 * Les réponses VISIBLES du nœud courant, dans l'ordre de la donnée. Une réponse dont le `when` est
 * faux n'est pas rendue et ne consomme PAS de rang : la touche 3 choisit la 3ᵉ réponse À L'ÉCRAN.
 * Hors dialogue (ou sur un nœud introuvable) : aucune réponse — la touche n'a rien à adresser.
 */
export function reponsesDuNoeud(s: GameState): ReponseDeDialogue[] {
  const etat = s.dialogue;
  if (!etat) return [];
  const node = etat.dialogue.nodes.find((n) => n.id === etat.nodeId);
  if (!node) return [];
  const get = () => s;
  // Contexte de Condition de SCÈNE par la couture canonique (`bourseFlow.condCtx`) : la Condition
  // `money` y lit le total des bourses du groupe, comme les triggers et les `if` de scène.
  const cc = condCtx(get);
  const money = partyMoneyTotal(get);
  const decide = ownsGroupDecision(s);
  const out: ReponseDeDialogue[] = [];
  node.choices.forEach((c, index) => {
    if (c.when && !evalCondition(c.when, cc)) return;
    const cost = c.cost ? toMoney(c.cost) : undefined;
    const solvable = !cost || canAfford(money, cost);
    const test = testAnnonce(c.flow, cc);
    out.push({
      index,
      rang: out.length + 1,
      label: c.label,
      ...(c.icon ? { icon: c.icon } : {}),
      ...(cost ? { cost } : {}),
      enabled: decide && solvable,
      ...(!decide ? { refus: 'siege' as const } : !solvable ? { refus: 'argent' as const } : {}),
      ...(test ? { test } : {}),
    });
  });
  return out;
}

/**
 * Le Test que CE flux déclenche, ou rien. Le parcours suit ce qui va RÉELLEMENT s'exécuter : une
 * `seq` dans l'ordre, un `if` par la branche que sa Condition prend, et il s'arrête au PREMIER jet
 * rencontré — c'est le seul que le joueur déclenche en choisissant la réponse (les branches
 * `success`/`fail` d'un `test` sont APRÈS le jet ; ce qu'elles contiennent n'est pas annoncé).
 * Un nœud `test` dont le `gate` est fermé ne jette rien : il n'annonce rien non plus.
 * Un `choice` est une DÉCISION, pas un jet.
 */
export function testAnnonce(flow: Flow | undefined, cc: ConditionCtx): TestAnnonce | undefined {
  if (!flow) return undefined;
  switch (flow.kind) {
    case 'seq': {
      for (const step of flow.steps) {
        const trouve = testAnnonce(step, cc);
        if (trouve) return trouve;
      }
      return undefined;
    }
    case 'if':
      return testAnnonce(evalCondition(flow.cond, cc) ? flow.then : flow.else, cc);
    case 'test': {
      if (!flowTestGateOpen(flow.test, cc)) return undefined;
      return {
        ...(flow.test.skill ? { skill: flow.test.skill } : {}),
        ...(flow.test.characteristic ? { characteristic: flow.test.characteristic } : {}),
        difficulty: resolveTestDifficulty(flow.test, cc),
      };
    }
    case 'do': {
      const e = flow.effect;
      if (e.type !== 'extendedTest') return undefined;
      // Défaut de difficulté : celui de l'APPLIER (`combatEffects.ts` `extendedTest`), jamais un autre.
      return {
        ...(e.skill ? { skill: e.skill } : {}),
        ...(e.characteristic ? { characteristic: e.characteristic } : {}),
        difficulty: e.difficulty ?? 'intermediaire',
        targetDR: e.targetDR,
      };
    }
    case 'choice':
      return undefined;
  }
}
