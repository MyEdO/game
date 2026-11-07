import type { SoundDef } from '../types';

/** « Medieval: Battle » — RandomMind, CC0 (opengameart.org/content/medieval-battle). */
export const sound: SoundDef = {
  id: 'musique-combat',
  files: ['musique-combat.mp3'],
  volume: 0.5,
  music: { contexts: ['combat'] },
};
