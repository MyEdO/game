import type { HealMode } from '../engine/healing';
import type { IconId } from '../data/icons';

/**
 * VOCABULAIRE d'un acte de soin — source UNIQUE de `useHealJetProps`, `useSurgeryJetProps` et du
 * dossier d'opération de `MedicModal` : ce sur QUOI porte le soin (`label`) et son icône. Sert à
 * annoter la flèche de l'A→B (`VsHeader`), qui est LA forme canonique du face-à-face (décision
 * utilisateur 2026-08-04) — plus aucune phrase « A soigne B » en sous-titre.
 *
 * Ni la Difficulté ni la Compétence n'ont de composeur ici (#1078 LOT B2) : elles voyagent en donnée
 * de LIGNE (`difficulty` → `testPending`/`testBreakdown` → `.rm-roll-diff`, #1072 ; « Guérison » est
 * le label de la ligne). Les écrire aussi au bandeau était le double rendu de classe #352.
 */
export const HEAL_ACT: Record<HealMode, { label: string; icon: IconId }> = {
  blessures: { label: 'Blessures', icon: 'journal/soin' },
  hemorragie: { label: 'Hémorragie', icon: 'etat/hemorragique' },
  traumatisme: { label: 'Déchirure', icon: 'medical/dechirure' },
  munition: { label: 'Munition logée', icon: 'objet/munition' },
  chirurgie: { label: 'Chirurgie', icon: 'medical/scalpel' },
  reeducation: { label: 'Rééducation', icon: 'medical/bequille' },
};
