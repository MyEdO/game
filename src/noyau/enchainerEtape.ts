import type { Get } from './flowTypes';
import { programmer } from './plateforme';

/**
 * ENCHAÎNEMENT d'une étape depuis l'applier de la PRÉCÉDENTE — SOURCE UNIQUE de ce geste (`portFlow`,
 * `landMarketFlow`). Une conséquence qui veut OUVRIR l'étape suivante ne peut pas le faire pendant que
 * la cascade courante commite encore la sienne : d'où le report d'un tour de boucle, geste de l'HÔTE
 * (minuterie réelle), qui vit donc hors du séquenceur `cascade`. Sur le chemin INLINE (surface I, aucune cascade
 * ouverte) l'ouverture est DIRECTE et le flux reste synchrone — c'est ce que voit un jet non surfacé,
 * et donc ses tests.
 */
export function chainStep(get: Get, open: () => void): void {
  if (get().pendingCascade) programmer(open, 0);
  else open();
}
