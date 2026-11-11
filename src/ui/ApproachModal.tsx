import { useGame } from '../state/store';
import { cibleMesuree } from '../engine/tests';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { Icon } from './Icon';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeApproach } from '../noyau/flowOutcomes';
import { libelleDuTestNomme } from '../noyau/jetsEnVue';
import { FLOWS, ligneDuTestNomme } from '../noyau/rollFlowSpecs';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale d'APPROCHE d'une source de Peur (LDB 21 l.27) : Test SEC de `pendingApproach.test` qui diffère le
 * clic d'approche — succès → l'intention est relancée (approches libres ce Tour) ; échec → aucune approche
 * ce Tour.
 */
export function ApproachModal() {
  const pa = useGame((s) => s.pendingApproach);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'approche');
  const reroll = useGesteDeJet('jetRelancer', 'approche');
  const darkPact = useGesteDeJet('jetPactiser', 'approche');
  const force = useGesteDeJet('jetForcerLaReussite', 'approche');
  const reverse = useGesteDeJet('jetInverser', 'approche'); // Inversion (LDB 12 l.42)
  const confirm = useGesteDeJet('jetValider', 'approche');
  const cancel = useGesteDeJet('jetAnnuler', 'approche');
  if (!pa || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pa.combatantId);
  if (!c) return null;
  const r = pa.result;
  const rolled = !!r;
  const label = libelleDuTestNomme(pa.test);
  const l = ligneDuTestNomme(c, pa.test); // la ligne que le résolveur `approach` jette

  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown(label, l.base, r, l.difficulty, l.mods) : undefined,
      pending: testPending(label, l.base, cibleMesuree(l), l.difficulty, l.mods),
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
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, verbe: 'confirm' },
  ];

  return (
    <RollShell
      flowKey="approche"
      title={<><Icon id="flag/fear" size="sm" /> Affronter sa Peur</>}
      subtitle={
        <>
          <strong>{c.label}</strong> ose approcher {pa.sourceName}
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('peur', describeApproach(pa), c.id, pa.sourceId), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
