/**
 * Musique de fond — partie PURE : les pistes du registre et la forme d'une sélection. La sélection
 * depuis l'état du jeu vit chez l'hôte (`state/audioWiring.ts`), la lecture (canal, boucle, fondu)
 * dans `engine.ts`.
 */
import { SOUND_DEFS } from './_registry.generated';
import type { MusicContext, SoundDef } from './types';

/** Ce que le canal doit jouer : une piste précise (`def`, paramétrée par la scène), un
 *  contexte (`ctx`, une piste du registre en est tirée), ou le silence (`null`). */
export type MusicSelection = { def: string } | { ctx: MusicContext } | null;

/** Pistes du registre jouables dans ce contexte (plusieurs = variantes, une est tirée au hasard). */
export function musicDefsFor(ctx: MusicContext): SoundDef[] {
  return SOUND_DEFS.filter((d) => d.music?.contexts.includes(ctx));
}

/** Toutes les pistes de musique du registre (pour les sélecteurs de l'éditeur). */
export function allMusicDefs(): SoundDef[] {
  return SOUND_DEFS.filter((d) => !!d.music);
}

/** Les ids des pistes de musique du registre : ce que l'hôte web sait jouer, passé à `validateScene`. */
export function idsDesPistesDeMusique(): ReadonlySet<string> {
  return new Set(allMusicDefs().map((d) => d.id));
}
