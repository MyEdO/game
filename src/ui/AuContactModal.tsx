import { useGame } from '../state/store';
import { flowStakeRef, type FlowStakeId } from '../data';
import type { PendingAuContact } from '../noyau/pendings';
import { ligneDeCorpsACorpsBrut } from '../noyau/combatManeuvers';
import { cibleBrute } from '../engine/tests';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction } from './RollShell';
import { VsHeader } from './VsHeader';
import { Icon } from './Icon';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { opposedLines } from './breakdown';
import { JET_FIGE, jetFigeRevele } from '../noyau/netOwnership';
import { buildRollRow, frozenOpposedRow } from './rollRowBuild';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { useGesteDeJet } from './useGesteDeJet';

/** Enjeu servi par chaque fenêtre d'Au contact. */
const AU_CONTACT_STAKE: Record<PendingAuContact['phase'], FlowStakeId> = { jet: 'au-contact-test', choix: 'au-contact-choix' };

/**
 * Modale « Au Contact » (LDB 62 l.176, Option « Longueur d'arme »). Test OPPOSÉ de Corps à corps
 * sur `RollShell` (opposé = 2 rangées) :
 * - rangée [0] = TÉMOIN : le jet de Corps à corps du foe, FIGÉ (`interactive:false`) ;
 * - rangée [1] = INTERACTIVE : le jet de Corps à corps du mover (héros), porteur de son cycle
 *   d'influence (Lancer → Chance/+1 DR/Pacte/Résilience → Appliquer).
 * - phase 'choix' : le VAINQUEUR (héros) tranche via `OptionChooser` (« Au contact » / « Combat
 *   normal »). Un foe IA gagnant tranche en amont (pas de phase de choix montrée).
 */
export function AuContactModal() {
  const pd = useGame((s) => s.pendingAuContact);
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'auContact');
  const reroll = useGesteDeJet('jetRelancer', 'auContact');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'auContact');
  const darkPact = useGesteDeJet('jetPactiser', 'auContact');
  const force = useGesteDeJet('jetForcerLaReussite', 'auContact');
  const confirm = useGesteDeJet('jetValider', 'auContact');
  const regler = useGame((s) => s.jetRegler);
  const cancel = useGesteDeJet('jetAnnuler', 'auContact');
  if (!pd || !battle) return null;
  const mover = battle.combatants.find((c) => c.id === pd.moverId);
  const foe = battle.combatants.find((c) => c.id === pd.foeId);
  if (!mover || !foe) return null;
  const rolled = !!pd.def;
  const winnerIndex = pd.result === 'reussite' ? 1 : pd.result === 'echec' ? 0 : null;
  const outcome =
    pd.result === 'reussite' ? `${mover.label} l'emporte — à toi de choisir.`
    : pd.result === 'echec' ? `${foe.label} l'emporte et choisit.`
    : 'Égalité parfaite : le combat se poursuit normalement.';

  // Test OPPOSÉ de Corps à corps : la Difficulté est DÉCLARÉE UNE fois pour l'opposition entière
  // (LDB 12 l.166 ; jet de combat, LDB 13 l.118).
  // Lignes : `ligneDeCorpsACorpsBrut`, celle de `rollDisengageAttack`.
  const [foeL, moverL] = [ligneDeCorpsACorpsBrut(foe), ligneDeCorpsACorpsBrut(mover)];
  const [foeLine, moverLine] = opposedLines([
    { label: libelleDeTest('corps-a-corps'), base: foeL.base, target: cibleBrute(foeL), r: pd.atk, mods: foeL.mods },
    { label: libelleDeTest('corps-a-corps'), base: moverL.base, target: cibleBrute(moverL), r: pd.def, mods: moverL.mods },
  ]);
  // Rangée TÉMOIN : Corps à corps du foe, figé à l'ouverture (jamais relancé, aucun bouton) — MASQUÉ
  // tant que le mover n'a pas répondu (#990 : `pd.def` est SA réponse).
  const foeRow = frozenOpposedRow({
    revele: jetFigeRevele(useGame.getState(), JET_FIGE.auContact(pd)),
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
    lost: pd.result !== 'reussite',
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    rollLabel: t('verbe.lancer'),
  });

  const issue = pd.def
    ? [recapLineOfEvent(ev(pd.result === 'reussite' ? 'esquive' : 'attaque', outcome, mover.id, foe.id), battle.combatants)]
    : undefined;

  const actions: RollAction[] = [
    { key: 'abandonner', label: 'Renoncer', onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: confirm, verbe: 'valider' },
  ];

  if (pd.phase === 'choix') {
    // Le VAINQUEUR (héros) tranche : « Au contact » / « Combat normal ». Panneau résolu conservé.
    return (
      <RollShell
        etape={pd.phase}
        flowKey="auContact"
        stake={flowStakeRef(AU_CONTACT_STAKE[pd.phase])}
        title="Au contact"
        extra={<VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb="melee/au-contact" />}
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
                { key: 'contact', label: <><Icon id="melee/au-contact" size="sm" /> Au contact</>, primary: true, onSelect: () => regler('auContact', 'issue', 'contact'), title: 'Entrer dans la longueur d’arme : toute arme plus longue que Courte est traitée comme une Arme improvisée (les deux camps)' },
                { key: 'normal', label: <><Icon id="action/attaquer" size="sm" /> Combat normal</>, onSelect: () => regler('auContact', 'issue', 'normal'), title: 'Le combat se poursuit à distance d’arme normale' },
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
      extra={<VsHeader actor={mover} target={foe} label="entrer dans la longueur d'arme" verb="melee/au-contact" />}
      rows={[foeRow, actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      outcome={issue}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
