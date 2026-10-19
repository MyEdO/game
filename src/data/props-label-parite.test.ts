/**
 * BIJECTION art ⇄ donnée du décor (#1680 ligne 14) et PARITÉ des libellés (#1467 L1b V-P0d).
 *
 * DEUX SENS, un seul contrat : chaque entrée de `props.json` a sa def d'ART
 * (`src/gameIso/catalog/decor/defs/<id>.ts`) et chaque def d'ART a son entrée. Le sens donnée→art
 * était seul gardé ; une def d'art SANS donnée passait donc en silence, et le monde la traitait
 * comme « passable, transparente, sans couvert » par simple ABSENCE (`PropData` non trouvé,
 * `noyau/monde/sceneRules.ts`, `noyau/monde/lineOfSight.ts`) — un défaut muet, jamais une déclaration.
 *
 * Le `label`, lui, est le MIROIR d'un porteur à l'autre : la donnée le porte parce que l'enveloppe de
 * document l'exige, l'art parce que le catalogue gameIso dessine la vignette. Deux porteurs, une
 * seule vérité — sans cette garde, renommer un décor d'un côté laisserait l'autre mentir en silence.
 *
 * L'extraction du label d'art vient du foyer UNIQUE `scripts/guards/lib/propArtLabels.mjs`, celui-là
 * même dont la migration `2026-08-28-l1b-10a-props-labels.mjs` a DÉRIVÉ la donnée : la vérification ne
 * peut pas s'écarter de la dérivation.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import propsJson from './props.json';
import { fileURLToPath } from 'node:url';
import { DECOR_DEFS_DIR, labelDArt } from '../../scripts/guards/lib/propArtLabels.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const entrees = propsJson as { id: string; label: string }[];

/** Les ids des defs d'ART : un fichier `<id>.ts` du répertoire des defs, hors tests. */
const idsDArt = (): string[] =>
  listerDossier(join(RACINE, DECOR_DEFS_DIR))
    .filter((f) => f.endsWith('.ts') && !estFichierVitest(f))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();

describe('décor — BIJECTION entre les defs d’art et les entrées de props.json', () => {
  it('chaque def d’ART a son `PropData`, et chaque `PropData` sa def d’art', () => {
    const art = idsDArt();
    const donnee = entrees.map((p) => p.id).sort();
    expect(art.length, 'aucune def d’art lue : ce contrat mesurerait du néant').toBeGreaterThan(100);
    const dansLaDonnee = new Set(donnee);
    const dansLArt = new Set(art);
    expect(art.filter((id) => !dansLaDonnee.has(id)), 'def d’ART sans `PropData` — physique, opacité et couvert seraient un DÉFAUT silencieux').toEqual([]);
    expect(donnee.filter((id) => !dansLArt.has(id)), '`PropData` sans def d’art — rien ne le dessine').toEqual([]);
    expect(donnee).toEqual(art);
  });
});

describe('props.json — parité des labels avec les defs d’art', () => {
  it('chaque entrée porte un label non vide', () => {
    const vides = entrees.filter((p) => typeof p.label !== 'string' || p.label.trim() === '').map((p) => p.id);
    expect(vides).toEqual([]);
    expect(entrees.length).toBeGreaterThan(0);
  });

  it('label de donnée === label de la def d’art du même id', () => {
    const divergents = entrees
      .map((p) => ({ id: p.id, donnee: p.label, art: labelDArt(RACINE, p.id) }))
      .filter((x) => x.donnee !== x.art)
      .map((x) => `${x.id} : donnée ${JSON.stringify(x.donnee)} ≠ art ${JSON.stringify(x.art)}`);
    expect(divergents).toEqual([]);
  });
});
