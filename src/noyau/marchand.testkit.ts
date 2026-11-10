/**
 * Achat d'UNE unité chez le marchand ouvert par le chemin du produit : le panier (`fenetreChoisir('marchand', 'ajouterAuPanier', …)` → `fenetreChoisir('marchand', 'payer', true)`),
 * puis la répartition chez le premier héros (`fenetreValider('marchand')`), sur le propriétaire de l'état `get`.
 */
import type { Get } from './flowTypes';
import type { Jeu } from './etat';
import type { ArgumentsDuChoix } from './choixDesFenetres';
import { exemplaireCede, type DemandeDeTroc } from './merchantFlow';
import { garanti } from '../lib/garanti';

export function acheterAuPanier(get: Get, id: string): void {
  const s = get();
  s.fenetreChoisir('marchand', 'ajouterAuPanier', id);
  get().fenetreChoisir('marchand', 'payer', true);
  get().fenetreValider('marchand');
}

/** Les choix qui composent le Troc `d` dans l'échoppe ouverte de l'état `s`, puis le concluent (`marchand.troquer`),
 *  chacun en arguments de `fenetreChoisir`. */
export function choixDuTroc(s: Pick<Jeu, 'party'>, d: DemandeDeTroc): ArgumentsDuChoix[] {
  const hero = garanti(s.party.find((h) => h.id === d.giveHeroId), d.giveHeroId, 'héros cédant');
  return [
    ['marchand', 'trocCeder', exemplaireCede(hero, d.giveTrappingId)],
    ['marchand', 'trocRecevoir', d.getStockId],
    ['marchand', 'trocQuantite', d.getCount ?? 1],
    ['marchand', 'troquer', true],
  ];
}

/** Compose puis conclut le Troc `d` dans l'échoppe ouverte de `get`. */
export function troquer(get: Get, d: DemandeDeTroc): void {
  for (const args of choixDuTroc(get(), d)) get().fenetreChoisir(...args);
}
