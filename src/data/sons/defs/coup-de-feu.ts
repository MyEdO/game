import type { SoundDef } from '../types';

/** Détonation d’arme à poudre — rubberduck, « 25 CC0 bang / firework SFX », OpenGameArt (CC0). */
export const sound: SoundDef = {
  id: 'coup-de-feu',
  label: 'Coup de feu',
  files: ['coup-de-feu-1.ogg', 'coup-de-feu-2.ogg', 'coup-de-feu-3.ogg'],
  volume: 0.9,
};
