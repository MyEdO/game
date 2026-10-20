/**
 * L'ENTROPIE DE L'HÔTE (#2817, D8) : le seul site de `Math.random` de `src/` (mur `murs/entropie`,
 * `oxlint.config.mjs`). Le moteur et le noyau n'en tirent jamais : ils reçoivent un `RNG` nommé par
 * l'appelant, et l'hôte sème le RNG de bataille de `graineDEntropie` au branchement du store.
 */

/** Entier d'entropie dans [0, n[ : tirage de présentation (défilement d'un dé, variante d'un son). */
export const entierDEntropie = (n: number): number => Math.floor(Math.random() * n);

/** Graine d'entropie dans [0, 0xffff] : RNG de bataille, brouillon de création, générateur de nom. */
export const graineDEntropie = (): number => entierDEntropie(0x10000);

/** Id d'entité unique d'un projet à l'autre (scène, carte, projet, lieu, trajet) : la seule fabrique
 *  d'id de l'hôte (#2817), horloge de l'hôte plus entropie. */
export const idDEntropie = (genre: string): string =>
  `${genre}-${Date.now().toString(36)}-${entierDEntropie(36 ** 6).toString(36).padStart(6, '0')}`;
