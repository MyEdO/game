import { cibleMesuree } from '../../engine/tests';
import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { FLOWS } from '../../state/rollFlowSpecs';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow } from '../rollRowBuild';
import { PortraitPicker } from '../console/PortraitPicker';
import { testBreakdown, testPending } from '../breakdown';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../noyau/combatLog';
import { describeTest, amazingTestLabel } from '../../state/flowOutcomes';
import { rule } from '../../engine/policy';
import { CodexRef } from '../compendium/CodexRef';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'un Test de compétence de scène
 * (LDB 12). La situation « Test » est une cascade à une étape `jet:'test'`, rendue par `CascadeModal`
 * via ce hook (une seule fenêtre, comme l'attaque via `useAttackJetProps`). `pendingTest` reste le
 * porteur de données ; `resolveTest` (onConfirm) applique la branche réussite/échec ET ferme la cascade.
 *
 * Rendu calqué sur l'étape-jet de cascade : QUI tente le Test → PORTRAIT (jamais le nom en clair).
 *  - Plusieurs candidats : `PortraitPicker` (choix du lanceur par portrait, sélectionné mis en avant) ;
 *  - candidat unique / après le jet : le portrait vit DANS la ligne de jet (`RollRow.row.combatant`).
 * Le cadre de jet porte la COMPÉTENCE (`pt.skill`), pas l'intitulé de situation (`pt.label` = titre).
 */
export function useTestJetProps(): ComponentProps<typeof RollShell> | null {
  const pt = useGame((s) => s.pendingTest);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.testRoll);
  const reroll = useGame((s) => s.testReroll);
  const bonusSL = useGame((s) => s.testBonusSL);
  const darkPact = useGame((s) => s.testDarkPact);
  const determination = useGame((s) => s.testDetermine);
  const forceSuccess = useGame((s) => s.testForceSuccess);
  const reverseVerb = useGame((s) => s.testReverse);
  const setActor = useGame((s) => s.testSetActor);
  const resolve = useGame((s) => s.resolveTest);
  const cancel = useGame((s) => s.testCancel);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);
  const multi = !rolled && !!pt.candidates && pt.candidates.length > 1;
  const skillLabel = pt.skill ?? pt.label;
  // LIGNE MONTÉE : la base NUE (LDB 09 l.17) et TOUTES les lignes nommées — Soutien (LDB 12), États,
  // Encombrement, séquelles, passifs, outil, malus psy (LDB 21), Statut (LDB 08), météo maritime
  // (MDG 13) — sont montées à l'OUVERTURE par le monteur canonique (`rollSeam.rollStep`) et
  // transportées par le pending. L'affichage les REND telles quelles : leur `famille` et leur fiche
  // sont posées à l'émission (`engine/types.ModFamille`), donc jamais re-décidées ici. Sans ligne
  // transportée (pending d'un producteur qui n'en pose pas), la rangée montre la valeur SEULE — elle
  // ne reconstruit rien : une décomposition d'affichage peut diverger de celle qui a fait la cible.
  const base = pt.base ?? pt.skillValue;
  const extraMods = pt.mods ?? [];
  const pendingLine = testPending(skillLabel, base, cibleMesuree(pt), pt.difficulty, extraMods, pt.easedBy);
  // Capricieux (MSRC 15 l.149-159) : le d10 de l'interlocuteur ne touche NI `skillValue` NI `target` —
  // il décale le DR du Test résolu (`FLOWS.test`), donc il s'affiche comme une ligne de mod de DR.
  const capLabel = pt.capriciousRoll == null ? null
    : `Capricieux (d10 ${pt.capriciousRoll} → ${pt.capriciousDR ? `${pt.capriciousDR > 0 ? '+' : '−'}${Math.abs(pt.capriciousDR)} DR` : 'DR indiqué'})`;
  // Option « Succès / échec stupéfiants » (LDB 12 l.127) : badge du double, pilotée par la règle.
  const amazing = rule('test-critiques-doubles') ? amazingTestLabel(pt) : null;
  // Inversion de Test (LDB 23 l.209/218, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant — jamais un automatisme).
  const reverseAvail = rolled && FLOWS.test.reverseAvailable(useGame.getState, useGame.setState);
  const reversePreview = reverseAvail ? FLOWS.test.reversePreview(useGame.getState, useGame.setState) : null;
  // Barre : « Continuer » post-jet + « Annuler » pré-jet SI le test est annulable (action de COMBAT ;
  // referme la cascade sans dépenser l'Action). Les tests de dialogue/scène n'ont pas `cancellable`.
  const actions: RollAction[] = [{ key: 'confirm', label: 'Continuer', onClick: resolve, when: 'post' }];
  if (pt.cancellable) actions.unshift({ key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' });

  return {
    flowKey: 'test',
    title: pt.label,
    /* Sous-titre = modulateurs portés par l'INTERLOCUTEUR : le malus psy social (valeur, déjà dans la
       cible) et la table Capricieux (DR du Test résolu). La cible/valeur vit dans le cadre de jet. */
    subtitle: pt.psychMod || capLabel ? (
      <>
        {pt.psychMod ? (
          <span className="test-psych-mod" title="Trait psychologique envers l'interlocuteur">
            {pt.psychDetail ?? `psychologie ${pt.psychMod}`}
          </span>
        ) : null}
        {pt.psychMod && capLabel ? ' · ' : null}
        {capLabel ? (
          <span className="test-psych-mod" title="Capricieux : le d10 de l'interlocuteur décale le DR du Test">
            {capLabel}
          </span>
        ) : null}
      </>
    ) : undefined,
    rolled,
    /* Pré-jet : choix du LANCEUR par PORTRAIT (picker mutualisé). Avec plusieurs candidats, le picker
       porte les portraits (sélectionné mis en avant) et la ligne reste sans portrait (le picker montre
       déjà qui) ; avec un seul, le portrait vit dans la ligne. */
    setup: multi ? (
      <PortraitPicker
        choices={pt.candidates!.map((c) => ({
          c: party.find((h) => h.id === c.id)!,
          caption: <>cible {c.target}</>,
          title: `${c.label} — cible ${c.target}${c.psychDetail ? ` · ${c.psychDetail}` : ''}`,
        }))}
        selectedId={pt.actorId}
        onPick={setActor}
      />
    ) : undefined,
    rows: [
      buildRollRow({
        /* Pré-jet : ligne en attente (portrait sauf en mode picker — le picker montre déjà qui) ;
           post-jet : la ligne PORTE le portrait de l'acteur (comme la cascade). */
        /* Le ✓/✗ de la LIGNE est le verdict du TEST (d100 propre, `LDB 12 l.11`) — pas l'issue
           composée `pt.success`, qui porte en plus le seuil de DR exigé (`requireSL`). Le seuil manqué
           se dit par le verdict du flux ; la ligne, elle, dit le Test. C'est aussi l'issue canonique
           du seam (`rollOutcome`), dont dérivent Chance et Résilience. */
        row: rolled
          ? { combatant: actor, d: testBreakdown(skillLabel, base, { roll: pt.roll!, ...cibleMesuree(pt), sl: pt.sl, success: pt.roll! <= pt.target }, pt.difficulty, extraMods, pt.easedBy) }
          : (multi ? { pending: pendingLine } : { combatant: actor, pending: pendingLine }),
        onRoll: roll,
        rerolled: !!pt.rerolled,
        onReroll: reroll,
        onBonusSL: bonusSL,
        onDarkPact: darkPact,
        onForce: forceSuccess,
      }, {
        fortune: actor?.fortune ?? 0,
        resilience: actor?.resilience ?? 0,
        reverse: reverseAvail ? { onReverse: reverseVerb, preview: reversePreview } : undefined,
        /* Détermination (LDB 17 l.59) : AVANT le jet, si un malus psy social pèse, la dépense l'ignore. */
        determination: !rolled && pt.psychMod ? { resolve: actor?.resolve ?? 0, onResolve: determination } : undefined,
      }),
    ],
    outcome: rolled ? [recapLineOfEvent(ev('info', describeTest(pt), pt.actorId), party)] : undefined,
    /* Option « Succès / échec stupéfiants » (LDB 12 l.127) : badge du double (libellé seul, aucune
       mécanique nouvelle), gaté par la règle. */
    postRollExtra: amazing ? (
      <div className="amazing-row">
        <CodexRef
          category="regles"
          id="double-critique-maladresse"
          label="Critique et Maladresse (double)"
          className={`chip amazing-chip ${amazing.success ? 'amazing-success' : 'amazing-failure'}`}
        >
          ✦ {amazing.text}
        </CodexRef>
      </div>
    ) : undefined,
    actions,
    /* Échap = Annuler, seulement si le test est annulable (pré-jet ; RollShell ne l'attache pas post-jet). */
    onCancel: pt.cancellable ? cancel : undefined,
  };
}
