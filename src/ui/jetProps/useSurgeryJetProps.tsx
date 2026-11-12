import { cibleMesuree } from '../../engine/tests';
import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { type RollAction, type RollShell } from '../RollShell';
import { buildRollRow, type BuiltRollRow } from '../rollRowBuild';
import { testBreakdown, testPending } from '../breakdown';
import { Icon } from '../Icon';
import { HEAL_ACT } from '../healSubtitle';
import { libelleDeTest } from '../../noyau/jetsEnVue';
import { t } from '../../i18n';
import { useGesteDeJet } from '../useGesteDeJet';

/**
 * Jet d'UNE passe de Chirurgie (Test ÉTENDU influençable), données de la coquille — calque `useHealJetProps` :
 * « Lancer » → Chance (relance / +1 DR) → Résilience → « Appliquer la passe » (jetValider('chirurgie')). Le chirurgien
 * peut être un héros (Chance/Résilience) ; PNJ payant → ressources à 0. « Annuler » et Échap (avant le jet)
 * annulent la PASSE posée (jetAnnuler('chirurgie')) : l'opération armée, son cumul et le patient restent, et le
 * pied de l'infirmerie reprend « Arrêter l'opération » (`MedicModal`).
 */
export function useSurgeryJetProps(): ComponentProps<typeof RollShell> | null {
  const ps = useGame((s) => s.pendingSurgery);
  const kind = useGame((s) => s.medic?.surgery?.kind);
  const stake = useGame((s) => s.medic?.surgery?.stake); // posé à l'armement — opérer ≠ rééduquer
  const party = useGame((s) => s.party);
  const roll = useGesteDeJet('jetLancer', 'chirurgie');
  const reroll = useGesteDeJet('jetRelancer', 'chirurgie');
  const bonusSL = useGesteDeJet('jetAjouterUnDR', 'chirurgie');
  const darkPact = useGesteDeJet('jetPactiser', 'chirurgie');
  const force = useGesteDeJet('jetForcerLaReussite', 'chirurgie');
  const next = useGesteDeJet('jetValider', 'chirurgie');
  const cancel = useGesteDeJet('jetAnnuler', 'chirurgie');
  if (!ps) return null;
  const surgeon = party.find((c) => c.id === ps.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = surgeon?.fortune ?? 0;
  const rolled = ps.roll != null;
  // La ligne de la passe, figée à son ouverture (`passeDeLOperation`) : celle que le résolveur jette.
  const l = ps.ligne;
  const actorRow: BuiltRollRow = buildRollRow({
    actor: surgeon,
    row: {
      combatant: surgeon,
      d: rolled ? testBreakdown(libelleDeTest('guerison'), l.base, { roll: ps.roll!, ...cibleMesuree(ps), sl: ps.sl, success: ps.success }, l.difficulty, l.mods) : undefined,
      pending: testPending(libelleDeTest('guerison'), l.base, cibleMesuree(l), l.difficulty, l.mods),
    },
    rerolled: !!ps.rerolled,
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    onDarkPact: darkPact,
    onForce: force,
  }, {
    fortune,
    resilience: surgeon?.resilience ?? 0,
  });
  const recovery = kind === 'reeducation';
  const actions: RollAction[] = [
    { key: 'abandonner', label: t('verbe.annuler'), onClick: cancel, verbe: 'annuler' },
    { key: 'confirmer', label: 'Appliquer la passe', onClick: next, verbe: 'valider' },
  ];
  return {
    flowKey: 'chirurgie',
    stake,
    title: <><Icon id={HEAL_ACT[kind ?? 'chirurgie'].icon} size="sm" /> {recovery ? 'Rééduquer (une passe)' : 'Opérer (une passe)'}</>,
    /* AUCUN sous-titre : la passe est EMBARQUÉE dans le dossier d'opération, qui porte déjà l'A→B
       (`VsHeader` soignant→patient) au-dessus. Le geste est le titre, la Difficulté la donnée de la
       LIGNE (#1072), le cumul la `DrBar` — il ne reste rien à écrire ici. */
    rows: [actorRow],
    rolled,
    actions,
    onCancel: rolled ? undefined : cancel,
  };
}
