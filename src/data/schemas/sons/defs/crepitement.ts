import type { SoundDef } from '../types';

/** Crépitement d'un feu, joué en boucle par sa source de lumière — pagdev, « Fireplace Sound loop », OpenGameArt (CC0). */
export const sound: SoundDef = {
  id: 'crepitement',
  label: 'Crépitement',
  files: ['crepitement.ogg'],
  canal: 'ambiance',
  volume: 0.6,
};
