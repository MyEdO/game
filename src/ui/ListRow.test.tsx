import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reglesCss, declarations } from '../../scripts/guards/lib/cssCouches.mjs';

/**
 * Banc de la rangée CANONIQUE `ListRow` (#679) : quand la place manque, les puces de méta passent
 * SOUS le nom au lieu de l'écraser, et une puce trop longue se coupe en ellipse.
 */
const css = readFileSync(fileURLToPath(new URL('./styles/components.css', import.meta.url)), 'utf8');
const decl = (selecteur: string): Record<string, string> => {
  const regles = reglesCss(css).filter((r) => !r.media && r.selecteurs.includes(selecteur));
  expect(regles.length, `\`${selecteur}\` doit être déclarée une fois hors média`).toBe(1);
  return Object.fromEntries(declarations(regles[0].corps).map((x) => [x.prop, x.valeur]));
};

describe('ListRow — les puces passent sous le nom quand la place manque', () => {
  it('la rangée s\'enroule, et seulement quand nom et puces ne tiennent pas', () => {
    expect(decl('.listrow')['flex-wrap']).toBe('wrap');
    const nom = decl('.listrow > .lr-name');
    // Base = CONTENU du nom : une base fixe (`12rem`) passait la puce à la ligne dans un rail étroit
    // alors que nom court et puce tenaient ensemble (inspecteur de l'éditeur, +22 px par rangée).
    expect(nom.flex).toBe('1 1 auto');
    expect(nom['min-width']).toBe('0');
  });

  it('une puce trop longue se coupe en ellipse sans déborder de la rangée', () => {
    const puce = decl('.listrow > .chip');
    expect(puce['max-width']).toBe('100%');
    expect(puce['text-overflow']).toBe('ellipsis');
    expect(puce['white-space']).toBe('nowrap');
    expect(puce.overflow).toBe('hidden');
  });
});
