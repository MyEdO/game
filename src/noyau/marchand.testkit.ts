/**
 * Achat d'UNE unité chez le marchand ouvert par le chemin du produit : le panier (`addToCart` → `payCart`),
 * puis la répartition chez le premier héros (`confirmDistribution`), sur le propriétaire de l'état `get`.
 */
import type { Get } from './flowTypes';

export function acheterAuPanier(get: Get, id: string): void {
  const s = get();
  s.addToCart(id);
  get().payCart();
  get().confirmDistribution();
}
