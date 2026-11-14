import { describe, it, expect } from 'vitest';
import { categoryByKey } from './registry';
import { entreesDuDataset } from '../../data/overrides';
import { estObjet } from '../../lib/objet.mjs';
import { metaDesChamps } from '../../data/schemas/grammaire/meta';
import { PORTEURS_DE_CAPACITES } from './porteursDeCapacites.testkit';

// La fiche du Codex ne rend pas en lecture les libellés de saisie du schéma de capacités : choix
// d'interface : la saisie (CodexEdit) les porte.
/** Les capacités posées d'une entrée (`capabilities`), vides sans elles. */
const capacitesDe = (e: Record<string, unknown>): Record<string, unknown> => (estObjet(e.capabilities) ? e.capabilities : {});

describe('Codex — les libellés de saisie des capacités restent hors de la fiche', () => {
  it('la dérivation trouve au moins les porteurs connus', () => {
    expect(PORTEURS_DE_CAPACITES.map((p) => p.dataset)).toEqual(expect.arrayContaining(['traits', 'qualities', 'symptoms']));
  });

  for (const { categorie: key, dataset, schema } of PORTEURS_DE_CAPACITES) {
    const entrees = entreesDuDataset(dataset);
    it(`${key} : aucune fiche à capacités posées ne porte de libellé de champ du schéma`, () => {
      const champs = metaDesChamps(schema, { exigees: true });
      const porteurs = entrees.filter((e) => Object.values(capacitesDe(e)).some((v) => v === true));
      expect(porteurs.length).toBeGreaterThan(0);
      const fuites = porteurs.flatMap((e) => {
        const fiche = categoryByKey(key)!.items.find((i) => i.id === e.id)!;
        const texte = JSON.stringify(fiche.sections ?? []);
        const libelles = Object.entries(capacitesDe(e))
          .filter(([k, v]) => v === true && k in champs)
          .map(([k]) => champs[k as keyof typeof champs].label)
          .filter((l) => texte.includes(`"${l}"`) || texte.includes(` · ${l}`) || texte.includes(`${l} · `));
        return libelles.map((l) => `${String(e.id)}: ${l}`);
      });
      expect(fuites).toEqual([]);
    });
  }
});
