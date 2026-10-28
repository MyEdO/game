/**
 * Achat d'UNE unité chez le marchand ouvert par le chemin du produit : le panier (`addToCart` → `payCart`),
 * puis la répartition chez le premier héros (`confirmDistribution`).
 */
import { useGame } from './store';

export function acheterAuPanier(id: string): void {
  const s = useGame.getState();
  s.addToCart(id);
  useGame.getState().payCart();
  useGame.getState().confirmDistribution();
}
