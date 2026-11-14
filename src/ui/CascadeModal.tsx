import type { JSX } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGame } from '../state/store';
import { fermeturesDuFlux } from '../noyau/verbesOuverts';
import { refusDImmunite } from '../noyau/determinationDuJet';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { StakeRule, OutcomeNote, sameCertainOps, sameEntityRef } from './StakeNote';
import { branchCertainOps, branchBlockingEntity } from '../noyau/combat/flowEval';
import { resolveStake } from '../data';
import { useAttackJetProps } from './jetProps/useAttackJetProps';
import { useDefenseJetProps } from './jetProps/useDefenseJetProps';
import { useFumbleJetProps } from './jetProps/useFumbleJetProps';
import { useTestJetProps } from './jetProps/useTestJetProps';
import { useExtendedTestJetProps } from './jetProps/useExtendedTestJetProps';
import { DisengageModal } from './DisengageModal';
import { ForceDoorModal } from './ForceDoorModal';
import { CastModal } from './CastModal';
import { type PanelRowData as PanelRow } from './RollPanel';
import { OptionChooser, type RollGridOption } from './OptionChooser';
import { NumberField } from './NumberField';
import { CriticalBody, RevealBody } from './RevealBody';
import { ModalSubject } from './ModalSubject';
import { RecapLineList } from './RecapLine';
import { TableRollLine } from './RollLine';
import { testBreakdown, testPending, opposedLines } from './breakdown';
import type { ModLine } from '../engine/combat';
import { Icon } from './Icon';
import { stepInteraction, stepReady, secondReadOf, tableStepDef, tableStepNaturalRange, naturalRollForTableRow, liveTableDecl } from '../noyau/cascade';
import { fourchette } from '../engine/tables';
import { estJete, refusSansJet, cibleMesuree } from '../engine/tests';
import { opposedAttackerLabel } from '../noyau/rollSeam';
import { useOwns } from './ownership';
import { sequenceAbandonEtatOf } from '../noyau/sequenceCore';
import { SequencePanel } from './SequencePanel';
import { stepForcedDie } from './forcedDieRow';
import { JET_FIGE, jetFigeRevele } from '../noyau/netOwnership';
import { frozenOpposedRow, tableRow, witnessRow, buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { referentDeLEtape, type CascadeStep, type CascadeRollStep, type CascadeRoll, type BatchParticipant } from '../noyau/pendings';
import type { Combatant } from '../engine/types';
import { buildParticipantRows, rollAllUnrolledRows, rangeeSansJet } from './buildParticipantRows';
import { Prose, mdToText } from './Prose';
import { useIdentites } from './useIdentites';
import { nommer } from '../noyau/monde/identites';
import { libelleDuDe, lectureDuTotal, libelleDuSeuil, libelleDeTable, libelleDuJetFige } from '../noyau/jetsEnVue';
import { cumulEtenduDeRangee } from '../noyau/progresEtendu';
import { FLOWS } from '../noyau/rollFlowSpecs';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/** Une étape-JET est PRÉSENTABLE avec son acteur (comportement historique) OU sans acteur quand
 *  elle est MONDIALE (`worldOwner`, seam #275 Décision 3 — désertion/Moral, aucun `actorId` par
 *  conception) : rendre `null` dans ce second cas privait TOUS les sièges — y compris l'owner
 *  (MJ) — de la modale (#P0-2). Exporté pour test direct (pas de harnais de rendu React ici). */
export function jetStepPresentable(step: CascadeStep, actor: Combatant | undefined): boolean {
  return !!actor || !!step.worldOwner;
}

/** Clé React d'une rangée-témoin/participant — SCOPÉE PAR ÉTAPE. Deux pas BATCH successifs partagent
 *  leurs participants (Capitaine/Timonier/Navigateur d'Orientation ET d'Entretien) : keyer par le seul
 *  id de participant collisionne (pas figé + pas courant côte à côte → « two children with the same
 *  key »). Site UNIQUE de la clé, partagé par la pile figée et la rangée batch courante. */
export const witnessRowKey = (stepId: string, participantId?: string): string =>
  participantId != null ? `${stepId}:${participantId}` : stepId;

/** Sous-titre d'étape — SOURCE UNIQUE des six branches de la cascade (table / affichage riche /
 *  affichage / choix / batch / jet) : la POSITION dans la séquence, et elle seule. Le libellé de
 *  l'étape et son renvoi de règle sont portés par le TITRE de la fenêtre (`CascadeBody.titleNode`,
 *  qui suit le pas courant) — les redire ici empilerait deux tuiles pour la même information.
 *  `undefined` quand il n'y a rien à situer (séquence à une étape) : un fragment JSX vide n'est pas
 *  `null`, la coquille rendrait un `<p>` vide, soit une bande de marge sans contenu sous le titre.
 *  `count` porte le rang de l'étape par défaut (`n/m`), ou le compte de JETS RÉELS pour la branche
 *  jet (`prefix: 'jet '`, `total` = `totalJets`, arbitrage user 2026-07-11).
 *
 *  `porteur` — POUR QUI le dé tombe (précédent `jetProps/useFumbleJetProps.tsx`, Z1 = l'acteur et le
 *  fait qui ouvre la fenêtre) : une rangée de dé NU n'a pas de portrait avant le lancer, son porteur
 *  n'a donc aucune autre surface. Il ne REDIT jamais le libellé du pas (celui-là titre la fenêtre —
 *  arbitrage user 2026-08-06 #1117, verrouillé par `cascade-subtitle.test.tsx`) : les deux se
 *  composent à la même graphie que le précédent (`X — Y`). */
export function stepSubtitle(count: { cursor: number; total: number; prefix?: string }, porteur?: string): ReactNode {
  const position = count.total <= 1 ? undefined : `${count.prefix ?? ''}${count.cursor + 1}/${count.total}`;
  if (!porteur) return position;
  return position ? `${porteur} — ${position}` : porteur;
}

/** Nom de table de la rangée de tirage : rendu SEULEMENT s'il apporte autre chose que ce qui est déjà
 *  à l'écran (titre de fenêtre, libellé d'étape). Sinon la même phrase se lit trois fois. */
export function tableLineLabel(defLabel: string | undefined, stepLabel: string | undefined, modalTitle: unknown): string {
  const dejaLu = [typeof modalTitle === 'string' ? modalTitle : '', stepLabel ?? ''].map((s) => s.trim().toLowerCase());
  const l = (defLabel ?? stepLabel ?? '').trim();
  return dejaLu.includes(l.toLowerCase()) ? '' : l;
}

/** COQUE d'une étape de cascade : `RollShell` + l'ABANDON de la séquence en cours (`SequenceDef.abandon`),
 *  servi par TOUTE branche d'étape — l'issue est celle que la définition nomme. Un abandon FERMÉ (demandé,
 *  ou manche entamée sans être résolue) reste affiché avec sa raison (`sequenceAbandonEtatOf`). */
function CoqueDEtape(props: ComponentProps<typeof RollShell>): JSX.Element {
  const regler = useGame((s) => s.jetRegler);
  const abandon = useGame(useShallow((s) => sequenceAbandonEtatOf(() => s)));
  const actions: RollAction[] = abandon
    ? [{ key: 'rompre', label: abandon.label, title: abandon.title, onClick: () => regler('cascade', 'abandon', true), ...(abandon.refus !== undefined ? { refus: abandon.refus } : {}) }, ...props.actions]
    : props.actions;
  return <RollShell {...props} actions={actions} />;
}

/**
 * CASCADE de jets SÉQUENTIELS (nuit / voyage) — c'est LA coquille de jet partagée `RollShell`,
 * paramétrée comme `DefenseModal` : plusieurs RANGÉES de jet avec portraits (`RollShell rows`). Chaque
 * étape validée reste FIGÉE avec son jet ET sa CONSÉQUENCE (note de ligne) — on ne perd pas les
 * conséquences en enchaînant. L'étape COURANTE est active (pending → résultat) avec son cycle Chance/
 * +1 DR/Pacte/Résilience ; « Continuer » enchaîne. « Tout lancer » résout d'un coup le reste puis
 * affiche le BILAN (curseur EN FIN) — la modale reste ouverte, « Terminer » ferme. Cascade SUBIE →
 * pas d'« Annuler » / pas d'Échap.
 */
export function CascadeModal() {
  return <CascadeBody />;
}

/** Corps de la cascade — `embedded` (#333) bascule chaque `RollShell` en zone embarquée (sans `Modal`)
 *  pour l'incrustation dans l'écran-hub de voyage. Défaut `false` = modale flottante (inchangé). */
export function CascadeBody({ embedded = false }: { embedded?: boolean } = {}) {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingCascade);
  const identites = useIdentites();
  const batchRoll = useGesteDeJet('jetLancer', 'cascadeEnBande'); // étape « batch » — un Test générique par participant (seam #275 Décision 4 cran 1)
  const batchReroll = useGesteDeJet('jetRelancer', 'cascadeEnBande');
  const batchBonusSL = useGesteDeJet('jetAjouterUnDR', 'cascadeEnBande');
  const batchDarkPact = useGesteDeJet('jetPactiser', 'cascadeEnBande');
  const batchForce = useGesteDeJet('jetForcerLaReussite', 'cascadeEnBande');
  const batchResist = useGesteDeJet('jetResister', 'cascadeEnBande'); // Résistance (Menace) PAR RANGÉE (LDB 10)
  const depenserLaDetermination = useGame((s) => s.depenserLaDetermination); // Détermination PAR RANGÉE (LDB 17 l.59)
  const batchReverse = useGesteDeJet('jetInverser', 'cascadeEnBande'); // Inversion PAR RANGÉE (LDB 12 l.42)
  const roll = useGesteDeJet('jetLancer', 'cascade'); // sans rangée : « Tout lancer » → bilan
  const reroll = useGesteDeJet('jetRelancer', 'cascade');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'cascade');
  const darkPact = useGesteDeJet('jetPactiser', 'cascade');
  const force = useGesteDeJet('jetForcerLaReussite', 'cascade');
  const resistAct = useGesteDeJet('jetResister', 'cascade'); // Résistance (Menace) : auto-succès du talent (LDB 10)
  const reverseAct = useGesteDeJet('jetInverser', 'cascade'); // Inversion (LDB 12 l.42)
  const next = useGesteDeJet('jetValider', 'cascade'); // valider l'étape courante
  const regler = useGame((s) => s.jetRegler); // étape « choix » : l'option retenue ; « quantité » : le nombre saisi
  const tirerLeDe = useGesteDeJet('jetLancer', 'cascadeTirage'); // étape « table » ou « de » (#1508) : tire le dé
  const poserLeDe = useGesteDeJet('jetImposerLeResultat', 'cascadeTirage'); // POSE le dé (champ, ou ligne de table)
  const fermer = useGame((s) => s.fenetreFermer);
  const finish = () => fermer('cascade'); // « Terminer » du bilan
  const attackProps = useAttackJetProps(); // étape-jet d'attaque : rendue dans CETTE coquille (une fenêtre)
  const defenseProps = useDefenseJetProps(); // étape-jet de défense réactive : défense + son Critique dans UNE fenêtre
  const fumbleProps = useFumbleJetProps(); // étape-jet de Maladresse : Tableau des Oups ! dans la MÊME fenêtre
  const testProps = useTestJetProps(); // étape-jet de Test de scène : même coquille, une seule fenêtre
  const extendedProps = useExtendedTestJetProps(); // étape-jet de Test étendu (Rounds cumulés)
  // COOP : une rangée n'est pilotable que par le siège qui possède son acteur — couture
  // `netOwnership.ownsLocal` vue par `useOwns`, lue jamais redécidée ; hook AVANT tout retour anticipé.
  const owns = useOwns();

  // Prêt-à-valider de l'étape COURANTE, abonné : une étape hôte dépend de son slot (`stepReady`, #1765).
  const curReady = useGame((s) => {
    const st = s.pendingCascade?.participants[s.pendingCascade.cursor];
    return !!st && stepReady(st, s);
  });

  if (!p) return null;
  // Étape du cadre (`useFocusEmprunte`) : purpose et id de l'étape, jamais le curseur (`cascade.ts`, `startCascade`).
  const etape = `${p.purpose}:${p.participants[p.cursor]?.id ?? 'bilan'}`;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actorOf = (s: CascadeStep) => (s.actorId ? pool.find((c) => c.id === s.actorId) : undefined);
  /** POUR QUI le dé tombe — écrit UNE fois, servi par les DEUX phases d'une étape à dé NU (branche
   *  `de` avant le lancer, branche `affichage` une fois `de.result` posé). Z1 est la seule surface
   *  qui puisse le dire avant le tirage (une rangée de dé nu n'a pas de portrait), et le nom ne
   *  disparaît pas à l'instant où on lit le résultat et où l'on clique « Terminer ». Une étape à
   *  TABLE n'en prend pas : sa fenêtre pré-tirage ne le dit pas non plus, Z1 changerait de contenu
   *  entre les deux phases. */
  const porteurZ1 = (s: CascadeStep): string | undefined => (s.de ? actorOf(s)?.label : undefined);

  // Base AFFICHÉE + lignes de mod NOMMÉES d'une étape QUI LANCE (`CascadeRollStep` : cible ET libellé
  // de ligne par le TYPE) : le libellé est la COMPÉTENCE lancée (« Résistance », « Calme »…), comme
  // Défense affiche « Attaque »/« Parade » — pas le texte de l'étape (le but vit dans le sous-titre).
  // La `base` d'une étape est NUE quel que soit son producteur (`CascadeStepBase.base`) : rien à
  // défaire ici. Le Soutien (LDB 12) est une ligne de `mods` comme les autres modificateurs
  // circonstanciels NOMMÉS — un malus RAW qui n'est pas une Difficulté se LIT sur la ligne, jamais
  // fondu dans la cible. La Difficulté, elle, n'est PAS un mod (#1072) : elle voyage en donnée de
  // LIGNE (`step.difficulty`).
  const stepLine = (s: CascadeRollStep): { label: string; base: number; mods: ModLine[] } => (
    { label: s.rollLabel, base: s.base ?? s.target, mods: s.mods ?? [] }
  );
  const breakdown = (s: CascadeRollStep, r: CascadeRoll) => {
    const l = stepLine(s);
    // L'ÉCRÊTAGE mesuré à la construction (`step.clamped`) voyage avec la ligne : le réconciliateur
    // le NOMME (« plafond 99 ») au lieu de l'avouer « autres » (#1117).
    // La SECONDE LECTURE (Test combiné) est ÉVALUÉE par le socle (`secondReadOf`) : la modale la
    // transmet, elle ne recompare pas le dé.
    return testBreakdown(l.label, l.base, { roll: r.roll, target: s.target, sl: r.sl, success: r.success, ...(s.clamped ? { clamped: s.clamped } : {}), ...(s.evaluation === 'seuil' ? { seuil: s.verdict } : {}) }, s.difficulty, l.mods, s.easedBy, secondReadOf(s.second, r));
  };
  const pendingOf = (s: CascadeRollStep) => {
    const l = stepLine(s);
    // Pré-jet : la seconde lecture n'a que sa CIBLE à annoncer (aucun dé n'est tombé) — c'est
    // précisément ce qui manquait au joueur, qui ne découvrait le second Test qu'en le ratant.
    return testPending(l.label, l.base, s.target != null ? cibleMesuree({ target: s.target, clamped: s.clamped }) : undefined, s.difficulty, l.mods, s.easedBy, s.second ? { ...s.second } : undefined);
  };
  /** Étape qui LANCE — la ligne de jet n'existe que là (les étapes d'affichage/choix/table/batch
   *  n'ont ni cible ni libellé de ligne : elles se rendent par leur note). */
  const isRollStep = (s: CascadeStep): s is CascadeRollStep => s.target != null;
  // Conséquence (issue style journal) d'une étape — rendue sous le jet, elle PERSISTE quand on
  // enchaîne (« on ne perd pas les conséquences »). Une étape VALIDÉE porte sa conséquence RÉELLE
  // chiffrée dans `outcome` (lignes STRUCTURÉES #349 : « récupère 8 PB », « contracte : Vérole… »,
  // déjà tonées par leur `Consequence` d'origine, `rollSeam.resultLines`) → rendu par le renderer
  // PARTAGÉ (`RecapLineList`, `ui/RecapLine.tsx`), MÊME brique que `TravelDayBody`/`dayCardSummary`.
  // `cons` vide (#295 Décision 1b) ⇒ rien à noter : la rangée ✓/✗ ±DR (breakdown, ci-dessous) porte
  // SEULE le verdict — aucun repli « X réussit »/« X échoue ».
  const noteFor = (s: CascadeStep): ReactNode => {
    if (!s.outcome?.length) return undefined;
    return <RecapLineList lines={s.outcome} />;
  };
  /** Ligne de TIRAGE d'une étape à table résolue — dé, opération et ligne atteinte, même présentation
   *  qu'en fenêtre (`TableRollLine`). C'est ce qui rend un tirage LISIBLE au bilan. */
  const tableLineOf = (s: CascadeStep): ReactNode => {
    // DÉ NU (#1508) : MÊME rangée, même anatomie — le libellé dit ce qui se tire et avec quels dés,
    // le « résultat » est le TOTAL avec son unité. Aucune primitive neuve : c'est un tirage.
    const d = s.de?.result;
    if (d) return <TableRollLine table={libelleDuDe(s)} roll={d.roll} die={d.total} mod={s.de!.mod ?? 0} result={lectureDuTotal(s, d.total)} />;
    const r = s.table?.result;
    if (!r) return undefined;
    return (
      <TableRollLine
        table={tableLineLabel(libelleDeTable(s), s.label, p.title)}
        roll={r.roll} die={r.die} mod={s.table!.mod ?? 0} result={r.lines[0] ?? ''}
      />
    );
  };
  const rowOf = (s: CascadeStep): PanelRow | null => {
    const a = actorOf(s);
    // Étape BATCH committée : sa conséquence (resultLine, #331) se lit SUR PLACE — note SEULE (pas de
    // RollLine mono factice `base 0` : le batch n'a ni acteur ni cible d'étape, le verdict est agrégé).
    if (s.participants) return s.outcome?.length ? { combatant: a, note: noteFor(s) } : null;
    const refus = refusSansJet(s);
    if (refus != null) return { combatant: a, note: <>{refus}{noteFor(s)}</> };
    if (estJete(s.result) && isRollStep(s)) return { combatant: a, d: breakdown(s, s.result), note: noteFor(s) }; // jet validé
    // TIRAGE SUR TABLE committé : le dé A ÉTÉ jeté — la rangée existe même sans conséquence écrite,
    // sinon l'étape DISPARAÎT du bilan (une table que le socle a résolue d'office pour un porteur
    // qu'aucun siège ne tient n'aurait alors jamais été vue, #1426).
    const tl = tableLineOf(s);
    if (tl) return { combatant: a, note: <>{tl}{noteFor(s)}</> };
    if (s.outcome?.length) return { combatant: a, note: noteFor(s) }; // affichage/choix validé : note seule
    return null;
  };
  // Un panneau figé (`PanelRow` : breakdown + note) → rangées TÉMOINS du shell (constructeur
  // `witnessRow` : lecture seule, jet déjà subi). Source unique de la conversion « pile figée → rangées ».
  const witnessRows = (panelRows: PanelRow[], fixedMark = false): BuiltRollRow[] =>
    panelRows.map((r, i) => witnessRow({ key: i, row: r, fixedMark }));
  // Note de conséquence d'une rangée-participant (batch) : `part.outcome` (lignes STRUCTURÉES #349)
  // porte l'attribution par le portrait (pas de note agrégée à l'étape) — MÊME renderer partagé.
  const partNote = (part: Pick<BatchParticipant, 'outcome'>): ReactNode => {
    if (!part.outcome?.length) return undefined;
    return <RecapLineList lines={part.outcome} />;
  };
  // Rangées TÉMOINS d'un pas VALIDÉ (pile persistante) — un pas BATCH est DÉPLIÉ en une rangée par
  // participant (breakdown + sa note + sa barre de Test étendu PERSISTANTE) ; les autres pas → une rangée.
  const stepWitnessRows = (s: CascadeStep): BuiltRollRow[] => {
    if (s.participants) {
      return s.participants.flatMap((part) => {
        const a = pool.find((c) => c.id === part.id);
        if (!a) return [];
        const res = estJete(part.result) ? part.result : null;
        // La rangée FIGÉE garde sa seconde lecture : ce que la bande a tranché reste lisible au bilan.
        const d = res ? { label: part.label ?? a.label, base: part.base, mods: part.mods, ...(part.difficulty ? { difficulty: part.difficulty } : {}), ...(part.clamped ? { clamped: part.clamped } : {}), modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl, ...(part.second ? { second: secondReadOf(part.second, res)! } : {}) } : undefined;
        const extendedDr = cumulEtenduDeRangee(part, s.participants!);
        return [witnessRow({ key: witnessRowKey(s.id, part.id), row: { combatant: a, d, note: refusSansJet(part) ?? partNote(part) }, extendedDr })];
      });
    }
    const pr = rowOf(s);
    if (!pr) return [];
    // `fixedMark` : le dé de l'étape a été SAISI (option « Dés fixés ») — la marque suit le jet dans la
    // pile figée comme dans le journal (`step.fixed`, écrit par la fabrique de flux ou le mode table).
    return [witnessRow({ key: witnessRowKey(s.id), row: pr, fixedMark: !!s.fixed })];
  };

  // Nombre de JETS DE DÉ réels (arbitrage user 2026-07-11) : un pas BATCH = ses N rangées ; un pas-jet
  // = 1 ; l'agrégation / la météo / les affichages = 0. Sert au « Bilan · N jets » et à « jet N/M ».
  const diceOf = (s: CascadeStep) => (s.participants ? s.participants.length : s.target != null || s.jet || s.table ? 1 : 0);
  const totalJets = p.participants.reduce((n, s) => n + diceOf(s), 0);

  // BILAN « Tout lancer » : curseur EN FIN — toutes les étapes résolues, chaque conséquence visible.
  // Un seul bouton « Terminer » (ferme + enchaîne la suite). Pas d'influence (jets déjà subis).
  // TITRE NEUTRE (arbitrage user 2026-08-06, #1117 : « Neutre "Bilan" ») : le récap couvre TOUS les
  // pas, il ne peut pas emprunter le nom d'un seul d'entre eux. Le compte de jets reste au
  // sous-titre, qui ne redit donc plus le mot du titre.
  if (p.cursor >= p.participants.length) {
    return (
      <RollShell
        title={<><Icon id={p.icon || 'navigation/des'} size="sm" /> Bilan</>}
        subtitle={<>{totalJets} jet{totalJets > 1 ? 's' : ''}</>}
        rolled
        rows={p.participants.flatMap(stepWitnessRows)}
        actions={[{ key: 'terminer', label: t('verbe.cascade.fermer'), onClick: () => finish() }]}
        embedded={embedded} etape={etape}
      />
    );
  }

  const cur = p.participants[p.cursor];
  if (!cur) return null;
  // ENJEU (#331/#1117) : ce que le jet de l'étape COURANTE met en jeu, ÉNONCÉ sous le titre AVANT le
  // jet (le mécanisme est déjà dans l'applier — cf. « on ne sait ni à quoi ça correspond »). L'étape
  // ne porte qu'une RÉFÉRENCE de donnée : la coquille `RollShell` la résout et rend la PHRASE
  // (`StakeNote`, zone Z3b, classe propriétaire `.rm-stake`).
  // Le RENVOI, lui, vit sur la LIGNE DE TITRE (arbitrage user 2026-08-06) : affordance compacte
  // accolée au libellé d'étape, pas un lien textuel sous la phrase. Sa cible se DÉRIVE de la même
  // entrée d'enjeu (`resolveStake`) ; une étape de CHOIX, sans enjeu, garde son `stakeRule` propre.
  const stakeProps = cur.stake ? { stake: cur.stake } : {};
  const stakeRule = (cur.stake ? resolveStake(cur.stake).rule : undefined) ?? cur.stakeRule;
  // TITRE = le pas COURANT (arbitrage user 2026-08-06, #1117). Une séquence APPEND (`pushStep`,
  // `noyau/cascade.ts`) et n'écrit son `title` qu'à la CRÉATION : la fenêtre resterait titrée par le
  // PREMIER pas pendant qu'on en joue un autre. Dérivation au RENDU (aucune écriture d'état) ; repli
  // sur le titre de séquence pour un pas sans libellé. Le titre porte l'icône du pas COURANT (elle
  // suit le même curseur) et le renvoi de règle, accolé au libellé d'étape (arbitrage user
  // 2026-08-06 : « Je pensais que tu allais mettre un "i" a coté de "Cauchemars" ») — même
  // déclencheur-icône que la barre d'action (`CodexRef` + glyphe `journal/information`), jamais un lien
  // textuel sous la phrase d'enjeu. La nuance de #1078 tient : les CHIPS restent leurs propres
  // portes (aucun ⓘ voisin) — ceci ne vaut que pour la ligne de TITRE. Le sous-titre, lui, ne garde
  // que la position (« jet N/M »).
  const modalTitle = mdToText(nommer(cur.label ?? p.title, identites));
  const titleNode = (
    <>
      <Icon id={cur.icon || p.icon || 'navigation/des'} size="sm" /> {modalTitle}
      {cur.label && stakeRule ? <StakeRule rule={stakeRule} /> : null}
    </>
  );
  // ENCADRÉ « Réussite / Échec » en régime CALCULÉ (#1117) : les deux fabriques d'étape
  // `testDeclenche` (`noyau/combat/triggeredTest.ts`) SÉRIALISENT déjà les Flows de branche dans le
  // `meta` — l'encadré se DÉRIVE donc de leurs ops effectives (`branchCertainOps` → `GameOpChips`),
  // règles optionnelles comprises, au lieu d'être une phrase stockée qui mentirait dès qu'une option
  // change le comportement. Rendu SEULEMENT quand au moins une branche est certaine.
  // Le repli des Conditions se fait contre le combattant de l'étape (et son référent `casterId`) :
  // une branche gardée par un `if` d'appartenance a une réponse POUR LUI. Une fois le jet tranché
  // (`cur.result`), le MÊME encadré se filtre à la branche réalisée : c'est le verdict, et il est
  // structurellement le même objet que la promesse d'avant le jet.
  const stepActor = actorOf(cur);
  const referent = referentDeLEtape(cur);
  const stepCaster = referent ? pool.find((c) => c.id === referent) : undefined;
  const outcomeNote = (
    <OutcomeNote
      onSuccess={branchCertainOps(cur.meta?.onSuccess, stepActor, stepCaster)}
      onFail={branchCertainOps(cur.meta?.onFail, stepActor, stepCaster)}
      onSuccessBy={branchBlockingEntity(cur.meta?.onSuccess, stepActor, stepCaster)}
      onFailBy={branchBlockingEntity(cur.meta?.onFail, stepActor, stepCaster)}
      {...(cur.result ? { realized: cur.result.success ? ('reussite' as const) : ('echec' as const), sl: cur.result.sl } : {})}
    />
  );
  // Le MÊME encadré, pour UNE RANGÉE d'une bande (étape BATCH) : la promesse et le verdict sont
  // PAR PARTICIPANT (chaque rangée gagne ou perd son propre jet), et se replient contre SON acteur.
  const rowOutcomeNote = (partId: string, res: CascadeRoll | null) => (
    <OutcomeNote
      onSuccess={branchCertainOps(cur.meta?.onSuccess, pool.find((c) => c.id === partId), stepCaster)}
      onFail={branchCertainOps(cur.meta?.onFail, pool.find((c) => c.id === partId), stepCaster)}
      onSuccessBy={branchBlockingEntity(cur.meta?.onSuccess, pool.find((c) => c.id === partId), stepCaster)}
      onFailBy={branchBlockingEntity(cur.meta?.onFail, pool.find((c) => c.id === partId), stepCaster)}
      {...(res ? { realized: res.success ? ('reussite' as const) : ('echec' as const), sl: res.sl } : {})}
    />
  );
  // Test OPPOSÉ (#579/#990) : le jet ADVERSAIRE FIGÉ (`meta.opposed.aT`) est une rangée TÉMOIN, masquée
  // tant que ce siège n'a pas répondu. Il vaut pour l'étape ENTIÈRE — une bande de N défenseurs
  // s'oppose à un SEUL jet (LDB 13 l.77), donc la rangée est la MÊME et se pose EN TÊTE, une fois.
  const opp = cur.meta?.opposed;
  const oppActor = opp?.attackerId ? pool.find((c) => c.id === opp.attackerId) : undefined;
  // CE QUE TESTE l'adversaire s'ÉCRIT ICI, jamais au flux — et par la SOURCE UNIQUE partagée avec la
  // ligne de JOURNAL (`opposedAttackerLabel`, `rollSeam`) : le libellé AUTHORÉ d'abord (l'alternative
  // qu'aucune structure ne porte), la STRUCTURE figée au catalogue ensuite.
  const oppTestLabel = opposedAttackerLabel(opp);
  const oppRow: BuiltRollRow | null = opp ? {
    key: 'opposed-attacker',
    ...frozenOpposedRow({
      revele: jetFigeRevele(useGame.getState(), JET_FIGE.cascade(cur)),
      row: {
        combatant: oppActor,
        // Ligne d'un Test OPPOSÉ : Difficulté déclarée UNE fois à la fabrique (LDB 12 l.166) — celle
        // de l'opposition, portée par le freeze, donc LUE des deux côtés (le camp qui a pré-jeté
        // l'affichait « Intermédiaire » par défaut tant qu'elle ne voyageait pas). Base NUE de
        // l'attaquant (`aT.base`) pour que le modificateur de Difficulté se lise sur la ligne.
        ...opposedLines([{
          label: libelleDuJetFige(opp),
          base: opp.aT.base ?? opp.aT.target,
          r: { roll: opp.aT.roll, target: opp.aT.target, sl: opp.aT.sl, success: opp.aT.success },
        }], opp.difficulty)[0],
      },
    }),
  } : null;
  // ÉTAPE-JET : REGISTRE data-driven du rendu par TYPE de jet (ajouter un type = 1 entrée ici). Les
  // cinq jets RollShell (attaque/défense/Maladresse/Test/Test étendu) sont rendus via leur hook de
  // props dans la MÊME coquille restée montée → jet ET conséquences vivent dans UNE fenêtre jusqu'à
  // « Terminer » (leur `jetValider(flux)` enchaîne le curseur / ferme la cascade). Les hooks de props
  // sont appelés INCONDITIONNELLEMENT au top-level (le registre ne mappe que le RENDU). Trois cas
  // BESPOKE (non-RollShell) rendent leur propre modale : désengagement (menu 3 phases, choix d'abord),
  // enfoncement de porte (multi PARALLÈLE, rangées par participant), incantation (`CastModal` — s'efface
  // pendant un ciblage CARTE (pickingTargets / pose de zone) pour déférer à la carte).
  //
  // ENJEU d'une étape HÔTE (#1117 / #1262 V2 L6c) : il est posé sur l'ÉTAPE par son mint
  // (`hostStep`), pas sur le `pending*` — un hook de props ne peut donc pas le connaître, et sans ce
  // relais la zone Z3b reste VIDE pour TOUT jet hôté (recette : le jet de scène de la dalle piégée
  // ouvrait sa fenêtre sans jamais dire ce qu'il mettait en jeu, l'enjeu authoré pourtant présent sur
  // l'étape). Il est donc versé ICI, à la coquille, pour les six rendus `RollShell` — spread AVANT
  // les props du hook : celui qui porte DÉJÀ son enjeu (Test étendu, dont le pending le transporte)
  // garde le sien, sans jamais deux `StakeNote`.
  const JET_RENDERERS: Record<NonNullable<CascadeStep['jet']>, () => JSX.Element> = {
    attaque: () => <CoqueDEtape {...stakeProps} {...attackProps!} embedded={embedded} etape={etape} />,
    defense: () => <CoqueDEtape {...stakeProps} {...defenseProps!} embedded={embedded} etape={etape} />,
    maladresse: () => <CoqueDEtape {...stakeProps} {...fumbleProps!} embedded={embedded} etape={etape} />,
    test: () => <CoqueDEtape {...stakeProps} {...testProps!} embedded={embedded} etape={etape} />,
    testEtendu: () => <CoqueDEtape {...stakeProps} {...extendedProps!} embedded={embedded} etape={etape} />,
    desengagement: () => <DisengageModal />,
    enfoncerLaPorte: () => <ForceDoorModal />,
    incantation: () => <CastModal />,
  };
  // ÉTAPE-JET : le rendu est INCONDITIONNEL (#1852) — ce que garantissent DEUX portes en amont, et
  // elles seules : le socle refuse de poser le curseur sur un hôte qui n'a pas de quoi rendre un corps
  // (`cascade.poserLeCurseur` → `slotsDeJet.hoteOrphelin`, prédicat TOTAL : slot, acteurs, donnée
  // d'étape), et l'effacement VOULU de l'incantation pendant un ciblage CARTE est une condition
  // d'élection de l'ARBITRE (`modalArbiter`, entrée `cascade`).
  if (cur.jet) return JET_RENDERERS[cur.jet]();
  const interaction = stepInteraction(cur);
  const isLast = p.cursor + 1 >= p.participants.length;
  // CORPS PURGÉ PAR ÉTAPE (arbitrage user 2026-08-09) : la fenêtre d'une étape COURANTE ne rend QUE
  // SES rangées — les étapes déjà validées quittent le corps avec leurs verdicts. Une séquence pose
  // une question à la fois ; garder les rangées d'avant faisait lire des issues d'« Animosité » sous
  // un titre « Haine ». La mémoire du joueur est portée par le JOURNAL (chaque conséquence y est
  // écrite par `commitStep`) et par le BILAN de fin de séquence, qui rend TOUTES les étapes.
  // Action « Continuer » / « Terminer » (dernière étape) — bouton primaire d'enchaînement, partagé par
  // les étapes AFFICHAGE, QUANTITÉ et CHOIX (conséquences pures, aucun jet à attendre) : sans `verbe`, donc jamais fermé par un flux ;
  // l'étape BATCH ne le sert qu'une fois ses rangées lancées (`ready`).
  // Un CHOIX non tranché ne se valide pas (`stepReady`) : l'action est REFUSÉE et dit pourquoi
  // (`RollAction.refus` → `GatedAction`), jamais un primaire actif qui ne fait rien.
  const continueAction: RollAction = {
    key: 'poursuivre', label: isLast ? t('verbe.cascade.fermer') : t('verbe.cascade.valider'), onClick: () => next(),
    ...(curReady ? {} : { refus: 'Choisis une option pour continuer.' }),
  };

  // AFFORDANCES DE POSE du dé d'une étape (#942 L3, généralisées aux deux lectures en #1508) — une
  // seule sémantique (POSER LE DÉ) : le champ « Fixer le dé » (sélecteur dérivé par la COUTURE UNIQUE
  // `stepForcedDie` — gate `canFixDie`, borne = les dés déclarés, valeur ré-éditable) et, POUR UNE
  // TABLE SEULEMENT, la grille des LIGNES (clic = le dé naturel qui atteint cette ligne, `mod` compris
  // — sinon la ligne cliquée glisserait sous le modificateur ; un dé NU n'a pas de ligne à viser).
  // Servies AVANT le tirage comme APRÈS (l'étape passe alors en interaction `'affichage'`) : un dé
  // posé se corrige, il ne se subit pas.
  const affordancesDuDe = (s: CascadeStep): { rows: BuiltRollRow[]; lines: ReactNode } => {
    // UN SEUL sélecteur pour les DEUX porteurs de dé (#1508) : la couture (`stepForcedDie`) lit
    // `step.de ?? step.table`, seul le délégué d'écriture diffère.
    const die = stepForcedDie(useGame.getState(), s, (r) => poserLeDe(r, s.id));
    if (!die.forcedRoll) return { rows: [], lines: null };
    // Rangée porteuse du SEUL sélecteur — constructeur `tableRow` (ni cible ni DR à pré-afficher,
    // aucun `onRoll` : ni bouton de rangée, ni « Lancer » hissé, ni cycle d'influence).
    const rows = [tableRow({ key: `${s.id}:die`, row: { combatant: actorOf(s) }, forcedRoll: die.forcedRoll, fixedMark: die.fixedMark })];
    // DÉ NU : aucune grille de lignes — il n'y a pas de table où choisir, le total EST la conséquence.
    if (s.de) return { rows, lines: null };
    // La déclaration servie à l'écran est celle qui TIRERA (`liveTableDecl` : modificateur vivant) —
    // une grille calculée sur un `mod` périmé ferait glisser la ligne cliquée.
    const decl = s.table && liveTableDecl(useGame.getState(), s);
    if (!decl) return { rows: [], lines: null };
    const mod = decl.mod ?? 0;
    const dieMax = tableStepNaturalRange(decl).max;
    const options: RollGridOption[] = (tableStepDef(decl.tableId)?.rows ?? []).map((r) => {
      const nat = naturalRollForTableRow(decl, r);
      return {
        key: r.id,
        /* La FOURCHETTE est portée par la tuile, libellé ou pas : c'est ce qui fait lire une table
           d100 (« Corps 01-50 / Esprit 51-100 ») au lieu d'un choix binaire libre. */
        label: r.label ?? '',
        range: fourchette(r.min, r.max, dieMax),
        disabled: nat == null,
        selected: decl.result?.id === r.id, // ligne ÉLUE = état ferré (aria-pressed), pas un simple style
        /* Refus MUTUALISÉ : les N lignes hors d'atteinte le sont par la MÊME cause (le modificateur),
           déjà énoncée une fois sous la grille — forme `reasonId` de `GatedAction`, l'unique grammaire
           de refus de la primitive. Elles portent ainsi `aria-disabled`, donc le focus clavier/manette
           et le tap. */
        ...(nat == null ? { refusId: `${s.id}-unreachable` } : {}),
        title: nat == null ? undefined
          : `Poser le dé à ${nat}${mod !== 0 ? ` (dé effectif ${nat + mod})` : ''}`,
        onSelect: nat == null ? undefined : () => poserLeDe(nat, s.id),
      };
    });
    const unreachable = options.filter((o) => o.disabled).length;
    return {
      rows,
      lines: (
        <>
          <OptionChooser layout="grid" groupLabel="Choisir la ligne" options={options} idPrefix={`${s.id}-ligne`} />
          {/* La RAISON du grisage se lit à l'écran — une seule fois pour toutes les lignes qu'elle
              éteint, et les options s'y LIENT (`refusId`). C'est le cas STRUCTURANT que `GatedAction`
              nomme (`raisonInline`/`reasonId`) : ici le refus est ce que la grille a à dire, et le
              récapitulatif reste plus lisible que N infobulles identiques. */}
          {unreachable > 0 && (
            <p className="hint" id={`${s.id}-unreachable`}>
              {unreachable} ligne{unreachable > 1 ? 's' : ''} grisée{unreachable > 1 ? 's' : ''} : hors d'atteinte{mod !== 0 ? ` avec le modificateur ${mod > 0 ? '+' : '−'}${Math.abs(mod)}` : ''} (dé de 1 à {dieMax}).
            </p>
          )}
        </>
      ),
    };
  };

  // TABLE (#942 L2) : dé NON JETÉ sur le tableau déclaré (`cur.table`) — bouton de jet
  // standard, la rangée `TableRollLine` annonce SUR QUOI on tire (le résultat s'y inscrira). Le tirage
  // naturel reste le DÉFAUT : les affordances de pose (#942 L3) s'ajoutent, ne remplacent rien.
  if (interaction === 'table') {
    const aff = affordancesDuDe(cur);
    const tableActions: RollAction[] = [
      { key: 'lancer', label: <><Icon id="navigation/des" size="sm" /> Lancer</>, onClick: () => tirerLeDe(cur.id) },
      ...(!isLast ? [{ key: 'toutResoudre', label: <><Icon id="navigation/des" size="sm" /> Tout lancer</>, onClick: () => roll(), title: "Résoudre d'un coup tous les jets restants (sans influence)" } as RollAction] : []),
    ];
    return (
      <CoqueDEtape
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        rolled={false}
        rows={aff.rows}
        extra={<TableRollLine table={tableLineLabel(libelleDeTable(cur), cur.label, modalTitle)} />}
        setup={aff.lines}
        actions={tableActions}
        disableEscClose
        embedded={embedded} etape={etape}
      />
    );
  }

  // DÉ NU (#1508) : dé NON JETÉ dont le TOTAL fera la conséquence — CALQUE de la branche `'table'`
  // ci-dessus SANS sa grille de lignes (il n'y a pas de table où choisir). Même coquille, même bouton
  // « Lancer », même sélecteur de pose : un dé de la porte, pas une fenêtre de plus.
  if (interaction === 'de') {
    const aff = affordancesDuDe(cur);
    // CE QU'ON JOUE, AVANT DE LANCER : le SEUIL dans la cellule centrale de la rangée — exactement là
    // où une rangée de Test pré-jet dit « contre quoi » (`RollCalc`, `RollLine.PendingRollLine`) — et le
    // PORTEUR en Z1. La fenêtre annonce le seuil et le porteur AVANT le lancer : la donnée est sur
    // l'étape dès sa déclaration (`rollSeam.dieStep`).
    const dieActions: RollAction[] = [
      { key: 'lancer', label: <><Icon id="navigation/des" size="sm" /> Lancer</>, onClick: () => tirerLeDe(cur.id) },
      ...(!isLast ? [{ key: 'toutResoudre', label: <><Icon id="navigation/des" size="sm" /> Tout lancer</>, onClick: () => roll(), title: "Résoudre d'un coup tous les jets restants (sans influence)" } as RollAction] : []),
    ];
    return (
      <CoqueDEtape
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length }, porteurZ1(cur))}
        rolled={false}
        rows={aff.rows}
        extra={<TableRollLine table={libelleDuDe(cur)} result={cur.de?.seuil ? `≥ ${libelleDuSeuil(cur.de.seuil)}` : undefined} />}
        actions={dieActions}
        disableEscClose
        embedded={embedded} etape={etape}
      />
    );
  }

  // AFFICHAGE : conséquence pure — pas de jet, pas d'influence. Charge RICHE (`reveal` : Coup Critique,
  // entretien de Round, mutation, effet d'auteur, entrée de zone) → panneau partagé `RevealBody`, routé
  // par `kind` ; sinon contenu pré-posé (`outcome`) en note. TABLE déjà tirée (`table.result`) → la
  // rangée `TableRollLine` (dé + ligne atteinte) puis le reste des lignes de l'entrée : même
  // présentation canonique que la Maladresse et les révélations.
  if (interaction === 'affichage') {
    const rev = cur.reveal;
    if (rev) {
      const revActor = rev.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
      const revSubject = rev.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
      return (
        <CoqueDEtape
          title={titleNode}
          subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
          rolled
          /* Le CONCERNÉ (`RevealEntry.subjectId`) porte son portrait EN TÊTE de l'étape : on sait
             toujours à qui la révélation s'applique. Le Coup Critique le rend déjà dans son en-tête
             A→B (`CriticalBody`) — une seule surface, jamais deux portraits du même sujet. */
          extra={revSubject && rev.kind !== 'critique' ? <ModalSubject c={revSubject} /> : undefined}
          rows={[]}
          postRollExtra={<RevealBody entry={rev} actor={revActor} subject={revSubject} />}
          actions={[continueAction]}
          disableEscClose
          embedded={embedded} etape={etape}
        />
      );
    }
    const tbl = cur.table?.result;
    // Étape à TABLE déjà tirée : les affordances de POSE restent servies tant que l'étape est
    // COURANTE (le dé se re-pose, la ligne se re-choisit) — le tirage n'est pas un aller sans retour.
    const aff = affordancesDuDe(cur);
    return (
      <CoqueDEtape
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length }, porteurZ1(cur))}
        rolled
        /* La marque « dé fixé » n'a qu'UNE surface : l'étiquette du sélecteur quand il est servi,
           la pastille de rangée sinon (siège voisin, option éteinte). */
        rows={[...witnessRows([{ combatant: actorOf(cur), note: noteFor(cur) }], !!cur.fixed && !aff.rows.length), ...aff.rows]}
        /* `extra` est la zone STABLE de l'étape à table : l'état AVANT tirage la sert déjà (branche
           `table` ci-dessus), celui-ci l'ÉPAISSIT du résultat. Une zone stable qui grossit respecte
           l'invariant de géométrie (`docs/charte-ui.md` § « Invariant de GÉOMÉTRIE d'une fenêtre de
           jet ») — c'est `postRollExtra` qui en ferait une zone à présence dépendante de la phase. */
        /* VALEUR EN TÊTE : la rangée de tirage (dé + opération + ligne atteinte) est le PREMIER
           contenu de l'étape résolue — c'est le verdict, il ne se cherche pas sous une grille. */
        extra={tbl ? (
          <>
            <TableRollLine table={tableLineLabel(libelleDeTable(cur), cur.label, modalTitle)} roll={tbl.roll} die={tbl.die} mod={cur.table!.mod ?? 0} result={tbl.lines[0] ?? ''} />
            {tbl.lines.slice(1).map((l, i) => <p key={i} className="modal-log">{l}</p>)}
            {aff.lines}
          </>
        ) : cur.de?.result ? (
          /* DÉ NU résolu (#1508) : même zone STABLE, même rangée — le total (avec son unité) est le
             verdict, et la pose reste servie tant que l'étape est courante. */
          <>{tableLineOf(cur)}{aff.lines}</>
        ) : undefined}
        actions={[continueAction]}
        disableEscClose
        embedded={embedded} etape={etape}
      />
    );
  }

  // QUANTITÉ (#1279 Sf) : le joueur POSE un nombre dans la plage déclarée — pas de jet, pas
  // d'influence. Le compteur est la primitive canonique (`QtyStepper`), doublée du champ de saisie
  // qui la rend atteignable au clavier et d'un coup pour les grandes plages : d'un bout à l'autre
  // d'un 1..100, cliquer 99 fois n'est pas une affordance. Les bornes se LISENT (une flèche éteinte
  // sans raison est une affordance morte).
  if (interaction === 'quantite') {
    const q = cur.quantity!;
    const n = cur.amount ?? q.min;
    return (
      <CoqueDEtape
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        rolled
        rows={[]}
        extra={<SequencePanel />}
        postRollExtra={
          <>
            {cur.outcome?.length ? <RecapLineList lines={cur.outcome} /> : null}
            <NumberField
              id={`${cur.id}-amount`}
              label={cur.label ?? ''}
              min={q.min}
              max={q.max}
              value={n}
              {...(q.step != null ? { step: q.step } : {})}
              {...(q.unit ? { unit: q.unit } : {})}
              onChange={(v) => regler('cascade', 'quantite', v, cur.id)}
            />
          </>
        }
        actions={[continueAction]}
        disableEscClose
        embedded={embedded} etape={etape}
      />
    );
  }

  // CHOIX : le joueur tranche (l'option pilote la conséquence) — pas de jet, pas d'influence. Une
  // DÉVIATION (P3a) porte le Critique pré-tiré (panneau riche `CriticalBody`). Ce rendu est GÉNÉRIQUE :
  // il ne connaît aucune clé d'option ; l'indisponibilité d'une voie voyage en `refus` depuis son
  // producteur (`OptionChooser`/`GatedAction` l'affichent au survol/focus/tap).
  if (interaction === 'choix') {
    const rev = cur.reveal;
    // UNE SEULE FENÊTRE (#1426) : l'étape a pu porter un TIRAGE avant sa décision (sévérité d'une
    // Blessure critique). Le dé tombé, la MÊME étape offre ses voies — la ligne de tirage reste en
    // TÊTE, zone stable, et les options se prennent dessous. Jamais deux corps successifs.
    const tblChoix = cur.table?.result;
    // … et la POSE du dé reste servie tant que l'étape est COURANTE, exactement comme à la branche
    // `affichage` : le tirage n'est pas un aller sans retour. MÊME délégué (`affordancesDuDe`), donc
    // même sélecteur « Fixer le dé » et même grille de lignes — les voies se prennent dessous.
    const aff = affordancesDuDe(cur);
    const revActor = rev?.actorId ? pool.find((c) => c.id === rev.actorId) : undefined;
    const revSubject = rev?.subjectId ? pool.find((c) => c.id === rev.subjectId) : undefined;
    return (
      <CoqueDEtape
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        rolled
        rows={aff.rows}
        // Un CHOIX d'une séquence se prend DEVANT le score (Middenball : l'option de Test se choisit en
        // sachant où en est la partie) — même tableau de marque que les fenêtres de jet.
        extra={tblChoix ? (
          <>
            <TableRollLine table={tableLineLabel(libelleDeTable(cur), cur.label, modalTitle)} roll={tblChoix.roll} die={tblChoix.die} mod={cur.table!.mod ?? 0} result={tblChoix.lines[0] ?? ''} />
            {aff.lines}
            <SequencePanel />
          </>
        ) : <SequencePanel />}
        postRollExtra={
          <>
            {rev?.kind === 'critique' && <CriticalBody entry={rev} actor={revActor} subject={revSubject} />}
            {cur.label && <Prose md={cur.label} paquet />}
            {!rev && cur.outcome?.length ? <RecapLineList lines={cur.outcome} /> : null}
            <OptionChooser
              layout="grid"
              groupLabel={cur.label ? mdToText(nommer(cur.label, identites)) : undefined}
              options={(cur.options ?? []).map((o) => ({
                key: o.key, label: mdToText(nommer(o.label, identites)), title: o.detail ? mdToText(o.detail) : undefined,
                ...(o.refus ? { refus: o.refus } : {}),
                selected: cur.chosen === o.key,
                onSelect: () => regler('cascade', 'choix', o.key, cur.id),
              }))}
            />
          </>
        }
        actions={[continueAction]}
        disableEscClose
        embedded={embedded} etape={etape}
      />
    );
  }

  // BATCH : Test d'équipage MULTI (participants — seam de jet #275 Décision 4 cran 1) — patron
  // `ForceDoorModal` (frappe PARALLÈLE) : chaque contributeur lance SON rôle indépendamment, son
  // propre cycle Chance/+1 DR/Pacte/Résilience ; « Continuer » n'agit QUE quand `stepReady` (tous les
  // interactifs ont un `result` — les témoins PNJ, `interactive:false`, ne freinent jamais).
  if (interaction === 'batch') {
    // ANNONCE MUTUALISÉE de la bande (arbitrage user 2026-08-09, en jeu : « "Réussite : rien. / Échec :
    // Surpris" sur chaque ligne de test c'est normal ? ») : une promesse IDENTIQUE répétée sur N rangées
    // est du bruit — à la table, elle s'annonce UNE fois. Les rangées PAS ENCORE jouées qui annoncent la
    // MÊME chose (égalité STRUCTURELLE des ops certaines, `sameCertainOps` — jamais le HTML rendu) sont
    // regroupées : leur bloc monte en tête de bande (zone `extra`, sous l'enjeu) et disparaît de leurs
    // lignes. Restent PAR RANGÉE : (a) une rangée qui DIVERGE avant le jet (porteur de Vigilance : sa
    // branche d'échec est indécidable, donc silencieuse) ; (b) le VERDICT d'une rangée résolue, individuel
    // par nature. Quand toutes les rangées ont joué, l'annonce n'a plus d'objet et s'efface.
    const bandOps = (partId: string) => {
      const a = pool.find((c) => c.id === partId);
      return {
        onSuccess: branchCertainOps(cur.meta?.onSuccess, a, stepCaster), onFail: branchCertainOps(cur.meta?.onFail, a, stepCaster),
        onSuccessBy: branchBlockingEntity(cur.meta?.onSuccess, a, stepCaster), onFailBy: branchBlockingEntity(cur.meta?.onFail, a, stepCaster),
      };
    };
    const groupes: { ops: ReturnType<typeof bandOps>; ids: string[] }[] = [];
    for (const part of cur.participants!.filter((x) => !x.result)) {
      const o = bandOps(part.id);
      const g = groupes.find((x) => sameCertainOps(x.ops.onSuccess, o.onSuccess) && sameCertainOps(x.ops.onFail, o.onFail)
        && sameEntityRef(x.ops.onSuccessBy, o.onSuccessBy) && sameEntityRef(x.ops.onFailBy, o.onFailBy));
      if (g) g.ids.push(part.id); else groupes.push({ ops: o, ids: [part.id] });
    }
    // Le groupe HISSÉ est le plus nombreux, et seulement s'il couvre ≥ 2 rangées : mutualiser une
    // annonce unique la déplacerait loin de sa ligne sans rien économiser.
    const mutualise = groupes.filter((g) => g.ids.length >= 2).sort((a, b) => b.ids.length - a.ids.length)[0];
    const bandNote = mutualise ? <OutcomeNote {...mutualise.ops} /> : null;
    // Rangées-participants via le builder mutualisé (#328) : la modale ne fournit QUE la PRÉSENTATION
    // (label/base/mods déjà résolus à la construction, GÉNÉRIQUES) + son bundle d'actions de flux ; les
    // fenêtres d'influence sont dérivées au rendu par les prédicats du seam.
    // Clés SCOPÉES PAR ÉTAPE (`witnessRowKey`) : la rangée batch COURANTE côtoie les rangées FIGÉES d'un
    // pas batch précédent aux MÊMES participants (Orientation puis Entretien) — sans scope, collision de
    // clé + duplication visuelle. `buildParticipantRows` keye par id nu (correct pour ses 6 autres
    // appelants MONO-étape) ; ici on re-scope au site qui compose plusieurs pas — et l'id RÉEL du
    // participant part alors dans `pid` (le socle résout SON slot par là, jamais par la clé de rendu).
    // Rangées du flux `cascadeEnBande` (la coquille hôte porte la cascade) : `flowKey` de RANGÉE.
    const rows: BuiltRollRow[] = buildParticipantRows(cur.participants!, pool, {
      onRoll: batchRoll, onReroll: batchReroll, onBonusSL: batchBonusSL, onDarkPact: batchDarkPact, onForce: batchForce,
      interactiveOf: (part) => part.interactive !== false && owns(part.id),
      row: (part, actor, res) => {
        const label = part.label ?? actor.label;
        // La rangée batch se lit comme la rangée MONO : base NUE, chips nommées, CIBLE de l'étape et
        // ÉCRÊTAGE mesuré. Sans `target` en pré-jet, la cible affichée se re-dérivait de `base +
        // Difficulté` et divergeait de celle qui sera roulée ; sans `clamped`, le plafond redevenait
        // une chip « autres ».
        // SECONDE LECTURE (Test combiné) : la rangée dit SES deux cibles — évaluée par le socle
        // après le jet, annoncée à sa seule cible avant.
        const second = part.second;
        return res
          ? { combatant: actor, d: { label, base: part.base, mods: part.mods, ...(part.difficulty ? { difficulty: part.difficulty } : {}), ...(part.clamped ? { clamped: part.clamped } : {}), modifier: res.target - part.base, target: res.target, roll: res.roll, success: res.success, sl: res.sl, ...(second ? { second: secondReadOf(second, res)! } : {}) } }
          : { combatant: actor, pending: { label, base: part.base, mods: part.mods ?? [], target: part.target, ...(part.difficulty ? { difficulty: part.difficulty } : {}), ...(part.clamped ? { clamped: part.clamped } : {}), ...(second ? { second: { ...second } } : {}) } };
      },
      // ISSUES de la rangée (#1117) : la MÊME dérivation que l'étape MONO, mais PAR PARTICIPANT — le
      // VERDICT d'une rangée résolue et la promesse d'une rangée DIVERGENTE. Une rangée dont l'annonce est
      // montée en tête de bande n'a plus rien à dire ici : elle se tait plutôt que de répéter.
      issues: (part, _actor, res) => (!res && mutualise?.ids.includes(part.id) ? undefined : rowOutcomeNote(part.id, res)),
      // Test ÉTENDU d'une rangée (cartographie de voyage) : DONNÉE seule — `RollRow` rend la barre (site
      // UNIQUE), visible AVANT et après le jet, persistante (arbitrage user 2026-07-11).
      extendedDrOf: (part) => cumulEtenduDeRangee(part, cur.participants!),
    }).map((r) => {
      // Verbes à RESSOURCE de la rangée (parité avec l'étape MONO, joués PAR RANGÉE — flux `cascadeEnBande`) :
      // Résistance (Menace) sur une rangée TAGUÉE dont l'issue reste défavorable (LDB 10 l.1016-1020) ;
      // Détermination avant le jet sur une bande de Psychologie (LDB 17 l.59), le verbe général
      // `depenserLaDetermination` sur le combattant de la rangée, ouvert par `refusDImmunite`.
      const part = cur.participants!.find((x) => x.id === String(r.key));
      const a = r.actor;
      const ouverts = part ? fermeturesDuFlux(useGame.getState(), 'cascadeEnBande', part.id) : null;
      const resistOk = !!part?.menace && ouverts?.resister === null;
      const determineOk = !!a && !refusDImmunite(useGame.getState(), a);
      // Inversion (LDB 12 l.42) : offre et aperçu sont les verdicts du flux (`FLOWS.cascadeEnBande`).
      const reverseOk = ouverts?.inverser === null;
      return {
        ...r,
        flowKey: 'cascadeEnBande' as const,
        pid: String(r.key),
        key: witnessRowKey(cur.id, String(r.key)),
        ...(resistOk ? { resist: { menace: part!.menace!, onResist: () => batchResist(part!.id) } } : {}),
        ...(determineOk ? { determination: { resolve: a!.resolve ?? 0, onResolve: () => depenserLaDetermination(a!.id, 'immuniserALaPsychologie') } } : {}),
        ...(reverseOk ? { reverse: { onReverse: () => batchReverse(part!.id), preview: FLOWS.cascadeEnBande.reversePreview(useGame.getState, part!.id) } } : {}),
      };
    });
    const ready = curReady;
    // Deux « Tout lancer » (#328) : PAR RANGÉES (lance d'un coup les contributeurs restants de CETTE
    // étape, ≥2 non lancés — mutualisé) et CASCADE (résout d'office tout le reste de la cascade, sans
    // influence — le jet sans rangée, comme la branche jet).
    const rollAllRows = rollAllUnrolledRows(cur.participants!, batchRoll, (x) => x.interactive !== false && owns(x.id));
    const batchActions: RollAction[] = [
      ...(rollAllRows ? [{ key: 'lancerMesRangees', label: <><Icon id="navigation/des" size="sm" /> Tout lancer</>, onClick: rollAllRows, title: 'Lancer toutes MES rangées non encore lancées (les rangées d’un autre siège lui restent)' } as RollAction] : []),
      ...(!isLast ? [{ key: 'toutResoudre', label: <><Icon id="navigation/des" size="sm" /> {t('verbe.cascade.lancerAll')}</>, onClick: () => roll(), title: "Résoudre d'un coup tous les jets restants de la cascade (sans influence)" } as RollAction] : []),
      ...(ready ? [continueAction] : []),
    ];
    return (
      <CoqueDEtape
        title={titleNode}
        subtitle={stepSubtitle({ cursor: p.cursor, total: p.participants.length })}
        {...stakeProps}
        extra={<><SequencePanel />{bandNote}</>}
        rolled={ready}
        rows={[...(oppRow ? [oppRow] : []), ...rows]}
        actions={batchActions}
        disableEscClose
        embedded={embedded} etape={etape}
      />
    );
  }

  // JET : étape influençable (comportement historique — requiert l'acteur) OU étape MONDIALE
  // (`worldOwner`, seam #275 Décision 3 — désertion/Moral) : aucun acteur PRÉSENTABLE par
  // conception, l'ownership est déjà routée en amont (sentinel `WORLD_STEP_OWNER`, ne pas y
  // toucher ICI) — rendu générique (titre = `cur.label` déjà composé par le seam, pas de portrait).
  const actor = actorOf(cur);
  if (!jetStepPresentable(cur, actor)) return null;
  const res = cur.result;
  const rolled = cur.target == null ? true : !!res;
  const curPending: PanelRow = { combatant: actor, ...(isRollStep(cur) ? { pending: pendingOf(cur) } : {}) };
  // `outcome` (résumé de conséquence) n'existe que sur une étape COMMITTÉE ; l'étape COURANTE
  // s'appuie sur la rangée ✓/✗ ±DR (breakdown) comme SEUL verdict (#295 Décision 1b) : aucun
  // prologue « X réussit »/« X échoue » ici.
  // Résistance (Menace), LDB 10 l.1020 : la fenêtre est le verbe `resister` du flux.
  const resistAvail = cur.menace != null && !fermeturesDuFlux(useGame.getState(), 'cascade', cur.id).resister;

  // En-tête A→B du Test opposé : il n'existe QUE pour un défenseur unique (une bande n'a pas de « B »
  // — chaque rangée porte son portrait, la rangée témoin porte l'attaquant).
  const oppHeader = opp && oppActor && actor ? <VsHeader actor={oppActor} target={actor} label={oppTestLabel} /> : null;

  // Rangée INTERACTIVE de l'étape COURANTE : pré-jet en attente puis résultat, porteuse du cycle
  // d'influence (Chance/+1 DR/Pacte/Résilience/forcedRoll/resist) — étape MONDIALE (`worldOwner`,
  // `actor` absent) : cycle d'influence NUL (Chance/Pacte/Résilience sont des ressources de HÉROS),
  // seul « Lancer » reste actionnable pour le siège owner.
  // Chance / relance gratuite / Résilience ne sont PAS recopiées ici : `RollRow`/`InfluenceRow` les
  // DÉRIVENT de `actor` (site unique). `rolled` est dérivé par le noyau du dé de la ligne (`row.d`) —
  // identique à la phase de l'étape, une étape-JET portant toujours sa cible (`stepInteraction`).
  const curRow: BuiltRollRow = rangeeSansJet(cur.id, actor, cur) ?? buildRollRow(
    {
      actor,
      row: estJete(res) && isRollStep(cur) ? { combatant: actor, d: breakdown(cur, res) } : curPending,
      onRoll: () => roll(cur.id),
      rerolled: !!cur.rerolled,
      onReroll: () => reroll(cur.id),
      onBonusSL: () => bonusSL(cur.id),
      onDarkPact: () => darkPact(cur.id),
      onForce: () => force(cur.id),
    },
    {
      // Étape COURANTE du flux `cascade` : `key` = son id de slot → `RollShell` dérive le sélecteur
      // de dé sur la BONNE étape (la coquille n'a pas de `flowKey` propre).
      flowKey: 'cascade',
      key: cur.id,
      resist: resistAvail ? { menace: cur.menace!, onResist: () => resistAct(cur.id) } : undefined,
      // Inversion (LDB 12 l.42) : offre et aperçu sont les verdicts du flux (`FLOWS.cascade`).
      reverse: FLOWS.cascade.reverseAvailable(useGame.getState, cur.id)
        ? { onReverse: () => reverseAct(cur.id), preview: FLOWS.cascade.reversePreview(useGame.getState, cur.id) }
        : undefined,
    },
  );

  const jetActions: RollAction[] = [
    // « Tout lancer » : tant qu'il reste >1 jet, résout d'un coup le reste (RNG, sans influence) PUIS
    // montre le bilan — bouton PRÉSENT avant ET après le jet (parité `cancelAfterRoll`). Pas d'Échap :
    // la cascade est SUBIE, on ne ferme pas — le bouton est une action explicite, pas une sortie.
    ...(!isLast ? [{ key: 'toutResoudre', label: <><Icon id="navigation/des" size="sm" /> Tout lancer</>, onClick: () => roll(), title: "Résoudre d'un coup tous les jets restants (sans influence)" } as RollAction] : []),
    { key: 'poursuivre', label: isLast ? t('verbe.cascade.fermer') : t('verbe.cascade.valider'), onClick: () => next(), verbe: 'valider', flux: 'cascade' },
  ];

  return (
    <CoqueDEtape
      title={titleNode}
      /* « jet N/M » : N = jets de dé jusqu'ici + celui-ci, M = total des jets RÉELS (arbitrage user
         2026-07-11 — l'agrégation/la météo/les affichages ne comptent pas). */
      subtitle={stepSubtitle({
        cursor: p.participants.slice(0, p.cursor).reduce((n, s) => n + diceOf(s), 0),
        total: totalJets,
        prefix: 'jet ',
      })}
      {...stakeProps}
      extra={<><SequencePanel />{oppHeader}{outcomeNote}</>}
      rolled={rolled}
      /* Rangées : rangée de l'adversaire figé (Test opposé, #579) + courante interactive (pré-jet en
         attente, post-jet résolue). */
      rows={[...(oppRow ? [oppRow] : []), curRow]}
      actions={jetActions}
      disableEscClose
      embedded={embedded} etape={etape}
    />
  );
}
