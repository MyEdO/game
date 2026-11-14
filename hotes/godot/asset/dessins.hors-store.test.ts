/**
 * LE CATALOGUE DES DESSINS (#3935, `dessins.ts`) : chaque icône, chaque fond, chaque couche de paysage et chaque cadre de
 * panneau de son registre y est, au cadre de son type, et chaque jeton `var(--…)` d'un dessin a sa couleur au thème de l'hôte (`Dessin`, `projet/art/theme.tres`),
 * que `projet/scripts/dessin.gd` lit pour le tracer ; chaque cadre qu'un style de `projet/art` nomme y est.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listerDossier } from '../../../scripts/guards/lib/lister.mjs';
import { CADRES, COUCHES_DE_PAYSAGE, FONDS, ICON_DEFS } from '../../../src/noyau/index';
import { figerLesDessins } from './dessins';

const ART = new URL('../projet/art/', import.meta.url);
const THEME = readFileSync(new URL('theme.tres', ART), 'utf8');

describe('le catalogue des dessins de l’hôte Godot', () => {
  const catalogue = figerLesDessins();

  it('porte chaque icône, chaque fond, chaque couche de paysage et chaque cadre de son registre, au cadre de son type', () => {
    expect(Object.keys(catalogue.icone.dessins)).toEqual(Object.keys(ICON_DEFS));
    expect(Object.keys(catalogue.fond.dessins)).toEqual(Object.keys(FONDS));
    expect(Object.keys(catalogue.paysage.dessins)).toEqual(Object.keys(COUCHES_DE_PAYSAGE));
    expect(Object.keys(catalogue.cadre.dessins)).toEqual(Object.keys(CADRES));
    expect(Object.keys(catalogue.cadre.tranches)).toEqual(Object.keys(CADRES));
    expect([catalogue.icone, catalogue.fond, catalogue.paysage, catalogue.cadre].map((type) => [type.largeur, type.hauteur])).toEqual([[24, 24], [320, 96], [1600, 900], [128, 128]]);
  });

  it('chaque jeton d’un dessin a sa couleur au thème', () => {
    const couleurs = new Set([...THEME.matchAll(/^Dessin\/colors\/(\w+) = /gm)].map((m) => m[1]));
    expect(couleurs.has('encre'), 'la couleur de `currentColor`').toBe(true);
    const jetons = new Set(Object.values(catalogue).flatMap((type) => Object.values(type.dessins)).flatMap((svg) => [...svg.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((m) => m[1].replace(/-/g, '_'))));
    expect([...jetons].filter((j) => !couleurs.has(j)), 'un jeton sans couleur au thème `Dessin`').toEqual([]);
  });

  it('chaque cadre qu’un style de `projet/art` nomme (`cadre.gd`) est au catalogue', () => {
    const nommes = listerDossier(fileURLToPath(ART)).filter((f) => f.endsWith('.tres')).flatMap((f) => [...readFileSync(new URL(f, ART), 'utf8').matchAll(/^cadre = "([^"]+)"$/gm)].map((m) => `${f} : ${m[1]}`));
    expect(nommes.length).toBeGreaterThan(0);
    expect(nommes.filter((n) => !(n.split(' : ')[1] in catalogue.cadre.tranches)), 'un cadre nommé hors du catalogue').toEqual([]);
  });
});
