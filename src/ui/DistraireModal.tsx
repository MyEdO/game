import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { distraireFoes, ligneDeDistraire, ligneDuCalmeDistrait } from '../noyau/combatManeuvers';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { testBreakdown } from './breakdown';
import { describeDistraire } from '../noyau/flowOutcomes';
import { JET_FIGE, jetFigeRevele } from '../noyau/netOwnership';
import { buildRollRow, frozenOpposedRow } from './rollRowBuild';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';
import type { ReglagesDuJet } from '../noyau/reglagesDuJet';

/**
 * Modale de Distraire (LDB 10 l.364 / AA 13 l.51) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs Calme
 * (foe), sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Calme du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet d'Athlétisme du mover, porteur de son cycle d'influence.
 * Issue BINAIRE (succès/égalité/échec). Le picker de cible (`OptionChooser`) n'apparaît qu'en
 * pré-jet si plusieurs adversaires sont éligibles (slot `setup`).
 */
export function DistraireModal() {
  const pd = useGame((s) => s.pendingDistraire);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'distraire');
  const reroll = useGesteDeJet('jetRelancer', 'distraire');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'distraire');
  const darkPact = useGesteDeJet('jetPactiser', 'distraire');
  const force = useGesteDeJet('jetForcerLaReussite', 'distraire');
  const regler = useGame((s) => s.jetRegler);
  const setFoe = (v: ReglagesDuJet['distraire']['adversaire']) => regler('distraire', 'adversaire', v);
  const confirm = useGesteDeJet('jetValider', 'distraire');
  const cancel = useGesteDeJet('jetAnnuler', 'distraire');
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const rolled = !!pd.atk;
  // Adversaires éligibles au Distraire — MÊME source que l'ouverture (`distraireFoes`).
  const foes = distraireFoes(mover, battle);
  const winnerIndex = pd.result === 'reussite' ? 1 : pd.result === 'echec' ? 0 : null;
  const calme = ligneDuCalmeDistrait(foe);
  const athletisme = ligneDeDistraire(mover);

  // Rangée TÉMOIN : Calme du foe, figé à l'ouverture (jamais relancé) — MASQUÉ tant que le mover n'a
  // pas répondu (#990 : `pd.atk` est SA réponse ; ici le jet FIGÉ est celui du DÉFENSEUR).
  const foeRow = frozenOpposedRow({
    revele: jetFigeRevele(useGame.getState(), JET_FIGE.distraire(pd)),
    row: { combatant: foe, d: testBreakdown(libelleDeTest('calme'), calme.base, pd.defRoll, calme.difficulty, calme.mods) },
  });
  // Rangée INTERACTIVE : Athlétisme du mover, porteur de son cycle d'influence.
  const actorRow = buildRollRow({
    actor: mover,
    row: { combatant: mover, d: pd.atk ? testBreakdown(libelleDeTest('athletisme'), athletisme.base, pd.atk, athletisme.difficulty, athletisme.mods) : undefined },
    onRoll: roll,
    rerolled: !!pd.rerolled,
    // Égalité comprise : l'opposition n'est pas emportée (LDB 17 l.68).
    lost: pd.result !== 'reussite',
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    rollLabel: t('verbe.lancer'),
  });

  const issue = pd.atk
    ? [recapLineOfEvent(ev(pd.result === 'reussite' ? 'esquive' : 'attaque', describeDistraire(pd, mover.label, foe.label), mover.id, foe.id), battle.combatants)]
    : undefined;

  const actions: RollAction[] = [
    { key: 'abandonner', label: 'Renoncer', onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="distraire"
      stake={flowStakeRef('distraire-test')}
      title="Distraire"
      extra={<VsHeader actor={mover} target={foe} label="détourner son attention (Athlétisme vs Calme)" />}
      // Choix de la cible AVANT le jet (plusieurs adversaires en Ligne de vue) — OptionChooser partagé.
      setup={foes.length > 1 && (
        <OptionChooser
          layout="seg"
          groupLabel="Cible"
          options={foes.map((f) => ({ key: f.id, label: f.label, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
        />
      )}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      outcome={issue}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
