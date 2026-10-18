/**
 * Un libellé de champ de RACINE s'affiche tel quel au Codex (`libelleDuChamp`, `ui/compendium/editFields.ts`) :
 * rien ne le capitalise à l'affichage. Il commence donc par une majuscule dans la méta du document,
 * sans exception.
 */
import { describe, expect, it } from 'vitest';
import { DEFS_DE_DOCUMENT } from '../validate';

const libelles = DEFS_DE_DOCUMENT.flatMap((d) =>
  Object.entries((d.meta ?? {}) as Record<string, { label?: string }>)
    .filter(([, m]) => !!m?.label)
    .map(([cle, m]) => ({ site: `${d.file} › ${cle}`, label: m.label! })));

describe('libellés de racine des documents — une majuscule à l’initiale', () => {
  it('la mesure porte sur les libellés de tous les documents', () => {
    expect(libelles.length).toBeGreaterThan(700);
  });

  it('aucun libellé de racine ne commence par une minuscule', () => {
    const minuscules = libelles.filter(({ label }) => label[0] !== label[0].toLocaleUpperCase()).map(({ site, label }) => `${site} = « ${label} »`);
    expect(minuscules).toEqual([]);
  });
});
