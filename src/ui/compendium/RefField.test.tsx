// @vitest-environment jsdom
/**
 * #1993 — `RefField` porte le nom accessible, l'invalidité et la description sur le contrôle qu'il
 * rend, dans CHAQUE mode à contrôle unique (`single`, `freeText`, `vocab`). Le mode `liste` et le
 * `single` à `spec` n'en rendent aucun : l'appel qui les leur passerait ne compile pas
 * (`@ts-expect-error` ci-dessous, lu par `tsc`).
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RefField, type RefFieldCfgUnique } from './RefField';

const MODES: [string, RefFieldCfgUnique, string][] = [
  ['single', { ds: 'books', single: true }, 'select'],
  ['freeText', { ds: 'trappings', freeText: true }, 'input'],
  ['vocab', { vocabFrom: 'species.refChar' }, 'input'],
];

describe('RefField — l’accessibilité passée atteint le contrôle rendu', () => {
  for (const [mode, cfg, balise] of MODES) {
    it(`mode ${mode}`, () => {
      const html = renderToStaticMarkup(
        <RefField cfg={cfg} label="Réf" ariaLabel={`Réf ${mode}`} invalide describedBy="aide" value="" onChange={() => {}} />,
      );
      const controle = new DOMParser().parseFromString(html, 'text/html').querySelector(balise)!;
      expect(controle.getAttribute('aria-label')).toBe(`Réf ${mode}`);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.getAttribute('aria-describedby')).toBe('aide');
    });
  }

  it('mode liste : aucune accessibilité de contrôle unique ne se passe', () => {
    // @ts-expect-error — une `liste` n'a pas de contrôle unique à qui poser `invalide`.
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'spells' }} invalide value={[]} onChange={() => {}} />);
    expect(html).not.toContain('aria-invalid');
  });

  it('mode single à `spec` : deux contrôles, aucune accessibilité de contrôle unique ne se passe', () => {
    // @ts-expect-error — le `<select>` et l'`<input>` de spécialisation : pas de contrôle unique à nommer.
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'skills', single: true, spec: true }} ariaLabel="Compétence" value="" onChange={() => {}} />);
    expect(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('select, input')).toHaveLength(2);
  });
});
