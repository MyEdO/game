import { useGame, type PendingBargain } from '../state/store';
import type { Combatant } from '../engine/types';
import { sceneNpc } from '../state/sceneNpc';
import { influencesLocally } from '../state/netOwnership';
import { RollShell, type RollAction } from './RollShell';
import { soutienMod, opposedLines } from './breakdown';
import { testValueParts } from '../engine/skills';
import { opposedResponded } from './opposedFrozen';
import { buildRollRow, frozenOpposedRow, type BuiltRollRow } from './rollRowBuild';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeBargain } from '../state/flowOutcomes';

/** Vue pure de la modale de Marchandage (Test OPPOSÉ, testable sans store). */
export function BargainModalView({
  pb,
  actor,
  merchant,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
  owned = true,
}: {
  pb: PendingBargain;
  /** Négociateur du groupe (portrait, ligne joueur). */
  actor?: Combatant;
  /** Le marchand, dérivé de l'entité de scène → portrait de la ligne adverse. */
  merchant?: Combatant;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  /** COOP (#1017) : ce siège possède-t-il le négociateur ? Faux → rangée TÉMOIN et aucune action —
   *  l'hôte ne joue pas le Marchandage d'un héros distant, et l'invité qui ne le possède pas non plus
   *  (`intentAllowedFor` refuserait le geste ; une affordance cliquable serait morte). */
  owned?: boolean;
}) {
  const rolled = pb.roll != null && pb.result != null;
  // #1153 — l'écran montre la grandeur qui TRANCHE : le Niveau de Compétence NU (`pb.playerBase`,
  // `LDB 09 l.17`), celle que `resolveOpposed` compare à DR égal (`LDB 12 l.160`). Tout le reste est
  // MODIFICATEUR de la cible et arrive NOMMÉ : le Soutien des conseillers (`LDB 12 l.187-200`) puis
  // TOUTES les composantes de la valeur de Test, par le décomposeur EXHAUSTIF `testValueParts`
  // (États, mutations, qualités d'objet, séquelles, effets, outil manquant, Encombrement — libellés et
  // renvois Codex tirés de la DONNÉE). La CIBLE ne bouge pas : elle reste `pb.playerSkill`, la valeur
  // que le résolveur a roulée — et `base + Σ mods` la retrouve exactement (invariant du décomposeur).
  const soutien = soutienMod(pb.support);
  const playerMods = [...(soutien ? [soutien] : []), ...(actor ? testValueParts(actor, 'marchandage', 'sociabilite') : [])];
  // Jet OPPOSÉ de Marchandage rendu façon Défense : 2 lignes à portrait (joueur + marchand), vainqueur
  // accentué, Difficulté DÉCLARÉE UNE fois pour l'opposition (LDB 12 l.166). Le Marchandage du marchand
  // reste OPAQUE → `mask:'value'` (portrait + dé + DR, sans base/cible).
  const [playerLine, merchantLine] = opposedLines([
    { label: 'Marchandage', base: pb.playerBase, r: pb.roll, target: pb.playerSkill, mods: playerMods },
    { label: 'Marchandage', base: pb.merchantValue, r: rolled ? pb.merchantRoll : undefined, mask: 'value' },
  ]);
  const playerD = playerLine.d;
  const merchantD = merchantLine.d ?? null;
  const opposed = rolled && !!actor && !!merchant && !!playerD && !!merchantD;

  // Rangée INTERACTIVE du négociateur (pré-jet en attente puis résultat), porteuse de son influence.
  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: playerD,
      pending: playerLine.pending,
    },
    rerolled: !!pb.rerolled,
    onRoll,
    onReroll,
    onBonusSL,
    onDarkPact,
  }, {
    interactive: owned,
    fortune,
  });
  // Rangée TÉMOIN du marchand — PRÉSENTE DÈS L'OUVERTURE, portrait compris (arbitrage user 2026-07-30,
  // #990, patron `frozenOpposedRow` des 7 autres sites à jet figé) : son Marchandage est connu du
  // pending (`merchantValue`) mais reste OPAQUE (`mask:'value'`, on ne lit pas la fiche d'un inconnu) et
  // le calendrier le masque ENTIÈREMENT (`mask:'roll'`, strictement plus fort) tant que le négociateur
  // n'a pas répondu ; à son jet, la rangée retombe sur l'opacité de valeur seule.
  const merchantRow: BuiltRollRow = frozenOpposedRow(useGame.getState(), {
    responded: opposedResponded(useGame.getState(), [{ id: pb.playerId, interactive: true, result: pb.roll ?? undefined }]),
    row: { combatant: merchant, ...(merchantD ? { d: merchantD } : { pending: merchantLine.pending }) },
  });
  const winnerIndex = opposed ? (pb.result!.attackerWins ? 0 : 1) : null;

  const actions: RollAction[] = owned
    ? [
        { key: 'cancel', label: 'Annuler', onClick: onCancel, when: 'pre' },
        { key: 'confirm', label: 'Conclure', onClick: onConfirm, when: 'post' },
      ]
    : [];

  return (
    <RollShell
      flowKey="bargain"
      title={pb.mode === 'buy' ? 'Marchander l’achat' : 'Marchander la vente'}
      /* Test OPPOSÉ : 2 lignes à portrait DÈS L'OUVERTURE (#990), l'adverse masquée jusqu'au jet. */
      subtitle={<>{pb.merchantName}{pb.negotiator ? <> · Négociateur</> : null}</>}
      rows={[actorRow, merchantRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      netSL={opposed ? pb.result!.netSL : undefined}
      outcome={rolled ? [recapLineOfEvent(ev('info', describeBargain(pb)))] : undefined}
      actions={actions}
      onCancel={rolled || !owned ? undefined : onCancel}
    />
  );
}

/**
 * Marchandage (LDB 59 l.43 : « réduire le prix de 10 % … 20 % avec un Succès Stupéfiant ou Négociateur »).
 * Test OPPOSÉ Marchandage (le meilleur négociateur du groupe) contre le Marchandage du marchand. « Lancer »
 * fait les deux jets, une Chance est possible avant de conclure (relance/+1 DR côté joueur). Le résultat est
 * verrouillé pour la visite (1 marchandage) et module les prix d'achat (−10/−20 %) et de vente (½ ou ¼).
 */
export function BargainModal() {
  const pb = useGame((s) => s.pendingBargain);
  const party = useGame((s) => s.party);
  const scene = useGame((s) => s.scene);
  const merchantState = useGame((s) => s.merchant);
  const roll = useGame((s) => s.bargainRoll);
  const reroll = useGame((s) => s.bargainReroll);
  const bonusSL = useGame((s) => s.bargainBonusSL);
  const darkPact = useGame((s) => s.bargainDarkPact);
  const confirm = useGame((s) => s.bargainConfirm);
  const cancel = useGame((s) => s.bargainCancel);
  // COOP (#1017) : l'ABONNEMENT à `net` (attribution des sièges) vit AVANT le retour anticipé — une
  // ré-attribution en cours de fenêtre doit re-rendre la modale, pas figer l'affordance du 1er rendu.
  useGame((s) => s.net);
  if (!pb) return null;
  const actor = party.find((c) => c.id === pb.playerId);
  // Le marchand est un PNJ de scène : sa fiche (portrait de la ligne adverse).
  const merchant = merchantState ? sceneNpc(scene, merchantState.entityId) : undefined;
  // Le Marchandage se joue ENTIER par le siège du négociateur — MÊME prédicat que la validation
  // d'intent côté hôte (`intentAllowedFor` → `seatInfluences`) : afficher et agir répondent pareil.
  const owned = influencesLocally(useGame.getState(), pb.playerId);
  return <BargainModalView pb={pb} actor={actor} merchant={merchant} fortune={actor?.fortune ?? 0} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} owned={owned} />;
}
