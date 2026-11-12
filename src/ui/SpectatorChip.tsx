import { Icon } from './Icon';

/**
 * AFFORDANCE DE SPECTATEUR (coop) — puce discrète qui NOMME le siège attendu quand le geste
 * n'appartient pas au siège local. Deux poses : dans le FLUX (défaut), DANS le panneau qui porte
 * les commandes désactivées (zone de choix d'un dialogue, travée de la console) ; ou `ecran`, en
 * surimpression du champ, pour l'hôte qui arbitre les modales.
 *
 * L'ancrage est un ÉTAT de la primitive (`data-pose`), consommé par `spectator-chip.css` : les
 * trois hôtes partagent la même règle au lieu d'en recopier une chacun.
 */
export function SpectatorChip({ label, action = 'joue…', pose }: {
  label: string;
  /** Ce que le siège nommé est en train de faire (« joue… », « choisit la réponse… »). */
  action?: string;
  /** `ecran` = surimpression ancrée au champ ; absent = la puce suit le flux de son panneau. */
  pose?: 'ecran';
}) {
  return <div className="spectator-chip" data-pose={pose}><Icon id="interface/attendre" size="sm" /> {label} {action}</div>;
}
