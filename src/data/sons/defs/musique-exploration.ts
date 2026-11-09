import type { SoundDef } from '../types';

/** « Medieval: Exploration » — RandomMind, CC0 (opengameart.org/content/medieval-exploration). */
export const sound: SoundDef = {
  id: 'musique-exploration',
  label: 'Musique d’exploration',
  files: ['musique-exploration.mp3'],
  volume: 0.45,
  music: { contexts: ['exploration'] },
};
