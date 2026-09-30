import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { SANS_LIVRE, SANS_PROVENANCE_EXIGEE, SOURCE_EN_PROFONDEUR } from './schemas/grammaire/sans-livre';

/**
 * Cliquet « entrée MAISON sans folio » (#1467 L1b V-Src) — patron stock décroissant
 * (`scripts/guards/lib/structuresStock.mjs`).
 *
 * `document()` accepte `source` OU `maison` : une entrée sans folio n'est pas interdite, elle doit
 * dire pourquoi. Ce régime est nécessaire (le canon est muet sur des points qu'un jeu sans MJ doit
 * trancher) et il est exactement ce qui peut DÉRIVER : rien n'empêche, sans cliquet, d'écrire
 * `maison` plutôt que de chercher le folio. Ce test gèle donc, PAR DATASET, le nombre d'entrées de
 * premier niveau qui portent `maison` SANS `source`. Dépasser sa baseline = rouge nominatif ;
 * décroître = abaisser la baseline DANS LE MÊME COMMIT (le stock ne fait que décroître).
 *
 * PÉRIMÈTRE — les types exemptés (`SANS_PROVENANCE_EXIGEE` = `SANS_LIVRE` ∪ `SOURCE_EN_PROFONDEUR`)
 * sont hors mesure : leur document entier est déclaré sans provenance exigible à l'entrée de racine,
 * y compter des `maison` mélangerait deux régimes.
 *
 * Ce que cette borne masque AUJOURD'HUI est GELÉ NOMINATIVEMENT (`MASQUES_GELES`, asserté plus bas) :
 * 29 des 30 raisons de coût d'`actions.json`, entrées dans le périmètre mesurable par la migration
 * `2026-08-27-l1b-4b-actions-maison-raison.mjs` (le couple `maison: true` + `costNote` y est devenu la
 * RAISON en clair), et les 41 règles de `props.json` (#1680 ligne 5, cf. `MASQUES_GELES`). Chacune de ces 29 entrées porte sa raison dans le champ `maison` ; `actions` est
 * dans `SANS_LIVRE` (`schemas/grammaire/sans-livre.ts:41`), et 12 de ses 55 entrées citent malgré tout
 * un folio. 29 et non 30 : `switch-loadout`
 * porte SA raison ET son folio (LDB 13 l.106) — le prédicat exige `source` absente, il n'est donc pas
 * masqué. Tout masqué NOUVEAU — une 30ᵉ entrée d'`actions.json` sans folio, ou un autre dataset
 * exempté — rougit nominativement. Le total hors exemption vaut 44.
 *
 * Second volet : AUCUN champ `source` de type CHAÎNE dans les deux racines de documents. `source`
 * est la réf `{book, page}` ; une chaîne y passe au travers de tout lecteur générique de provenance
 * sans erreur ET sans être comptée. `axes.json` en portait 9 (`source: 'maison'`), migrées en champ
 * `maison` par `scripts/migrations/2026-08-27-l1b-1c-axes-maison.mjs`.
 */

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const SCENES_DIR = fileURLToPath(new URL('../scenes', import.meta.url));

/**
 * Entrées de premier niveau portant `maison` SANS `source`, par dataset — gelé au 2026-08-27,
 * APRÈS la migration 1c. `actions.json` n'y figure pas : il est dans `SANS_LIVRE` (cf. PÉRIMÈTRE).
 *
 * `axes.json` (9) est ENTRÉ dans ce stock au geste même qui l'y a rendu mesurable : ses 9 entrées
 * portaient `source: 'maison'` (une chaîne), invisible de tout lecteur de provenance ; elles portent
 * désormais `maison`. Ce n'est pas une dérive, c'est un angle mort qui devient un compte. Les axes
 * sont MAISON par construction (#409) : cette ligne n'est pas attendue à décroître, elle est
 * attendue à NE PAS CROÎTRE. Les trois autres, elles, se soldent au fil du sourçage (L1d #1469).
 */
const BASELINES: Record<string, number> = {
  'axes.json': 9,
  'crew-roles.json': 7,
  'naval-traits.json': 1,
  // 27→28 (#1599, 2026-09-05) : la fenêtre de conscience par Détermination — LDB 20 l.170 dit
  // « pendant quelques minutes » et ne chiffre RIEN. Un arbitrage n'y a remplacé aucun folio : le
  // folio existe (LDB 189) et ne porte pas de durée.
  // 28 → 33 (#1612, 2026-09-06) : les CINQ réglages de l'Activité Mendier. Aucun folio n'est remplacé
  // par un arbitrage — `LDB 09 l.97/l.99` décrit la mendicité sans chiffrer la durée du créneau, le
  // discours, l'apparence, la chance d'être surpris ni la sanction des gardes. Leur `ref` porte la
  // ligne du passage arbitré ; `maison` est leur régime définitif, comme les 28 précédentes.
  // 33 → 34 (#700, 2026-09-29) : `fenetre-hauteur-allege` — LDB 15 l.55 ne chiffre ni l'allège ni le
  // franchissement d'une croisée ; aucun folio n'est remplacé.
  // 34 → 35 (#700, 2026-09-30) : `porte-secrete-rayon-m` — LDB 09 l.399 ne chiffre pas la distance à
  // laquelle une porte secrète se remarque ; aucun folio n'est remplacé.
  // 35 → 36 (#700, 2026-09-30) : `chute-tombant-non-debout` — EDO 01 l.231 et LDB 15 l.82 ne disent rien
  // d'un compagnon qui n'est pas debout quand le groupe saute ; aucun folio n'est remplacé.
  // 36 → 37 (#700, 2026-09-30) : `fenetre-suspension` — EDO 01 l.231 ne nomme que l'avance du fuyard,
  // aucun coût tactique de la suspension ; aucun folio n'est remplacé.
  'reglesOptionnelles.json': 37,
};

// 45 → 50 (#1612, 2026-09-06) : les 5 réglages MAISON de l'Activité Mendier, cf. la baseline
// `reglesOptionnelles.json` ci-dessus.
// 50 → 51 (#700, 2026-09-29) : `fenetre-hauteur-allege`, cf. la baseline ci-dessus.
// 51 → 52 (#700, 2026-09-30) : `porte-secrete-rayon-m`, cf. la baseline ci-dessus.
// 52 → 53 (#700, 2026-09-30) : `chute-tombant-non-debout`, cf. la baseline ci-dessus.
// 53 → 54 (#700, 2026-09-30) : `fenetre-suspension`, cf. la baseline ci-dessus.
const TOTAL_GELE = 54;

/**
 * Entrées `maison` sans `source` des datasets EXEMPTÉS — gelé au 2026-08-27 (migration 4b), ÉTENDU le
 * 2026-09-02 (#1680 ligne 5). Ce que la borne soustrait au cliquet, nommé dataset par dataset : un
 * masqué de plus, ici ou ailleurs, n'a nulle part où se cacher.
 *
 * `props.json` (41) ENTRE dans ce stock au geste même qui l'y rend mesurable, comme `axes.json` est
 * entré dans `BASELINES`. Ces 41 règles — `light` (éclairage, LDB 74 l.43/56/58), `cover` et `opaque`
 * (couvert, LDB 14 l.72/81/86) — existaient NON TAGUÉES depuis `270fe58a4` : le document est exempté
 * au dataset (c'est de l'art), et l'exemption couvrait aussi ces trois champs, qui n'en sont pas. Elles
 * sont désormais écrites (`scripts/migrations/2026-09-02-1680-props-provenance.mjs`) et EXIGÉES par
 * `affinerEntree` (`schemas/defs/props.ts`). Le stock ne CROÎT pas : il devient VISIBLE. Il n'est pas
 * attendu à décroître non plus — aucun folio ne chiffre le couvert d'un tonneau ni le rayon d'un feu
 * de camp ; ce sont des extrapolations d'étalons, et `maison` est leur régime définitif.
 *
 * `terrains.json` (25) ENTRE le 2026-09-06 (#1690) par le MÊME chemin : le document est de l'art et
 * exempté au dataset, mais chacune de ses 25 entrées porte quatre champs de RÈGLE (`walkable`,
 * `priority`, `opaque`, `built`) que l'exemption ne couvre pas — `maison` y est EXIGÉE (`exiges` de
 * `schemas/defs/terrains.ts`). Ces règles vivaient NON TAGUÉES dans 25 modules TS : le stock ne
 * croît pas, il devient visible. Il n'est pas attendu à décroître — aucun folio n'imprime de
 * catalogue de sols.
 *
 * `buildings.json` (7) ENTRE le 2026-09-09 (#1715) par le MÊME chemin : le document est de l'art et
 * exempté au dataset, et chaque entrée dit ce que CE bâtiment arbitre (son empreinte de pose, sa
 * couverture, son ornement) — `maison` y est EXIGÉE (`exiges` de `schemas/defs/buildings.ts`). Ces
 * arbitrages vivaient NON TAGUÉS dans 7 modules TS : le stock ne croît pas, il devient visible.
 *
 * `semences-de-scene.json` (1) ENTRE le 2026-09-18 (#1716) par le MÊME chemin, à une différence
 * près : le document est à racine UNIQUE (famille `config`), sa seule entrée EST sa racine, et le
 * masqué vaut donc 1. Ce qu'une scène NEUVE reçoit à sa création n'a pas de folio — aucun livre
 * n'imprime le défaut d'un éditeur de scène — et le régime `source: {book, page}` n'admet AUCUNE
 * forme pour un arbitrage d'authoring : `source` est une RÉFÉRENCE de livre, et une chaîne y est
 * interdite par le second volet de ce fichier (« AUCUN champ `source` de type CHAÎNE »). Ces valeurs
 * vivaient NON TAGUÉES en littéraux de `state/scene.ts` : le stock ne croît pas, il devient visible,
 * et `TOTAL_GELE` ne bouge pas.
 */
const MASQUES_GELES: Record<string, number> = { 'actions.json': 29, 'buildings.json': 7, 'defauts-de-compilation.json': 1, 'props.json': 41, 'semences-de-scene.json': 1, 'terrains.json': 25 };

const lire = (dir: string, f: string): unknown => JSON.parse(readFileSync(join(dir, f), 'utf8'));

/** `.json` du dossier — RÉCURSIF : les projets de `src/scenes` vivent en sous-dossiers
 *  (`arene/arene-projet.json`), un scan à plat les manquerait en silence. */
const jsons = (dir: string): string[] => listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') });

/** `maison` non vide ET `source` absente, sur les entrées de PREMIER niveau. */
function maisonSansSource(data: unknown): number {
  const items = Array.isArray(data) ? data : [data];
  return items.filter((e) => {
    if (!e || typeof e !== 'object') return false;
    const r = e as Record<string, unknown>;
    return typeof r.maison === 'string' && r.maison.length > 0 && r.source === undefined;
  }).length;
}

function mesure(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of jsons(DATA_DIR)) {
    if (SANS_PROVENANCE_EXIGEE[f.replace(/\.json$/, '')]) continue;
    let data: unknown;
    try {
      data = lire(DATA_DIR, f);
    } catch {
      continue;
    }
    const n = maisonSansSource(data);
    if (n > 0) out[f] = n;
  }
  return out;
}

describe('cliquet « maison sans source » — le régime d’arbitrage ne dérive pas (#1467 L1b)', () => {
  it('aucun dataset ne DÉPASSE sa baseline gelée', () => {
    const mesuree = mesure();
    const fautifs: string[] = [];
    for (const [f, n] of Object.entries(mesuree)) {
      const base = BASELINES[f] ?? 0;
      if (n > base) fautifs.push(`${f} : ${n} entrée(s) maison sans source (baseline ${base})`);
    }
    expect(fautifs, `régression — un folio a été remplacé par un arbitrage :\n  ${fautifs.join('\n  ')}`).toEqual([]);
  });

  it('aucune baseline n’est devenue TROP HAUTE (un dataset curé se solde dans le même commit)', () => {
    const mesuree = mesure();
    const perimees: string[] = [];
    for (const [f, base] of Object.entries(BASELINES)) {
      const n = mesuree[f] ?? 0;
      if (n < base) perimees.push(`${f} : baseline ${base}, mesuré ${n} — abaisser la baseline`);
    }
    expect(perimees, perimees.join('\n  ')).toEqual([]);
  });

  it('le TOTAL gelé est celui mesuré (le stock ne croît pas en silence)', () => {
    const total = Object.values(mesure()).reduce((a, b) => a + b, 0);
    expect(total).toBe(TOTAL_GELE);
  });

  it('la BORNE d’exemption ne masque QUE le connu — même prédicat appliqué aux datasets exemptés', () => {
    const masques: Record<string, number> = {};
    for (const f of jsons(DATA_DIR)) {
      if (!SANS_PROVENANCE_EXIGEE[f.replace(/\.json$/, '')]) continue;
      let data: unknown;
      try {
        data = lire(DATA_DIR, f);
      } catch {
        continue;
      }
      const n = maisonSansSource(data);
      if (n > 0) masques[f] = n;
    }
    // Si un exempté se met à porter des `maison` STRING hors du gel, la borne cesse d'être connue et le dit.
    expect(masques, `masqués par l’exemption — attendu ${JSON.stringify(MASQUES_GELES)}, mesuré ${JSON.stringify(masques)}`).toEqual(MASQUES_GELES);
  });

  it('le CONTENU des deux listes d’exemption est gelé (un ajout sort des entrées du cliquet)', () => {
    // Le cardinal ne suffit pas : un échange à cardinal constant doit rougir. On gèle les CLÉS.
    expect(Object.keys(SOURCE_EN_PROFONDEUR).sort()).toEqual([
      // `miscast` en SORT par #1467 L1b V-FLIP-TABLE : son fichier porte 5 DOCUMENTS, chacun avec SA
      // `source` à son entrée de premier niveau — il n'y a plus de racine nue à exempter.
      // `criticals` et `aa-criticals` en SORTENT par #1657 B2a, MEME chemin : les deux racines nues
      // sont devenues 8 documents-tables dans un seul fichier, chacun portant SA `source`.
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
    // Les deux régimes sont DISJOINTS : une clé dans les deux rendrait l'union ambiguë.
    const communes = Object.keys(SANS_LIVRE).filter((k) => k in SOURCE_EN_PROFONDEUR);
    expect(communes).toEqual([]);
    // 50 → 51 : `aa-criticals` rejoint `SOURCE_EN_PROFONDEUR` (#1467 L1b V-FLIP-CONFIG).
    // 51 → 50 : `miscast` en sort (#1467 L1b V-FLIP-TABLE).
    // 50 → 48 : `criticals` et `aa-criticals` en sortent (#1657 B2a) — le régime ne fait que décroître.
    // 48 → 46 : `propMaterials`/`reliefMaterials`/`roofMaterials` fusionnent en `materials` (#1686 lot 2).
    // 46 → 47 : `terrains` entre (#1690) — 25 sols qu'aucun folio n'imprime, dont les 4 champs de
    // règle par entrée sont couverts, eux, par un `maison` EXIGÉ au def.
    // 47 → 48 : `buildings` entre (#1715) — 7 types de bâtiment qu'aucun folio n'imprime, chacun
    // portant son `maison` EXIGÉ au def.
    // 48 → 49 : `semences-de-scene` entre (#1716) — un document `config` à racine unique dont le
    // `maison` EXIGÉ au def dit ce qu'une scène neuve reçoit ; aucun folio n'imprime ce défaut.
    // 49 → 50 : `defauts-de-compilation` entre (#1789) — même régime, même forme : un document `config`
    // à racine unique dont le `maison` EXIGÉ dit ce que le COMPILATEUR pose à la place d'un auteur muet.
    expect(Object.keys(SANS_PROVENANCE_EXIGEE)).toHaveLength(50);
  });

  it('`maison` est TOUJOURS une chaîne — zéro drapeau booléen, à TOUTE profondeur des deux racines', () => {
    // Le TYPE porte le contrat de l'enveloppe (`grammaire/document.ts` : la RAISON en clair). Un
    // `maison: true` ne dit aucune raison et passerait tous les lecteurs de provenance en silence.
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
