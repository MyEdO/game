/**
 * LA SORTIE D'UNE FENÊTRE (#3367) : un seul verbe, `fenetreFermer(fenetre)`, la fenêtre en argument. Chaque fenêtre qui
 * se ferme le déclare dans son registre (`sortie`, `modalArbiter.ts`) ; son corps vit dans la table totale
 * `SortiesDeFenetre`, assemblée par `fabriquesDuNoyau.ts`.
 */
import { t } from '../i18n';
import type { ActionsDuNoyau } from './actionsDuNoyau';
import type { Jeu } from './etat';
import type { Get, Set } from './flowTypes';
import { libelleDeLaFermeture } from './libelles';
import { sortieDeLaFenetre, type FenetreQuiSeFerme } from './modalArbiter';
import { refuserGesteDuSiege } from './refusVisible';

/** Le corps de la sortie de chaque fenêtre qui se ferme, que seul `fenetreFermer` appelle : une fenêtre qui déclare sa
 *  `sortie` sans corps ne compile pas. */
export type SortiesDeFenetre = { readonly [F in FenetreQuiSeFerme]: () => void };

/** Ce qui refuse la sortie de `fenetre` venue d'une frontière (JSON d'un hôte, intention d'un siège) : une fenêtre qui
 *  ne se ferme pas, une fenêtre fermée, la sortie de l'hôte dans l'état d'un invité, ce qui ferme sa sortie maintenant
 *  (`sortieFermee`) ; `null` : elle se joue. */
export function refusDeLaSortie(s: Jeu, fenetre: unknown): string | null {
  const sortie = sortieDeLaFenetre(fenetre);
  if (!sortie) return t('sortie.refus.inconnue');
  if (!sortie.ouverte(s)) return t('sortie.refus.fermee');
  if (sortie.sortie === 'hote' && s.net.mode === 'guest') return t('sortie.refus.hoteSeul');
  const fermee = sortie.fermee(s);
  return fermee && libelleDeLaFermeture(fermee);
}

/** Le verbe de sortie du noyau sur `get`/`set` : il refuse, et le dit, la sortie que `refusDeLaSortie` refuse, sinon
 *  joue le corps de la fenêtre (`sorties`). */
export function creerSortieDeFenetre(get: Get, set: Set, sorties: SortiesDeFenetre): Pick<ActionsDuNoyau, 'fenetreFermer'> {
  return {
    fenetreFermer: (fenetre) => {
      const refus = refusDeLaSortie(get(), fenetre);
      if (refus) { refuserGesteDuSiege(get, set, refus); return; }
      sorties[fenetre]();
    },
  };
}
