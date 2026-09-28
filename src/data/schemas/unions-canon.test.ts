/**
 * CONTRAT des unions PARTAGÉES entre le moteur et les schémas de donnée (#1440) : `Availability`
 * (LDB 59) et `StakeForm` (forme déclarée d'un enjeu) ont chacune UN tuple canon dans
 * `src/engine/types.ts`, dont le schéma zod de `schemas/grammaire/valeurs.ts` DÉRIVE. Ce fichier verrouille
 * les deux moitiés du lien :
 *  - au TYPE (`Eq<…>` ci-dessous, gaté par `npm run typecheck`) : le type inféré du schéma et le
 *    type moteur sont mutuellement assignables — un palier ajouté d'un seul côté ne compile pas ;
 *  - au RUNTIME : les options du schéma sont EXACTEMENT le tuple canon, et PERSONNE dans `src/` ne
 *    re-tape le littéral à côté (c'était l'état d'avant : 6 recopies pour `StakeForm`, 4 pour
 *    `Availability` ; puis 10 de plus, hors des schémas, que le scan élargi a mesurées et migrées).
 *
 * Le volet « re-tape » se lit à l'AST et par FORME, pas par nom : chaque canon est une construction
 * réservée, `recopieDeCanon({ nom, membres, complet })` (`scripts/guards/lib/canonUnique.mjs`) déclarée
 * avec son `foyer`, jugée par `scanConstructionsReservees` : ≥2 membres du canon (TOUS sous `complet`)
 * reproduits ensemble en TABLEAU, en union de types, en CLÉS d'objet (zod compris), en membres de type
 * (littéral ou `interface`), en `case` d'un `switch` ou en CHAÎNE de comparaisons. Le scan couvre le
 * périmètre des gardes (`corpusDesGardes()`) — PROD ET TESTS : un test qui recopie l'union verrouille une
 * divergence aussi sûrement qu'un module. N'en sont exclues que les deux formes que le COMPILATEUR borne déjà :
 * la sélection zod `.extract([…])` posée sur un schéma DU canon, et la table `Record<UnionNommée, …>`
 * annotée (dont il exige les clés). Les sous-ensembles MÉTIER (`TestedAvailability`,
 * `APPRAISED_AVAILABILITIES`) sont nommés au foyer, jamais re-tapés au site.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import type { z } from 'zod';
import {
  constructionsReserveesDuCorpus, estTableTotale, recopieDeCanon, scanConstructionsReservees,
} from '../../../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../../../scripts/guards/lib/commentPoison.mjs';
import { AVAILABILITIES, STAKE_FORMS, type Availability, type StakeForm, type TestedAvailability } from '../../engine/types';
import { availabilitySchema, harvestRaritySchema, stakeFormSchema } from './grammaire/valeurs';
import { dispoPctAvailabilitySchema } from './defs/disponibilite';
import type { HarvestRarity } from '../index';
import { wallSideSchema } from './defs-scenes/communs';
import { weatherIdSchema } from './defs/weather';
import type { WallSide } from '../../state/scene';
import type { WallEdgeSide } from '../../engine/types';

/** Ce fichier : ses fixtures et ses attentes SONT des recopies, c'est leur métier. */
const ICI = 'src/data/schemas/unions-canon.test.ts';
/** Foyer des deux tuples canon, où vivent AUSSI les sous-ensembles métier (chacun `satisfies` le
 *  canon). `grammaire/valeurs.ts` n'est foyer de rien : il DÉRIVE (`z.enum(AVAILABILITIES)`), il ne
 *  tape rien. */
const TYPES = 'src/engine/types.ts';
/** Les deux canons verrouillés AU SEUIL GÉNÉRIQUE (≥2 membres), chacun avec son foyer, `[TYPES, ICI]`.
 *  L'alphabet météo n'en est PAS : il se verrouille sur l'union COMPLÈTE (`complet: true`), plus bas —
 *  voir le pourquoi, mesuré, au JSDoc de son `it`. */
const CANONS = [
  { ...recopieDeCanon({ nom: 'AVAILABILITIES', membres: AVAILABILITIES }), foyer: [TYPES, ICI] },
  { ...recopieDeCanon({ nom: 'STAKE_FORMS', membres: STAKE_FORMS }), foyer: [TYPES, ICI] },
];
/** Fixture de scan : un fichier de corpus fabriqué à la main. */
const fixture = (text: string) => ({ rel: 'fixture.ts', text });

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _availabilityExact: Eq<Availability, z.infer<typeof availabilitySchema>> = true;
const _stakeFormExact: Eq<StakeForm, z.infer<typeof stakeFormSchema>> = true;
const _harvestRarityExact: Eq<HarvestRarity, z.infer<typeof harvestRaritySchema>> = true;
const _testedExact: Eq<TestedAvailability, z.infer<typeof dispoPctAvailabilitySchema>> = true;
const _wallSideExact: Eq<WallSide, z.infer<typeof wallSideSchema>> = true;
const _wallEdgeSideExact: Eq<WallEdgeSide, z.infer<typeof wallSideSchema>> = true;
void _availabilityExact; void _stakeFormExact; void _harvestRarityExact; void _testedExact;
void _wallSideExact; void _wallEdgeSideExact;

describe('unions partagées moteur ⇄ schémas de donnée (#1440)', () => {
  it('`availabilitySchema` expose EXACTEMENT les paliers de `AVAILABILITIES`', () => {
    expect(availabilitySchema.options).toEqual([...AVAILABILITIES]);
  });

  it('`harvestRaritySchema` = les paliers canon + le 5ᵉ palier RAW `Unique` (`ZI 13 l.286`)', () => {
    expect(harvestRaritySchema.options).toEqual([...AVAILABILITIES, 'Unique']);
  });

  it('`stakeFormSchema` expose EXACTEMENT `STAKE_FORMS`', () => {
    expect(stakeFormSchema.options).toEqual([...STAKE_FORMS]);
  });

  it('PERSONNE dans `src/` ne re-tape le littéral des unions partagées — prod ET tests', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), CANONS)).toEqual([]);
  });

  /**
   * ARÊTE DE MUR — le canon est le SCHÉMA (`wallSideSchema`, `defs-scenes/communs.ts`) : `WallSide`
   * (`state/scene.ts`) et `WallEdgeSide` (`engine/types.ts`) en dérivent par `z.infer` (les deux `Eq`
   * ci-dessus), l'éditeur en dérive ses `<option>` (`wallSideSchema.options`, `LogicDock.tsx`).
   *
   * PÉRIMÈTRE MESURÉ (2026-08-26, scan sur 3438 fichiers) : la recopie que cette garde
   * ferme est celle de l'union COMPLÈTE — les 4 membres re-tapés ensemble, `recopieDeCanon({ nom:
   * 'WALL_SIDES', membres, complet: true })`. Il en reste 2 : le canon lui-même, son foyer
   * (`defs-scenes/communs.ts`), et `authoring/detailSvg.ts:64` (exempté ci-dessous).
   *
   * Le seuil GÉNÉRIQUE de `recopieDeCanon` (≥2 membres) ne convient PAS ici : il rapporte 102 sites, dont
   * 100 ne re-déclarent PAS l'union. Trois familles y coexistent : les SOUS-ENSEMBLES cardinaux `'N','E'`
   * (arêtes orthogonales des toits/sols/façades) ; les sous-ensembles diagonaux `'\\','/'`
   * (`asciiMap`/`mapSpec`/`sceneEdit`/`sceneToAscii`) ; et des CONSOMMATEURS EXHAUSTIFS en VALEURS —
   * `builders/walls.ts:66` énumère trois `case` + un `default` sur une valeur déjà typée par le canon : un
   * narrowing n'est pas une recopie de TYPE, le compilateur le borne déjà. Nommer les deux sous-ensembles
   * au foyer et étendre le canon au seuil ≥2 : dette #1515.
   */
  it('l’arête de mur : l’union COMPLÈTE n’est re-tapée NULLE PART hors du canon', () => {
    /** Le SEUL site qui re-tape les 4 membres hors canon, et pourquoi il n'en est pas une recopie :
     *  `AXIS_OF` mappe les SIX orientations d'arête de la planche (N/S/E/O + les 2 diagonales) vers
     *  ses 4 axes de motif — un vocabulaire de dessin plus large que l'arête de mur, dont l'union
     *  n'est pas le canon (il porte `S` et `O`, que `wallSideSchema` n'a pas). */
    const EXEMPTIONS = ['src/gameIso/authoring/detailSvg.ts:64'];
    const arete = {
      ...recopieDeCanon({ nom: 'WALL_SIDES', membres: wallSideSchema.options, complet: true }),
      foyer: ['src/data/schemas/defs-scenes/communs.ts', ICI],
    };
    const complets = constructionsReserveesDuCorpus(corpusDesGardes(), [arete])
      .filter(({ rel, line }) => !EXEMPTIONS.includes(`${rel}:${line}`));
    expect(complets, 'dériver du canon : `z.infer<typeof wallSideSchema>` / `wallSideSchema.options`').toEqual([]);
  });

  /**
   * ALPHABET MÉTÉO DE VOYAGE — le canon est le SCHÉMA (`weatherIdSchema`, `defs/weather.ts`) : le moteur
   * en dérive `type Weather` (`engine/travelStages.ts`), l'éditeur ses `<option>`
   * (`CodexEdit.WeatherRangesField`) et les domaines de test leur énumération (`engine/rule-refs.test.ts`).
   *
   * SEUIL COMPLET (`complet: true`), et il est MESURÉ (2026-08-30, scan sur tout `src/`) : au seuil
   * GÉNÉRIQUE de `recopieDeCanon` (≥2 membres) ce canon rapporte 14 sites dont AUCUN ne re-déclare l'alphabet.
   * La raison est structurelle — il existe TROIS vocabulaires météo distincts dans l'arbre, et les deux
   * autres chevauchent celui-ci par exactement deux noms (`pluie`, `neige`) :
   *  - la météo de SCÈNE `'clair'|'pluie'|'brouillard'|'neige'|'tempete'` (`state/scene.ts:345`,
   *    `defs-scenes/scene.ts:510`, ses lecteurs `engine/exposure.ts:42`, `defs/ambiance.ts`,
   *    `gameIso/catalog/ambiance.ts`, `gameIso/stage/weather-portes.test.tsx`) — AUTRE axe, migration
   *    possédée par #1585 ; une garde de CE canon qui la rougirait accuserait un innocent ;
   *  - les particules de RENDU `'pluie'|'averse'|'neige'` (`gameIso/catalog/ambiance.ts:57`).
   * Restent, sur le vrai axe : le FOYER (le `z.enum` lui-même, `defs/weather.ts`, déclaré `foyer` comme
   * `communs.ts` l'est pour l'arête) et les deux narrowings RAW de `stageExposureDifficulty` (EDOC 8 l.90, modéré
   * pluie/neige vs extrême diluvienne/blizzard) — un `case` sur une valeur DÉJÀ typée `Weather` n'est
   * pas une recopie de type, le compilateur le borne (même verdict que `builders/walls.ts:66` ci-dessus).
   * Sous `complet`, `pluie`+`neige` ne suffisent pas : seule une vraie recopie des 6 rougit, une
   * énumération des 6 en dur.
   */
  it('l’alphabet météo de VOYAGE : les 6 ids ne sont re-tapés NULLE PART hors du canon', () => {
    const meteo = {
      ...recopieDeCanon({ nom: 'WEATHER_IDS', membres: weatherIdSchema.options, complet: true }),
      foyer: ['src/data/schemas/defs/weather.ts', ICI],
    };
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), [meteo])).toEqual([]);
    // DENTS : un vert ne prouve rien si la déclaration ne peut PAS mordre. Une recopie des 6, rejouée
    // en fixture, doit être vue ; le chevauchement à 2 noms de l'axe SCÈNE, non.
    const vu = (text: string) => scanConstructionsReservees(fixture(text), [meteo]);
    expect(vu(`const meteos: Weather[] = ['sec', 'beau', 'pluie', 'pluie-diluvienne', 'neige', 'blizzard'];`)).toHaveLength(1);
    expect(vu(`weather?: 'clair' | 'pluie' | 'brouillard' | 'neige' | 'tempete';`), 'axe SCÈNE (#1585) : 2 noms partagés ne font pas une recopie').toEqual([]);
  });

  it('`TestedAvailability` et sa sélection zod nomment le MÊME couple (le sous-ensemble n’a qu’un site)', () => {
    expect(dispoPctAvailabilitySchema.options).toEqual(['Limitée', 'Rare']);
    expect(AVAILABILITIES.filter((a) => !dispoPctAvailabilitySchema.options.includes(a as never))).toEqual(['Commune', 'Exotique']);
  });

  it('le scan LIT L’AST : les six FORMES de recopie sont vues, quelle que soit la mise en page', () => {
    const forme = (text: string) => scanConstructionsReservees(fixture(text), CANONS).map((x) => x.detail);
    expect(forme(`export const s = z.enum([
      'verbatim',
      'descripteur',
      'resume',
    ]);`), 'tableau MULTI-LIGNE et divergent').toEqual(["STAKE_FORMS recopiée en tableau ('verbatim', 'descripteur')"]);
    expect(forme(`type F =
      | 'verbatim'
      | 'descripteur';`), 'union de types').toHaveLength(1);
    expect(forme(`const rang = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };`), 'clés d’objet nues').toHaveLength(1);
    expect(forme(`const s = z.strictObject({ Commune: r, Limitée: r, Rare: r, Exotique: r });`), 'clés d’un objet zod').toHaveLength(1);
    expect(forme(`type T = { Commune: number; Exotique: number };`), 'membres de type').toHaveLength(1);
    expect(forme(`switch (f) {
      case 'verbatim': return 1;
      case 'descripteur': return 2;
    }`), 'case d’un switch').toHaveLength(1);
    expect(forme(`const ok = av === 'Rare' || av === 'Exotique';`), 'chaîne de comparaisons').toHaveLength(1);
    expect(forme(`const ko = f !== 'verbatim' && f !== 'descripteur';`), 'chaîne de NON-égalités').toHaveLength(1);
    expect(forme(`const un = ['Rare'];`), 'UN seul membre n’est pas une union recopiée').toEqual([]);
  });

  it('`recopieDeCanon` : une forme hors des six lève en la nommant', () => {
    expect(() => recopieDeCanon({ nom: 'X', membres: ['a', 'b'], formes: ['tableau', 'liste'] })).toThrow(/recopieDeCanon\(X\) : forme\(s\) inconnue\(s\) liste/);
  });

  it('ce que le COMPILATEUR borne déjà n’est pas une recopie — et rien d’autre ne se blanchit', () => {
    const forme = (text: string) => scanConstructionsReservees(fixture(text), CANONS);
    expect(forme(`const s = grilleMaison.extract(['Limitée', 'Rare']);`), 'même appel sur un récepteur ÉTRANGER : rien n’est prouvé').toHaveLength(1);
    expect(forme(`const t: Record<Availability, number> = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };`), 'table exhaustive keyée par l’union NOMMÉE').toEqual([]);
    expect(forme(`const t: Record<string, number> = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };`), 'Record<string, …> n’exige aucune exhaustivité').toHaveLength(1);
    expect(forme(`const t = { Commune: 0, Limitée: 1 } as Record<Availability, number>;`), 'une ASSERTION ne vérifie pas les clés manquantes').toHaveLength(1);
  });

  /** Le récepteur d'une sélection se juge par sa LIAISON d'import (`estSelectionDerivee`) : chaque
   *  forme, et le nombre de recopies attendues (`0` blanchie, `1` vue, HORS DE PORTÉE compris). */
  const SELECTIONS: readonly (readonly [string, string, number])[] = [
    ['schéma DU canon importé', `import { availabilitySchema } from '../grammaire/valeurs';
const s = availabilitySchema.extract([
  'Limitée',
  'Rare',
]);`, 0],
    ['schéma du canon importé RENOMMÉ', `import { availabilitySchema as palier } from '../grammaire/valeurs';
const s = palier.extract(['Limitée', 'Rare']).optional();`, 0],
    ['HOMONYME local du schéma, sans import', `const availabilitySchema = grilleMaison;
const s = availabilitySchema.extract(['Limitée', 'Rare']);`, 1],
    ['homonyme importé d’un AUTRE module', `import { availabilitySchema } from '../defs/disponibilite';
const s = availabilitySchema.extract(['Limitée', 'Rare']);`, 1],
    ['HORS DE PORTÉE : par un espace de noms', `import * as v from '../grammaire/valeurs';
const s = v.availabilitySchema.extract(['Limitée', 'Rare']);`, 1],
    ['HORS DE PORTÉE : par un alias local', `import { availabilitySchema } from '../grammaire/valeurs';
const alias = availabilitySchema;
const s = alias.extract(['Limitée', 'Rare']);`, 1],
  ];

  it.each(SELECTIONS)('sélection zod — %s', (_forme, text, recopies) => {
    expect(scanConstructionsReservees({ rel: 'src/data/schemas/defs/fixture.ts', text }, CANONS)).toHaveLength(recopies);
  });

  it('`estTableTotale` : une table keyée par une union FERMÉE sous son type déclaré, jamais sous une assertion', () => {
    const totale = (code: string) => {
      const sf = ts.createSourceFile('fixture.ts', code, ts.ScriptTarget.Latest, true);
      const objets: ts.ObjectLiteralExpression[] = [];
      const walk = (n: ts.Node) => {
        if (ts.isObjectLiteralExpression(n)) objets.push(n);
        ts.forEachChild(n, walk);
      };
      walk(sf);
      return estTableTotale(objets[0]);
    };
    const CAS: [string, boolean][] = [
      ["const T: Record<View, string> = { a: '1' };", true],
      ["const T: Record<'front' | 'back', string> = { a: '1' };", true],
      ["const T: Required<Record<View, string>> = { a: '1' };", true],
      ["const T = { a: '1' } satisfies Record<View, string>;", true],
      ["const T: Record<string, string> = { a: '1' };", false],
      ["const T: Record<(typeof VIEWS)[number], string> = { a: '1' };", true],
      ["const T: Record<View, string> = { a: '1' } as const;", true],
      ["const T = { a: '1' } as Record<View, string>;", false],
      ["const T: Partial<Readonly<Record<View, string>>> = { a: '1' };", true],
      ["const T: Record<symbol, string> = { a: '1' };", false],
      ["const T: Record<string | 'x', string> = { a: '1' };", false],
      ['const T: Record<`${string}#x`, string> = { a: \'1\' };', false],
      ['const T: Record<`${Bone}#${View}`, string> = { a: \'1\' };', true],
    ];
    for (const [code, attendu] of CAS) expect(totale(code), code).toBe(attendu);
  });

  it('le scan couvre bien `src/` (sanity : > 1500 fichiers, tests ET defs de schémas compris)', () => {
    const vus = corpusDesGardes();
    expect(vus.length).toBeGreaterThan(1500);
    expect(vus.filter(({ rel }) => rel.startsWith('src/data/schemas/defs/')).length).toBeGreaterThan(40);
    expect(vus.filter(({ rel }) => rel.endsWith('.test.ts')).length).toBeGreaterThan(100);
  });
});
