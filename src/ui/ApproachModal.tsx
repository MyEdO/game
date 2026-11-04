import { useGame } from '../state/store';
import { valeurDecomposee } from '../engine/skills';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeApproach } from '../noyau/flowOutcomes';
import { libelleDuTestNomme } from '../noyau/jetsEnVue';
import { FLOWS } from '../noyau/rollFlowSpecs';
import { t } from '../i18n';

/**
 * Modale d'APPROCHE d'une source de Peur (LDB 21 l.27) : Test SEC de `pendingApproach.test` qui diffère le
 * clic d'approche — succès → l'intention est relancée (approches libres ce Tour) ; échec → aucune approche
 * ce Tour.
 */
export function ApproachModal() {
  const pa = useGame((s) => s.pendingApproach);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.approachRoll);
  const reroll = useGame((s) => s.approachReroll);
  const darkPact = useGame((s) => s.approachDarkPact);
  const force = useGame((s) => s.approachForceSuccess);
  const reverse = useGame((s) => s.approachReverse); // Inversion (LDB 12 l.42)
  const confirm = useGame((s) => s.approachConfirm);
  const cancel = useGame((s) => s.approachCancel);
  if (!pa || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pa.combatantId);
  if (!c) return null;
  const r = pa.result;
  const rolled = !!r;
  const label = libelleDuTestNomme(pa.test);
  const { base, mods } = valeurDecomposee(c, pa.test);

  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown(label, base, r, pa.test.difficulty, mods) : undefined,
      pending: testPending(label, base, undefined, pa.test.difficulty, mods),
    },
    rerolled: !!pa.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune: c.fortune ?? 0,
    resilience: c.resilience ?? 0,
    // Offre et aperçu de l'inversion : verdicts du flux (`FLOWS.approach`).
    ...(FLOWS.approach.reverseAvailable(useGame.getState) ? { reverse: { onReverse: reverse, preview: FLOWS.approach.reversePreview(useGame.getState) } } : {}),
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: t('verbe.cancel'), onClick: cancel, verbe: 'cancel' },
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, verbe: 'apply' },
  ];

  return (
    <RollShell
      flowKey="approach"
      title={<><Icon id="flag/fear" size="sm" /> Affronter sa Peur</>}
      subtitle={
        <>
          <strong>{c.label}</strong> ose approcher {pa.sourceName}
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('fear', describeApproach(pa), c.id, pa.sourceId), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
