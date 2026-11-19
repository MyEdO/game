import { cibleMesuree } from '../engine/tests';
import { useGame } from '../state/store';
import { type PendingReload } from '../noyau/pendings';
import { flowStakeRef } from '../data';
import type { Combatant } from '../engine/types';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../noyau/combatLog';
import { describeReload } from '../noyau/flowOutcomes';
import { progresDeRecharge } from '../noyau/progresEtendu';
import { libelleDeTest } from '../noyau/jetsEnVue';
import { t } from '../i18n';
import { nomEnVue } from '../noyau/visionDuGroupe';
import { garanti } from '../lib/garanti';
import { useGesteDeJet } from './useGesteDeJet';

/** Vue pure de la modale de rechargement (testable sans store). */
export function ReloadModalView({
  pr,
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
  const after = progresDeRecharge(pr, actor).total;
  const weapon = actor?.weapons.find((w) => w.uid === pr.weaponUid);
  const weaponName = weapon?.label ?? 'arme'; // uid → NOM (affichage)
  // Ligne montée à l'ouverture (`pr.ligne`, Soutien MDG 12 l.462 compris).
  const { base, mods } = pr.ligne;

  const actorRow: BuiltRollRow = buildRollRow({
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(libelleDeTest('projectiles'), base, { roll: pr.roll!, ...cibleMesuree(pr), sl: pr.sl, success: pr.success }, pr.difficulty, mods) : undefined,
      pending: testPending(libelleDeTest('projectiles'), base, cibleMesuree(pr), pr.difficulty, mods),
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
    { key: 'abandonner', label: t('verbe.annuler'), onClick: onCancel, verbe: 'annuler' },
    { key: 'confirmer', label: t('verbe.valider'), onClick: onConfirm, verbe: 'valider' },
  ];

  return (
    <RollShell
      flowKey="rechargement"
      stake={flowStakeRef('rechargement-test', { values: { indice: pr.reload } })}
      title="Recharger"
      subtitle={<>{weaponName}</>}
      /* QUI recharge → portrait dans la ligne de jet ; Projectiles/cible vivent dans le cadre, le cumul dans la rangée. */
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled ? [recapLineOfEvent(ev('rechargement', describeReload(pr, nom, after, weaponName), pr.actorId))] : undefined}
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
  const nom = useGame((s) => (s.pendingReload ? nomEnVue(s, s.pendingReload.actorId) : null));
  const battle = useGame((s) => s.battle);
  const roll = useGesteDeJet('jetLancer', 'rechargement');
  const reroll = useGesteDeJet('jetRelancer', 'rechargement');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'rechargement');
  const darkPact = useGesteDeJet('jetPactiser', 'rechargement');
  const confirm = useGesteDeJet('jetValider', 'rechargement');
  const cancel = useGesteDeJet('jetAnnuler', 'rechargement');
  if (!pr || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pr.actorId);
  return (
    <ReloadModalView pr={pr} nom={garanti(nom, pr.actorId, 'tireur')} actor={actor} fortune={actor?.fortune ?? 0} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />
  );
}
