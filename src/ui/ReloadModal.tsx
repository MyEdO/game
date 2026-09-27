import { useGame, type PendingReload } from '../state/store';
import { flowStakeRef } from '../data';
import type { Combatant } from '../engine/types';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending, supportSplit } from './breakdown';
import { combatValueModParts } from '../engine/combat';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeReload } from '../state/flowOutcomes';

/** Vue pure de la modale de rechargement (testable sans store). */
export function ReloadModalView({
  pr,
  actor,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  pr: PendingReload;
  /** Tireur (jet mono-acteur) → portrait dans la ligne de jet. */
  actor?: Combatant;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pr.roll != null;
  const after = Math.max(0, pr.progressBefore + pr.sl);
  const weapon = actor?.weapons.find((w) => w.uid === pr.weaponUid);
  const weaponName = weapon?.label ?? 'arme'; // uid → NOM (affichage)
  // Soutien des servants (Arme d'équipe, MDG 12 l.462) : ligne de mod comme tout bonus, base SANS le Soutien.
  // Le Rechargement roule une valeur de COMBAT (`combatValue`) : ses modificateurs fondus se nomment
  // par le décomposeur de CETTE valeur (`combatValueModParts`), et la base retombe sur la valeur NUE
  // (#1178). `base + Σ mods` reste exactement la valeur jetée.
  const { base: supBase, mods: supMods } = supportSplit(pr.skillValue, pr.soutien);
  const valueParts = actor ? combatValueModParts(actor, 'ranged', weapon) : [];
  const base = supBase - valueParts.reduce((s, p) => s + p.value, 0);
  const mods = [...supMods, ...valueParts];

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown('Projectiles', base, { roll: pr.roll!, target: pr.target, sl: pr.sl, success: pr.success }, pr.difficulty, mods) : undefined,
      pending: testPending('Projectiles', base, pr.target, pr.difficulty, mods),
    },
    rerolled: !!pr.rerolled,
    onRoll,
    onReroll,
    onBonusSL,
    onDarkPact,
  }, {
    fortune,
    /* Test ÉTENDU (Rechargement) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: { cum: rolled ? after : pr.progressBefore, target: pr.reload },
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: onCancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: onConfirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="reload"
      stake={flowStakeRef('reload-roll', { values: { indice: pr.reload } })}
      title="Recharger"
      subtitle={<>{weaponName}</>}
      /* QUI recharge → portrait dans la ligne de jet ; Projectiles/cible vivent dans le cadre, le cumul dans la rangée. */
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(ev('reload', describeReload(pr, after, weaponName), pr.actorId))] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : onCancel}
    />
  );
}

/**
 * Rechargement d'une arme à distance = Test étendu de Projectiles (LDB 62 l.335 :
 * « une arme déchargée … nécessite un Test étendu de Projectiles … et nécessite d'obtenir
 * Indice DR pour être rechargée »). « Lancer » fait le jet, une Chance est possible avant
 * d'acquitter, et le DR obtenu se cumule vers l'Indice (LDB 12 l.170-174).
 */
export function ReloadModal() {
  const pr = useGame((s) => s.pendingReload);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.reloadRoll);
  const reroll = useGame((s) => s.reloadReroll);
  const bonusSL = useGame((s) => s.reloadBonusSL);
  const darkPact = useGame((s) => s.reloadDarkPact);
  const confirm = useGame((s) => s.reloadConfirm);
  const cancel = useGame((s) => s.reloadCancel);
  if (!pr || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pr.actorId);
  return (
    <ReloadModalView pr={pr} actor={actor} fortune={actor?.fortune ?? 0} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />
  );
}
