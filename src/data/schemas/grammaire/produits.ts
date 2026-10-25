import { empreinte, produitDe, type ProduitDeFabrique } from './interne/produits';

/**
 * PORTE de lecture des produits de fabrique (#3012), pour qui vit hors de `grammaire/` : la mesure des
 * structures locales (`scripts/`) lit la classe d'un produit et l'empreinte d'un nœud par ces deux
 * fonctions ; l'écrivain `marquerProduit` reste derrière le mur (`interne/produits.ts`).
 */

/** La classe du produit de fabrique `noeud` (fabrique, rôle, clés apportées), ou `undefined` hors produit. */
export function classeDeProduit(noeud: unknown): ProduitDeFabrique | undefined {
  return produitDe(noeud);
}

/** L'empreinte de `noeud` : type zod, valeurs, enfants en profondeur ; un produit s'y lit par sa classe. */
export function empreinteDeNoeud(noeud: unknown): string {
  return empreinte(noeud);
}
