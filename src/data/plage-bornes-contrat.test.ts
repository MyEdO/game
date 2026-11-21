/**
 * CONTRAT des deux concepts à DEUX BORNES de la donnée (#1463 L4, vague `plage`) — sondes du design
 * jugé du 2026-08-31 promues en tests.
 *
 * Ce fichier tient cinq affirmations POSITIVES, chacune mesurée sur les DEUX racines de donnée
 * (`src/data` et `src/scenes`, comme le scan des structures) :
 *  A. une seule graphie d'OBJET nomme une paire de bornes (`min,max`) ; ce qui reste encodé par la
 *     BORNE HAUTE SEULE est INVENTORIÉ, document par document ;
 *  B. les bornes d'un RÉGLAGE et les bornes d'un TIRAGE sont disjointes ;
 *  C. la fourchette EMBOÎTÉE (`{range: {min, max}}`) n'existe nulle part ;
 *  E. une borne `null` ne s'admet qu'à travers `plageOuverteSchema` (#1463 L-gram-1), composé aux positions
 *     de schéma NOMMÉES, et la donnée n'en porte qu'à ces positions — un nœud de grammaire à part plutôt
 *     qu'une paire de bornes rendue `nullable` partout ;
 *  F. aucun schéma de document n'admet une paire de nombres en TUPLE hors des paramètres d'une recette de
 *     RENDU (`detailRecipeSchema`).
 *
 * COUVERTURE RÉELLE, et ses deux bords (#1659, #3021) :
 *   (1) A/B/C/E ne voient que des OBJETS : une paire de bornes écrite `[81, 130]` n'a ni clé `min` ni
 *       clé `max` — c'est le volet F qui la mesure, sur le SCHÉMA ; une paire écrite dans une LISTE de
 *       nombres (`z.array(z.number())`) se lit comme une liste et lui échappe ;
 *   (2) le volet A « borne haute seule » reste borné à l'ÉLÉMENT DE TABLEAU, là où A/B/C/E et le
 *       lexique ne le sont plus : hors tableau, `{max}` sans `min` est un CARDINAL, pas une table
 *       encodée par sa borne haute — mesuré 2026-09-01, les deux seuls sites sont
 *       `arcane-phenomena.json › stonePropertySlots` (nombre de propriétés d'une pierre) et
 *       `traits.json › effects[].on` (nombre de cibles d'un déclenchement).
 *
 * Ces cinq-là sont ce qui rend la CIBLE tenable : `findTableEntry`
 * (`src/engine/tables.ts`, primitive de la table `docs/primitives.md`) exige la forme PLATE `{min, max}`, et
 * borne le tirage des DEUX côtés — donc l'ordre des rangées d'une table éditable au Codex ne décide
 * plus de son résultat.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { cheminsDeSchema } from '../../scripts/guards/lib/structuresLocales.mts';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { SCHEMA_DEFS_SCENES } from './schemas/_registry-scenes.generated';
import { defDe, descendre, enfantsDe, ouverts } from './schemas/grammaire/descente';
import { detailRecipeSchema, plageOuverteSchema, raceKeySchema } from './schemas/grammaire/valeurs';
import { validateDataset } from './schemas/validate';
import { tableTotale } from '../lib/tableTotale';
import { estObjet } from '../lib/objet.mjs';

/** Les DEUX racines de donnée du projet, comme le scan des structures (`scripts/docs/lib/structures-scan.mts`) :
 *  une graphie de bornes qui n'apparaîtrait que dans un document de SCÈNE échapperait sinon à la mesure.
 *  Mesuré 2026-08-31 : `src/scenes` (4 documents de projet) porte 0 paire de bornes, 0 borne haute
 *  seule, 0 `rand` — la sonde y verrouille donc une population VIDE, et c'est ce qu'on veut tenir. */
const RACINES: [string, string][] = ['src/data', 'src/scenes'].map((r) => [r, join(process.cwd(), r)]);

/** Graphies CONNUES d'une paire de bornes — celles qu'on cherche, pas seulement celle qu'on écrit. */
const PAIRES = [
  ['min', 'max'],
  ['from', 'to'],
  ['de', 'a'],
  ['low', 'high'],
  ['lo', 'hi'],
  ['debut', 'fin'],
  ['start', 'end'],
  ['inf', 'sup'],
] as const;

type Objet = Record<string, unknown>;
type Site = { doc: string; chemin: string; cles: string[] };

const estNombre = (v: unknown): v is number => typeof v === 'number';

type Mesure = {
  /** Compte par graphie de paire (`'min,max'` → n). */
  paires: Record<string, number>;
  /** Objets `{range: {min, max}}` — la cible EMBOÎTÉE. */
  emboites: string[];
  /** Objet portant `min` ET `max` numériques — la candidature structurelle du lexique, qui n'est plus
   *  POSITIONNELLE depuis #1659 (`candidatureHorsTableau`) : élément de tableau comme porté par un champ. */
  deuxBornes: Site[];
  /** Élément de TABLEAU portant `max` (nombre ou `null`) SANS `min` : la borne haute SEULE. Borné au
   *  tableau à dessein (cf. l'en-tête, bord (2) : hors tableau, `{max}` seul est un CARDINAL). */
  borneHauteSeule: Site[];
  /** Objet portant une borne numérique et l'autre `null` : la bande OUVERTE (`plageOuverteSchema`). */
  bandesOuvertes: Site[];
  /** Seuils de tirage à borne haute seule, par position. */
  seuils: string[];
  /** Documents JSON effectivement lus, PAR RACINE — sans quoi l'élargissement de la marche à une
   *  seconde racine serait un no-op indétectable (elle n'y porte, aujourd'hui, aucune borne). */
  documentsParRacine: Record<string, number>;
};

function mesurer(): Mesure {
  const m: Mesure = { paires: {}, emboites: [], deuxBornes: [], borneHauteSeule: [], bandesOuvertes: [], seuils: [], documentsParRacine: {} };
  const walk = (n: unknown, doc: string, chemin: string, dansTableau: boolean): void => {
    if (Array.isArray(n)) {
      for (const e of n) walk(e, doc, `${chemin}[]`, true);
      return;
    }
    if (!n || typeof n !== 'object') return;
    const o = n as Objet;
    const cles = Object.keys(o);

    for (const [a, b] of PAIRES) {
      if (estNombre(o[a]) && estNombre(o[b])) m.paires[`${a},${b}`] = (m.paires[`${a},${b}`] ?? 0) + 1;
    }
    const r = o.range as Objet | undefined;
    if (estObjet(r) && estNombre(r.min) && estNombre(r.max)) {
      m.emboites.push(`${doc}${chemin}`);
    }
    // Ni `deuxBornes` ni `bandesOuvertes` ne regardent la POSITION du porteur : la candidature `plage`
    // du lexique ne le fait plus non plus (`candidatureHorsTableau`, #1659) — un `{min,max}` porté par
    // un champ est la même fourchette que celui d'un élément de tableau.
    if (estNombre(o.min) && estNombre(o.max)) m.deuxBornes.push({ doc, chemin, cles });
    if ((estNombre(o.min) && o.max === null) || (o.min === null && estNombre(o.max))) m.bandesOuvertes.push({ doc, chemin, cles });
    if (dansTableau && 'max' in o && !('min' in o) && (estNombre(o.max) || o.max === null)) {
      m.borneHauteSeule.push({ doc, chemin, cles });
    }
    for (const c of cles.filter((cle) => cle === 'rand' || cle === 'randByRace')) m.seuils.push(`${doc}${chemin}.${c}`);

    for (const c of cles) walk(o[c], doc, `${chemin}.${c}`, false);
  };
  /** Les `.json` d'une racine, à toute profondeur : ce qui est collecté est de la DONNÉE, pas un
   *  corpus source — `listerArbre`, jamais `readCorpus`. */
  const documents = (dir: string): [string, string][] =>
    listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => [rel, join(dir, rel)]);
  for (const [cle, racine] of RACINES) {
    const lus = documents(racine);
    m.documentsParRacine[cle] = lus.length;
    for (const [nom, chemin] of lus) walk(JSON.parse(readFileSync(chemin, 'utf8')), nom, '', false);
  }
  return m;
}

/** Le type zod d'un nœud. */
const typeDe = (n: unknown): string => defDe(n)?.type ?? '';
/** Chaque nœud de chaque schéma de document, à son plus court chemin (`cheminsDeSchema`), nommé `fichier::chemin`. */
const NOEUDS_DE_DOCUMENT: [string, object][] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES]
  .flatMap((d) => [...cheminsDeSchema(d.schema)].map(([n, { path }]): [string, object] => [`${d.file}::${path}`, n]));
/** Les nœuds atteints depuis `racine`, elle comprise. */
const atteints = (racine: unknown): Set<unknown> => {
  const vus = new Set<unknown>();
  descendre([racine], ({ noeud }) => { vus.add(noeud); });
  return vus;
};

const M = mesurer();

describe('deux bornes : une seule graphie, et rien d’emboîté (#1463 L4, vague `plage`)', () => {
  it('A — la marche couvre les DEUX racines de donnée (sinon l’affirmation « dans la donnée » ment)', () => {
    // `src/scenes` ne porte AUCUNE borne aujourd'hui (mesuré 2026-08-31) : les assertions ci-dessous
    // y verrouillent donc le vide. Sans ce compte, ramener la marche à la seule racine `src/data` ne
    // ferait rougir aucun test — la sonde revendiquerait une couverture qu'elle n'a plus.
    const lues = Object.entries(M.documentsParRacine).filter(([, n]) => n > 0).map(([r]) => r).sort();
    expect(
      lues,
      'la marche ne lit plus les DEUX racines de donnée : une graphie de bornes posée dans un document de scène échapperait à tout ce que ce fichier affirme.',
    ).toEqual(['src/data', 'src/scenes']);
  });

  it('A — la SEULE paire de bornes nommée dans la donnée est `min,max`', () => {
    expect(
      Object.keys(M.paires).filter((p) => p !== 'min,max'),
      'une graphie CONCURRENTE de `min,max` est apparue (from/to, de/a, low/high…) : une fourchette s’écrit `{min, max}` — c’est la forme que `findTableEntry` (`src/engine/tables.ts`) lit.',
    ).toEqual([]);
    expect(M.paires['min,max'], 'la population à deux bornes a disparu : la sonde ne mesure plus rien.').toBeGreaterThan(0);
  });

  it('A — ce qui reste encodé par la BORNE HAUTE SEULE est INVENTORIÉ : les rangs maximaux de `talents.json`, et rien d’autre', () => {
    const RANGS_MAXIMAUX = ['talents.json[]', 'talents.json[].variants[]'];
    // Un RANG maximal n'est PAS une fourchette : `talents.json › max` est le nombre de fois qu'un
    // Talent peut être pris (`null` = sans limite, `{bonusOf}` = un Bonus de Caractéristique).
    // Aucun d100 ne le traverse — il n'a pas de borne basse à porter.
    expect(
      [...new Set(M.borneHauteSeule.map((s) => `${s.doc}${s.chemin}`))].filter((c) => !RANGS_MAXIMAUX.includes(c)),
      'un document encode ENCORE une table par sa seule borne haute — sa borne basse serait reconstruite par POSITION, donc ni authorée ni éditable, et son lookup ordre-dépendant (cf. `weather.json`/`advancementCosts.json`, migrés le 2026-08-31).',
    ).toEqual([]);
  });

  it('E — une borne `null` ne s’admet qu’à travers `plageOuverteSchema`, composé aux positions NOMMÉES, et la donnée n’en porte qu’à elles', () => {
    // Une bande ouverte est une borne que le livre n'imprime pas ; le lookup l'ouvre (`tableOuverte`,
    // `src/engine/tables.ts`). LDB 07 l.49, l.70 ; MDG 15 l.383 ; MDG 12 l.129 ; AA 10 l.127 ;
    // MDG 13 l.71, l.75, l.140, l.316, l.320, l.343, l.380, l.394 ; MDG 14 l.188, l.199 ;
    // MDG 15 l.33, l.37, l.137, l.235 ; VDM 12 l.435 ; AA 07 l.105, l.131, l.157, l.183 ; LDB 40 l.89.
    const bornesOuvertes = new Set<unknown>(Object.values(plageOuverteSchema.shape));
    const paires = NOEUDS_DE_DOCUMENT.flatMap(([site, n]) => {
      const bornes = typeDe(n) === 'object' ? enfantsDe(n).filter((e) => e.cle === 'min' || e.cle === 'max') : [];
      return bornes.length === 2 ? [{ site, bornes: bornes.map((e) => e.noeud) }] : [];
    });
    const admetNull = (b: unknown) => ouverts([b]).some((x) => ['null', 'nullable'].includes(typeDe(x)));
    expect(
      paires.filter((p) => p.bornes.some(admetNull) && !p.bornes.every((b) => bornesOuvertes.has(b))).map((p) => p.site),
      'une paire de bornes admet `null` sans composer `plageOuverteSchema` : la bande ouverte est le nœud d’une EXCEPTION nommée, pas une paire rendue `nullable`.',
    ).toEqual([]);
    const positions = paires.filter((p) => p.bornes.every((b) => bornesOuvertes.has(b))).map((p) => p.site).sort();
    expect(positions, 'les positions qui composent `plageOuverteSchema` ont changé : chacune se nomme ici.').toEqual([
      'advancementCosts.json::[]', 'crew-morale.json::.bands[]', 'criticals.json::[].entries[]', 'miscast.json::[].entries[]',
      'naval-progression.json::.entries[]', 'sea-cargo.json::.vente.prixDOffre[]', 'sea-events.json::.boardEvents.entries[]',
      'sea-events.json::.fastVoyage.entries[]', 'sea-navigation.json::.orientation.changementDeCap.entries[]',
      'sea-navigation.json::.orientation.reperes[]', 'sea-navigation.json::.phares.voirLaLumiere[]',
      'sea-navigation.json::.poursuite.drDeltas[]', 'sea-navigation.json::.vitesseMax.table[]',
      'ship-construction.json::.standard[].lengthM', 'structure-criticals.json::.entries[]', 'tables.json::[].entries[]',
    ]);
    const documents = new Set(positions.map((p) => p.split('::')[0]));
    expect(
      [...new Set(M.bandesOuvertes.map((s) => s.doc))].filter((d) => !documents.has(d)),
      'une bande OUVERTE est portée par un document qui ne compose pas `plageOuverteSchema`.',
    ).toEqual([]);
  });

  it('F — aucun schéma de document n’admet une paire de nombres en TUPLE hors d’une recette de RENDU (`detailRecipeSchema`)', () => {
    // Un paramètre de recette de RENDU est un intervalle géométrique lu POSITIONNELLEMENT,
    // pas une bande de table : aucun d100 ne le traverse. Une paire
    // de bornes de tirage s'écrit `{min, max}`, la forme que `findTableEntry` lit.
    const recette = atteints(detailRecipeSchema);
    const paires = NOEUDS_DE_DOCUMENT.filter(([, n]) => {
      const items = typeDe(n) === 'tuple' ? enfantsDe(n).filter((e) => /^\[\d+\]$/.test(e.segment)) : [];
      return items.length === 2 && items.every((e) => ouverts([e.noeud]).some((x) => typeDe(x) === 'number'));
    });
    expect(paires.filter(([, n]) => recette.has(n)).length, 'aucune recette de rendu n’admet de tuple : la sonde ne mesure plus rien.').toBeGreaterThan(0);
    expect(
      paires.filter(([, n]) => !recette.has(n)).map(([site]) => site),
      'un schéma admet une paire de nombres en TUPLE hors d’une recette de rendu : une paire de bornes s’écrit `{min, max}`.',
    ).toEqual([]);
  });

  it('A — les tables portent des fourchettes explicites dans les deux racines', () => {
    expect(M.seuils).toEqual([]);
  });

  it('B — les bornes d’un RÉGLAGE et celles d’un TIRAGE sont DISJOINTES', () => {
    // Discriminant STRUCTUREL, celui que le lexique déclare (`bornes.coPresence`) : une borne de
    // réglage vit avec sa valeur par défaut ou son pas. Mesuré 2026-08-31 : `kind` seul ne
    // discrimine pas (`oups.json` et `sea-events.json` le portent aussi).
    const estBorne = (s: Site) => s.cles.includes('default') || s.cles.includes('step');
    const bornes = M.deuxBornes.filter(estBorne);
    const tirages = M.deuxBornes.filter((s) => !estBorne(s));
    expect(
      [...new Set(bornes.map((s) => s.doc))].filter((d) => d !== 'reglesOptionnelles.json'),
      'les bornes de DOMAINE d’un réglage ne vivent que dans `reglesOptionnelles.json` : ailleurs, `min,max` est une plage de TIRAGE.',
    ).toEqual([]);
    expect(bornes.length, 'la population des bornes de réglage a disparu : la sonde ne mesure plus rien.').toBeGreaterThan(0);
    expect(
      tirages.filter((s) => s.doc === 'reglesOptionnelles.json'),
      'un réglage porte `min,max` SANS `default` ni `step` : il serait classé plage de tirage (`bornes` passe AVANT `plage` dans le lexique, mais sa co-présence n’est plus vérifiée).',
    ).toEqual([]);
    expect(bornes.filter((b) => tirages.includes(b)), 'intersection non vide entre bornes et tirages.').toEqual([]);
  });

  it('C — la fourchette EMBOÎTÉE `{range: {min, max}}` n’existe NULLE PART', () => {
    // La cible que le lexique déclarait avant le 2026-08-31 (« portée par `range` », #1463 S1) :
    // 0 objet la portait. La cible retenue est la fourchette PLATE, celle que `findTableEntry` lit.
    expect(
      M.emboites,
      'un objet emboîte sa fourchette sous `range` : `findTableEntry` (`src/engine/tables.ts`) lit la forme PLATE `{min, max}` — emboîter fork le lookup partagé.',
    ).toEqual([]);
  });
});

describe('Couverture des tables de création', () => {
  const source = { book: 'livre-de-base', page: 40 };
  const repere = (id: string, min: number, max: number) => ({ id, label: id, min, max });
  const demeure = (id: string, min: number, max: number) => ({
    ...repere(id, min, max), type: 'astrology', desc: 'Une demeure.', source,
  });

  it('les repères des demeures couvrent 1 à 10 dans tout ordre (ADE II 03 l.504-512)', () => {
    const premieres = demeure('premieres', 1, 5);
    const suivantes = demeure('suivantes', 6, 10);
    expect(validateDataset('astrology.json', [suivantes, premieres])).toBeNull();
    expect(validateDataset('astrology.json', [premieres, { ...suivantes, min: 7 }])).toMatch(/astrology\.json/);
    expect(validateDataset('astrology.json', [premieres, { ...suivantes, max: 11 }])).toMatch(/astrology\.json/);
    expect(validateDataset('astrology.json', [{ ...premieres, max: 5.5 }, { ...suivantes, min: 6.5 }])).toMatch(/entier/i);
  });

  it.each(['eyes', 'hairs'])('%s exige le dé entier dans chaque colonne', (type) => {
    const color = tableTotale(raceKeySchema.options, () => 'Brun');
    const premiere = { ...repere('premiere', 2, 3), color };
    const seconde = { ...repere('seconde', 4, 6), color };
    const die = { n: 2, sides: 3 };
    const fichier = `${type}.json`;
    const table = { id: 'table-test', type, label: 'Table de test', source, die };
    const erreurs = (entries: unknown[]) => validateDataset(fichier, { ...table, entries });
    const plageParRace = { gnome: { min: 5, max: 6 } };
    expect(erreurs([seconde, premiere])).toBeNull();
    expect(erreurs([premiere, { ...seconde, min: 3 }])).toMatch(/couvr/i);
    expect(erreurs([premiere, { ...seconde, plageParRace }])).toMatch(/gnome/i);
    expect(erreurs([premiere, { ...seconde, max: 5 }])).toMatch(/couvr/i);
    expect(erreurs([{ ...premiere, min: 1 }, seconde])).toMatch(/couvr/i);
    expect(erreurs([
      { ...premiere, plageParRace: { gnome: { min: 2, max: 3.5 } } },
      { ...seconde, plageParRace: { gnome: { min: 4.5, max: 6 } } },
    ])).toMatch(/entier/i);
    expect(erreurs([premiere, { ...seconde, color: { humain: 'Brun' } }])).toMatch(/couleur/i);
    expect(validateDataset(fichier, { ...table, die: { n: 2, sides: 4 }, entries: [premiere, seconde] })).toMatch(/couvr/i);
  });

  const signe = (id: string, min: number, max: number) => ({
    ...repere(id, min, max), source, desc: 'Un signe.', signe: 'Signe', classique: 'Classique',
    ascendant: 'Ascendant', dates: 'Dates', dieux: 'Dieux', apparence: 'Apparence',
  });
  const simple = signe('simple', 1, 3);
  const varianteA = { ...signe('variante-a', 4, 6), sub: { min: 1, max: 2 } };
  const varianteB = { ...signe('variante-b', 4, 6), sub: { min: 3, max: 4 } };
  const table = {
    id: 'table-test', type: 'stars', label: 'Table de test', source, die: { n: 1, sides: 6 }, sub: { die: { n: 1, sides: 4 } },
  };
  const erreursDesSignes = (entries: unknown[]) => validateDataset('stars.json', { ...table, entries });

  it('un groupe à largeur et rattachement communs couvre le sous-dé, dans tout ordre', () => {
    expect(erreursDesSignes([varianteB, simple, varianteA])).toBeNull();
    expect(erreursDesSignes([simple, varianteA, { ...varianteB, max: 5 }])).toMatch(/stars\.json/);
    expect(erreursDesSignes([simple, varianteA, { ...varianteB, min: 5 }])).toMatch(/stars\.json/);
    expect(erreursDesSignes([simple, varianteA])).toMatch(/stars\.json/);
    expect(erreursDesSignes([simple, varianteA, signe('intrus', 4, 6), varianteB])).toMatch(/stars\.json/);
    expect(erreursDesSignes([simple, signe('doublon', 1, 3), varianteA, varianteB])).toMatch(/stars\.json/);
  });

  it('les plages principales et secondaires couvrent leur dé sans trou, recouvrement ou fraction', () => {
    expect(erreursDesSignes([{ ...simple, max: 2 }, varianteA, varianteB])).toMatch(/couvr/i);
    expect(erreursDesSignes([{ ...simple, max: 4 }, varianteA, varianteB])).toMatch(/couvr/i);
    expect(erreursDesSignes([simple, varianteA, { ...varianteB, sub: { min: 4, max: 4 } }])).toMatch(/couvr/i);
    expect(erreursDesSignes([simple, varianteA, { ...varianteB, sub: { min: 2, max: 4 } }])).toMatch(/couvr/i);
    expect(erreursDesSignes([
      simple, { ...varianteA, sub: { min: 1, max: 2.5 } }, { ...varianteB, sub: { min: 3.5, max: 4 } },
    ])).toMatch(/entier/i);
  });
});
