/**
 * Le pointeur d'un banc de scène, posé par `window.matchMedia` et RENDU après chaque test : sous
 * `isolate: false` un `matchMedia` laissé en place par un fichier fausse ceux qui suivent dans le worker.
 *
 * Pointeur FIN (souris) par défaut ; un test tactile pose lui-même
 * `vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as unknown as MediaQueryList)`.
 *
 * S'appelle au CORPS du fichier de test : les hooks s'enregistrent pour ce fichier-là, le corps de ce
 * module n'étant évalué qu'une fois par worker.
 */
import { afterEach, beforeEach, vi } from 'vitest';

export function piloterLePointeurFin(): void {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true }) as unknown as MediaQueryList));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}
