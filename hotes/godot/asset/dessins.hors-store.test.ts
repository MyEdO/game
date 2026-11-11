/**
 * LE CATALOGUE DES DESSINS (#3935, `dessins.ts`) : chaque icône et chaque fond de son registre y est, au cadre de son
 * type, et chaque jeton `var(--…)` d'un dessin a sa couleur au thème de l'hôte (`Dessin`, `projet/art/theme.tres`),
 * que `projet/scripts/dessin.gd` lit pour le tracer.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FONDS, ICON_DEFS } from '../../../src/noyau/index';
import { figerLesDessins } from './dessins';

const THEME = readFileSync(new URL('../projet/art/theme.tres', import.meta.url), 'utf8');

describe('le catalogue des dessins de l’hôte Godot', () => {
  const catalogue = figerLesDessins();

  it('porte chaque icône et chaque fond de son registre, au cadre de son type', () => {
    expect(Object.keys(catalogue.icone.dessins)).toEqual(Object.keys(ICON_DEFS));
    expect(Object.keys(catalogue.fond.dessins)).toEqual(Object.keys(FONDS));
    expect([catalogue.icone.largeur, catalogue.icone.hauteur, catalogue.fond.largeur, catalogue.fond.hauteur]).toEqual([24, 24, 320, 96]);
  });

  it('chaque jeton d’un dessin a sa couleur au thème', () => {
    const couleurs = new Set([...THEME.matchAll(/^Dessin\/colors\/(\w+) = /gm)].map((m) => m[1]));
    expect(couleurs.has('encre'), 'la couleur de `currentColor`').toBe(true);
    const jetons = new Set(Object.values(catalogue).flatMap((type) => Object.values(type.dessins)).flatMap((svg) => [...svg.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1].replace(/-/g, '_'))));
    expect([...jetons].filter((j) => !couleurs.has(j)), 'un jeton sans couleur au thème `Dessin`').toEqual([]);
  });
});
