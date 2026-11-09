import { describe, it, expect } from 'vitest';
import { rendus } from './index';

describe('rendus.json — le catalogue des rendus des coups et des incantations (#3771)', () => {
  it('un projectile vole à sa vitesse sur sa cloche ; sans projectile, ni l’une ni l’autre', () => {
    const fautes = rendus.filter((r) => (r.projectile !== undefined) !== (r.vitesseMs !== undefined) || (r.projectile !== undefined) !== (r.cloche !== undefined)).map((r) => r.id);
    expect(fautes).toEqual([]);
  });
});
