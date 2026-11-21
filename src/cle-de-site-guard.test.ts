/**
 * `src/lib/stock.mjs` déclare les champs de la clé de site, du site observé et de l’échéance
 * (#1903, #2016).
 * La règle de l’échéance couvre `src/` et les dossiers d’outillage qui portent les stocks.
 * Le lexique des structures date l’inscription d’un peuplement attendu.
 *
 * Ce que cette garde ne voit pas. Une paire d'affichage `fichier :: ref`, sans occurrence ni séparateur
 * final, n'est pas une clé. Une clé de groupe écrite sur les champs d'un site observé (`Site`, champ
 * `file`, avant `sitesEnEntrees`) : ses champs ne sont pas ceux de l'entrée. Une clé bâtie sans
 * séparateur littéral (concaténation de variables). Une clé calculée concaténée à son remède
 * (`cleDeSite(x) + ' — …'`) : la règle « clé calculée suivie de son remède » de `cleEnLigne` ne lit que
 * les gabarits. Une fonction de clé atteinte par une réexportation, une affectation
 * (`const k = cleDeSite`) ou un appel indirect : la même règle ne lit que l'appel d'une liaison importée
 * de son module déclaré (`estAppelDeclare`). La concordance des tuples de `stock.d.mts` avec les valeurs
 * de `stock.mjs` : la forme `tableau` ne lit pas un type tuple, comme pour tout module `.mjs` typé par un
 * `.d.mts`. Une ré-énumération des champs dans un JSDoc (`@type {{ fichier: string, … }}`) : l'AST ne
 * parcourt pas les commentaires. Une réf de stock CSS dont la valeur est un entier nu
 * (`… :: z-index :: 10`) vérifie la règle « clé à occurrence » de `cleEnLigne` : elle s'écrit avec son
 * unité, jamais sous un foyer.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { ast } from '../scripts/guards/lib/dialecte.mjs';
import {
  cleEnLigne, constructionsReserveesDuCorpus, recopieDeCanon, scanConstructionsReservees,
} from '../scripts/guards/lib/canonUnique.mjs';
import { corpusTypeScriptDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import {
  CHAMPS_D_ECHEANCE, CHAMPS_DE_GROUPE, CHAMPS_DE_SITE_OBSERVE, CHAMPS_REQUIS,
  CHAMP_D_OCCURRENCE, SEPARATEUR_DE_CLE, SEPARATEUR_DE_REMEDE,
} from './lib/stock.mjs';

const STOCK = 'src/lib/stock.mjs';
const ENTREE_HISTORIQUE = 'scripts/guards/lib/stock.mjs';
const FONCTIONS_DE_CLE = ['cleDeSite', 'groupeDeSite'];
const FOYER_DE_LA_CLE = [STOCK, 'scripts/guards/lib/stock.test.mjs', 'src/cle-de-site-guard.test.ts'];

function domaineDesStocks(rel: string): boolean {
  return rel.startsWith('src/') || rel.startsWith('scripts/guards/')
    || rel.startsWith('scripts/raw/') || rel.startsWith('scripts/hooks/');
}

const CONSTRUCTIONS_DE_STOCK = [
  {
    ...cleEnLigne({
      nom: 'clé de site en ligne', champsDeGroupe: CHAMPS_DE_GROUPE, occurrence: CHAMP_D_OCCURRENCE,
      separateur: SEPARATEUR_DE_CLE, separateurDeRemede: SEPARATEUR_DE_REMEDE,
      fonctionsDeCle: { [STOCK]: FONCTIONS_DE_CLE, [ENTREE_HISTORIQUE]: FONCTIONS_DE_CLE },
    }),
    foyer: FOYER_DE_LA_CLE,
  },
  { ...recopieDeCanon({ nom: 'clé de site', membres: CHAMPS_REQUIS, complet: true, formes: ['tableau', 'membres de type'] }), foyer: FOYER_DE_LA_CLE },
  { ...recopieDeCanon({ nom: 'Site', membres: CHAMPS_DE_SITE_OBSERVE, complet: true, formes: ['membres de type'] }), foyer: STOCK },
  {
    ...recopieDeCanon({
      nom: 'échéance de stock', membres: CHAMPS_D_ECHEANCE, complet: true, formes: ['tableau', 'membres de type'],
    }),
    foyer: STOCK,
    domaine: domaineDesStocks,
  },
];

/** Les constructions reconnues dans un texte hors foyer. */
const fixture = (text: string, rel = 'src/fixture.ts') =>
  scanConstructionsReservees({ rel, text }, CONSTRUCTIONS_DE_STOCK).map((t) => t.construction);
const EN_LIGNE = ['clé de site en ligne'];

describe('clé de site (#1903)', () => {
  it('les constructions de stock sont déclarées dans leur foyer', () => {
    expect(constructionsReserveesDuCorpus(corpusTypeScriptDesGardes(), CONSTRUCTIONS_DE_STOCK)).toEqual([]);
  });

  it('clé à occurrence', () => {
    expect(fixture('const k = `${e.famille} :: ${e.fichier} :: ${e.ref} :: ${e.occurrence}`;')).toEqual(EN_LIGNE);
    expect(fixture('const k = ` :: ${x.ref} :: ${x.occurrence}`;')).toEqual(EN_LIGNE);
    expect(fixture('const k = `${fichier} :: ${ref} :: 1`;')).toEqual(EN_LIGNE);
    expect(fixture("const k = ' :: armure:plaque:torse :: 1';")).toEqual(EN_LIGNE);
    expect(fixture('const k = ` :: ${x}:${y}:back :: 1`;')).toEqual(EN_LIGNE);
    expect(fixture("const k = 'f :: a.md :: <sup> :: 1 — nombre 4 > 3';")).toEqual(EN_LIGNE);
    expect(fixture("const r = '.hud-clock :: padding :: 0 10px';"), 'réf CSS : l’entier ne finit pas le texte').toEqual([]);
  });

  it('champ puis occurrence', () => {
    expect(fixture('const k = `${ref} :: ${occurrence}`;')).toEqual(EN_LIGNE);
  });

  it('clé de groupe', () => {
    expect(fixture('const g = `${e.famille} :: ${e.fichier} :: ${e.ref}`;')).toEqual(EN_LIGNE);
    expect(fixture("const g = [e.famille, e.fichier, e.ref].join(' :: ');")).toEqual(EN_LIGNE);
    expect(fixture('const p = `${a.fichier} :: ${a.ref}`;'), 'paire d’affichage').toEqual([]);
  });

  it('clé tronquée', () => {
    expect(fixture('const k = ` :: ${ref} :: `;')).toEqual(EN_LIGNE);
  });

  it('clé calculée suivie de son remède', () => {
    const importeCanon = "import { cleDeSite } from './lib/stock.mjs';\n";
    expect(fixture(importeCanon + 'const m = `${cleDeSite(e)} — x`;')).toEqual(EN_LIGNE);
    const importe = "import { cleDeSite } from '../scripts/guards/lib/stock.mjs';\n";
    expect(fixture(`${importe}const m = \`\${cleDeSite(e)} — x\`;`)).toEqual(EN_LIGNE);
    expect(fixture("import { cleDeSite as k } from '../scripts/guards/lib/stock.mjs';\nconst m = `${k(e)} — x`;")).toEqual(EN_LIGNE);
    expect(fixture("import * as S from '../scripts/guards/lib/stock.mjs';\nconst m = `${S.groupeDeSite(e)} — x`;")).toEqual(EN_LIGNE);
    expect(fixture('const cleDeSite = (e) => e.ref;\nconst m = `${cleDeSite(e)} — x`;'), 'homonyme local').toEqual([]);
    expect(fixture("import { cleDeSite } from '../scripts/guards/lib/stockDeSites.mjs';\nconst m = `${cleDeSite(e)} — x`;"), 'homonyme d’un autre module').toEqual([]);
    expect(fixture(`${importe}const m = \`\${cleDeSite(e)} : x\`;`), 'autre séparateur').toEqual([]);
  });

  it('les champs requis de l’entrée de site, en tableau ou en membres de type', () => {
    expect(fixture("const c = ['fichier', 'ref', 'occurrence'];")).toEqual(['clé de site']);
    expect(fixture('interface X { fichier: string; ref: string; occurrence: number; lot?: string }')).toEqual(['clé de site']);
    expect(fixture("const c = ['famille', 'ref'];"), 'sous-ensemble d’un autre vocabulaire').toEqual([]);
  });

  it('les champs d’échéance, en tableau ou dans une déclaration de stock', () => {
    expect(fixture("const c = ['date', 'lot'];")).toEqual(['échéance de stock']);
    expect(fixture('export type Entree = { date: string; lot: string };', 'scripts/guards/lib/exempleStock.d.mts'))
      .toEqual(['échéance de stock']);
  });

  it('les champs du site observé, en membres de type', () => {
    expect(fixture('type Y = { file: string; ref: string; row: number };')).toEqual(['Site']);
  });

  it('le foyer', () => {
    expect(fixture("const k = 'f :: a.md :: r :: 1';", 'scripts/guards/lib/stock.test.mjs')).toEqual([]);
    expect(fixture('type Y = { file: string; ref: string };', STOCK)).toEqual([]);
  });

  it('les types JSDoc @type, @returns et @template sont ignorés ; les types de code restent vus', () => {
    const jsdoc = [
      '/** @type {{ fichier: string, ref: string, occurrence: number }} */',
      'const entree = {};',
      '/** @returns {{ file: string, ref: string, row: number }} */',
      'function lire() { return {}; }',
      '/** @template {{ fichier: string, ref: string, occurrence: number }} T */',
      'function identite(x) { return x; }',
    ].join('\n');
    const sf = ast({ rel: 'src/fixture.mjs', text: jsdoc })!;
    const typesDocumentaires: ts.Node[] = [];
    const visiter = (n: ts.Node) => {
      if (ts.isTypeLiteralNode(n)) typesDocumentaires.push(n);
      n.forEachChild(visiter);
    };
    visiter(sf);
    expect(typesDocumentaires).toHaveLength(3);
    expect(typesDocumentaires.every((n) => (n.flags & ts.NodeFlags.JSDoc) !== 0)).toBe(true);
    expect(fixture(jsdoc, 'src/fixture.mjs')).toEqual([]);
    expect(fixture(jsdoc + '\n/** Entrée du code. */\ninterface Entree { fichier: string; ref: string; occurrence: number }\n/** Site du code. */\ntype Observe = { file: string; ref: string; row: number };')).toEqual(['clé de site', 'Site']);
  });

  it('le corpus exclut les sous-arbres JSDoc des tags @typedef, @param et @satisfies', () => {
    const corpus = [
      { rel: 'src/typedef.mjs', text: '/** @typedef {{ fichier: string, ref: string, occurrence: number }} Entree */\nconst x = 1;' },
      { rel: 'src/param.mjs', text: '/** @param {{ file: string, ref: string, row: number }} x */\nfunction lire(x) { return x; }' },
      { rel: 'src/satisfies.mjs', text: '/** @satisfies {{ fichier: string, ref: string, occurrence: number }} */\nconst x = {};' },
    ];
    expect(constructionsReserveesDuCorpus(corpus, CONSTRUCTIONS_DE_STOCK)).toEqual([]);
  });
});
