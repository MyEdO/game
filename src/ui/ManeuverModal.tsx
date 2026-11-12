import { useGame } from '../state/store';
import { attaqueDeCle } from '../engine/creatureAttacks';
import { MANEUVER_ICON, maneuverDefensePending, maneuverAttackerDifficulty, ligneDAttaquantDeManoeuvre } from '../noyau/combatManeuvers';
import { cibleMesuree } from '../engine/tests';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { Icon } from './Icon';
import { OptionChooser, type RollSegOption } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { confirmerLeCoup } from './jetProps/useAttackJetProps';
import { libelleDeManoeuvre } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';
import type { ReglagesDuJet } from '../noyau/reglagesDuJet';

/**
 * Modale de MANŒUVRE de créature (LDB 85) qu'un héros active (mutation/polymorphie) : elle influence
 * le SEUL jet de l'ATTAQUANT (`ligneDAttaquantDeManoeuvre`) ; « Appliquer » résout l'opposition, ou
 * « Passer à la Défense » quand un défenseur SURFACÉ joue sa défense en cascade
 * (`maneuverDefensePending`). LDB 85 l.290 : sélecteur d'Avantage pré-jet.
 */
export function ManeuverModal() {
  const pm = useGame((s) => s.pendingManeuver);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'manoeuvre');
  const reroll = useGesteDeJet('jetRelancer', 'manoeuvre');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'manoeuvre');
  const darkPact = useGesteDeJet('jetPactiser', 'manoeuvre');
  const force = useGesteDeJet('jetForcerLaReussite', 'manoeuvre');
  const regler = useGame((s) => s.jetRegler);
  const setAvantage = (v: ReglagesDuJet['manoeuvre']['avantage']) => regler('manoeuvre', 'avantage', v);
  const confirm = useGesteDeJet('jetValider', 'manoeuvre');
  const cancel = useGesteDeJet('jetAnnuler', 'manoeuvre');
  const awaitingDefense = useGame(maneuverDefensePending);
  if (!pm || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pm.attackerId);
  if (!attacker) return null;
  const a = attaqueDeCle(attacker.traits ?? [], pm.attaque);
  if (!a) return null;
  const r = pm.result;
  const rolled = !!r;
  // LDB 85 l.445.
  const ligne = ligneDAttaquantDeManoeuvre(attacker, a.stat ?? 'capacite-de-tir', maneuverAttackerDifficulty(pm.kind));
  const label = libelleDeManoeuvre(attacker, pm.attaque);
  // LDB 85 l.290.
  const variable = a.modeDAvantage === 'variable';
  const avOptions: RollSegOption[] = variable
    ? Array.from({ length: Math.max(1, attacker.advantage) }, (_, i) => i + 1).map((n) => ({
        key: String(n), label: `+${n} DR`, selected: pm.avantageSpent === n, onSelect: () => setAvantage(n),
      }))
    : [];

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown(label, ligne.base, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, ligne.difficulty, ligne.mods) : undefined,
      pending: testPending(label, ligne.base, cibleMesuree(ligne), ligne.difficulty, ligne.mods),
    },
    onRoll: roll,
    rerolled: !!pm.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
    // LDB 17 l.68 : sélecteur du dé dérivé par la coquille (`RollShell` → `rowForcedDie`).
  });

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    confirmerLeCoup(awaitingDefense, confirm),
  ];

  return (
    <RollShell
      flowKey="manoeuvre"
      title={<><Icon id={MANEUVER_ICON[pm.kind]} /> {a.def.label}</>}
      subtitle={
        <>
          <strong>{attacker.label}</strong> déclenche {a.def.label}
          {variable ? <> ({pm.avantageSpent} Avantage)</> : a.avantage > 0 ? <> (coûte {a.avantage} Avantage)</> : null}
        </>
      }
      setup={variable ? <OptionChooser layout="seg" groupLabel="Avantage" options={avOptions} /> : undefined}
      rows={[actorRow]}
      rolled={rolled}
      actions={actions}
      onCancel={cancel}
    />
  );
}
