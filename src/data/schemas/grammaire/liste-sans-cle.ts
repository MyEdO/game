import type { z } from 'zod';

const LISTES_SANS_CLE = new WeakSet<object>();

/** Déclare une séquence sans clé d'élément, sur son tableau final (après les bornes et affinages). */
export function listeSansCle<N extends z.ZodArray>(liste: N): N {
  LISTES_SANS_CLE.add(liste);
  return liste;
}

/** Lit la déclaration portée par ce nœud de tableau. */
export function estListeSansCle(noeud: unknown): boolean {
  return typeof noeud === 'object' && noeud !== null && LISTES_SANS_CLE.has(noeud);
}
