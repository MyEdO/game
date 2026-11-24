/**
 * Achat d'UNE unité chez le marchand ouvert par le chemin du produit : le panier (`fenetreChoisir('marchand', 'ajouterAuPanier', …)` → `fenetreChoisir('marchand', 'payer', true)`),
 * puis la répartition chez le premier héros (`fenetreValider('marchand')`), sur le propriétaire de l'état `get`.
 */
import type { Get } from './flowTypes';
import type { Jeu } from './etat';
import type { ArgumentsDuChoix } from './choixDesFenetres';
import { exemplaireCede, type DemandeDeTroc } from './merchantFlow';
import { garanti } from '../lib/garanti';
import type { Combatant } from '../engine/types';
import { withBourseMoney } from '../engine/bourse';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fromBrass } from '../engine/money';
import { ouvrirLeBanc } from './banc.testkit';
import { emptyNarratif } from './monde/campaignNarratif';
import { emptyScene } from './monde/scene';

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

/** L'armurier `artisan` d'un relais, le projet chargé avec `narratif`, le groupe réduit à `hero` (bourse : 960 sous de
 *  cuivre) ; `ouvrir` lui donne trois dagues en stock et ouvre l'échoppe. */
export function armurierDuRelais(hero: Combatant, narratif = emptyNarratif()) {
  const { getState: get, setState: set } = ouvrirLeBanc();
  const scene = emptyScene('relais', 5, 5);
  scene.entities.push(
    { id: 'depart', kind: 'heroStart', pos: { x: 1, y: 1 } },
    { id: 'artisan', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 2, y: 1 }, merchant: { archetype: { id: 'armurier' }, settlement: 'ville', resaleRate: 0.5 } },
  );
  set({ party: [withBourseMoney(hero, fromBrass(960), idsDeTest)] });
  get().chargerLeProjet({ scenes: [scene], entryId: scene.id, narratif, projet: null });
  const ouvrir = () => {
    set({ merchantStocks: { artisan: { stock: [{ id: 'dague', qty: 3 }], rolledAt: get().gameTime } } });
    get().jouerAction('artisan', 'commercer');
  };
  return { get, set, ouvrir };
}
