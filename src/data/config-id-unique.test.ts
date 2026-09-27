import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerArbre, listerDossier } from '../../scripts/guards/lib/lister.mjs';

/**
 * Garde-fou « l'id d'un document de RACINE est unique » (#1467 L1b V-FLIP-CONFIG).
 *
 * Les documents de famille `config` portent depuis ce lot leur ENVELOPPE (`id`/`type`/`label`), et
 * leur `id` est AUTHORÉ — jamais dérivé du `type` : la dérivation a été RÉFUTÉE à la mesure, le type
 * `water-exposure` collisionnant avec l'entrée `water-exposure` de `combat-stakes.json`. Un id
 * authoré n'est libre que s'il est UNIQUE, faute de quoi deux documents se répondraient sous le même
 * nom au premier index qui les réunit.
 *
 * Le périmètre est l'ESPACE ENTIER des ids de premier niveau des DEUX racines (`src/data`,
 * `src/scenes`) : ids d'entrées des datasets-listes, clés des racines-objets sans enveloppe, et ids
 * de racine des documents `config`. Le scan est STRUCTUREL (lecture du filesystem), jamais une liste
 * de noms — un document déposé demain y entre sans qu'on l'inscrive.
 *
 * ANGLE MORT DIT : les espaces de noms NICHÉS (jetons de scène, sous-entrées) ne sont pas relevés —
 * seul le PREMIER NIVEAU l'est ; ceux de `src/data` que l'INDEX DES IDS indexe (`IDS_PAR_ESPACE`,
 * clés `fichier#…`) y sont uniques par la marque de leur collection (`grammaire/collection-cle.ts`).
 */

const RACINES = [fileURLToPath(new URL('./', import.meta.url)), fileURLToPath(new URL('../scenes/', import.meta.url))];

type Porteur = { id: string; ou: string };

/** Tous les ids de PREMIER NIVEAU des deux racines, chacun avec l'endroit qui le porte. */
function idsDePremierNiveau(): Porteur[] {
  const out: Porteur[] = [];
  const visite = (dir: string, prefixe: string) => {
    for (const nom of listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') })) {
      let racine: unknown;
      try {
        racine = JSON.parse(readFileSync(`${dir}${nom}`, 'utf8'));
      } catch {
        continue;
      }
      const ou = `${prefixe}${nom}`;
      if (Array.isArray(racine)) {
        for (const item of racine) {
          if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
            out.push({ id: (item as { id: string }).id, ou });
          }
        }
        continue;
      }
      if (!racine || typeof racine !== 'object') continue;
      const obj = racine as Record<string, unknown>;
      // Document à ENVELOPPE : son identité est SON id de racine, pas ses clés (qui sont des champs).
      if (typeof obj.id === 'string' && typeof obj.label === 'string') out.push({ id: obj.id, ou });
    }
  };
  for (const [i, r] of RACINES.entries()) visite(r, i === 0 ? 'src/data/' : 'src/scenes/');
  return out;
}

/** Les 39 `type` de racine-objet dotés d'une enveloppe : les 27 de V-FLIP-CONFIG moins les 2 que
 *  #1657 B2a a fondus en une LISTE de documents (`criticals`/`aa-criticals` — leur fichier n'est
 *  plus une racine-objet), puis les 14 documents uniques que V-FLIP-TABLE a flippés en `config`. */
const FLIPPES_V_FLIP_CONFIG = [
  'ambiance', 'arcane-phenomena', 'crew-morale', 'crew-test-types', 'details',
  'disponibilite', 'donnees.manifest', 'grapple', 'land-cargo', 'localisation', 'mass-battle',
  'progression-schemas.derived', 'renduMonte', 'river-navigation', 'river-perils', 'sea-cargo', 'sea-events',
  'sea-navigation', 'sea-perils', 'sea-weather', 'ship-construction', 'sizes', 'speciesRace', 'water-exposure',
  'weather',
  // #1467 L1b V-FLIP-TABLE (2026-08-28) — 14 racines-objet UNIQUES : l'instrument de mesure les classe
  // `config`, la famille déclarée les suit.
  'artillery-misfire', 'driving-mishap', 'drunkenness', 'incidents-monture', 'montures',
  'naval-progression', 'obsessions', 'problemes-vehicule', 'rencontres-edoc', 'river-criticals',
  'ship-criticals', 'structure-criticals', 'surincantation', 'vents-tourbillonnants',
];

/** TOUTE racine-objet à enveloppe de `src/data` (`id` + `label`) : l'espace d'unicité est celui des
 *  DOCUMENTS, pas d'un lot. */
function documentsConfig(): (Porteur & { type: string })[] {
  const dir = fileURLToPath(new URL('./', import.meta.url));
  return listerDossier(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      let racine: unknown;
      try {
        racine = JSON.parse(readFileSync(`${dir}${f}`, 'utf8'));
      } catch {
        return [];
      }
      if (Array.isArray(racine) || !racine || typeof racine !== 'object') return [];
      const o = racine as Record<string, unknown>;
      return typeof o.id === 'string' && typeof o.label === 'string'
        ? [{ id: o.id, ou: `src/data/${f}`, type: typeof o.type === 'string' ? o.type : '' }]
        : [];
    });
}

describe('id de racine d’un document `config` — unique dans l’espace des ids (#1467 L1b)', () => {
  it('les 39 documents flippés par les deux lots portent tous leur enveloppe', () => {
    const types = documentsConfig().map((d) => d.type);
    const manquants = FLIPPES_V_FLIP_CONFIG.filter((t) => !types.includes(t));
    expect(manquants, `document(s) du lot sans enveloppe :\n  ${manquants.join('\n  ')}`).toEqual([]);
  });

  it('les 43 documents à enveloppe de `src/data` portent 43 ids DISTINCTS entre eux', () => {
    const docs = documentsConfig();
    // 27 du lot V-FLIP-CONFIG (moins les 2 fondus par #1657 B2a) + 14 documents uniques flippés en
    // `config` par V-FLIP-TABLE + les 2 RECORDS enveloppés par V-FLIP-RECORD (`teintes-jeu`,
    // `palette-decor`) : l'espace d'unicité est celui des DOCUMENTS à enveloppe, quelle que soit leur
    // famille. Les 8 documents-tables de `criticals.json` n'y sont plus : leur fichier est une LISTE,
    // et leurs ids sont donc mesurés par `idsDePremierNiveau` ci-dessous, comme toute entrée de liste.
    // 41 → 42 (#1716, 2026-09-18) : `semences-de-scene.json` — un document `config` NEUF à objet
    // unique (ce qu'une scène reçoit à sa création), déclaré ici comme tout document déposé dans la
    // racine : le scan le voit par sa STRUCTURE, ce compte dit seulement combien il en voit.
    // 42 → 43 (#1789, 2026-09-18) : `defauts-de-compilation.json` — même forme, même régime, ce que le
    // COMPILATEUR de scène pose quand l'auteur laisse le terrain implicite.
    expect(docs.length).toBe(43);
    const parId = new Map<string, string[]>();
    for (const d of docs) parId.set(d.id, [...(parId.get(d.id) ?? []), d.ou]);
    const collisions = [...parId].filter(([, ou]) => ou.length > 1).map(([id, ou]) => `« ${id} » : ${ou.join(' + ')}`);
    expect(collisions, `id(s) de document en COLLISION :\n  ${collisions.join('\n  ')}`).toEqual([]);
  });

  it('aucun de ces ids ne collisionne avec un id de PREMIER NIVEAU des deux racines', () => {
    const docs = documentsConfig();
    const tous = idsDePremierNiveau();
    const collisions: string[] = [];
    for (const d of docs) {
      const ailleurs = tous.filter((p) => p.id === d.id && p.ou !== d.ou).map((p) => p.ou);
      if (ailleurs.length) collisions.push(`« ${d.id} » (${d.ou}) ⇄ ${[...new Set(ailleurs)].join(', ')}`);
    }
    expect(collisions, `id(s) de document déjà pris ailleurs :\n  ${collisions.join('\n  ')}`).toEqual([]);
  });

  it('le scan voit une population réelle (le contrat n’est pas vide par erreur de chemin)', () => {
    expect(idsDePremierNiveau().length).toBeGreaterThan(3000);
  });
});
