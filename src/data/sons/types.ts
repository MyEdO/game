/** Contexte de jeu qui pilote la musique de fond (résolu depuis l'état par `musicSelectionOf`, `state/audioWiring.ts`). */
export type MusicContext = 'exploration' | 'interieur' | 'combat';

/** Définition d'un SON du jeu (assets CC0 — Kenney.nl/OpenGameArt, `public/audio/`). Une def = un id
 *  logique + ses VARIANTES (une est tirée au hasard à la lecture — évite la répétition). */
export interface SoundDef {
  id: string;
  /** Fichiers dans `public/audio/` (variantes du même son). */
  files: string[];
  /** Volume propre 0..1 (multiplié par le volume global). Défaut 1. */
  volume?: number;
  /** Présent ⇒ la def est une MUSIQUE de fond (canal dédié, boucle, fondu enchaîné) et non un SFX.
   *  `contexts` liste où elle peut jouer ; plusieurs pistes sur un contexte = variantes. */
  music?: { contexts: MusicContext[] };
}
