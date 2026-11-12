import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { cibleMesuree } from '../engine/tests';
import { battementFoes, ligneDAttaquantDeManoeuvre } from '../noyau/combatManeuvers';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeBattement } from '../noyau/flowOutcomes';
import { Icon } from './Icon';
import { VsHeader } from './VsHeader';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { FLOWS } from '../noyau/rollFlowSpecs';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';
import type { ReglagesDuJet } from '../noyau/reglagesDuJet';

/**
 * Modale de Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant
 * de l'Avantage adverse. Même patron de jet MONO d'attaquant influençable que le Piétinement — la seule
 * différence métier est l'issue (`jetValider('battement')` → `resolveBattement`). Le picker de cible
 * (`OptionChooser`) n'apparaît que si plusieurs adversaires sont éligibles (avant le jet).
 */
export function BattementModal() {
  const pb = useGame((s) => s.pendingBattement);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'battement');
  const reroll = useGesteDeJet('jetRelancer', 'battement');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'battement');
  const darkPact = useGesteDeJet('jetPactiser', 'battement');
  const force = useGesteDeJet('jetForcerLaReussite', 'battement');
  const reverse = useGesteDeJet('jetInverser', 'battement'); // Inversion (LDB 12 l.42)
  const regler = useGame((s) => s.jetRegler);
  const setFoe = (v: ReglagesDuJet['battement']['adversaire']) => regler('battement', 'adversaire', v);
  const confirm = useGesteDeJet('jetValider', 'battement');
  const cancel = useGesteDeJet('jetAnnuler', 'battement');
  if (!pb || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pb.attackerId);
  const foe = battle.combatants.find((c) => c.id === pb.foeId);
  if (!attacker || !foe) return null;
  const r = pb.result;
  const rolled = !!r;
  const foes = battementFoes(attacker, battle);
  const ligne = ligneDAttaquantDeManoeuvre(attacker, 'capacite-de-combat');

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown(libelleDeTest('corps-a-corps'), ligne.base, r, ligne.difficulty, ligne.mods) : undefined,
      pending: testPending(libelleDeTest('corps-a-corps'), ligne.base, cibleMesuree(ligne), ligne.difficulty, ligne.mods),
    },
    onRoll: roll,
    rerolled: !!pb.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    // Offre et aperçu de l'inversion : verdicts du flux (`FLOWS.battement`).
    ...(FLOWS.battement.reverseAvailable(useGame.getState) ? { reverse: { onReverse: reverse, preview: FLOWS.battement.reversePreview(useGame.getState) } } : {}),
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="battement"
      stake={flowStakeRef('battement-test')}
      title={<><Icon id="action/attaquer" /> Battement</>}
      /* A→B canonique (décision utilisateur 2026-08-04) : portraits + flèche annotée de la manœuvre
         — jamais une phrase « X bat l'arme de Y ». Le COÛT (l'Action) est un prérequis de ressource,
         pas un modificateur du jet : il s'annonce sur la flèche, pas sur la ligne. */
      extra={<VsHeader actor={attacker} target={foe} label="Battement · coûte l’Action" verb="action/attaquer" />}
      /* Choix de la cible AVANT le jet (plusieurs adversaires éligibles) — OptionChooser partagé. */
      setup={
        foes.length > 1 ? (
          <OptionChooser
            layout="seg"
            groupLabel="Cible"
            options={foes.map((f) => ({ key: f.id, label: f.label, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
          />
        ) : undefined
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('attaque', describeBattement(pb, attacker.label, foe.label), attacker.id, foe.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={cancel}
    />
  );
}
