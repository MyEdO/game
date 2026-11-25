/**
 * #1466 sur chaque paquet livré du jeu : toute feuille `do` de ses Flows passe `effectSchema`. Contrat de la grammaire :
 * `src/data/schemas/defs-scenes/flow-de-scene.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { effectSchema } from '../../../src/data/schemas/defs-scenes/effets';
import { feuillesDo } from '../../../src/data/schemas/defs-scenes/feuillesDo.testkit';

describe('#1466 — les feuilles `do` de chaque paquet livré passent `effectSchema`', () => {
  for (const rel of listerProjetsLivres())
    it(rel, () => {
      const feuilles = feuillesDo([lireProjetLivre(rel)]);
      expect(feuilles.filter((e) => !effectSchema.safeParse(e).success).map((e) => JSON.stringify(e).slice(0, 120))).toEqual([]);
    });
});
