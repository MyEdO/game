/** Contexte de jeu qui pilote la musique de fond (résolu depuis l'état par `musicSelectionOf`, `state/audioWiring.ts`). */
export type MusicContext = 'exploration' | 'interieur' | 'combat';

/** Définition d'un SON du jeu (assets CC0 — Kenney.nl/OpenGameArt). Une def = un id logique + ses VARIANTES (une est
 *  tirée au hasard à la lecture — évite la répétition). */
export interface SoundDef {
  id: string;
  label: string;
  /** Noms nus des fichiers (variantes du même son), que chaque hôte résout dans son dossier : `public/audio/` pour le
   *  web, `hotes/godot/projet/sons/` (dossier épinglé, `provenance.json`) pour Godot. */
  files: string[];
  /** Volume propre 0..1 (multiplié par le volume global). Défaut 1. */
  volume?: number;
  /** Présent ⇒ la def est une MUSIQUE de fond (canal dédié, boucle, fondu enchaîné) et non un SFX.
   *  `contexts` liste où elle peut jouer ; plusieurs pistes sur un contexte = variantes. */
  music?: { contexts: MusicContext[] };
}
