/**
 * L'achat d'une cargaison joué comme un hôte le joue (`cargaison.ts`) : l'offre, le porteur et l'Enc se composent, puis
 * l'achat se conclut, par les choix du marché ; le premier choix refusé se dit et arrête l'achat.
 */
import type { Jeu } from './etat';
import { refusDuChoix } from './choixDeFenetre';
import type { FenetreDuMarche } from './cargaison';
import type { ArgumentsDuChoix } from './choixDesFenetres';

/** Achète `enc` de l'offre `offre` sur le porteur `porteur` au marché `fenetre`, chaque choix joué par `jouer` (défaut :
 *  le verbe du noyau) ; rend le refus qui l'a arrêté, `null` s'il s'est conclu. */
export function acheterAuMarche(
  get: () => Jeu, fenetre: FenetreDuMarche, porteur: string, offre: string, enc: number,
  jouer: (args: ArgumentsDuChoix) => void = (args) => get().fenetreChoisir(...args),
): string | null {
  const choix: ArgumentsDuChoix[] = [[fenetre, 'offre', offre], [fenetre, 'porteur', porteur], [fenetre, 'encombrement', enc], [fenetre, 'acheter', true]];
  for (const args of choix) {
    const refus = refusDuChoix(get(), args[0], args[1], args[2]);
    jouer(args);
    if (refus) return refus;
  }
  return null;
}
