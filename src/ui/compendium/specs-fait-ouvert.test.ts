import { describe, it, expect } from 'vitest';
import { codexLookupById } from './registry';

// LDB 10 l.548 (Haine), LDB 10 l.1091 (Sens aiguisé) ; `specsOpen` : `src/data/schemas/defs/{skills,talents}.ts`.
describe('fait « Spécialisations » du Codex — marque de liste ouverte, Compétence comme Talent', () => {
  const fait = (category: string, id: string) => codexLookupById(category, id)?.meta?.find((m) => m.label === 'Spécialisations');
  it.each([
    ['talents', 'haine', 'Spécialisation ouverte'],
    ['skills', 'metier', 'Spécialisation ouverte'],
    ['talents', 'sens-aiguise', undefined],
    ['skills', 'langue', undefined],
  ])('%s « %s » : marque %s', (category, id, marque) => {
    const f = fait(category, id);
    expect(f, `${category}/${id}`).toBeDefined();
    expect(f!.marque).toBe(marque);
  });
});
