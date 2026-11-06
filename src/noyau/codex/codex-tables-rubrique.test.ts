/**
 * GARDE STRUCTURELLE (#1612) — toute entrée de `tables.json` est ATTEIGNABLE au Compendium.
 *
 * Mode de panne fermé : une table d'effets authorée que le joueur ne peut LIRE nulle part. Elle est
 * tirée par l'op `rollTable` en pleine partie (« Mendier — Échec Stupéfiant : les ennuis »), ses
 * rangées le marquent, et sa fiche n'existerait à aucune rubrique — donc ni citable, ni éditable au
 * Codex, ni couverte par les relations inverses. La rubrique porteuse est `effectTables` (« Tables
 * d'effets »), qui projette le dataset ENTIER : ce contrat verrouille cette projection par
 * CONSTRUCTION — poser un filtre dans `registry.ts` rend la garde rouge, nominativement.
 *
 * Le stock des entrées SANS rubrique se mesure ici et vaut ZÉRO : il n'y a pas de liste d'exception à
 * tenir, seulement un écart à corriger.
 *
 * MUTATIONS qui doivent le faire ROUGIR :
 *  - filtrer `effectTables.map(...)` dans la catégorie `effectTables` de `registry.ts` → l'id filtré
 *    apparaît nominativement dans « entrées de tables.json sans rubrique au Compendium ».
 *  - retirer l'entrée `mendier-ennuis` de `tables.json` → la non-vacuité tombe.
 */
import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';
import { effectTables } from '../../data/effectTables';

/** id de table → rubriques (clés de catégorie) qui l'exposent au joueur. */
function rubriquesParTable(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const t of effectTables) out.set(t.id, []);
  for (const cat of CODEX) {
    for (const item of cat.items) {
      const rubs = out.get(item.id);
      if (rubs && !rubs.includes(cat.key)) rubs.push(cat.key);
    }
  }
  return out;
}

describe('Codex — toute table d’effets a sa rubrique (#1612)', () => {
  it('AUCUNE entrée de `tables.json` n’est hors rubrique — refus NOMINATIF', () => {
    const parTable = rubriquesParTable();
    const orphelines = [...parTable.entries()]
      .filter(([, rubs]) => rubs.length === 0)
      .map(([id]) => `${id} (${effectTables.find((t) => t.id === id)!.label}) — tirable par l’op « rollTable », lisible nulle part`);
    expect(orphelines, `entrées de tables.json sans rubrique au Compendium :\n${orphelines.join('\n')}`).toEqual([]);
  });

  it('NON-VACUITÉ : le dataset est peuplé, et « mendier-ennuis » y est — recette 2026-09-06', () => {
    const parTable = rubriquesParTable();
    expect(parTable.size).toBeGreaterThan(1);
    expect(parTable.get('mendier-ennuis'), 'la table des ennuis de Mendier doit avoir une rubrique').toContain('effectTables');
  });

  it('la rubrique porteuse EXISTE et rend la table avec ses rangées', () => {
    const cat = CODEX.find((c) => c.key === 'effectTables');
    expect(cat, 'rubrique « Tables d’effets » absente du Codex').toBeTruthy();
    const item = cat!.items.find((i) => i.id === 'mendier-ennuis')!;
    expect(item.label).toBe('Mendier — Échec Stupéfiant : les ennuis');
    const lignes = (item.sections ?? []).flatMap((s) => s.rows);
    // Les 3 fourchettes du d10 sont des sous-têtes, et l'amende des gardes est RENDUE (jamais comptée).
    expect(lignes.filter((r) => r.t === 'sub').map((r) => (r as { label: string }).label))
      .toEqual(['1–3 · Les gardes locaux vous délogent', '4–7 · Les autres mendiants du coin défendent leur place', '8–10 · D’importants échecs : la journée n’aura rien rapporté']);
    expect(lignes.length).toBeGreaterThan(3);
  });
});
