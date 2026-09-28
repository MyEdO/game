import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaSelect, type MediaOption } from './MediaSelect';

const OPTS: MediaOption[] = [
  { key: 'a', label: 'Alpha', sub: 'PA 2' },
  { key: 'b', label: 'Bravo', disabled: true },
];

describe('MediaSelect', () => {
  it('rend les options EAGER dans le DOM (listbox présente même fermée → SSR)', () => {
    const h = renderToStaticMarkup(<MediaSelect options={OPTS} onSelect={() => {}} placeholder="Choisir…" />);
    expect(h).toContain('role="listbox"');
    expect(h).toContain('role="option"');
    expect(h).toContain('Alpha'); // option dans le markup statique (popover fermé)
    expect(h).toContain('Bravo');
    expect(h).toContain('PA 2'); // sub
  });

  it('déclencheur : placeholder sans valeur, libellé de l’option sélectionnée sinon', () => {
    expect(renderToStaticMarkup(<MediaSelect options={OPTS} onSelect={() => {}} placeholder="Choisir…" />)).toContain('Choisir…');
    expect(renderToStaticMarkup(<MediaSelect options={OPTS} value="a" onSelect={() => {}} />)).toContain('Alpha');
  });

  it('option désactivée → aria-disabled', () => {
    expect(renderToStaticMarkup(<MediaSelect options={OPTS} onSelect={() => {}} />)).toContain('aria-disabled="true"');
  });

  it('déclencheur custom (🎁) : pas de caret', () => {
    const h = renderToStaticMarkup(<MediaSelect options={OPTS} onSelect={() => {}} trigger="🎁" triggerClassName="btn small" />);
    expect(h).toContain('🎁');
    expect(h).not.toContain('ms-caret');
  });
});
