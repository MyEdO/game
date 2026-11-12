import { useGame } from '../state/store';
import { ligneDeForceDEmpoignade } from '../noyau/combatManeuvers';
import { cibleBrute } from '../engine/tests';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { opposedLines } from './breakdown';
import { JET_FIGE, jetFigeRevele } from '../noyau/netOwnership';
import { buildRollRow, frozenOpposedRow } from './rollRowBuild';
import { Icon } from './Icon';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/**
 * Modale « Empoignade » (LDB 14 l.161) — Test OPPOSÉ de FORCE sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Force du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet de Force de l'acteur, porteur de son cycle d'influence.
 *   Un bouton « Briser l'Empoignade » (gratuit) apparaît AVANT le jet si l'acteur a un Avantage supérieur.
 * - phase 'options' : le VAINQUEUR tranche via `OptionChooser` — Dégâts (BF + DR, PA ignorés) / Empêtrer
 *   l'adversaire / Se libérer (retire son *Empêtré* + 1 par DR).
 */
export function GrappleModal() {
  const pd = useGame((s) => s.pendingGrapple);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'empoignade');
  const reroll = useGesteDeJet('jetRelancer', 'empoignade');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'empoignade');
  const darkPact = useGesteDeJet('jetPactiser', 'empoignade');
  const force = useGesteDeJet('jetForcerLaReussite', 'empoignade');
  const regler = useGame((s) => s.jetRegler);
  const confirm = useGesteDeJet('jetValider', 'empoignade');
  const cancel = useGesteDeJet('jetAnnuler', 'empoignade');
  if (!pd || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pd.actorId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!actor || !foe) return null;
  const rolled = !!pd.def;
  const winnerIndex = pd.result === 'reussite' ? 1 : pd.result === 'echec' ? 0 : null;
  const outcome =
    pd.result === 'reussite' ? `${actor.label} l'emporte — à toi de choisir.`
    : pd.result === 'echec' ? `${foe.label} l'emporte : +1 Avantage.`
    : 'Égalité parfaite : l’Empoignade se poursuit.';

  // Test OPPOSÉ de Force : la Difficulté est DÉCLARÉE UNE fois pour l'opposition entière
  // (LDB 12 l.166 ; jet de combat, LDB 13 l.118).
  // Lignes : `ligneDeForceDEmpoignade`, celle de `rollGrappleForce`.
  const [foeL, actorL] = [ligneDeForceDEmpoignade(foe), ligneDeForceDEmpoignade(actor)];
  const [foeLine, actorLine] = opposedLines([
    { label: libelleDeTest('force'), base: foeL.base, target: cibleBrute(foeL), r: pd.atk, mods: foeL.mods },
    { label: libelleDeTest('force'), base: actorL.base, target: cibleBrute(actorL), r: pd.def, mods: actorL.mods },
  ]);
  // Rangée TÉMOIN : Force du foe, figée à l'ouverture (jamais relancée) — MASQUÉE tant que l'acteur
  // n'a pas répondu (#990 : `pd.def` est SA réponse ; le calendrier est celui de tous les jets figés).
  const foeRow = frozenOpposedRow({
    revele: jetFigeRevele(useGame.getState(), JET_FIGE.empoignade(pd)),
    row: { combatant: foe, d: foeLine.d },
  });
  // Rangée INTERACTIVE : Force de l'acteur, porteur de son cycle d'influence.
  const actorRow = buildRollRow({
    actor,
    row: { combatant: actor, d: actorLine.d },
    onRoll: roll,
    rerolled: !!pd.rerolled,
    // Égalité comprise : l'opposition n'est pas emportée (LDB 17 l.68).
    lost: pd.result !== 'reussite',
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    rollLabel: 'Lancer (Force)',
  });

  const issue = pd.def
    ? [recapLineOfEvent(ev(pd.result === 'reussite' ? 'esquive' : 'attaque', outcome, actor.id, foe.id), battle.combatants)]
    : undefined;

  if (pd.phase === 'options') {
    // Le VAINQUEUR tranche l'issue de l'Empoignade. Panneau résolu conservé.
    return (
      <RollShell
        etape={pd.phase}
        flowKey="empoignade"
        title="Empoignade"
        extra={<VsHeader actor={actor} target={foe} label="lutte au corps à corps" verb="melee/empoignade" />}
        rows={[foeRow, actorRow]}
        rolled
        winnerIndex={winnerIndex}
        outcome={issue}
        postRollExtra={
          <>
            <p className="modal-log">Tu l'emportes : choisis l'issue de l'Empoignade.</p>
            <OptionChooser
              layout="grid"
              options={[
                { key: 'degats', label: <><Icon id="journal/degats" size="sm" /> Dégâts</>, primary: true, onSelect: () => regler('empoignade', 'issue', 'degats'), title: 'BF + DR Dégâts, en IGNORANT tous les Points d’Armure (Localisation au lancer de Force).' },
                { key: 'empetrer', label: <><Icon id="etat/empetre" size="sm" /> Empêtrer</>, onSelect: () => regler('empoignade', 'issue', 'empetrer'), title: 'Conférer l’État Empêtré à l’adversaire.' },
                { key: 'liberer', label: <><Icon id="melee/roule-boule" size="sm" /> Se libérer</>, onSelect: () => regler('empoignade', 'issue', 'liberer'), title: 'Te défaire de ton État Empêtré, et en retirer 1 de plus par DR obtenu.' },
              ]}
            />
          </>
        }
        actions={[]}
      />
    );
  }

  const actions: RollAction[] = [
    { key: 'abandonner', label: 'Renoncer', onClick: cancel, verbe: 'annuler' },
    // Avantage supérieur : briser l'Empoignade gratuitement (par son Mouvement) — pré-jet uniquement.
    ...(pd.canBreak
      ? [{ key: 'rompre', label: "Briser l'Empoignade", onClick: () => regler('empoignade', 'briser', true), title: 'Avantage supérieur : briser l’Empoignade gratuitement (par ton Mouvement).', verbe: 'lancer' } as RollAction]
      : []),
    { key: 'valider', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      etape={pd.phase}
      flowKey="empoignade"
      title="Empoignade"
      extra={<VsHeader actor={actor} target={foe} label="lutte au corps à corps" verb="melee/empoignade" />}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      outcome={issue}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
