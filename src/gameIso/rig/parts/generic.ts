import type { Slot } from '../bones';
import type { PartArt } from './types';

/** Fallback neutre par slot (le rig rend toujours quelque chose pour les vêtements). */
export function genericPart(slot: Slot): PartArt {
  switch (slot) {
    case 'tete':    return ''; // pas de couvre-chef par défaut (tête nue)
    case 'visage':  return `<circle cx="0" cy="7" r="9" fill="@peau"/>`;
    case 'cou':     return ''; // le cou système est fourni par resolveParts (NECK), jamais générique
    case 'cheveux': return `<path d="M-9 6 Q0 -6 9 6 Q4 0 0 0 Q-4 0 -9 6Z" fill="@cheveux"/>`;
    case 'torse':   return `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="@vet1"/>`;
    case 'bras':      return `<rect x="-3" y="-2" width="6" height="20" rx="3" fill="@peau"/>`; // épaule → coude (#633 D1)
    case 'avantBras': return `<rect x="-3" y="-3" width="6" height="19" rx="3" fill="@peau"/>`; // coude → poignet (#633 D1) ; -3 chevauche le bas de l'épaule (aucun pincement au coude)
    case 'jambes':  return `<rect x="-4" y="0" width="8" height="50" rx="3" fill="@vet1O"/>`;
    case 'pied':    return ''; // le pied orienté est fourni par resolveParts (BOTTE_CUIR/repli d'espèce)
    case 'main':    return ''; // la main orientée est fournie par resolveParts (HAND)
    case 'arme':    return '';
    case 'bouclier':return '';
  }
}
