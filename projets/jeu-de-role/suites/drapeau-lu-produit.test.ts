/**
 * GARDE ABSOLUE (#2219, #2539) sur chaque paquet livré du jeu : tout drapeau et tout état lu a son producteur, tout état
 * déclaré est produit. Contrat et couverture du détecteur : `src/data/schemas/defs-scenes/drapeau-lu-produit.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { declaresNonProduits, lusSansProducteur } from '../../../src/data/schemas/defs-scenes/lectureEtProduction.testkit';

describe('#2219 · #2539 — lu → producteur, sur chaque paquet livré', () => {
  for (const rel of listerProjetsLivres())
    it(rel, () => {
      expect(lusSansProducteur(parseProject(lireProjetLivre(rel))), 'drapeau ou état lu sans producteur dans le paquet').toEqual([]);
    });
});

describe('#2539 — état déclaré → produit, sur chaque paquet livré', () => {
  for (const rel of listerProjetsLivres())
    it(rel, () => {
      expect(declaresNonProduits(parseProject(lireProjetLivre(rel))), 'état de campagne déclaré sans producteur dans le paquet').toEqual([]);
    });
});
