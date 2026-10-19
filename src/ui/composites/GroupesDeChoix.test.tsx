// @vitest-environment jsdom
/** #414 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { Menu } from './Menu';
import { Listbox, RadioGroup } from './GroupesDeChoix';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => demonterRacines());

const touche = (el: Element, key: string) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
const nomFocalise = () => document.activeElement?.textContent;

describe('groupes composites — clavier', () => {
  it('menu : les flèches déplacent le focus d’entrée en entrée, sans rien activer', () => {
    const actives: string[] = [];
    const { container } = monterRacine(
      <Menu entrees={[
        { cle: 'a', label: 'Nouveau', onSelect: () => actives.push('a') },
        { cle: 's', separateur: true },
        { cle: 'b', label: 'Ouvrir', onSelect: () => actives.push('b') },
        { cle: 'c', label: 'Exporter', onSelect: () => actives.push('c') },
      ]} />,
    );
    const items = container.querySelectorAll<HTMLElement>('[role="menuitem"]');
    act(() => items[1].focus());
    touche(items[1], 'ArrowDown');
    expect(nomFocalise()).toBe('Exporter');
    touche(document.activeElement!, 'Home');
    expect(nomFocalise()).toBe('Nouveau');
    touche(document.activeElement!, 'ArrowUp');
    expect(nomFocalise()).toBe('Exporter');
    expect(actives).toEqual([]);
  });

  it('liste déroulante (`suivi: focus`) : une option `aria-disabled` sort du roving', () => {
    const { container } = monterRacine(
      <Listbox as="ul" suivi="focus">
        <li role="option" aria-selected={false} tabIndex={0}>Alpha</li>
        <li role="option" aria-selected={false} aria-disabled tabIndex={-1}>Bravo</li>
        <li role="option" aria-selected={false} tabIndex={0}>Charlie</li>
      </Listbox>,
    );
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    act(() => options[0].focus());
    touche(options[0], 'ArrowDown');
    expect(nomFocalise()).toBe('Charlie');
  });

  it('radiogroup : la flèche ACTIVE le radio suivant activable et lui donne le focus', () => {
    const activations: number[] = [];
    const { container } = monterRacine(
      <RadioGroup label="Talent" count={2} activeIndex={0} onActivate={(i) => activations.push(i)}>
        <button type="button" role="radio" aria-checked tabIndex={0}>Un</button>
        <button type="button" role="radio" aria-checked={false} disabled>Deux</button>
        <button type="button" role="radio" aria-checked={false} tabIndex={-1}>Trois</button>
      </RadioGroup>,
    );
    const radios = container.querySelectorAll<HTMLElement>('[role="radio"]');
    act(() => radios[0].focus());
    touche(radios[0], 'ArrowRight');
    expect(activations).toEqual([1]);
    expect(nomFocalise()).toBe('Trois');
  });

  it('radiogroup : un `<select>` posé dans une option garde ses flèches, le groupe ne les prend pas', () => {
    const activations: number[] = [];
    const { container } = monterRacine(
      <RadioGroup label="Talent" count={2} activeIndex={0} onActivate={(i) => activations.push(i)}>
        <div>
          <button type="button" role="radio" aria-checked tabIndex={0}>Un</button>
        </div>
        <div>
          <button type="button" role="radio" aria-checked={false} tabIndex={-1}>Deux</button>
          <select aria-label="Spécialisation" defaultValue="a"><option value="a">A</option><option value="b">B</option></select>
        </div>
      </RadioGroup>,
    );
    const select = container.querySelector('select')!;
    act(() => select.focus());
    const appui = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    act(() => { select.dispatchEvent(appui); });
    expect(activations, 'la flèche du select a activé un radio').toEqual([]);
    expect(appui.defaultPrevented, 'la flèche du select a été empêchée').toBe(false);
    expect(document.activeElement).toBe(select);
  });
});
