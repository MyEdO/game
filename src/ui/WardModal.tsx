import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { ligneDeProtection } from '../noyau/rollFlowSpecs';
import { cibleMesuree } from '../engine/tests';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeWard } from '../noyau/flowOutcomes';
import { Icon } from './Icon';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale de la Bénédiction de Protection (LDB 41 l.142) : le Test du HÉROS attaquant DIFFÈRE la
 * déclaration d'attaque sur une cible bénie. Ligne : `ligneDeProtection`.
 */
export function WardModal() {
  const pw = useGame((s) => s.pendingWard);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'protection');
  const reroll = useGesteDeJet('jetRelancer', 'protection');
  const darkPact = useGesteDeJet('jetPactiser', 'protection');
  const force = useGesteDeJet('jetForcerLaReussite', 'protection');
  const confirm = useGesteDeJet('jetValider', 'protection');
  const cancel = useGesteDeJet('jetAnnuler', 'protection');
  if (!pw || !battle) return null;
  const attacker = battle.combatants.find((x) => x.id === pw.attackerId);
  if (!attacker) return null;
  const r = pw.result;
  const rolled = !!r;
  const fm = ligneDeProtection(attacker);

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown(libelleDeTest('force-mentale'), fm.base, r, fm.difficulty, fm.mods) : undefined,
      pending: testPending(libelleDeTest('force-mentale'), fm.base, cibleMesuree(fm), fm.difficulty, fm.mods),
    },
    onRoll: roll,
    rerolled: !!pw.rerolled,
    onReroll: reroll,
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: t('verbe.cancel'), onClick: cancel, verbe: 'cancel' },
    { key: 'confirm', label: t('verbe.confirm'), onClick: confirm, verbe: 'confirm' },
  ];

  return (
    <RollShell
      flowKey="protection"
      stake={flowStakeRef('ward-roll')}
      title={<><Icon id="action/defend" size="sm" /> Bénédiction de Protection</>}
      subtitle={
        <>
          <strong>{attacker.label}</strong> ose frapper {pw.targetName} (Test de FM +20)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('info', describeWard(pw, pw.targetName), attacker.id, pw.targetId), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
