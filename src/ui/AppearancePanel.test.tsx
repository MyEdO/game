// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { hairstylesForSex } from '../gameIso/rig/parts/hairstyles';
import { AppearancePanel } from './AppearancePanel';
import type { Appearance } from '../gameIso/rig/appearance';
import { asRigSpeciesId } from '../gameIso/rig/appearance';

const app: Appearance = { species: asRigSpeciesId('humain'), sex: 'F', build: 0.4, seed: 2 };

describe('AppearancePanel', () => {
  it('rend un aperçu de rig + les contrôles sexe/morpho', () => {
    const html = renderToStaticMarkup(
      <AppearancePanel value={app} equip={{ weapons: [], armour: [] }} career="soldat" onChange={vi.fn()} />,
    );
    expect(html).toContain('data-bone='); // aperçu RigSprite présent
    expect(html).toContain('<select'); // sélecteur de sexe
    expect(html).toContain('type="range"'); // slider morphologie
    expect(html).toContain('Masculin');
    expect(html).toContain('Féminin');
  });
});

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

/** Patron `propRefPatch` (verdict 5805847379 de #1897, section E) : changer de sexe ne laisse pas une
 *  coiffure hors du pool du nouveau sexe. */
describe('AppearancePanel — la coiffure retombe quand le sexe change', () => {
  it('coiffure M puis sexe F : la valeur émise n’a plus de coiffure', () => {
    const onChange = vi.fn();
    const coiffureM = hairstylesForSex('M')[0].id;
    const { container } = monterRacine(
      <AppearancePanel value={{ ...app, sex: 'M', hairstyle: coiffureM }} equip={{ weapons: [], armour: [] }} career="soldat" onChange={onChange} />,
    );
    const sexe = Array.from(container.querySelectorAll('select')).find((el) => el.closest('label')?.textContent?.trim().startsWith('Sexe')) as HTMLSelectElement;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(sexe, 'F');
      sexe.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sex: 'F' }));
    expect(onChange.mock.lastCall![0]).not.toHaveProperty('hairstyle');
  });
});
