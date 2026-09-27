import { useGame } from '../state/store';
import { flowStakeRef, type FlowStakeId } from '../data';
import type { PendingAuContact } from '../state/pendings';
import { baseTestModLines, combatValue } from '../engine/combat';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { Icon } from './Icon';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { opposedLines } from './breakdown';
import { opposedResponded } from './opposedFrozen';
import { buildRollRow, frozenOpposedRow } from './rollRowBuild';

/** Enjeu servi par chaque fenêtre d'Au contact. */
const AU_CONTACT_STAKE: Record<PendingAuContact['phase'], FlowStakeId> = { roll: 'au-contact-roll', choice: 'au-contact-choice' };

/**
 * Modale « Au Contact » (LDB 62 l.176, Option « Longueur d'arme »). Test OPPOSÉ de Corps à corps
 * sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Corps à corps du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet de Corps à corps du mover (héros), porteur de son cycle
 *   d'influence (Lancer → Chance/+1 DR/Pacte/Résilience → Appliquer).
 * - phase 'choice' : le VAINQUEUR (héros) tranche via `OptionChooser` (« Au contact » / « Combat
 *   normal »). Un foe IA gagnant tranche en amont (pas de phase de choix montrée).
 */
export function AuContactModal() {
  const pd = useGame((s) => s.pendingAuContact);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.auContactRoll);
  const reroll = useGame((s) => s.auContactReroll);
  const bonusSL = useGame((s) => s.auContactBonusSL);
  const darkPact = useGame((s) => s.auContactDarkPact);
  const force = useGame((s) => s.auContactForceSuccess);
  const confirm = useGame((s) => s.auContactConfirm);
  const choose = useGame((s) => s.auContactChoose);
  const cancel = useGame((s) => s.auContactCancel);
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const rolled = !!pd.def;
  const winnerIndex = pd.result === 'success' ? 1 : pd.result === 'failure' ? 0 : null;
  const outcome =
    pd.result === 'success' ? `${mover.label} l'emporte — à toi de choisir.`
    : pd.result === 'failure' ? `${foe.label} l'emporte et choisit.`
    : 'Égalité parfaite : le combat se poursuit normalement.';

  // Test OPPOSÉ de Corps à corps : la Difficulté est DÉCLARÉE UNE fois pour l'opposition entière
  // (LDB 12 l.166 ; jet de combat, LDB 13 l.118).
  // Les modificateurs du jet (Avantage, États, météo) sont NOMMÉS sur la ligne — même source que celle
  // que roule `rollDisengageAttack` (`baseTestMods`) : aucun +N anonyme dans la cible.
  const [foeLine, moverLine] = opposedLines([
    { label: 'Corps à corps', base: combatValue(foe, 'melee'), r: pd.atk, mods: baseTestModLines(foe, 'capacite-de-combat') },
    { label: 'Corps à corps', base: combatValue(mover, 'melee'), r: pd.def, mods: baseTestModLines(mover, 'capacite-de-combat') },
  ]);
  // Rangée TÉMOIN : Corps à corps du foe, figé à l'ouverture (jamais relancé, aucun bouton) — MASQUÉ
  // tant que le mover n'a pas répondu (#990 : `pd.def` est SA réponse).
  const foeRow = frozenOpposedRow(useGame.getState(), {
    ownerId: pd.foeId,
    responded: opposedResponded(useGame.getState(), [{ id: pd.moverId, interactive: true, result: pd.def }]),
    row: { combatant: foe, d: foeLine.d },
  });
  // Rangée INTERACTIVE : Corps à corps du mover (héros), porteur de son cycle d'influence.
  const actorRow = buildRollRow({
    actor: mover,
    row: { combatant: mover, d: moverLine.d },
    onRoll: roll,
    rerolled: !!pd.rerolled,
    // Égalité comprise : l'opposition n'est pas emportée (LDB 17 l.68) — l'accent `winner` ne la dit
    // pas (il n'existe qu'une fois l'opposition tranchée).
    lost: pd.result !== 'success',
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    rollLabel: 'Lancer',
    // Résilience AVANT le jet (LDB 17 l.68) : Corps à corps forcé à l'emporter.
    preRollForce: () => { roll(); force(); },
  });

  const issue = pd.def
    ? [recapLineOfEvent(ev(pd.result === 'success' ? 'dodge' : 'attack', outcome, mover.id, foe.id), battle.combatants)]
    : undefined;

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Renoncer', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  if (pd.phase === 'choice') {
    // Le VAINQUEUR (héros) tranche : « Au contact » / « Combat normal ». Panneau résolu conservé.
    return (
      <RollShell
        etape={pd.phase}
        flowKey="auContact"
        stake={flowStakeRef(AU_CONTACT_STAKE[pd.phase])}
        title="Au contact"
        extra={<VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb="melee/close-in" />}
        rows={[foeRow, actorRow]}
        rolled
        winnerIndex={winnerIndex}
        outcome={issue}
        postRollExtra={
          <>
            <p className="modal-log">Tu l'emportes : choisis comment se poursuit le corps à corps.</p>
            <OptionChooser
              layout="grid"
              options={[
                { key: 'contact', label: <><Icon id="melee/close-in" size="sm" /> Au contact</>, primary: true, onSelect: () => choose('contact'), title: 'Entrer dans la longueur d’arme : toute arme plus longue que Courte est traitée comme une Arme improvisée (les deux camps)' },
                { key: 'normal', label: <><Icon id="action/attack" size="sm" /> Combat normal</>, onSelect: () => choose('normal'), title: 'Le combat se poursuit à distance d’arme normale' },
              ]}
            />
          </>
        }
        actions={[]}
      />
    );
  }

  return (
    <RollShell
      etape={pd.phase}
      flowKey="auContact"
      stake={flowStakeRef(AU_CONTACT_STAKE[pd.phase])}
      title="Au contact"
      extra={<VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb="melee/close-in" />}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      outcome={issue}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
