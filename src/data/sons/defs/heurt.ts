import type { SoundDef } from '../types';

/** Heurt sourd contre un mur/bord — exploration bloquée (#792). Réutilise l'asset d'impact CC0 Kenney, volume bas. */
export const sound: SoundDef = {
  id: 'heurt',
  label: 'Heurt contre un mur',
  files: ['impact-1.ogg', 'impact-2.ogg', 'impact-3.ogg'],
  volume: 0.35,
};
