/**
 * `soutienMod` (LDB 12 « Soutien ») — la ligne de mod porte SA RÈGLE et SA PROVENANCE (#1078).
 * Le bonus n'est pas un nombre orphelin : la chip renvoie au texte de la règle, et dit QUI soutient.
 */
import { describe, it, expect } from 'vitest';
import { soutienMod } from './skills';
import { RULE_REF } from './ruleRefs';

const SUP = { count: 2, bonus: 20, ids: ['h2', 'h3'] };

describe('soutienMod — règle + provenance', () => {
  it('pointe l’entrée `regles/soutien` (la règle DÉPENSÉE, pas une caractéristique)', () => {
    expect(soutienMod(SUP)!.ref).toEqual(RULE_REF.soutien);
    expect(RULE_REF.soutien).toEqual({ category: 'regles', id: 'soutien' });
  });

  it('`by` porte UN item par soutien, en IDENTITÉ SEULE — le moteur reste pur', () => {
    // AUCUN résolveur de nom en paramètre : le passer de site en site s'oublie, et l'écran affiche
    // alors l'id brut (recette B3a, « soldat-de-test » depuis `medicFlow`). Le NOM se résout à la
    // COUTURE DE RENDU (`provenanceLabel`), que TOUTE chip traverse.
    expect(soutienMod(SUP)!.by).toEqual([{ id: 'h2' }, { id: 'h3' }]);
    // La signature elle-même ferme la porte : un 2ᵉ argument n'existe plus.
    expect(soutienMod.length).toBe(1);
  });

  it('personne ne soutient → aucune ligne (pas de « Soutien +0 »)', () => {
    expect(soutienMod({ count: 0, bonus: 0, ids: [] })).toBeUndefined();
    expect(soutienMod(undefined)).toBeUndefined();
  });
});
