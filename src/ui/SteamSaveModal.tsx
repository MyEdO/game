import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';

/**
 * Sauvegarde d'Initiative d'une PANNE DE VAPEUR « Fuite de vapeur » (MDG 12 l.326-328) : la personne qui
 * s'occupe du moteur teste l'Initiative sous peine d'être ébouillantée (1d10−5 Dégâts min 1, ignorent
 * l'Armure). Modale INFLUENÇABLE (Chance/+1 DR/Pacte/Résilience) — l'ÉCHEC applique l'ébouillantage puis
 * la traversée reprend (`steamSaveConfirm`). Jet PROPRE de l'acteur (aucun « Annuler » : la panne EST là).
 */
export function SteamSaveModal() {
  const p = useGame((s) => s.pendingSteamSave);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.steamSaveRoll);
  const reroll = useGame((s) => s.steamSaveReroll);
  const bonusSL = useGame((s) => s.steamSaveBonusSL);
  const darkPact = useGame((s) => s.steamSaveDarkPact);
  const forceSuccess = useGame((s) => s.steamSaveForceSuccess);
  const confirm = useGame((s) => s.steamSaveConfirm);
  if (!p) return null;
  const actor = party.find((c) => c.id === p.actorId);
  const rolled = p.roll != null;

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: rolled
      ? { combatant: actor, d: testBreakdown('Initiative', p.skillValue, { roll: p.roll!, target: p.target, sl: p.sl, success: p.success }, p.difficulty) }
      : { combatant: actor, pending: testPending('Initiative', p.skillValue, p.target, p.difficulty) },
    onRoll: roll,
    rerolled: !!p.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: forceSuccess,
  }, {
    fortune: actor?.fortune ?? 0,
    resilience: actor?.resilience ?? 0,
  });

  const actions: RollAction[] = [{ key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' }];
  const text = !rolled
    ? 'Un jet de vapeur jaillit de la chaudière — Test d’Initiative ou ébouillanté.'
    : p.success ? `${p.actorName} esquive le jet de vapeur.` : `${p.actorName} est ébouillanté par le jet de vapeur !`;

  return (
    <RollShell
      flowKey="steamSave"
      stake={flowStakeRef('steam-save-roll')}
      title="Fuite de vapeur — Initiative"
      subtitle={<>panne de vapeur</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={[recapLineOfEvent(ev(p.success ? 'info' : 'condition', text, p.actorId), party)]}
      actions={actions}
    />
  );
}
