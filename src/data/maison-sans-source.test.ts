import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { ecartsDeStock, cleDeSite, sitesEnEntrees, type EntreeDeSite } from '../../scripts/guards/lib/stock.mjs';
import { MAISON_SANS_SOURCE, MAISON_MASQUEES } from '../../scripts/guards/lib/integriteStock.mjs';
import { SANS_LIVRE, SANS_PROVENANCE_EXIGEE, SOURCE_EN_PROFONDEUR } from './schemas/grammaire/sans-livre';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const SCENES_DIR = fileURLToPath(new URL('../scenes', import.meta.url));
const lire = (dir: string, f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const jsons = (dir: string): string[] => listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') });

function sitesMaison(f: string, data: unknown, masquee: boolean) {
  const sites = [];
  for (const entree of Array.isArray(data) ? data : [data]) {
    if (!entree || typeof entree !== 'object') continue;
    const r = entree as Record<string, unknown>;
    if (typeof r.maison !== 'string' || !r.maison.length || r.source !== undefined) continue;
    if (Array.isArray(data) && typeof r.id !== 'string') throw new Error(f + ' : entrée maison sans id');
    sites.push({ famille: masquee ? 'maison-masquee' : 'maison-sans-source', file: 'src/data/' + f, ref: JSON.stringify([r.id ?? '$racine', 'maison', '', '']) });
  }
  return sites;
}

function mesure(masquee: boolean) {
  const sites = [];
  for (const f of jsons(DATA_DIR)) {
    if (Boolean(SANS_PROVENANCE_EXIGEE[f.replace(/\.json$/, '')]) !== masquee) continue;
    const data = lire(DATA_DIR, f);
    sites.push(...sitesMaison(f, data, masquee));
  }
  return sitesEnEntrees(sites);
}

function ecartMaison(observe: EntreeDeSite[], stock: readonly EntreeDeSite[]) {
  const ecart = ecartsDeStock({ observe, stock, cle: cleDeSite });
  expect(ecart.taille, 'Stock dupliqué : retirer les identités répétées').toBe(stock.length);
  return ecart;
}

// #1469
describe('maison sans source — collections nominatives', () => {
  for (const masquee of [false, true]) {
    it(masquee ? 'les exemptions ne masquent que les identités déclarées' : 'les entrées maison sans source sont déclarées et soldées', () => {
      const ecart = ecartMaison(mesure(masquee), masquee ? MAISON_MASQUEES : MAISON_SANS_SOURCE);
      expect(ecart.neuves, 'Entrées neuves : déclarer fichier/id dans scripts/guards/lib/integriteStock.mjs :\n' + ecart.neuves.join('\n')).toEqual([]);
      expect(ecart.perimees, 'Entrées soldées : retirer de scripts/guards/lib/integriteStock.mjs :\n' + ecart.perimees.join('\n')).toEqual([]);
    });
  }
  it('un échange à cardinal constant nomme les deux identités', () => {
    const stock = sitesEnEntrees(sitesMaison('fixture.json', [{ id: 'id-original', maison: 'raison' }], false));
    const observe = sitesEnEntrees(sitesMaison('fixture.json', [{ id: 'id-neuf', maison: 'raison' }], false));
    const ecart = ecartMaison(observe, stock);
    expect(ecart.neuves[0]).toContain('id-neuf');
    expect(ecart.perimees[0]).toContain('id-original');
  });
  it('une identité de stock répétée rougit', () => {
    const original = { famille: 'maison-sans-source', fichier: 'src/data/fixture.json', ref: 'proprietaire-fixture', occurrence: 1 };
    expect(() => ecartMaison([original], [original, original])).toThrow(/Stock dupliqué/);
  });
  it('le CONTENU des deux listes d’exemption est gelé (un ajout sort des entrées du cliquet)', () => {

    expect(Object.keys(SOURCE_EN_PROFONDEUR).sort()).toEqual([

      'arcane-phenomena', 'crew-test-types', 'disponibilite', 'land-cargo',
      'mass-battle', 'naval-progression', 'river-perils', 'sea-cargo', 'sea-events',
      'sea-navigation', 'sea-perils', 'sea-weather', 'ship-construction', 'weather',
    ]);
    expect(Object.keys(SANS_LIVRE).sort()).toEqual([
      'actions', 'ambiance', 'books', 'breath-types', 'buildings', 'calendarPhases', 'damage-types',
      'decorPalette', 'defauts-de-compilation', 'details', 'donnees.manifest', 'groups', 'lieux-services', 'lightLevels',
      'lightTones', 'localisation', 'materials', 'merchantFamilies', 'merchants', 'names', 'pregens',
      'primitives.manifest', 'progression-schemas.derived', 'props',
      'qualitySubtypes', 'qualityTypes', 'raceAppearance', 'raw.manifest',
      'renduMonte', 'semences-de-scene', 'sizes', 'speciesRace', 'structureAppearance',
      'systemes.manifest', 'teintesJeu', 'terrains',
    ]);

    const communes = Object.keys(SANS_LIVRE).filter((k) => k in SOURCE_EN_PROFONDEUR);
    expect(communes).toEqual([]);

  });

  it('`maison` est TOUJOURS une chaîne — zéro drapeau booléen, à TOUTE profondeur des deux racines', () => {

    const fautifs: string[] = [];
    const walk = (n: unknown, ou: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${ou}[${i}]`));
      if (!n || typeof n !== 'object') return;
      const r = n as Record<string, unknown>;
      if (r.maison !== undefined && typeof r.maison !== 'string') fautifs.push(`${ou}.maison = ${JSON.stringify(r.maison)} (${typeof r.maison})`);
      for (const [k, v] of Object.entries(r)) walk(v, `${ou}.${k}`);
    };
    for (const [dir, etiquette] of [
      [DATA_DIR, 'src/data'],
      [SCENES_DIR, 'src/scenes'],
    ] as const) {
      for (const f of jsons(dir)) {
        try {
          walk(lire(dir, f), `${etiquette}/${f}`);
        } catch {
          continue;
        }
      }
    }
    expect(fautifs, `\`maison\` doit être la RAISON en clair — un drapeau ne dit rien :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });

  it('AUCUN champ `source` de type CHAÎNE dans les deux racines de documents', () => {
    const fautifs: string[] = [];
    const walk = (n: unknown, ou: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${ou}[${i}]`));
      if (!n || typeof n !== 'object') return;
      const r = n as Record<string, unknown>;
      if (typeof r.source === 'string') fautifs.push(`${ou}.source = ${JSON.stringify(r.source)}`);
      for (const [k, v] of Object.entries(r)) walk(v, `${ou}.${k}`);
    };
    for (const [dir, etiquette] of [
      [DATA_DIR, 'src/data'],
      [SCENES_DIR, 'src/scenes'],
    ] as const) {
      for (const f of jsons(dir)) {
        try {
          walk(lire(dir, f), `${etiquette}/${f}`);
        } catch {
          continue;
        }
      }
    }
    expect(fautifs, `\`source\` doit être {book,page} — une chaîne échappe à TOUT lecteur de provenance :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });
});
