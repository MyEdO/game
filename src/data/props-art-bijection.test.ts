/**
 * BIJECTION art ⇄ donnée du décor (#1680 ligne 14).
 *
 * DEUX SENS, un seul contrat : chaque entrée de `props.json` a sa def d'ART
 * (`src/gameIso/catalog/decor/defs/<id>.ts`) et chaque def d'ART a son entrée. Le sens donnée→art
 * était seul gardé ; une def d'art SANS donnée passait donc en silence, et le monde la traitait
 * comme « passable, transparente, sans couvert » par simple ABSENCE (`PropData` non trouvé,
 * `noyau/monde/sceneRules.ts`, `noyau/monde/lineOfSight.ts`) — un défaut muet, jamais une déclaration.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { estFichierVitest, estKitDeTest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { props } from './index';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const DECOR_DEFS_DIR = 'src/gameIso/catalog/decor/defs';

/** Les ids des defs d'ART : un fichier `<id>.ts` du répertoire des defs, hors tests. */
const idsDArt = (): string[] =>
  listerDossier(join(RACINE, DECOR_DEFS_DIR))
    .filter((f) => f.endsWith('.ts') && !estFichierVitest(f) && !estKitDeTest(f))
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();

describe('décor — BIJECTION entre les defs d’art et les entrées de props.json', () => {
  it('chaque def d’ART a son `PropData`, et chaque `PropData` sa def d’art', () => {
    const art = idsDArt();
    const donnee: string[] = props.map((p) => p.id).sort();
    expect(art.length, 'aucune def d’art lue : ce contrat mesurerait du néant').toBeGreaterThan(100);
    const dansLaDonnee = new Set(donnee);
    const dansLArt = new Set(art);
    expect(art.filter((id) => !dansLaDonnee.has(id)), 'def d’ART sans `PropData` — physique, opacité et couvert seraient un DÉFAUT silencieux').toEqual([]);
    expect(donnee.filter((id) => !dansLArt.has(id)), '`PropData` sans def d’art — rien ne le dessine').toEqual([]);
    expect(donnee).toEqual(art);
  });
});
