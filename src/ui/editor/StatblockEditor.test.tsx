// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatblockEditor } from './StatblockEditor';
import type { CustomStatblock } from '../../state/scene';
import { charAbr, creatures } from '../../data';
import { CHAR_KEYS } from '../../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe('StatblockEditor — exposition Psychologie (P4)', () => {
  it('affiche le champ Groupes (extras) avec la valeur courante', () => {
    const stat: CustomStatblock = { type: 'statblock', label: 'X', char: { M: 4 }, groups: ['Sigmarite', 'Cultiste'] };
    const html = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    expect(html).toContain('Groupes');
    expect(html).toContain('Sigmarite, Cultiste');
  });

  it('documente la syntaxe des Traits psy (Peur/Terreur/Animosité)', () => {
    const stat: CustomStatblock = { type: 'statblock', label: 'X', char: { M: 4 } };
    const html = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    expect(html).toMatch(/Peur/);
    expect(html).toMatch(/Animosit/);
  });
});

describe('StatblockEditor — cloner une créature de base ne décide JAMAIS par comparaison de texte (#142)', () => {
  it('un profil réellement nommé « Profil personnalisé » n’est PAS écrasé par le clone', () => {
    const stat: CustomStatblock = { type: 'statblock', label: 'Profil personnalisé', char: { M: 4 } };
    let latest: CustomStatblock = stat;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<StatblockEditor stat={stat} onChange={(s) => { latest = s; }} />);
    });
    const select = container.querySelector('select') as HTMLSelectElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(select, creatures[0].id);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(latest.label).toBe('Profil personnalisé');
    act(() => { root.unmount(); });
    container.remove();
  });
});

describe('StatblockEditor — une clé de Caractéristique ne se rend JAMAIS telle quelle (engine/types.ts CharKey)', () => {
  it('la grille affiche l’abréviation dérivée de la donnée (charAbr), pas l’id stable', () => {
    const stat: CustomStatblock = { type: 'statblock', label: 'X', char: { M: 4 } };
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(<StatblockEditor stat={stat} onChange={() => {}} />);
    const libelles = [...container.querySelectorAll('.statblock-grid > label.ed-subfield')].map((l) => l.firstChild?.textContent);
    expect(libelles).toContain(charAbr('capacite-de-combat'));
    expect(libelles).toContain(charAbr('force-mentale'));
    for (const k of CHAR_KEYS) expect(libelles).not.toContain(k);
  });
});
