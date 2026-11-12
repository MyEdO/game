import { useGame } from '../state/store';
import { cibleMesuree } from '../engine/tests';
import { flowStakeRef } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeRun } from '../noyau/flowOutcomes';
import { ligneDuTestNomme } from '../noyau/rollFlowSpecs';
import { Icon } from './Icon';
import { libelleDuTestNomme } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale de Course (LDB 15 l.41) : « Lancer » jette le Test de `pendingRun.test`,
 * « Relancer »/« Résilience ×N » dépensent Chance/Résilience, « Appliquer » ouvre le déplacement
 * étendu (Marche + Course + DR). La Course N'EST PAS binaire : « +1 DR » (Chance, LDB 17 l.24) allonge
 * la distance parcourue (DR en mètres → cases, cf. le flux `course`).
 */
export function RunModal() {
  const pr = useGame((s) => s.pendingRun);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'course');
  const reroll = useGesteDeJet('jetRelancer', 'course');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'course');
  const darkPact = useGesteDeJet('jetPactiser', 'course');
  const force = useGesteDeJet('jetForcerLaReussite', 'course');
  const confirm = useGesteDeJet('jetValider', 'course');
  const cancel = useGesteDeJet('jetAnnuler', 'course');
  if (!pr || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pr.combatantId);
  if (!c) return null;
  const r = pr.result;
  const skillLabel = libelleDuTestNomme(pr.test);
  const l = ligneDuTestNomme(c, pr.test); // la ligne que le résolveur `run` jette
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown(skillLabel, l.base, { roll: r.roll, ...cibleMesuree(r), sl: r.dr, success: r.success }, l.difficulty, l.mods) : undefined,
      pending: testPending(skillLabel, l.base, cibleMesuree(l), l.difficulty, l.mods),
    },
    onRoll: roll,
    rerolled: !!pr.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL, // Chance « +1 DR » = +distance de Course (LDB 17 l.24) — offert dès le jet réussi OU raté
    onDarkPact: darkPact,
    onForce: force,
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="course"
      stake={flowStakeRef('course-test')}
      title={<><Icon id="melee/fuir" size="sm" /> {pr.test.label}</>}
      subtitle={
        <>
          <strong>{c.label}</strong> s'élance
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('deplacement', describeRun(pr), c.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
