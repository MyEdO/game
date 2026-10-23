import type { FabriqueDId } from '../lib/entityId';

/**
 * L'ENTROPIE DE L'HÔTE (#2817, D8) : le seul site de `Math.random` de `src/` (mur `murs/entropie`,
 * `oxlint.config.mjs`). Le moteur et le noyau n'en tirent jamais : ils reçoivent un `RNG` nommé par
 * l'appelant, et l'hôte sème le RNG de bataille de `graineDEntropie` au branchement du store.
 */

/** Entier d'entropie dans [0, n[ : tirage de présentation (défilement d'un dé, variante d'un son). */
export const entierDEntropie = (n: number): number => Math.floor(Math.random() * n);

/** Graine d'entropie dans [0, 0xffff] : RNG de bataille, brouillon de création, générateur de nom. */
export const graineDEntropie = (): number => entierDEntropie(0x10000);

/** La fabrique d'ids neufs de l'hôte web (`FabriqueDId`, #2817, #2907) : un id unique d'un projet, d'une
 *  sauvegarde, d'un onglet et d'un siège à l'autre — scène, carte, projet, lieu, trajet, et ce que la partie
 *  fabrique (objet, héros, refus). Horloge de l'hôte plus entropie : sa forme (`genre-horloge-tirage`) ne
 *  rejoint jamais celle d'un compteur. */
export const idDEntropie: FabriqueDId = (genre) =>
  `${genre}-${Date.now().toString(36)}-${entierDEntropie(36 ** 6).toString(36).padStart(6, '0')}`;
