/**
 * Achat d'UNE unité chez le marchand ouvert par le chemin du produit : le panier (`fenetreChoisir('marchand', 'ajouterAuPanier', …)` → `payCart`),
 * puis la répartition chez le premier héros (`fenetreValider('marchand')`), sur le propriétaire de l'état `get`.
 */
import type { Get } from './flowTypes';

export function acheterAuPanier(get: Get, id: string): void {
  const s = get();
  s.fenetreChoisir('marchand', 'ajouterAuPanier', id);
  get().payCart();
  get().fenetreValider('marchand');
}
