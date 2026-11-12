/**
 * DIALOGUE — ce qu'une réponse OFFRE et ce qu'elle ANNONCE viennent de sa DONNÉE (#1869).
 *
 * Des fonctions PURES (elles LISENT l'état, n'en écrivent aucun), source UNIQUE des surfaces qui servent
 * une réponse — la fenêtre (`ui/DialogueBox`), les touches `dialogue-reponse-N` (`state/clavier/keybindings`) et
 * l'écran d'un hôte du noyau (`conversationEnVue`) :
 *  · `ouvrirDialogue` — la SEULE fabrique d'un état de conversation : tout ouvreur y passe, et la
 *    conversation naît avec sa `session`, l'id MONOTONE qui regroupe SES tours à la relecture ;
 *  · `reponsesDuNoeud` — la liste VISIBLE des réponses : filtre `when`, rang d'affichage 1..n,
 *    verdict d'offre (le siège qui décide, la bourse du groupe). Le RANG est celui de la liste
 *    visible, l'`id` celui de la donnée (c'est lui que reçoit le choix `dialogue.reponse`) ;
 *  · `testAnnonce` — le Test que le flux d'une réponse DÉCLENCHE, en ids STABLES (jamais un libellé
 *    recopié dans la donnée), que `libelleDuTestAnnonce` résout en libellés au registre.
 */
import type { IconId } from '../data/icons';
import type { CharKey, Difficulty } from '../engine/types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { canAfford, toMoney } from '../engine/money';
import { evalCondition } from '../engine/flowCore';
import { resoudreFlowTest, type ContexteDuTest } from '../engine/decisionDuTest';
import type { Flow } from '../data/schemas/defs-scenes/effets';
import { speakerEntity, type Dialogue } from './monde/scene';
import { nomDEntite } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { testSkillLabel } from '../data';
import { DIFFICULTY_LABELS } from '../engine/types';
import type { DialogueTurn } from './monde/dialogueHistory';
import type { EtatDialogue } from './pendings';
import { condCtx, partyMoneyTotal } from './bourseFlow';
import { groupDecisionSeat, ownsGroupDecision } from './netOwnership';
import { nomDuSiege } from './sieges';
import { t } from '../i18n';
import { surfaceTientLaMain } from './modalArbiter';
import type { Jeu } from './etat';
import type { IdDeReponseDeDialogue } from './designations';

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
  return { dialogue: structuredClone(dialogue), nodeId: dialogue.start.id, ...(speakerId ? { speakerId } : {}), session }; // #2097
}

/**
 * LA CONVERSATION RÉPOND-ELLE ? Prédicat NOMMÉ, UNIQUE, de toutes les portes par lesquelles une
 * réponse se choisit — le choix `dialogue.reponse` (donc aussi l'intent coop appliqué par l'hôte) et
 * les touches `dialogue-reponse-N`. Trois termes, aucun recopié ailleurs :
 *  · une conversation est OUVERTE ;
 *  · CE siège décide pour le groupe (décision de groupe, #1262) ;
 *  · aucune surface ne tient la main (`surfaceTientLaMain`, l'arbitre) — la conversation est CE
 *    que le joueur a sous les yeux : la fenêtre de jet qu'une réponse à Test vient d'ouvrir, le
 *    marché qu'une réponse vient d'ouvrir, un écran plein la SUSPENDENT.
 */
export function conversationRepond(s: Jeu): s is Jeu & { dialogue: EtatDialogue } {
  return !!s.dialogue && ownsGroupDecision(s) && !surfaceTientLaMain(s);
}

/** `kind` de la couche que la fenêtre de conversation pose sur la pile de CE siège (`ui/DialogueBox`). */
export const COUCHE_CONVERSATION = 'dialogue';

/** Le Test qu'un flux de réponse DÉCLENCHE, en ids STABLES — `drCible` n'est porté que par un Test
 *  ÉTENDU (le DR CUMULÉ à atteindre, donnée du flux). */
export interface TestAnnonce {
  skill?: RefDesignee;
  characteristic?: CharKey;
  difficulty: Difficulty;
  drCible?: number;
}

/** Une réponse VISIBLE du nœud courant. */
export interface ReponseDeDialogue {
  /** Id STABLE de la réponse dans la DONNÉE (`DialogueChoice.id`) — la valeur du choix `dialogue.reponse`. */
  id: IdDeReponseDeDialogue;
  /** Rang 1..n dans la liste VISIBLE — le numéro affiché, et la touche qui l'adresse. */
  rang: number;
  label: string;
  icon?: IconId;
  /** Coût normalisé de la réponse payante (affiché, et payé par le choix `dialogue.reponse`). */
  cost?: ReturnType<typeof toMoney>;
  /** La réponse est-elle OFFERTE ? Verdict PARTAGÉ par le clic et par la touche. */
  enabled: boolean;
  /** TEXTE du refus d'une réponse non offerte — ce siège ne décide pas pour le groupe (coop, #1262), ou
   *  réponse payante que la bourse du groupe ne couvre pas : la fenêtre l'affiche, le choix `dialogue.reponse` le dit. */
  refus?: string;
  test?: TestAnnonce;
}

/**
 * Les réponses VISIBLES du nœud courant, dans l'ordre de la donnée. Une réponse dont le `when` est
 * faux n'est pas rendue et ne consomme PAS de rang : la touche 3 choisit la 3ᵉ réponse À L'ÉCRAN.
 * Hors dialogue (ou sur un nœud introuvable) : aucune réponse — la touche n'a rien à adresser.
 */
export function reponsesDuNoeud(s: Jeu): ReponseDeDialogue[] {
  const etat = s.dialogue;
  if (!etat) return [];
  const node = etat.dialogue.nodes.find((n) => n.id === etat.nodeId);
  if (!node) return [];
  const get = () => s;
  // Contexte de Condition de SCÈNE par la couture canonique (`bourseFlow.condCtx`) : la Condition
  // `money` y lit le total des bourses du groupe, comme les triggers et les `si` de scène.
  const cc = condCtx(get);
  const money = partyMoneyTotal(get);
  const decide = ownsGroupDecision(s);
  const out: ReponseDeDialogue[] = [];
  node.choices.forEach((c) => {
    if (c.when && !evalCondition(c.when, cc)) return;
    const cost = c.cost ? toMoney(c.cost) : undefined;
    const solvable = !cost || canAfford(money, cost);
    const test = testAnnonce(c.flow, { cc, groupe: s.party });
    out.push({
      id: c.id,
      rang: out.length + 1,
      label: c.label,
      ...(c.icon ? { icon: c.icon } : {}),
      ...(cost ? { cost } : {}),
      enabled: decide && solvable,
      ...(!decide ? { refus: t('dlg.refusSiege', { meneur: nomDuSiege(s.net, groupDecisionSeat(s)) }) }
        : !solvable ? { refus: t('store.dialogueNoMoney') } : {}),
      ...(test ? { test } : {}),
    });
  });
  return out;
}

/**
 * Le Test que CE flux déclenche, ou rien. Le parcours suit ce qui va RÉELLEMENT s'exécuter : une
 * `sequence` dans l'ordre, un `si` par la branche que sa Condition prend, et il s'arrête au PREMIER jet
 * rencontré — c'est le seul que le joueur déclenche en choisissant la réponse (les branches
 * `reussite`/`echec` d'un `test` sont APRÈS le jet ; ce qu'elles contiennent n'est pas annoncé).
 * Un nœud `test` et un Test étendu s'annoncent par la décision de leur ouvreur (`resoudreFlowTest`, `engine/decisionDuTest`),
 * sur le contexte que l'ouvreur reçoit. Un `choix` est une DÉCISION, pas un jet.
 */
export function testAnnonce(flow: Flow | undefined, ctx: ContexteDuTest): TestAnnonce | undefined {
  if (!flow) return undefined;
  switch (flow.kind) {
    case 'sequence':
      return flow.etapes.reduce<TestAnnonce | undefined>((trouve, step) => trouve ?? testAnnonce(step, ctx), undefined);
    case 'si':
      return testAnnonce(evalCondition(flow.condition, ctx.cc) ? flow.alors : flow.sinon, ctx);
    case 'test': {
      const decision = resoudreFlowTest(flow.test, ctx);
      return decision.joue ? { ...decision.sujet, difficulty: decision.difficulty } : undefined;
    }
    case 'effet': {
      const e = flow.effet;
      if (e.type !== 'extendedTest') return undefined;
      const decision = resoudreFlowTest(e, ctx);
      return decision.joue ? { ...decision.sujet, difficulty: decision.difficulty, drCible: e.drCible } : undefined;
    }
    case 'choix':
      return undefined;
  }
}

/**
 * Ce que la réponse ANNONCE, en clair : « Compétence — Difficulté », plus le DR CUMULÉ d'un Test ÉTENDU. Les ids
 * STABLES viennent du FLUX (`testAnnonce`) ; ici, et ici seulement, ils se résolvent en libellés au registre
 * (`testSkillLabel`, `DIFFICULTY_LABELS`) — un auteur n'écrit JAMAIS la Compétence dans le libellé de sa réponse
 * (garde `scripts/guards/lib/dialogueLabelTest.mjs`).
 */
export function libelleDuTestAnnonce(test: TestAnnonce): string {
  const quoi = testSkillLabel(test) ?? '';
  const diff = DIFFICULTY_LABELS[test.difficulty];
  return test.drCible != null ? t('dlg.testTagCumul', { quoi, diff, dr: test.drCible }) : t('dlg.testTag', { quoi, diff });
}

/** Une réponse en vue : ce qu'elle annonce (`libelleDuTestAnnonce`) et le geste qui la choisit. */
export interface ReponseEnVue extends ReponseDeDialogue {
  annonce: string | null;
  geste: { verbe: 'fenetreChoisir'; args: ['dialogue', 'reponse', IdDeReponseDeDialogue] };
}

/** La conversation en vue, pour un hôte qui la dessine. */
export interface ConversationEnVue {
  /** Le nom de l'interlocuteur du nœud (`nomDeLInterlocuteur`) ; `null` sans interlocuteur nommé. */
  orateur: string | null;
  /** La réplique du nœud, en Markdown verbatim ; `null` sans réplique. */
  replique: string | null;
  reponses: ReponseEnVue[];
}

/** Le nom de l'interlocuteur du nœud courant : l'entité du nœud, à défaut celle de la conversation (`speakerEntity`),
 *  nommée par `nomDEntite` ; `undefined` hors dialogue ou sans interlocuteur nommé. */
export function nomDeLInterlocuteur(s: Jeu): string | undefined {
  const etat = s.dialogue;
  const node = etat?.dialogue.nodes.find((n) => n.id === etat.nodeId);
  const locuteur = etat && node && speakerEntity(s.scene?.entities ?? [], node, etat);
  return locuteur ? nomDEntite(locuteur, presetDuNarratif(s.campaignNarratif)) : undefined;
}

/** LA CONVERSATION EN VUE : l'interlocuteur et la réplique du nœud courant, et chaque réponse visible
 *  (`reponsesDuNoeud`) avec ce qu'elle annonce et le geste qui la choisit. `null` hors dialogue. */
export function conversationEnVue(s: Jeu): ConversationEnVue | null {
  const etat = s.dialogue;
  const node = etat?.dialogue.nodes.find((n) => n.id === etat.nodeId);
  if (!etat || !node) return null;
  return {
    orateur: nomDeLInterlocuteur(s) ?? null,
    replique: node.desc ?? null,
    reponses: reponsesDuNoeud(s).map((r) => ({ ...r, annonce: r.test ? libelleDuTestAnnonce(r.test) : null, geste: { verbe: 'fenetreChoisir', args: ['dialogue', 'reponse', r.id] } })),
  };
}
