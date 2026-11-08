/**
 * Garde-fou « Schéma de Progression incomplet » (cliquet, patron `obtainability-guard.test.ts`).
 *
 * Vérifiable au LDB : `Source/Warhammer v4 - Livre de base version corrigee/08 - Statut.md`
 * l.2380-2384 (Sorcier) n'imprime que `CC / Int / FM`, alors que `careerLevels.json` porte en plus
 * `Ag`, `I` et `Soc` aux niveaux 2-4 — ces trois-là viennent de la maquette, pas du Markdown.
 *
 * Ticket #883 : la ligne de NIVEAU 1 est désormais lisible pour les 10 carrières via `pdfminer.six`
 * (police `crossbatstfb` distincte des en-têtes `CaslonAntique`, glyphes comparés par abscisse aux
 * en-têtes `CC CT F E I Ag Dex Int FM Soc`, recherche restreinte à la ligne du schéma pour écarter
 * les icônes de rang des niveaux qui partagent la même police). Les niveaux 2-4 sont des `LTRect`
 * remplis, distingués par `non_stroking_color` (0.357 cuivre = N2, 0.815 argent = N3, 0.000 or = N4),
 * alignés sur les colonnes de l'en-tête — extraits et curés (Ticket #954).
 *
 * Ce cliquet fige la garantie : aucun niveau de Carrière n'a de `characteristics` vide. Toute
 * NOUVELLE entrée vide — d'où qu'elle vienne — fait échouer la garde, au lieu de se dissimuler
 * dans un `[]` indistinguable d'un « ce niveau n'augmente aucune Caractéristique ».
 */
import { describe, it, expect } from 'vitest';
import { careerLevels } from './index';

describe('Schéma de Progression — aucun niveau ne perd ses Caractéristiques en silence', () => {
  it('aucun niveau de Carrière n’a de Schéma de Progression vide', () => {
    const vides = careerLevels
      .filter((l) => l.characteristics.length === 0)
      .map((l) => `${l.career.id}/${l.level}`)
      .sort();
    expect(vides).toEqual([]);
  });
});
