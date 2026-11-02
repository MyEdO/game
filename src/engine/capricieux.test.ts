import { describe, it, expect } from 'vitest';
import { capriciousDR } from './social';

/**
 * Capricieux (Trait de créature, MSRC 15 l.149-159) : « Lorsqu'un Personnage effectue un Test de
 * Sociabilité en traitant avec la créature, lancez un dé selon le Tableau suivant : » — la table rend
 * un DELTA de DR (« Soustraire 2 au DR » … « Ajouter 2 au DR »).
 * Son application au DR du Test RÉSOLU est mesurée par `noyau/capricieux-flow.hors-store.test.ts`.
 */
describe('capriciousDR — table d10 (MSRC 15 l.149-159)', () => {
  it('1 → Soustraire 2 au DR', () => expect(capriciousDR(1)).toBe(-2));
  it('2-3 → Soustraire 1 au DR', () => { expect(capriciousDR(2)).toBe(-1); expect(capriciousDR(3)).toBe(-1); });
  it('4-7 → Utiliser le DR indiqué', () => { for (const r of [4, 5, 6, 7]) expect(capriciousDR(r)).toBe(0); });
  it('8-9 → Ajouter 1 au DR', () => { expect(capriciousDR(8)).toBe(1); expect(capriciousDR(9)).toBe(1); });
  it('10 → Ajouter 2 au DR', () => expect(capriciousDR(10)).toBe(2));
});
