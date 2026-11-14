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
import { nomEnVue } from '../noyau/visionDuGroupe';
import { garanti } from '../lib/garanti';
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
  const nomCible = useGame((s) => (s.pendingWard ? nomEnVue(s, s.pendingWard.targetId) : null));
  const roll = useGesteDeJet('jetLancer', 'protection');
  const reroll = useGesteDeJet('jetRelancer', 'protection');
  const darkPact = useGesteDeJet('jetPactiser', 'protection');
  const force = useGesteDeJet('jetForcerLaReussite', 'protection');
  const confirm = useGesteDeJet('jetValider', 'protection');
  const cancel = useGesteDeJet('jetAnnuler', 'protection');
  if (!pw || !battle) return null;
  const cible = garanti(nomCible, pw.targetId, 'cible bénie');
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
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="protection"
      stake={flowStakeRef('protection-test')}
      title={<><Icon id="action/se-defendre" size="sm" /> Bénédiction de Protection</>}
      subtitle={
        <>
          <strong>{attacker.label}</strong> ose frapper {cible} (Test de FM +20)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('information', describeWard(pw, cible), attacker.id, pw.targetId), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
