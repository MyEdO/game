import type { HealMode } from '../engine/healing';
import type { IconId } from './icons';

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
  wounds: { label: 'Blessures', icon: 'journal/heal' },
  bleed: { label: 'Hémorragie', icon: 'condition/bleeding' },
  trauma: { label: 'Déchirure', icon: 'medical/tear' },
  ammo: { label: 'Munition logée', icon: 'item/ammo' },
  surgery: { label: 'Chirurgie', icon: 'medical/scalpel' },
  recovery: { label: 'Rééducation', icon: 'medical/crutch' },
};
