import { describe, it, expect } from 'vitest';
import { categoryByKey } from './registry';
import { datasetArray } from '../../data/overrides';
import { metaDesChamps } from '../../data/schemas/grammaire/meta';
import { PORTEURS_DE_CAPACITES } from './porteursDeCapacites.testkit';

// La fiche du Codex ne rend pas en lecture les libellés de saisie du schéma de capacités : choix
// d'interface : la saisie (CodexEdit) les porte.
type Porteur = { id: string; capabilities?: object };

describe('Codex — les libellés de saisie des capacités restent hors de la fiche', () => {
  it('la dérivation trouve au moins les porteurs connus', () => {
    expect(PORTEURS_DE_CAPACITES.map((p) => p.dataset)).toEqual(expect.arrayContaining(['traits', 'qualities', 'symptoms']));
  });

  for (const { categorie: key, dataset, schema } of PORTEURS_DE_CAPACITES) {
    const entrees = datasetArray(dataset) as Porteur[];
    it(`${key} : aucune fiche à capacités posées ne porte de libellé de champ du schéma`, () => {
      const champs = metaDesChamps(schema, { exigees: true });
      const porteurs = entrees.filter((e) => Object.values(e.capabilities ?? {}).some((v) => v === true));
      expect(porteurs.length).toBeGreaterThan(0);
      const fuites = porteurs.flatMap((e) => {
        const fiche = categoryByKey(key)!.items.find((i) => i.id === e.id)!;
        const texte = JSON.stringify(fiche.sections ?? []);
        const libelles = Object.entries(e.capabilities ?? {})
          .filter(([k, v]) => v === true && k in champs)
          .map(([k]) => champs[k as keyof typeof champs].label)
          .filter((l) => texte.includes(`"${l}"`) || texte.includes(` · ${l}`) || texte.includes(`${l} · `));
        return libelles.map((l) => `${e.id}: ${l}`);
      });
      expect(fuites).toEqual([]);
    });
  }
});
