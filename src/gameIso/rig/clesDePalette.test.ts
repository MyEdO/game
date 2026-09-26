import { describe, expect, it } from 'vitest';
import { communes } from './clesDePalette';

describe('clesDePalette — lignes communes', () => {
  it('`suit` vise une clé de la table : recoloriable ou commune', () => {
    const t = communes({ botte: { defaut: '#3a2614' }, semelle: { defaut: '#241608', suit: 'botte' }, aile: { suit: 'corps' } });
    expect(t.semelle.suit).toBe('botte');
    // @ts-expect-error `suit` hors de la table (faute de frappe)
    communes({ botte: { defaut: '#3a2614' }, semelle: { defaut: '#241608', suit: 'botet' } });
    // @ts-expect-error une clé commune ne peut pas être un Slot
    communes({ peau: { defaut: '#ffffff' } });
  });
});
