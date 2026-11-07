import type { SoundDef } from '../types';

/** « Medieval: Market Day » (boucle) — RandomMind, CC0 (opengameart.org/content/medieval-market-day). */
export const sound: SoundDef = {
  id: 'musique-ville',
  files: ['musique-ville.mp3'],
  volume: 0.45,
  music: { contexts: ['exploration'] },
};
