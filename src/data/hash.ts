/**
 * Hash 32 bits déterministe (FNV-1a) + flux pseudo-aléatoire semé — PURS, stables inter-plateformes
 * (arithmétique entière 32 bits via `Math.imul`, zéro état de module, zéro entropie).
 *
 * INVARIANT (Lot 0 rendu) : le seed d'un détail de surface est TOUJOURS dérivé de l'identité MONDE de
 * l'élément — ex. `hash32('wall', x, y, z, side)` selon le `seedScope` de la recette — et JAMAIS
 * stocké : les deux backends (iso affine, POV perspective) retombent sur le MÊME détail sans se parler,
 * et recharger/rejouer la scène redonne exactement le même rendu.
 */

/** FNV-1a 32 bits sur la concaténation des parts. Un séparateur est haché ENTRE les parts pour que
 *  `('ab','c')` et `('a','bc')` divergent. Retour : entier non signé ∈ [0, 2³²−1]. */
export function hash32(...parts: (string | number)[]): number {
  let h = 0x811c9dc5; // offset basis FNV-1a
  for (const p of parts) {
    h ^= 0x1f; // « unit separator » inter-parts
    h = Math.imul(h, 0x01000193);
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

/** Flux déterministe de flottants ∈ [0,1) dérivé d'un seed 32 bits — même noyau mulberry32 que
 *  `makeRNG` (engine/dice), exposé en FLOTTANTS : l'interface `RNG.int` (entier inclusif) ne convient
 *  pas aux UV/jitters continus de l'expansion. */
export function seedStream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
