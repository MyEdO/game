import { act } from 'react';
import { expect } from 'vitest';

/** Pilotage du MediaSelect monté, par son titre et le libellé visible de l’option. */
export function choisirMediaSelect(container: HTMLElement, titre: string, libelle: string): void {
  const menu = [...container.querySelectorAll<HTMLElement>('[role="combobox"]')].find((e) => e.title === titre);
  expect(menu, titre).toBeTruthy();
  act(() => menu!.click());
  const option = [...menu!.parentElement!.querySelectorAll<HTMLElement>('[role="option"]')].find((e) => e.querySelector('.ms-label')?.textContent === libelle);
  expect(option, libelle).toBeTruthy();
  act(() => option!.click());
}
