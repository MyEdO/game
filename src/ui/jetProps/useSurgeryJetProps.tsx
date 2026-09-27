import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { type RollAction, type RollShell } from '../RollShell';
import { buildRollRow, type BuiltRollRow } from '../rollRowBuild';
import { testValueSplit, testBreakdown, testPending } from '../breakdown';
import { Icon } from '../Icon';
import { HEAL_ACT } from '../healSubtitle';

/**
 * Jet d'UNE passe de Chirurgie (Test ÉTENDU influençable), données de la coquille — calque `useHealJetProps` :
 * « Lancer » → Chance (relance / +1 DR) → Résilience → « Appliquer la passe » (surgeryNext). Le chirurgien
 * peut être un héros (Chance/Résilience) ; PNJ payant → ressources à 0. « Annuler » et Échap (avant le jet)
 * annulent la PASSE posée (surgeryPassCancel) : l'opération armée, son cumul et le patient restent, et le
 * pied de l'infirmerie reprend « Arrêter l'opération » (`MedicModal`).
 */
export function useSurgeryJetProps(): ComponentProps<typeof RollShell> | null {
  const ps = useGame((s) => s.pendingSurgery);
  const kind = useGame((s) => s.medic?.surgery?.kind);
  const stake = useGame((s) => s.medic?.surgery?.stake); // posé à l'armement — opérer ≠ rééduquer
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.surgeryRoll);
  const reroll = useGame((s) => s.surgeryReroll);
  const bonusSL = useGame((s) => s.surgeryBonusSL);
  const darkPact = useGame((s) => s.surgeryDarkPact);
  const force = useGame((s) => s.surgeryForceSuccess);
  const next = useGame((s) => s.surgeryNext);
  const cancel = useGame((s) => s.surgeryPassCancel);
  if (!ps) return null;
  const surgeon = party.find((c) => c.id === ps.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = surgeon?.fortune ?? 0;
  const rolled = ps.roll != null;
  // Soutien des assistants de chirurgie (LDB 12) et composantes de la valeur de Test (États, séquelles,
  // passifs, effets — #1178) : lignes de mod NOMMÉES, base rebasée sur le Niveau de Compétence nu
  // (LDB 09 l.17). Chirurgien PNJ tarifé (aucune fiche) : affichage inchangé (garde de reconstruction).
  const { base, mods: supMods } = testValueSplit(surgeon, ps.skillValue, { support: ps.support, skill: 'guerison' });
  const actorRow: BuiltRollRow = buildRollRow({
    actor: surgeon,
    row: {
      combatant: surgeon,
      d: rolled ? testBreakdown('Guérison', base, { roll: ps.roll!, target: ps.target, sl: ps.sl, success: ps.success }, ps.difficulty, supMods) : undefined,
      pending: testPending('Guérison', base, ps.target, ps.difficulty, supMods),
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
  const recovery = kind === 'recovery';
  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer la passe', onClick: next, when: 'post' },
  ];
  return {
    flowKey: 'surgery',
    stake,
    title: <><Icon id={HEAL_ACT[kind ?? 'surgery'].icon} size="sm" /> {recovery ? 'Rééduquer (une passe)' : 'Opérer (une passe)'}</>,
    /* AUCUN sous-titre : la passe est EMBARQUÉE dans le dossier d'opération, qui porte déjà l'A→B
       (`VsHeader` soignant→patient) au-dessus. Le geste est le titre, la Difficulté la donnée de la
       LIGNE (#1072), le cumul la `DrBar` — il ne reste rien à écrire ici. */
    rows: [actorRow],
    rolled,
    actions,
    onCancel: rolled ? undefined : cancel,
  };
}
