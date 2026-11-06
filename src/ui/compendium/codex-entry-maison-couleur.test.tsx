// @vitest-environment jsdom
/**
 * #1690 (correctifs du lot 3) — ce que la FICHE montre, mesuré sur le DOM :
 *
 *  1. le champ `maison` de l'enveloppe est LU par le joueur : titré par le libellé de la fabrique
 *     (`libelleDuChamp('maison')`) et rendu en prose. Il n'était affiché sur aucune fiche
 *     (recette #1690 lot 3, étape 2). MESURE du 2026-09-06 sur `src/data/*.json` : 172 entrées de
 *     1er rang le portent (props 41, actions 30, reglesOptionnelles 28, terrains 25, axes 9,
 *     talents 9, activities 8, crew-roles 7, naval-traits 3, traits 3, structures 2, trappings 2,
 *     traumas 2, creatures 1, etats 1, symptoms 1) ; 101 atteignent une fiche du Codex, 71 restent
 *     MUETTES faute de catégorie Codex — props 41 (catalogue édité à la palette de carte, cf.
 *     `registry.ts` `propLabel`) et actions 30 (`ACTIONS`, `src/data/index.ts:326`, sans aucun
 *     lecteur dans `src/ui/compendium`). Hors ce compte : 25 sous-entrées imbriquées portent aussi
 *     `maison` (dont la jambe de `criticals.json`, projetée, ce qui porte à 102 les fiches du Codex
 *     qui l'affichent) et le champ de politique `replisSansExpose` de `river-criticals.json`, qui
 *     n'est pas une entrée.
 *  2. la COULEUR d'une rangée `couleur` se VOIT : pastille peinte à la valeur de la donnée, nommée
 *     pour le lecteur d'écran, ET le code hex écrit à côté (lisible, copiable).
 *
 * La fiche `herbe` est prise dans le registre RÉEL (pas un item forgé) : c'est le chemin de
 * projection qui est mesuré, pas un objet de test.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CodexEntry } from './CodexEntry';
import { CODEX } from '../../noyau/codex/registry';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const terrain = (id: string) => {
  const item = CODEX.find((c) => c.key === 'terrains')!.items.find((i) => i.id === id);
  if (!item) throw new Error(`terrain « ${id} » absent du Codex`);
  return item;
};

describe('Fiche du Codex — provenance maison et couleurs (#1690)', () => {
  let container: HTMLDivElement;
  let root: Root;

  const rendre = (id: string) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CodexEntry item={terrain(id)} category="terrains" />); });
  };

  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('le champ `maison` est TITRÉ et LU sur la fiche', () => {
    rendre('herbe');
    const titres = [...container.querySelectorAll('.codex-sec-title')].map((h) => h.textContent);
    expect(titres, 'la note de provenance n’est pas titrée').toContain('Arbitrage maison');
    expect(container.textContent).toContain(terrain('herbe').maison!.slice(0, 40));
  });

  it('la couleur se VOIT : pastille peinte + hex en texte, annoncé UNE fois', () => {
    rendre('herbe');
    const pastilles = [...container.querySelectorAll('.swatch')] as HTMLElement[];
    expect(pastilles.length, 'aucune pastille peinte').toBeGreaterThanOrEqual(3); // teinte + 2 arrêts
    for (const p of pastilles) {
      // Le hex est ÉCRIT à côté de la pastille — c'est LUI que le lecteur d'écran annonce.
      const hex = p.parentElement!.textContent!.trim();
      expect(hex, 'le code hex n’est pas écrit à côté de la pastille').toMatch(/^#[0-9a-f]{6}$/);
      // La couleur est bien PEINTE à la valeur de la donnée (jsdom normalise `#rrggbb` en `rgb(r, g, b)`).
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(p.style.background, `pastille ${hex} non peinte à sa valeur`).toBe(`rgb(${r}, ${g}, ${b})`);
      // …et elle ne DOUBLE pas cette annonce : décorative, sans nom ni rôle.
      expect(p.getAttribute('aria-hidden'), `pastille ${hex} annoncée en double`).toBe('true');
      expect(p.getAttribute('aria-label')).toBeNull();
      expect(p.getAttribute('role')).toBeNull();
    }
  });
});
