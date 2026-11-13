import { cibleMesuree, evaluateTest } from '../../engine/tests';
import { formatDice } from '../../engine/dice';
import { deDuCapricieux } from '../../engine/social';
import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { FLOWS } from '../../noyau/rollFlowSpecs';
import { refusDImmunite } from '../../noyau/determinationDuJet';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow } from '../rollRowBuild';
import { PortraitPicker } from '../console/PortraitPicker';
import { testBreakdown, testPending } from '../breakdown';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../noyau/combatLog';
import { describeTest, amazingTestLabel } from '../../noyau/flowOutcomes';
import { CodexRef } from '../compendium/CodexRef';
import { libelleDuTestDeScene } from '../../noyau/jetsEnVue';
import { t } from '../../i18n';
import { nomEnVue } from '../../noyau/visionDuGroupe';
import { garanti } from '../../lib/garanti';
import { useGesteDeJet } from '../useGesteDeJet';
import type { ReglagesDuJet } from '../../noyau/reglagesDuJet';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'un Test de compétence de scène
 * (LDB 12). La situation « Test » est une cascade à une étape `jet:'test'`, rendue par `CascadeModal`
 * via ce hook (une seule fenêtre, comme l'attaque via `useAttackJetProps`). `pendingTest` reste le
 * porteur de données ; `jetValider('test')` (onConfirm) applique la branche réussite/échec ET ferme la cascade.
 *
 * Rendu calqué sur l'étape-jet de cascade : QUI tente le Test → PORTRAIT (jamais le nom en clair).
 *  - Plusieurs candidats : `PortraitPicker` (choix du lanceur par portrait, sélectionné mis en avant) ;
 *  - candidat unique / après le jet : le portrait vit DANS la ligne de jet (`RollRow.row.combatant`).
 * Le cadre de jet porte la COMPÉTENCE (`pt.skill`), pas l'intitulé de situation (`pt.label` = titre).
 */
export function useTestJetProps(): ComponentProps<typeof RollShell> | null {
  const pt = useGame((s) => s.pendingTest);
  const party = useGame((s) => s.party);
  const nom = useGame((s) => (s.pendingTest ? nomEnVue(s, s.pendingTest.actorId) : null));
  const roll = useGesteDeJet('jetLancer', 'test');
  const reroll = useGesteDeJet('jetRelancer', 'test');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'test');
  const darkPact = useGesteDeJet('jetPactiser', 'test');
  const depenserLaDetermination = useGame((s) => s.depenserLaDetermination);
  const forceSuccess = useGesteDeJet('jetForcerLaReussite', 'test');
  const reverseVerb = useGesteDeJet('jetInverser', 'test');
  const regler = useGame((s) => s.jetRegler);
  const setActor = (v: ReglagesDuJet['test']['testeur']) => regler('test', 'testeur', v);
  const resolve = useGesteDeJet('jetValider', 'test');
  const cancel = useGesteDeJet('jetAnnuler', 'test');
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);
  const multi = !rolled && !!pt.candidates && pt.candidates.length > 1;
  const skillLabel = libelleDuTestDeScene(pt);
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
  // Capricieux (MSRC 15 l.149-159) : le jet de l'interlocuteur ne touche NI `skillValue` NI `target` —
  // il décale le DR du Test résolu (`FLOWS.test`), donc il s'affiche comme une ligne de mod de DR.
  const capLabel = pt.capriciousRoll == null ? null
    : `Capricieux (${formatDice(deDuCapricieux())} ${pt.capriciousRoll} → ${pt.capriciousDR ? `${pt.capriciousDR > 0 ? '+' : '−'}${Math.abs(pt.capriciousDR)} DR` : 'DR indiqué'})`;
  // LDB 12 l.127
  const amazing = amazingTestLabel(pt);
  // Inversion de Test (LDB 23 l.209/218, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant — jamais un automatisme).
  const reverseAvail = FLOWS.test.reverseAvailable(useGame.getState);
  const reversePreview = reverseAvail ? FLOWS.test.reversePreview(useGame.getState) : null;
  // Barre : « Annuler » et « Continuer », que le flux `test` ouvre (un Test de COMBAT est annulable avant le jet,
  // `FLOWS.test.fermetures(get).cancel` ; referme la cascade sans dépenser l'Action).
  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: 'Continuer', onClick: resolve, verbe: 'valider' },
  ];

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
          ? { combatant: actor, d: testBreakdown(skillLabel, base, { roll: pt.roll!, ...cibleMesuree(pt), sl: pt.sl, success: evaluateTest(pt.roll!, pt.target).success }, pt.difficulty, extraMods, pt.easedBy) }
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
        /* Détermination (LDB 17 l.59) : AVANT le jet, si un malus psy social pèse, la dépense l'ignore (`refusDImmunite`). */
        determination: !actor || refusDImmunite(useGame.getState(), actor) ? undefined : { resolve: actor.resolve ?? 0, onResolve: () => depenserLaDetermination(actor.id, 'immuniserALaPsychologie') },
      }),
    ],
    outcome: rolled ? [recapLineOfEvent(ev('information', describeTest(pt, garanti(nom, pt.actorId, 'testeur')), pt.actorId), party)] : undefined,
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
    /* Échap = Annuler, tant que le flux `test` l'ouvre (RollShell le juge). */
    onCancel: cancel,
  };
}
