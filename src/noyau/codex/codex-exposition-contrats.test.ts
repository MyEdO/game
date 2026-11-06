import { describe, it, expect } from 'vitest';
import { SCHEMA_DEFS } from '../../data/schemas/_registry.generated';
import { EXEMPTS, CLES_CODEX_DECLAREES } from '../../data/schemas/exposition-derivee';
import { CODEX, categoryByKey } from './registry';

/**
 * Contrats d'EXPOSITION du Codex (#1472), part du REGISTRE : les clés que les defs déclarent
 * (`exposition-derivee.ts`) face au registre Codex VIVANT (`CODEX`). Les contrats de la dérivation
 * seule : `src/data/schemas/exposition-contrats.test.ts`.
 *  (b) égalité BIDIRECTIONNELLE entre le registre Codex VIVANT (`CODEX`) et les clés déclarées ;
 *  (c) exempt ∧ exposé = ROUGE, nominatif.
 */

describe('exposition Codex — contrats de la dérivation (#1472)', () => {
  it('(b) égalité bidirectionnelle : les clés du registre Codex vivant ≡ les clés déclarées par les defs', () => {
    const duRegistre = new Set(CODEX.map((c) => c.key));

    const declareesSansCategorie = [...CLES_CODEX_DECLAREES].filter((k) => !duRegistre.has(k));
    expect(
      declareesSansCategorie,
      `Clé(s) déclarée(s) par un def sans catégorie RÉELLE au registre (\`registry.ts::CODEX_SPECS\`) :\n${declareesSansCategorie.join('\n')}`,
    ).toEqual([]);

    const exposeesSansDeclaration = [...duRegistre].filter((k) => !CLES_CODEX_DECLAREES.has(k));
    expect(
      exposeesSansDeclaration,
      `Catégorie(s) du Codex qu'aucun def ne déclare en \`codex.keys\` :\n${exposeesSansDeclaration.join('\n')}`,
    ).toEqual([]);
  });

  it('(b bis) chaque clé déclarée porte des items — aucune catégorie vide (mapping périmé)', () => {
    const vides = [...CLES_CODEX_DECLAREES].filter((k) => (categoryByKey(k)?.items.length ?? 0) === 0);
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
    // Le cas nominal : un document exempté ne déclare AUCUNE clé, donc aucune clé du Codex ne peut
    // lui être rattachée — (b) le couvre en creux, ce test le nomme.
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
