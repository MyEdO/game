/**
 * Attente de test UNIQUE du focus des cadres : le sauvetage de `useModalA11y` est lu à la tâche
 * SUIVANTE, posée par le rappel (micro-tâche) de son `MutationObserver`. On laisse donc s'écouler les
 * micro-tâches en attente, puis une tâche — dans cet ordre, sans quoi le minuteur du banc passerait
 * avant celui du sauvetage.
 */
import { act } from 'react';

export async function tacheSuivante(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}
