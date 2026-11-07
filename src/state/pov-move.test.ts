import { describe, it, expect } from 'vitest';
import { useGame } from './store';

/**
 * POV (vue subjective) côté web : la bascule de la vue (`togglePov`, préférence de l'adaptateur). Le pas et le cap du
 * groupe se jouent au banc du noyau (`src/noyau/pov-move.hors-store.test.ts`).
 */
describe('store — actions POV (pivoterLeGroupe / avancerDUnPas)', () => {
  it("povActive : défaut false, togglePov le bascule", () => {
    useGame.setState({ povActive: false });
    useGame.getState().togglePov();
    expect(useGame.getState().povActive).toBe(true);
    useGame.getState().togglePov();
    expect(useGame.getState().povActive).toBe(false);
  });
});
