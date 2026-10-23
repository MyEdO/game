/**
 * Services que le noyau demande à l'environnement d'exécution (#2817, D6) : un appel différé, l'état
 * de son jeton, la persistance d'un héros et la fabrique d'ids neufs (#2907). L'hôte pose UNE plateforme (`poserLaPlateforme`) ; tout appel
 * sans plateforme posée lève. Le web la pose à la création du store (`src/state/store.ts`).
 */
import type { Combatant } from '../engine/types';
import type { FabriqueDId } from '../lib/entityId';

declare const marqueDuJeton: unique symbol;

/** Jeton d'un appel différé, rendu par `programmer` : type NOMINAL, aucune autre valeur ne s'y assigne. */
export type Jeton = { readonly [marqueDuJeton]: true };

/** Les services d'un hôte dont l'appel différé rend des jetons `J` (en propriétés : paramètres contravariants). */
export interface PlateformeDe<J> {
  programmer: (suite: () => void, delai: number) => J;
  /** Vrai tant que l'appel du jeton n'a ni tiré ni été annulé par l'hôte. */
  enAttente: (jeton: J) => boolean;
  persisterLeHeros: (heros: Combatant) => void;
  /** La fabrique d'ids neufs de l'hôte (`FabriqueDId`, `src/lib/entityId.ts`). */
  idNeuf: FabriqueDId;
}

export type Plateforme = PlateformeDe<Jeton>;

let posee: Plateforme | null = null;

function plateforme(): Plateforme {
  if (!posee) throw new Error('Plateforme absente : le noyau a besoin d’un hôte qui l’a posée par `poserLaPlateforme` (src/noyau/plateforme.ts).');
  return posee;
}

export function poserLaPlateforme(p: Plateforme): void {
  posee = p;
}

/** Retire la plateforme posée et la rend, pour qu'on la repose. */
export function retirerLaPlateforme(): Plateforme {
  const p = plateforme();
  posee = null;
  return p;
}

export function programmer(suite: () => void, delai: number): Jeton {
  return plateforme().programmer(suite, delai);
}

export function enAttente(jeton: Jeton): boolean {
  return plateforme().enAttente(jeton);
}

export function persisterLeHeros(heros: Combatant): void {
  plateforme().persisterLeHeros(heros);
}

/** Un id neuf de genre `genre`, par la fabrique de l'hôte (`FabriqueDId`). */
export const idNeuf: FabriqueDId = (genre) => plateforme().idNeuf(genre);
