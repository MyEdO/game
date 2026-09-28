import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { CreaturePreview } from './CreaturePreview';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { hairstylesForSex } from '../../gameIso/rig/parts/hairstyles';

const render = (label: string, appearance?: EntityAppearance) =>
  renderToStaticMarkup(React.createElement(CreaturePreview, { label, appearance }));

describe('CreaturePreview — aperçu rendu de créature (Codex / éditeur)', () => {
  it('bipède → SVG non vide, face + profil', () => {
    const html = render('Mutant', { species: 'humain' });
    expect((html.match(/<svg/g) ?? []).length).toBe(2);
    expect(html).toContain('<path');
  });

  it("reflète l'apparence éditée EN DIRECT (un trait ajouté change le rendu)", () => {
    const without = render('Mutant', { species: 'humain' });
    const withEars = render('Mutant', { species: 'humain', features: ['oreilles-pointues'] });
    expect(withEars).not.toBe(without);
    expect(withEars).toContain('M-8 7 Q-15 4 -14 -3'); // path d'oreille pointue du catalogue
  });

  it('non-bipède → rendu par SON gabarit (pas le bipède par défaut)', () => {
    // `label` est l'ID de record (`findCreatureById`) : un LIBELLÉ (« Loup ») ne résout aucun
    // record — le rendu retombe sur le bipède par défaut et `bodyPlan` le crie. Le témoin qui mord
    // est le DIAGNOSTIC « aucune espèce résolue » (les deux <svg> d'enveloppe sont invariants).
    const diag = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const html = render('loup');
      expect((html.match(/<svg/g) ?? []).length).toBe(2);
      expect(html).toContain('<path');
      expect(diag.mock.calls.map((c) => String(c[0])).filter((m) => /aucune espèce résolue/.test(m))).toEqual([]);
    } finally {
      diag.mockRestore();
    }
  });
});

describe('CreaturePreview — l’apparence ENTIÈRE atteint le rig, sans liste de champs', () => {
  it('une coiffure imposée change l’aperçu', () => {
    const sans = render('Mutant', { species: 'humain', sex: 'M' });
    const avec = render('Mutant', { species: 'humain', sex: 'M', hairstyle: hairstylesForSex('M')[1].id });
    expect(avec).not.toBe(sans);
  });
});
