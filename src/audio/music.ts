/**
 * Musique de fond — partie PURE : résolution de la musique depuis l'état du jeu.
 * Priorité : ce que la SCÈNE paramètre (éditeur : piste précise ou silence) > contexte
 * automatique (menu / exploration / intérieur / combat). La lecture (canal, boucle, fondu)
 * vit dans `engine.ts`.
 */
import { SOUND_DEFS } from './_registry.generated';
import type { MusicContext, SoundDef } from './types';
import { isIndoor, type Scene } from '../noyau/monde/scene';

/** Tranche minimale d'état nécessaire (évite de dépendre du store — testable à sec). */
export interface MusicStateSlice {
  screen: string;
  mode: string;
  battle: unknown;
  scene: Pick<Scene, 'ambiance' | 'music'> | null | undefined;
}

/** Ce que le canal doit jouer : une piste précise (`def`, paramétrée par la scène), un
 *  contexte (`ctx`, une piste du registre en est tirée), ou le silence (`null`). */
export type MusicSelection = { def: string } | { ctx: MusicContext } | null;

export function musicSelectionOf(s: MusicStateSlice): MusicSelection {
  // Musique UNIQUEMENT en jeu (vue campagne) : c'est le seul écran qui expose les contrôles
  // audio (☰ → volume/sourdine). Menu, groupe, créateur, galeries… = SILENCE — on n'impose
  // pas une musique qu'on ne peut pas couper (demande utilisateur 2026-06-11).
  if (s.screen !== 'campaign') return null;
  const inBattle = s.mode === 'battle' && !!s.battle;
  // La scène a la main (éditeur) : piste imposée, ou silence explicite (null).
  const wanted = inBattle ? s.scene?.music?.combat : s.scene?.music?.ambient;
  if (wanted === null) return null;
  if (typeof wanted === 'string') return { def: wanted };
  if (inBattle) return { ctx: 'combat' };
  return { ctx: s.scene && isIndoor(s.scene) ? 'interieur' : 'exploration' };
}

/** Pistes du registre jouables dans ce contexte (plusieurs = variantes, une est tirée au hasard). */
export function musicDefsFor(ctx: MusicContext): SoundDef[] {
  return SOUND_DEFS.filter((d) => d.music?.contexts.includes(ctx));
}

/** Toutes les pistes de musique du registre (pour les sélecteurs de l'éditeur). */
export function allMusicDefs(): SoundDef[] {
  return SOUND_DEFS.filter((d) => !!d.music);
}
