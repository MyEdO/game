import { describe, it, expect } from 'vitest';
import { CODEX, type CodexRow, type CodexSection } from './registry';
import { specLabel } from '../../data';

/**
 * Contrat (#2820) : une rangée `t:'ref'` du Codex nomme sa cible par le LIBELLÉ de la fiche Codex de même
 * `id` dans sa catégorie — jamais par l'id brut, ni pour la cible (`label` ≠ `id`) ni pour sa
 * spécialisation. Une référence spécialisée (« Métier (Armurier) ») porte ce libellé en tête, puis le
 * libellé de la spécialisation (`specLabel`) ; `show` peut porter autre chose (valeur, Indice), `label` non.
 */
describe('libellé des rangées de référence du Codex', () => {
  const fiches = new Map(CODEX.map((c) => [c.key, new Map(c.items.map((i) => [i.id, i.label]))]));
  const rangees = CODEX.flatMap((c) =>
    c.items.flatMap((item) =>
      [...(item.sections ?? []), ...(item.tabs ?? []).flatMap((t) => t.sections)].flatMap((s: CodexSection) =>
        s.rows.filter((r): r is Extract<CodexRow, { t: 'ref' }> => r.t === 'ref').map((r) => ({ porteur: `${c.key}/${item.id}`, r })),
      ),
    ),
  );

  it('chaque `label` égale le libellé de la fiche cible', () => {
    expect(rangees.length).toBeGreaterThan(0);
    const fautives = rangees.flatMap(({ porteur, r }) => {
      const libelle = fiches.get(r.category)?.get(r.id);
      const spec = libelle !== undefined && r.label.startsWith(`${libelle} (`) && r.label.endsWith(')') ? r.label.slice(libelle.length + 2, -1) : undefined;
      const juste = r.label !== r.id && (r.label === libelle || (spec !== undefined && specLabel(r.category, r.id, spec) === spec));
      return juste ? [] : [`${porteur} → ${r.category}/${r.id} : « ${r.label} » au lieu de « ${libelle ?? '(aucune fiche)'} »`];
    });
    expect(fautives).toEqual([]);
  });
});
