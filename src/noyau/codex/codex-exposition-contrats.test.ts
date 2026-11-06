import { describe, it, expect } from 'vitest';
import { SCHEMA_DEFS } from '../../data/schemas/_registry.generated';
import { EXEMPTS } from '../../data/schemas/exposition-derivee';
import { CODEX } from './registry';

/**
 * Contrats d'EXPOSITION du Codex (#1472), part du REGISTRE : le registre Codex VIVANT (`CODEX`) face
 * aux documents qui le servent. Ses clés sont celles que les defs déclarent PAR CONSTRUCTION
 * (`CODEX_SPECS satisfies Record<CleCodex, …>`, `_cles-de-dataset.generated.ts`). Les contrats de la
 * dérivation seule : `src/data/schemas/exposition-contrats.test.ts`.
 *  (b bis) aucune catégorie vide ;
 *  (c) exempt ∧ exposé = ROUGE, nominatif.
 */

describe('exposition Codex — contrats de la dérivation (#1472)', () => {
  it('(b bis) chaque catégorie déclarée porte des items — aucune catégorie vide (mapping périmé)', () => {
    const vides = CODEX.filter((c) => c.items.length === 0).map((c) => c.key);
    expect(vides, `Catégorie(s) Codex déclarée(s) mais VIDE(s) :\n${vides.join('\n')}`).toEqual([]);
  });

  it('(c) exempt ∧ exposé = ROUGE : aucune catégorie du Codex n’est servie par un document exempté', () => {
    const parFichier = new Map(SCHEMA_DEFS.map((d) => [d.file, d]));
    const fautifs: string[] = [];
    for (const cle of CODEX.map((c) => c.key)) {
      for (const [fichier, exempt] of Object.entries(EXEMPTS)) {
        const def = parFichier.get(fichier);
        const edit = def?.exposition?.edit;
        const routes = edit && 'niche' in edit ? Object.keys(edit.niche.categories) : [];
        if (routes.includes(cle)) fautifs.push(`${fichier} : exempté (${exempt.kind}) mais route la catégorie « ${cle} »`);
      }
    }
    const exemptsAvecCles = Object.keys(EXEMPTS).filter((f) => {
      const codex = parFichier.get(f)?.exposition?.codex;
      return codex && 'keys' in codex;
    });
    expect(
      [...fautifs, ...exemptsAvecCles.map((f) => `${f} : exempté ET porteur de \`codex.keys\``)],
      'Document(s) à la fois EXEMPTÉ et EXPOSÉ au Codex — trancher : exposer (retirer l’exempt) ou retirer les clés.',
    ).toEqual([]);
  });
});
