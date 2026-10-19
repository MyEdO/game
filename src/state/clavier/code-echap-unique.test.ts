/**
 * Un seul littéral de la touche Échap dans `src/state/clavier/` (#1476, #2724) : `murs/echap` n'y
 * admet le littéral qu'à la déclaration de `CODE_ECHAP`, et un mur de lint juge fichier par fichier.
 * Le compte porte sur le texte brut, commentaires compris : aucune forme de déclaration n'y échappe.
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';

const LITTERAL_ECHAP = /(['"`])Escape\1/g;

const compterLitteraux = (textes: readonly string[]): number =>
  textes.reduce((n, texte) => n + (texte.match(LITTERAL_ECHAP)?.length ?? 0), 0);

const textesDuRegistre = (): string[] => readCorpus(['src/state/clavier']).map(({ text }) => text);

describe('littéral Échap du registre clavier', () => {
  it('apparaît exactement une fois dans le dossier du registre', () => {
    expect(compterLitteraux(textesDuRegistre())).toBe(1);
  });

  it.each([
    ['saut de ligne après export', "export\nconst CODE_ECHAP_BIS = 'Escape';"],
    ['espaces doublés', 'export  const CODE_ECHAP_BIS = "Escape";'],
    ['commentaire bloc', 'export /**/ const CODE_ECHAP_BIS = `Escape`;'],
    ['indentation', "  export const CODE_ECHAP_BIS = 'Escape';"],
    ['commentaire ligne', "// 'Escape'"],
  ])('rougit sur une seconde définition (%s)', (_forme, ajout) => {
    expect(compterLitteraux([...textesDuRegistre(), ajout])).not.toBe(1);
  });
});
