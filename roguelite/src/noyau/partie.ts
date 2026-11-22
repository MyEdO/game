/**
 * La partie du noyau ouverte par l'hôte, et la fenêtre qui tient la main : son drive, à défaut sa validation.
 */
import { ouvrirLeLancement } from '../../../src/hote/partie';
import { fenetreDuJeu } from '../../../src/noyau/combatAuto';
import type { Intention } from '../../../src/noyau/partie';

export type PartieOuverte = ReturnType<typeof ouvrirLeLancement>['partie'];
export type Resultat = Parameters<ReturnType<typeof ouvrirLeLancement>['jetons']['programmes']>[0];

/** Joue la fenêtre qui tient la main : son drive, à défaut sa validation. Faux s'il n'y a rien à jouer (aucune
 *  fenêtre, ou une fenêtre qui attend un choix sans défaut). `apres` suit chaque geste. */
export function jouerLaFenetre(partie: PartieOuverte, recevoir: (r: Resultat) => void, apres: () => void = () => {}): boolean {
  const f = fenetreDuJeu(partie.etat() as never);
  if (!f) return false;
  const suite = f.drive?.length ? f.drive : f.gestes.filter((g) => g.verbe === 'fenetreValider');
  if (!suite.length) return false;
  for (const g of suite) {
    recevoir(partie.envoyer({ type: g.verbe, args: g.flux ? [g.flux] : g.fenetre ? [g.fenetre] : [] } as unknown as Intention));
    apres();
  }
  return true;
}
