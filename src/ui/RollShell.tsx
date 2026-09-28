import { Fragment, useId, useRef, type ComponentProps, type ReactNode } from 'react';
import { Modal, cibleEmbarquee } from './Modal';
import { useFocusEmprunte } from './focus';
import { GatedAction, classeBouton, type TonBouton } from './GatedAction';
import { CadrePied } from './Cadre';
import { Stack } from './Layout';
import { RollRow, type RollRowProps, DEFAULT_ROLL_LABEL } from './RollRow';
import { useRollFrisson } from './useRollFrisson';
import { DiceRoll } from './DiceRoll';
import { d100Faces } from './Dice';
import { FLOW_VERBS } from '../state/rollFlowSpecs';
import { rowForcedDie, useDieCommit, useDieCommitRegistry, withPickedDie } from './forcedDieRow';
import { useGame } from '../state/store';
import { RecapLineRow } from './RecapLine';
import type { RecapLine } from '../state/recapLine';
import { StakeNote, StakeRule, hasStakeRule, stakeRuleOf } from './StakeNote';
import type { StakeRef } from '../data';
import type { BuiltRollRow } from './rollRowBuild';
import type { OnDismiss } from '../state/dismissStack';

/**
 * RollShell — LA coquille UNIQUE des modales de jet différé (mono, opposé, ou N contributeurs).
 * Une enveloppe choisie (`Modal`, zone embarquée, ou la boîte d'un hôte via `useRollShell`), un ORDRE de zones fixe, et une barre d'actions
 * DATA-DRIVEN filtrée par phase.
 *
 *   overlay → titre → sous-titre → instruction → extra → setup (pré-jet) → rangées (`RollRow`)
 *   → outcome/summary → postRollExtra → forcedExtra → pied (`CadrePied`)
 *
 * Cardinalité des rangées :
 * - **mono** : 1 rangée interactive ;
 * - **opposé** : 2 rangées (1 interactive + 1 témoin `interactive:false`) ;
 * - **multi** : N rangées + `summary` (agrégat) — `summary` masqué si absent.
 *
 * `outcome` (l'issue sous la liste) se rend à TOUTE cardinalité : un jet opposé a une issue comme
 * un jet mono — c'est le MÊME schéma d'informations (#1078).
 *
 * La phase courante est `rolled` (au moins un jet lancé). Les actions déclarent `when` :
 * `'pre'` (avant jet), `'post'` (après), `'always'` (toujours) — le shell filtre. Aucune classe CSS
 * nouvelle : réutilise `Modal` (états `champ` et `plein`), `rm-subtitle`, `mini-title`,
 * `cs-rows`, `rm-summary`, `cadre-pied` — donc restyler/étendre se fait à UN endroit.
 */

/** Donnée d'UNE rangée de jet du shell = les props de `RollRow` (ligne + cycle d'influence propre).
 *  Le shell fournit `rolled` globalement si la rangée ne le porte pas. */
export type RollRowData = RollRowProps & {
  key?: string | number;
  /** Id RÉEL du participant (slot du flux multi) quand la `key` React est SCOPÉE par un site qui
   *  compose plusieurs pas (`CascadeModal`/`witnessRowKey`) : la clé sert au rendu, le pid sert au
   *  socle (`rowForcedDie` → `flow.slotOf`). Absent = la `key` EST l'id (6 sites mono-étape). */
  pid?: string;
  /** Séparateur rendu AVANT cette rangée (filet titré) — sert à couper la pile des étapes DÉJÀ
   *  validées de l'étape COURANTE : sans lui, la prose d'un résultat committé se colle au tirage
   *  suivant et les deux se lisent comme un seul bloc. */
  separator?: ReactNode;
};

/** Un bouton de la barre d'actions, filtré par phase (`when`). Rendu dans le pied (`CadrePied`). La
 *  PROÉMINENCE (style) n'est PLUS choisie par l'appelant : elle se DÉDUIT du RÔLE porté par la `key`
 *  (cf. `actionTon`) — un même verbe a le même poids visuel dans toutes les modales. */
export interface RollAction {
  key: string;
  label: ReactNode;
  onClick: () => void;
  /** Description de l'action OFFERTE. */
  title?: string;
  /** Fermée sans rien à dire (tous les jets ne sont pas lancés…). */
  disabled?: boolean;
  /** Fermée pour une RAISON, que le joueur lit au survol, au focus et au toucher (`GatedAction`). */
  refus?: string;
  /** Phase où le bouton est VISIBLE : avant le jet / après / toujours. */
  when: 'pre' | 'post' | 'always';
}

/** TON d'une action DÉDUIT de sa `key` (les appelants ne le choisissent plus) : abandon /
 *  secondaire = discret (`btn-ghost`) ; tout le reste (validation, progression :
 *  confirm/apply/next/finish/continue…) = primaire. Source UNIQUE de la proéminence des barres de jet,
 *  exposée en STRUCTURE (`primary`, `btnClassName` : les props de `GatedAction`) — le bouton nu et
 *  `GatedAction` lisent le même objet, jamais la chaîne de classes rendue.
 *  `all`/`rollAll` (« Tout lancer ») sont SECONDAIRES (#1117, recette 2026-08-05) : voisins du
 *  « Lancer » primaire, même style, ils déclenchaient la résolution de TOUTE la séquence sans
 *  influence — la confusion a coûté la moitié d'une recette. */
const ACTION_GHOST_KEYS = new Set(['cancel', 'break', 'ack', 'all', 'rollAll']);
const TON_PRIMAIRE: TonBouton = { primary: true };
const TON_DISCRET: TonBouton = { primary: false, btnClassName: 'btn-ghost' };
function actionTon(key: string): TonBouton {
  return ACTION_GHOST_KEYS.has(key) ? TON_DISCRET : TON_PRIMAIRE;
}

/** Commandes de barre NEUTRES (≠ verbes de cadence portés par les RANGÉES) présentes dans les
 *  modales : abandon / validation / progression. Toute AUTRE clé d'action doit être un verbe DÉCLARÉ
 *  du flux (`flowKey`) — sinon dérive (#211 : une action re-boulonnée hors du vocabulaire déclaré). */
const NEUTRAL_ACTION_KEYS = new Set(['cancel', 'confirm', 'apply', 'rollAll', 'next', 'finish', 'continue', 'all', 'ack', 'break']);

/** DEV : verrouille la surface d'actions d'une modale de jet à son vocabulaire (verbes du flux +
 *  neutres). Une clé hors-vocabulaire LÈVE — le choke-point relie la barre aux verbes DÉCLARÉS. */
function assertActionVocabulary(flowKey: keyof typeof FLOW_VERBS, actions: RollAction[]): void {
  const declared: readonly string[] = FLOW_VERBS[flowKey].verbs;
  for (const a of actions) {
    if (!NEUTRAL_ACTION_KEYS.has(a.key) && !declared.includes(a.key)) {
      throw new Error(
        `RollShell[${flowKey}] : action « ${a.key} » hors vocabulaire (verbes du flux : ${declared.join(', ')} ; neutres : ${[...NEUTRAL_ACTION_KEYS].join(', ')}).`,
      );
    }
  }
}

export function RollShell(props: {
  title: ReactNode;
  /** Zone Z1 — sous-titre « Acteur — Action (Compétence) », rendu par la coquille en `.rm-subtitle`. */
  subtitle?: ReactNode;
  /** Zone Z2 — CONSIGNE DE GESTE pré-jet, sous le sous-titre (`mini-title`) : ce que les joueurs ont
   *  à FAIRE dans cette fenêtre quand la barre d'actions ne suffit pas à le dire (multi : « Chacun
   *  frappe — Corps à corps (Bagarre)… », `ForceDoorModal`). Jamais un rappel de règle ni l'issue du
   *  jet : la Difficulté vit sur la ligne (#1072), le verdict sur `RollLine`, l'issue sur `outcome`. */
  instruction?: ReactNode;
  /** Rendu EMBARQUÉ (zone de jet d'une modale persistante) : même contenu, sans l'enveloppe `Modal`. */
  embedded?: boolean;
  /** N'attache PAS Échap à l'annulation (flux où l'on ne peut pas fermer — défense obligatoire). */
  disableEscClose?: boolean;
  /** Zone Z3b — ENJEU du jet (#1117) : une RÉFÉRENCE de donnée, jamais un texte. La coquille la résout
   *  et rend la PHRASE par `StakeNote`. Prop de PREMIER RANG : toute modale de jet peut dire son
   *  enjeu sans passer par `extra`. Le RENVOI vers la règle est accolé au TITRE par la coquille
   *  ELLE-MÊME (Z3b′) : un site n'a rien à composer, et n'en reçoit pas un 2ᵉ s'il en a déjà posé un
   *  dans son titre ou son sous-titre (cascade : la porte vit sur la ligne d'ÉTAPE). */
  stake?: StakeRef;
  /** Contenu optionnel AVANT les rangées (portraits, sélecteur de cible, choix de virage…). */
  extra?: ReactNode;
  /** Contenu métier PRÉ-JET uniquement (options : choix d'arme/localisation, Parade/Esquive…). */
  setup?: ReactNode;
  /** Les rangées de jet, rendues via `RollRow`. 1 = mono ; 2 = opposé ; N = multi. Elles NAISSENT de
   *  la porte (`rollRowBuild.ts`) : la marque est requise, un littéral monté à la main ne compile pas. */
  rows: readonly BuiltRollRow[];
  /** Phase GLOBALE : au moins un jet lancé (défaut de `RollRow.rolled` si la rangée ne le porte pas). */
  rolled: boolean;
  /** Test opposé (2 rangées) : index de la rangée gagnante — passé à `RollRow`/RollPanel via `row`. */
  winnerIndex?: number | null;
  netSL?: number;
  /** Issue du jet sous la LISTE, à TOUTE cardinalité (mono, opposé, multi) — DONNÉE, jamais du JSX :
   *  la coquille la rend elle-même (`RecapLineRow`, renderer UNIQUE). Ce que le TYPE garantit :
   *  aucun JSX n'entre ici, et le vocabulaire `RecapLine` (texte + segments tonés par camp + icône
   *  + ton) n'expose AUCUN champ de verdict — ✓/✗ et DR restent la donnée de la ligne de jet
   *  (`RollLine`). Le texte, lui, est libre : qu'il ne redise pas le verdict ni la progression déjà
   *  rendus par les autres zones relève du CONTRAT, pas du type (#1078).
   *  Producteurs : `recapLineOfEvent`/`recapLinesOfEvents` (événement de combat), `resultLines`
   *  (conséquences). Une issue PAR rangée passe, elle, par `row.note`. */
  outcome?: RecapLine[];
  /** Bandeau d'ISSUE agrégée sous les rangées (multi : total, succès…). Masqué si absent. */
  summary?: ReactNode;
  /** Contenu métier POST-JET (Surincantation, Contre-sort…). */
  postRollExtra?: ReactNode;
  /** Contenu métier juste APRÈS le picker du dé forcé (grille de localisation du Critique forcé). */
  forcedExtra?: ReactNode;
  /** Barre d'actions data-driven, filtrée par phase. */
  actions: RollAction[];
  /** Échap = annuler (pré-jet, ou si autorisé). Absent → modale non annulable au clavier. */
  onCancel?: () => void;
  /** Clé du flux de jet de la modale (`FLOW_VERBS`) : arme la garde de vocabulaire d'actions (DEV).
   *  Absente = modale sans flux naturel (garde inerte). */
  flowKey?: keyof typeof FLOW_VERBS;
  /** Étape de l'appelant (cascade, phase d'un flux) : la coquille y ajoute sa phase posé/résolu (`JetRendu.etape`). */
  etape?: string | number;
}) {
  const { embedded = false, ...p } = props;
  const jet = useRollShell(p);
  if (embedded) return <EmbeddedShell title={jet.titre} footer={jet.gestes} etape={jet.etape}>{jet.corps}</EmbeddedShell>;
  return <Modal title={jet.titre} champ plein onClose={jet.escClose} footer={jet.gestes} etape={jet.etape}>{jet.corps}</Modal>;
}

/** Le jet rendu À PART : titre, corps et gestes, que le cadre choisi pose (`footer`) ; `etape`, que
 *  le cadre relaie à `useFocusEmprunte`. */
export interface JetRendu { titre: ReactNode; corps: ReactNode; gestes: ReactNode; escClose?: OnDismiss; etape: string }

type JetDeCoquille = Omit<ComponentProps<typeof RollShell>, 'embedded'>;
const AUCUN_JET: JetDeCoquille = { title: null, rows: [], rolled: false, actions: [] };

/**
 * La coquille SANS cadre (`docs/charte-ui.md`, `.cadre-pied`, patron `useSessionEnd`) : `RollShell`
 * la pose dans `Modal` ou `EmbeddedShell` ; un hôte qui englobe le jet dans SA boîte la pose lui-même.
 * `null` : aucun jet, hooks appelés quand même.
 */
export function useRollShell(p: JetDeCoquille): JetRendu;
export function useRollShell(p: JetDeCoquille | null): JetRendu | null;
export function useRollShell(p: JetDeCoquille | null): JetRendu | null {
  const {
    title,
    subtitle,
    instruction,
    disableEscClose = false,
    stake,
    extra,
    setup,
    rows,
    rolled,
    winnerIndex,
    netSL,
    outcome,
    summary,
    postRollExtra,
    forcedExtra,
    actions,
    onCancel,
    flowKey,
    etape,
  } = p ?? AUCUN_JET;
  if (import.meta.env.DEV && flowKey) assertActionVocabulary(flowKey, actions);
  // Abonnement RÉACTIF au siège (coop : prise/relâche du rôle MJ, attribution d'un héros) — le
  // sélecteur de dé en dépend via `canFixDie`. L'état COMPLET se relit ensuite (pendings + délégués),
  // frais à chaque rendu : hook appelé INCONDITIONNELLEMENT, jamais après un retour anticipé.
  useGame((s) => s.net);
  const uid = useId();
  const state = useGame.getState();
  // Z3b′ AU SOCLE (recette #1117) : le RENVOI vers la règle est accolé au TITRE par la COQUILLE, plus
  // par discipline au site — une modale qui pose son `stake` l'obtient sans rien faire. La cible est
  // DÉRIVÉE de la même entrée d'enjeu que la phrase (`resolveStake().rule`), le nom accessible du
  // texte du titre. Un site qui a déjà composé son `StakeRule` dans le titre n'en reçoit pas un 2ᵉ
  // (reconnaissance par IDENTITÉ de composant, `hasStakeRule`).
  const stakeRule = stake ? stakeRuleOf(stake) : undefined;
  const titleNode = stakeRule && !hasStakeRule(title) && !hasStakeRule(subtitle)
    ? <>{title} <StakeRule rule={stakeRule} /></>
    : title;
  // VERROU de comparaison (#990) : dès qu'UNE rangée du panneau porte un jet MASQUÉ, la coquille ne
  // décerne plus rien qui compare les deux jets — ni halo vainqueur/perdant, ni badge « DR net ». Le
  // calendrier de découverte vit dans la donnée (`mask`), l'accent est DÉRIVÉ ici : sans ce verrou,
  // un `winnerIndex` posé par un site rallumerait le verdict sur la ligne qu'on vient de cacher.
  const panelMasked = rows.some((r) => r.row.d?.mask === 'roll' || r.row.pending?.mask === 'roll');
  // Z5c sous le MÊME verrou, élargi à `'value'` : la raison d'un départage CITE les deux grandeurs
  // comparées (LDB 12 l.160) — sous un masque de valeur (Marchandage du marchand), la phrase
  // révélerait le score que la ligne adverse cache justement.
  const reasonLocked = rows.some((r) => !!r.row.d?.mask || !!r.row.pending?.mask);
  // « Lancer » hissé dans la barre (cas MONO). On hisse quand EXACTEMENT UNE rangée est à lancer :
  // interactive (≠ false), non lancée, et porteuse d'un `onRoll`. Le multi (≥2 rangées à lancer)
  // garde son « Lancer » par rangée + « Tout lancer » → 0 hissé. Opposé (1 interactive + 1 témoin
  // sans onRoll) → 1 seule à lancer → hissé, correct.
  const rollableIdx = rows.map((r, i) => (r.interactive !== false && !(r.rolled ?? rolled) && r.onRoll ? i : -1)).filter((i) => i >= 0);
  const hoistIdx = rollableIdx.length === 1 ? rollableIdx[0] : -1;
  const hoistRow = hoistIdx >= 0 ? rows[hoistIdx] : undefined;
  // Hook appelé INCONDITIONNELLEMENT (règles des hooks) : no-op quand rien à hisser.
  const hoist = useRollFrisson(hoistRow?.onRoll, { frisson: hoistRow?.rollFrisson });
  // Le CTA HISSÉ lance à la place de la rangée : il doit consommer le MÊME brouillon de « Fixer le
  // dé » (garde partagée `withPickedDie`, `forcedDieRow.ts`). Sans cela, taper une valeur puis
  // cliquer « Lancer » dans une CASCADE roulait un dé naturel (recette #1117) — le fix côté rangée ne
  // couvrait pas cet hôte.
  const hoistDieCommit = useDieCommit();
  // REGISTRE des poignées de « Fixer le dé », une par rangée : il sert le CTA de rangée, le CTA hissé
  // ET le verbe groupé « Tout lancer » (3ᵉ hôte, #1117) — la garde vit au socle, jamais recopiée.
  const dieRegistry = useDieCommitRegistry();
  const rowKeyOf = (r: RollRowData, i: number): string => String(r.key ?? i);
  // Dès que le résolveur commet (`rolled` bascule, en plein `landed`), `hoistIdx` retombe à -1 (la
  // rangée n'est plus « à lancer ») et `hoistRow` disparaît PENDANT `landed`, avant que la scène n'ait
  // eu le temps de lire ses vraies faces. On fige donc l'INDEX de la
  // rangée hissée dans une ref (mise à jour tant qu'elle est valide, càd AVANT/PENDANT `rolling`) —
  // `rows[hoistedRowIdx.current]` reste résolvable pendant tout `landed`, `.row.d` y est FRAIS
  // (React 18 batch la transition `landed` et le commit du store dans le MÊME rendu).
  const hoistedRowIdx = useRef<number>(-1);
  if (hoistIdx >= 0) hoistedRowIdx.current = hoistIdx;
  const landedRow = hoist.landed ? rows[hoistedRowIdx.current] : undefined;
  const hoistFaces = landedRow?.row.d ? d100Faces(landedRow.row.d.roll) : null;
  // Échap : pendant le frisson HISSÉ (roulis ou atterrissage de la scène centrale), SKIPPE — même
  // geste qu'un clic sur les dés (`hoist.skip`), jamais une annulation en pleine animation. Sinon,
  // annule seulement pré-jet ; un bouton Annuler post-jet porte sa visibilité via `when`.
  // Congédiement PARTIEL par construction (`dismissStack.ts:12-14`) : la fenêtre qui porte le jet
  // (`Modal` de la coquille ou boîte d'un hôte) ne se ferme que par son démontage, jamais par l'appui.
  const escGeste = disableEscClose ? undefined : (hoist.rolling || hoist.landed) ? hoist.skip : (!rolled ? onCancel : undefined);
  const escClose: OnDismiss | undefined = escGeste && (() => { escGeste(); return false; });
  // « TOUT LANCER » par rangées (`rollRows`/`rollAll` — fenêtre MULTI) : chaque rangée commet d'abord
  // SON brouillon ; celles dont la saisie a POSÉ un dé ont déjà lancé, on ne les relance pas. Les
  // autres partent par LEUR propre `onRoll` (la même fonction que leur bouton) — le verbe du domaine
  // n'est pas réinterprété, il est seulement appliqué rangée par rangée.
  const ROLL_ALL_ROWS_KEYS = new Set(['rollRows', 'rollAll']);
  const rollAllRowsWithPickedDice = (fallback: () => void) => () => {
    const rollable = rows
      .map((r, i) => ({ r, key: rowKeyOf(r, i) }))
      .filter(({ r }) => r.interactive !== false && !(r.rolled ?? rolled) && r.onRoll);
    const launched = dieRegistry.commitAll(rollable.map((x) => x.key));
    if (!launched.size) { fallback(); return; } // aucun dé saisi : le verbe du domaine s'applique tel quel
    for (const { r, key } of rollable) if (!launched.has(key)) r.onRoll?.();
  };
  const shownActions = actions
    .filter((a) => a.when === 'always' || (rolled ? a.when === 'post' : a.when === 'pre'))
    .map((a) => (ROLL_ALL_ROWS_KEYS.has(a.key) ? { ...a, onClick: rollAllRowsWithPickedDice(a.onClick) } : a));
  // Le corps est une PILE (`Stack`) : c'est son `gap` qui place l'enjeu et les notes, primitives sans
  // marge externe.
  const body = (
    <Stack gap="md">
      {/* Scène centrale du roulis (#396 v2/v3, mono/opposé — le hissage `hoistIdx` ne s'active que
          pour UNE rangée à lancer) : grands dés au centre, voile sur le contenu qui reste dessous.
          Elle s'ancre sur le cadre positionné (`.modal`, `.rs-embedded`), pas sur le défileur. */}
      {(hoist.rolling || hoist.landed) && <DiceRoll scene landed={hoist.landed} faces={hoistFaces} onSkip={hoist.skip} />}
      {subtitle != null && <p className="rm-subtitle">{subtitle}</p>}
      {instruction != null && <div className="mini-title">{instruction}</div>}
      {/* Z3b — l'ENJEU (#1117) : résolu par la coquille depuis la RÉFÉRENCE de donnée, jamais écrit au site. */}
      {stake && <StakeNote stake={stake} />}
      {extra}
      {!rolled && setup}
      <div className="cs-rows">
        {rows.map((r, i) => {
          const { key, pid, separator, ...rest } = r;
          // Test opposé (≥2 rangées, post-jet) : la rangée `winnerIndex` est accentuée, les autres atténuées.
          // Une rangée qui porte déjà son propre `winner` reste prioritaire — SAUF quand le panneau est
          // masqué : `winner: undefined` d'une rangée masquée serait avalé par le `??` ci-dessous.
          const winner = !panelMasked && rolled && winnerIndex != null && rows.length > 1 ? (i === winnerIndex ? 'win' : 'lose') : null;
          // SÉLECTEUR DE DÉ (Résilience LDB 17 l.68 / dé fixé) : DÉRIVÉ ici pour TOUTE modale de jet —
          // aucune ne le calcule plus (cf. `forcedDieRow.ts`). `flowKey` donne le flux, la rangée donne
          // son acteur et, en multi, l'id de son slot (`pid`, ou la `key` quand elle n'est pas scopée).
          const die = rowForcedDie(state, r.flowKey ?? flowKey, { ...rest, key, pid, onRoll: r.onRoll ?? null }, rolled);
          const shown = reasonLocked && rest.row.d?.decided ? { ...rest, row: { ...rest.row, d: { ...rest.row.d, decided: undefined } } } : rest;
          const row = <RollRow {...shown} forcedRoll={die.forcedRoll} fixedMark={rest.fixedMark ?? die.fixedMark} rolled={rest.rolled ?? rolled} winner={rest.winner ?? winner} rollInBar={i === hoistIdx} dieCommitRef={i === hoistIdx ? hoistDieCommit : dieRegistry.handle(rowKeyOf(r, i))} />;
          return separator ? <Fragment key={key ?? i}>{separator}{row}</Fragment> : <Fragment key={key ?? i}>{row}</Fragment>;
        })}
      </div>
      {/* L'ISSUE dit ce que les jets ont produit : elle tombe sous le MÊME verrou que le halo et le
          badge « DR net » (#990) — une rangée masquée révélerait par sa conclusion ce que son dé cache.
          Le CADRE (`.rm-journal`) et le rendu de chaque ligne (`RecapLineRow`) appartiennent à la
          coquille : un site fournit la DONNÉE, jamais le markup (#1078). */}
      {!panelMasked && !!outcome?.length && (
        <div className="rm-journal">
          {outcome.map((l, i) => <RecapLineRow key={i} line={l} />)}
        </div>
      )}
      {/* DR net du Test opposé (2 rangées) — même badge que `RollPanel`, réutilisé ici. Il COMPARE les
          deux jets : masqué avec eux (#990). */}
      {!panelMasked && rolled && winnerIndex != null && netSL != null && (
        <div className="rm-netsl" title="Différence de DR entre les deux jets : elle alimente les Dégâts (Test opposé)">
          DR net : {netSL >= 0 ? '+' : '−'}{Math.abs(netSL)}
        </div>
      )}
      {summary != null && <p className="rm-summary">{summary}</p>}
      {postRollExtra}
      {forcedExtra}
    </Stack>
  );
  const footer = (
    <>
        {shownActions.map((a) => (a.refus ? (
          <GatedAction
            key={a.key}
            id={`${uid}-${a.key}`}
            label={a.label}
            enabled={false}
            reason={a.refus}
            onClick={() => {}}
            {...actionTon(a.key)}
          />
        ) : a.disabled ? (
          <button key={a.key} className={classeBouton(actionTon(a.key))} disabled>{a.label}</button>
        ) : (
          <button
            key={a.key}
            className={classeBouton(actionTon(a.key))}
            title={a.title}
            /* () => a.onClick() : ne PAS passer l'événement React (coop : l'invité sérialise les intents en JSON). */
            onClick={() => a.onClick()}
          >
            {a.label}
          </button>
        )))}
        {/* « Lancer » HISSÉ (mono) : au MÊME niveau qu'Annuler/Appliquer, en DERNIER (à DROITE) — action
            PRIMAIRE à droite, « Annuler » à gauche (convention de la coquille). Pendant le roulis/
            l'atterrissage, la SCÈNE centrale (ci-dessus) porte les dés : ce bouton disparaît sans repli. */}
        {hoistIdx >= 0 && !rolled && !hoist.rolling && (
          <button key="roll" className="btn btn-primary" onClick={withPickedDie(hoistDieCommit, () => hoist.trigger())}>
            {hoistRow?.rollLabel ?? DEFAULT_ROLL_LABEL}
          </button>
        )}
    </>
  );
  if (!p) return null;
  return { titre: titleNode, corps: body, gestes: footer, escClose, etape: `${etape ?? ''}:${rolled ? 'post' : 'pre'}` };
}

/**
 * ZONE EMBARQUÉE de la coquille de jet (#333) : titre + contenu, SANS `Modal` — le rendu qu'une
 * étape prend quand elle s'incruste dans un écran-hub au lieu de flotter. Exporté par la coquille
 * parce que les étapes HORS jet de la même cascade (décision d'escale, réglages de repos) portent la
 * MÊME zone : elles la COMPOSENT au lieu de recopier `.rs-embedded` + son titre.
 * Apparue dans un dialogue déjà ouvert, la zone EMPRUNTE le focus (`useFocusEmprunte`,
 * `cibleEmbarquee`) et le rend à son invocateur quand elle se retire.
 */
export function EmbeddedShell({ title, footer, etape, children }: {
  title: ReactNode;
  /** PIED : les gestes de sortie de l'étape (`CadrePied`, le pied des trois cadres). */
  footer?: ReactNode;
  /** Étape courante de la zone (`JetRendu.etape`, ou celle de l'hôte) : relayée à `useFocusEmprunte`. */
  etape?: string | number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusEmprunte(ref, true, cibleEmbarquee, etape);
  return (
    <div ref={ref} className="rs-embedded">
      <div className="mini-title">{title}</div>
      {children}
      <CadrePied>{footer}</CadrePied>
    </div>
  );
}
