import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { cibleMesuree } from '../engine/tests';
import { ligneDeFrenesie } from '../noyau/rollFlowSpecs';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeFrenzy } from '../noyau/flowOutcomes';
import { Icon } from './Icon';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale d'entrée en Frénésie (LDB 21 l.31) : « Lancer » jette le Test de Force Mentale,
 * « Relancer »/« Résilience ×N » dépensent Chance/Résilience, « Appliquer » fige le résultat
 * (entre en Frénésie sur succès). Test binaire (pas de DR) → pas de « +1 DR ».
 */
export function FrenzyModal() {
  const pf = useGame((s) => s.pendingFrenzy);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'frenesie');
  const reroll = useGesteDeJet('jetRelancer', 'frenesie');
  const darkPact = useGesteDeJet('jetPactiser', 'frenesie');
  const force = useGesteDeJet('jetForcerLaReussite', 'frenesie');
  const confirm = useGesteDeJet('jetValider', 'frenesie');
  const cancel = useGesteDeJet('jetAnnuler', 'frenesie');
  if (!pf || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pf.combatantId);
  if (!c) return null;
  const r = pf.result;
  const rolled = !!r;

  const l = ligneDeFrenesie(c); // la ligne que le résolveur `frenzy` jette
  const actorRow: BuiltRollRow = buildRollRow({
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown(libelleDeTest('force-mentale'), l.base, r, l.difficulty, l.mods) : undefined,
      pending: testPending(libelleDeTest('force-mentale'), l.base, cibleMesuree(l), l.difficulty, l.mods),
    },
    rerolled: !!pf.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune: c.fortune ?? 0,
    resilience: c.resilience ?? 0,
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="frenesie"
      stake={flowStakeRef('frenesie-test')}
      title={<><Icon id="drapeau/frenesie" size="sm" /> Frénésie</>}
      subtitle={
        <>
          <strong>{c.label}</strong> tente d'entrer en Frénésie (Test de Force Mentale)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('frenesie', describeFrenzy(pf, c.label), c.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
