/** Emplacements de base d'une palette (ordre stable), lus par les surcharges de palette et l'hôte 3D. */
export const SLOTS = ['peau', 'cheveux', 'yeux', 'vet1', 'vet2', 'cuir', 'metal', 'corps', 'accent'] as const;
export type Slot = (typeof SLOTS)[number];
