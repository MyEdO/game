import { useGame } from '../state/store';
import { type PendingStateRecovery } from '../noyau/pendings';
import { stateRecoveryStakeRef } from '../data';
import type { Combatant } from '../engine/types';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, witnessRow, type BuiltRollRow } from './rollRowBuild';
import { opposedLines } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { evDEtat } from '../noyau/combatLog';
import { describeStateRecovery } from '../noyau/flowOutcomes';
import { remedeDeLEtat } from '../noyau/actionRegistry';
import { conditionLabel } from '../data';
import { libelleDeForceAdverse } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { nomEnVue } from '../noyau/visionDuGroupe';
import { garanti } from '../lib/garanti';
import { useGesteDeJet } from './useGesteDeJet';

/** Vue pure de la modale « se libérer » (Empêtré) / « se rouler » (En flammes). Testable sans store. */
export function StateRecoveryModalView({
  sr,
  nom,
  actor,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  /** le nom de l'acteur tel que le groupe le connaît (`nomEnVue`). */
  nom: string;
  sr: PendingStateRecovery;
  /** Acteur qui se libère (jet mono-acteur côté joueur) → portrait dans la ligne de jet. */
  actor?: Combatant;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = sr.roll != null;
  // Contexte = nature du Test (opposé contre la source, ou cible) + pions ; le NOM de l'acteur est
  // montré par son portrait dans la ligne de jet (plus de nom en clair).
  const sub = sr.opposition
    ? `${sr.skillLabel} (opposé) contre ${sr.opposition.label}`
    : sr.requireSl != null
      ? `${sr.skillLabel}, cible ${sr.roll?.target ?? sr.skillValue} · DR ≥ ${sr.requireSl}`
      : `${sr.skillLabel}, cible ${sr.roll?.target ?? sr.skillValue}`;

  // Ligne de l'acteur : la Difficulté DÉCLARÉE par le flux (`sr.difficulty`, celle que roule le
  // résolveur `recover`) est une donnée de la ligne.
  const [actorLine] = opposedLines([{ label: sr.skillLabel, base: sr.skillValue, r: sr.roll ?? undefined }], sr.difficulty);
  // Rangée INTERACTIVE du joueur (pré-jet en attente puis résultat), porteuse de son cycle d'influence.
  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: actorLine.d,
      pending: actorLine.pending,
    },
    rerolled: !!sr.rerolled,
    onRoll,
    onReroll,
    onBonusSL,
    onDarkPact,
  }, { fortune });
  // Test opposé : rangée TÉMOIN de la source (Force), figée post-jet.
  const witness: BuiltRollRow | undefined = rolled && sr.opposition && sr.opponentRoll
    ? witnessRow({
        // La source oppose sa Force à Difficulté Intermédiaire — ce que roule le résolveur (LDB 12 l.166).
        row: opposedLines([{ label: libelleDeForceAdverse(sr.opposition.label), base: sr.opposition.value, r: sr.opponentRoll }])[0],
      })
    : undefined;

  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: onCancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: onConfirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="recuperation"
      stake={stateRecoveryStakeRef(sr.state)}
      title={remedeDeLEtat(sr.state)?.label ?? conditionLabel(sr.state)}
      subtitle={<>{sub} · {sr.stacks} pion{sr.stacks > 1 ? 's' : ''}</>}
      rows={witness ? [actorRow, witness] : [actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(evDEtat(sr.state, describeStateRecovery(sr, nom), sr.actorId))] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : onCancel}
    />
  );
}

/**
 * « Se libérer » d'un Empêtré (Test opposé de Force contre la source, LDB 16 l.66) ou « se rouler »
 * pour éteindre un En flammes (Test d'Athlétisme, l.84). Une Action ; succès ⇒ 1 + DR pions retirés.
 * « Lancer » fait le jet, une Chance est possible avant d'acquitter.
 */
export function StateRecoveryModal() {
  const sr = useGame((s) => s.pendingStateRecovery);
  const nom = useGame((s) => (s.pendingStateRecovery ? nomEnVue(s, s.pendingStateRecovery.actorId) : null));
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'recuperation');
  const reroll = useGesteDeJet('jetRelancer', 'recuperation');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'recuperation');
  const darkPact = useGesteDeJet('jetPactiser', 'recuperation');
  const confirm = useGesteDeJet('jetValider', 'recuperation');
  const cancel = useGesteDeJet('jetAnnuler', 'recuperation');
  if (!sr || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === sr.actorId);
  return (
    <StateRecoveryModalView sr={sr} nom={garanti(nom, sr.actorId, 'acteur qui se libère')} actor={actor} fortune={actor?.fortune ?? 0} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />
  );
}
