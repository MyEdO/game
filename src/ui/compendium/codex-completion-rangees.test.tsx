// @vitest-environment jsdom
/**
 * #1921 — les champs que DÉCLARE le nœud ne complètent que ce que la donnée ne porte pas (rangée neuve,
 * objet absent), et seulement dans une forme fidèle (`objetAdmis`, `editFields.ts`). Un objet PRÉSENT
 * dans la donnée garde ses seules clés : ni la variante d'une union, ni les champs d'un nœud voisin.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { CodexEdit } from './CodexEdit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

function libelles(categoryKey: string, id: string): string[] {
  const montage = monterRacine(null);
  act(() => montage.rendre(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />));
  return [...montage.container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label') ?? '');
}

describe('Codex — un objet présent garde ses seules clés', () => {
  it('bâton de combat : les Dégâts `{ plusBF, flat }` ne s’ouvrent pas sur la variante `literal` de l’union', () => {
    const degats = libelles('trappings', 'baton-de-combat').filter((l) => / de Dégâts$/.test(l));
    expect(degats).toEqual(['plusBF de Dégâts', 'flat de Dégâts']);
  });

  it('lumière : `cancelledBy.test` ne montre que `skill` et `difficulty`, les clés qu’il porte', () => {
    const test = libelles('domains', 'lumiere').filter((l) => / de Test de annulation de la rangée 1 /.test(l));
    expect(test.length, 'aucun contrôle de `cancelledBy.test` monté').toBeGreaterThan(0);
    expect(test.filter((l) => !/^(Retirer |Ajouter une entrée à )?(Compétence|difficulté) de Test /.test(l))).toEqual([]);
  });
});
