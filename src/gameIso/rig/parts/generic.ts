import type { Slot } from '../bones';
import type { PartArt } from './types';

/** Fallback neutre par slot (le rig rend toujours quelque chose pour les vêtements). */
export function genericPart(slot: Slot): PartArt {
  switch (slot) {
    case 'tete':    return ''; // pas de couvre-chef par défaut (tête nue)
    case 'cou':     return ''; // le cou est résolu par cosmeticPart/resolveParts (NECK), jamais par tenue
    case 'visage':  return `<circle cx="0" cy="7" r="9" fill="@peau"/>`;
    case 'cheveux': return `<path d="M-9 6 Q0 -6 9 6 Q4 0 0 0 Q-4 0 -9 6Z" fill="@cheveux"/>`;
    case 'torse':   return `<path d="M-13 -28 Q0 -32 13 -28 L12 4 L10 34 Q0 38 -10 34 L-12 4 Z" fill="@vet1"/>`;
    case 'bras':    return `<rect x="-3" y="-2" width="6" height="34" rx="3" fill="@peau"/>`;
    case 'jambes':  return `<rect x="-4" y="0" width="8" height="50" rx="3" fill="@vet1O"/>`;
    case 'pied':    return ''; // le pied directionnel est fourni par resolveParts (FOOT)
    case 'main':    return ''; // la main directionnelle est fournie par resolveParts (HAND)
    case 'arme':    return '';
    case 'bouclier':return '';
  }
}
