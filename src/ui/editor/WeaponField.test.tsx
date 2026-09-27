// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeaponField } from './WeaponField';
import { REACH_IDS } from '../../engine/items';
import { REACH_LABELS, REACH_VARIABLE } from '../../engine/types';
import type { Weapon } from '../../engine/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const melee: Weapon = { label: 'Tentacule', type: 'melee', damage: { plusBF: true, flat: 2 }, reach: 'Longue', qualities: [] };

describe('WeaponField — Allonge = choix FERMÉ sur l’axe (LDB 62 l.156-164)', () => {
  const html = () => renderToStaticMarkup(<WeaponField value={melee} onChange={() => {}} />);

  it('rend un <select> (plus de saisie libre) portant les SEPT longueurs + « Variable »', () => {
    const h = html();
    expect(h).toContain('<select');
    for (const id of REACH_IDS) expect(h).toContain(`value="${REACH_LABELS[id]}"`);
    expect(h).toContain(`value="${REACH_VARIABLE}"`);
    expect(h).not.toContain('placeholder="Moyenne…"'); // plus de saisie libre
  });

  it('aucune option hors vocabulaire : 7 longueurs + « Variable » + le vide', () => {
    const select = /Allonge<select[^>]*>(.*?)<\/select>/s.exec(html())?.[1] ?? '';
    const allonge = [...select.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    expect(new Set(allonge)).toEqual(new Set(['', ...Object.values(REACH_LABELS), REACH_VARIABLE]));
  });

  it('une arme à DISTANCE n’expose pas l’Allonge (Portée à la place)', () => {
    const h = renderToStaticMarkup(<WeaponField value={{ ...melee, type: 'ranged' }} onChange={() => {}} />);
    expect(h).not.toContain(REACH_LABELS.considerable);
  });
});

describe('WeaponField — Groupe = id du dataset `weaponGroups` (RefField), vide = pas de Groupe (LDB 85 l.31-33)', () => {
  /** Monte le champ, choisit `choix` dans le sélecteur de Groupe, rend l'arme émise. */
  function choisirGroupe(depart: Weapon, choix: string): Weapon | undefined {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let emise: Weapon | undefined;
    act(() => { root.render(<WeaponField value={depart} onChange={(v) => { emise = v; }} />); });
    const select = [...host.querySelectorAll('select')].find((s) => s.querySelector('option[value="armes-d-hast"]'));
    expect(select, 'sélecteur de Groupe absent').toBeDefined();
    act(() => {
      select!.value = choix;
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => { root.unmount(); });
    host.remove();
    return emise;
  }

  it('choisir un Groupe écrit son id dans `subType`', () => {
    expect(choisirGroupe(melee, 'armes-d-hast')?.subType).toBe('armes-d-hast');
  });

  it('le choix vide retire le Groupe', () => {
    const emise = choisirGroupe({ ...melee, subType: 'base' }, '');
    expect(emise).toBeDefined();
    expect(emise!.subType).toBeUndefined();
  });
});
