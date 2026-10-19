// @vitest-environment jsdom
/** #2864 — une primitive composite montée dans un cadre `useModalA11y` (`ScreenShell`) : une flèche = un pas. */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { act, useState, type ReactNode } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { ScreenShell } from '../ScreenShell';
import { MediaSelect } from '../MediaSelect';
import { Listbox, RadioGroup } from './GroupesDeChoix';
import { Menu } from './Menu';
import { Tabs } from './Tabs';

// jsdom n'a pas de layout : `useModalA11y` ne retient que les contrôles dont `getClientRects()` est non vide.
const sansLayout = HTMLElement.prototype.getClientRects;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLElement.prototype.getClientRects = () => [{}] as unknown as DOMRectList;
});
afterAll(() => { HTMLElement.prototype.getClientRects = sansLayout; });
afterEach(() => demonterRacines());

const touche = (key: string) =>
  act(() => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
const focalise = () => document.activeElement?.textContent;
const focaliser = (selecteur: string) => act(() => (document.querySelector(selecteur) as HTMLElement).focus());
const cadre = (enfant: ReactNode) => <ScreenShell title="Écran" onClose={() => {}}>{enfant}</ScreenShell>;

function Onglets() {
  const [actif, setActif] = useState<'a' | 'b' | 'c'>('a');
  return cadre(<Tabs tabs={(['a', 'b', 'c'] as const).map((k) => ({ key: k, label: k.toUpperCase() }))} active={actif} onChange={setActif} />);
}

function Services() {
  const [sel, setSel] = useState(0);
  return cadre(
    <>
      <Listbox label="Services" count={4} activeIndex={sel} onActivate={setSel}>
        {['S0', 'S1', 'S2', 'S3'].map((s, i) => (
          <button key={s} type="button" role="option" aria-selected={sel === i} tabIndex={sel === i ? 0 : -1}>{s}</button>
        ))}
      </Listbox>
      <output data-sel>{sel}</output>
    </>,
  );
}

function Radios() {
  const [sel, setSel] = useState(0);
  return cadre(
    <RadioGroup label="Groupe" count={4} activeIndex={sel} onActivate={setSel}>
      {['R0', 'R1', 'R2', 'R3'].map((r, i) => (
        <button key={r} type="button" role="radio" aria-checked={sel === i} tabIndex={sel === i ? 0 : -1}>{r}</button>
      ))}
    </RadioGroup>,
  );
}

describe('rovingKeyDown dans un ScreenShell : le groupe possède ses flèches', () => {
  it('Tabs', () => {
    monterRacine(<Onglets />);
    focaliser('[role="tab"]');
    touche('ArrowRight');
    expect(focalise()).toBe('B');
  });

  it('Listbox de sélection : focus et sélection avancent d’un seul item', () => {
    monterRacine(<Services />);
    focaliser('[role="option"]');
    touche('ArrowDown');
    expect([focalise(), document.querySelector('[data-sel]')!.textContent]).toEqual(['S1', '1']);
  });

  it('RadioGroup', () => {
    monterRacine(<Radios />);
    focaliser('[role="radio"]');
    touche('ArrowDown');
    expect(focalise()).toBe('R1');
  });

  it('Menu', () => {
    monterRacine(cadre(<Menu entrees={['M0', 'M1', 'M2'].map((l) => ({ cle: l, label: l, onSelect: () => {} }))} />));
    focaliser('[role="menuitem"]');
    touche('ArrowDown');
    expect(focalise()).toBe('M1');
  });

  it('MediaSelect (Listbox `suivi: focus`) : la flèche va à l’option suivante, pas au bouton de fermeture', () => {
    monterRacine(cadre(<MediaSelect options={['O0', 'O1', 'O2'].map((k) => ({ key: k, label: k }))} onSelect={() => {}} placeholder="Choisir" />));
    act(() => (document.querySelector('[role="combobox"]') as HTMLElement).click());
    focaliser('[role="option"]');
    touche('ArrowDown');
    expect(focalise()).toBe('O1');
  });
});
