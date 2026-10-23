import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { RollShell } from '../RollShell';
import { buildRollRow } from '../rollRowBuild';
import { testBreakdown, testPending } from '../breakdown';
import { Icon } from '../Icon';
import { resultLines, freeCons } from '../../noyau/rollSeam';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'un Test ÉTENDU (LDB 12 l.170-186).
 * La situation « Test étendu » est une cascade à une étape `jet:'extended'`, rendue par `CascadeModal`
 * via ce hook (une seule fenêtre, comme l'attaque). `pendingExtendedTest` reste le porteur de données
 * (les Rounds y vivent) ; « Round suivant » (`extendedTestNext`) CUMULE le DR et ouvre le Round
 * suivant, ou ferme la cascade à la réussite (total ≥ cible). Total < 0 → recommence à 0.
 *
 * QUI lance → portrait dans la ligne de jet (`RollRow.row.combatant`) ; la progression = barre de DR de
 * RANGÉE (`RollRow.extendedDr`, site unique — arbitrage user 2026-07-11).
 * Renvoie les props de `RollShell`, ou `null` si aucun Test étendu en attente.
 */
export function useExtendedTestJetProps(): ComponentProps<typeof RollShell> | null {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingExtendedTest);
  const roll = useGame((s) => s.extendedTestRoll);
  const reroll = useGame((s) => s.extendedTestReroll);
  const bonusSL = useGame((s) => s.extendedTestBonusSL);
  const darkPact = useGame((s) => s.extendedTestDarkPact);
  const force = useGame((s) => s.extendedTestForceSuccess);
  const next = useGame((s) => s.extendedTestNext);
  const cancel = useGame((s) => s.extendedTestCancel);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const actor = pool.find((c) => c.id === p.actorId);
  if (!actor) return null;
  const cur = p.rounds[p.rounds.length - 1];
  const res = cur.result;
  const rolled = !!res;
  const projected = rolled ? p.total + res!.sl : p.total;
  const cum = Math.max(0, projected);
  const willSucceed = rolled && cum >= p.targetDR;
  const willReset = rolled && projected < 0;

  return {
    flowKey: 'extendedTest',
    stake: p.stake,
    title: <><Icon id="ui/key" size="sm" /> {p.label}</>,
    subtitle: <>Round {p.rounds.length} · Test étendu (le DR de chaque Round se cumule)</>,
    rolled,
    rows: [
      buildRollRow({
        /* QUI lance → portrait dans la ligne de jet. Progression = barre de DR de RANGÉE. */
        row: res
          ? { combatant: actor, d: testBreakdown(p.skillLabel, p.target, { roll: res.roll, target: p.target, sl: res.sl, success: res.success }) }
          : { combatant: actor, pending: testPending(p.skillLabel, p.target) },
        onRoll: () => roll(cur.id),
        rerolled: !!cur.rerolled,
        onReroll: () => reroll(cur.id),
        onBonusSL: () => bonusSL(cur.id),
        onDarkPact: () => darkPact(cur.id),
        onForce: () => force(cur.id),
      }, {
        fortune: actor.fortune ?? 0,
        resilience: actor.resilience ?? 0,
        extendedDr: { cum, target: p.targetDR },
      }),
    ],
    /* La PROGRESSION (DR du Round, cumul vers la cible) est rendue par les zones qui la possèdent :
       ✓/✗ ±DR sur la ligne de jet, cumul/cible sur la barre de DR de la rangée. L'issue ne porte donc
       que ce qu'aucune des deux ne dit : la remise à zéro portée par `willReset`. */
    outcome: willReset ? resultLines(freeCons(['Le total repart de zéro !'])) : undefined,
    /* « Round suivant » cumule + ouvre le Round suivant ; à la réussite, ferme la cascade.
       « Renoncer » ouvert aussi APRÈS le jet (`clotures.cancel` du flux `extendedTest`). */
    actions: [
      { key: 'cancel', label: 'Renoncer', onClick: cancel, verbe: 'cancel' },
      { key: 'confirm', label: willSucceed ? <><Icon id="ui/done" size="sm" /> Réussir !</> : 'Round suivant →', onClick: () => next(), verbe: 'apply' },
    ],
    onCancel: cancel,
  };
}
