/**
 * Garde de la CLÉ DE SITE d'un stock (#1903) : la clé se bâtit par `cleDeSite`/`groupeDeSite` et ses
 * champs se déclarent une fois, `scripts/guards/lib/stock.mjs`. Trois constructions réservées, jugées sur
 * le périmètre des gardes : la clé écrite en ligne (`cleEnLigne`), la ré-énumération des champs requis
 * de l'entrée de site, celle des champs du site observé (`Site`).
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
import {
  cleEnLigne, constructionsReserveesDuCorpus, recopieDeCanon, scanConstructionsReservees,
} from '../scripts/guards/lib/canonUnique.mjs';
import { corpusDesGardes } from '../scripts/guards/lib/commentPoison.mjs';
import {
  CHAMPS_DE_GROUPE, CHAMPS_DE_SITE_OBSERVE, CHAMPS_REQUIS, CHAMP_D_OCCURRENCE, SEPARATEUR_DE_CLE,
  SEPARATEUR_DE_REMEDE,
} from '../scripts/guards/lib/stock.mjs';

const STOCK = 'scripts/guards/lib/stock.mjs';
const FOYER_DE_LA_CLE = [STOCK, 'scripts/guards/lib/stock.test.mjs', 'src/cle-de-site-guard.test.ts'];

const CLE_DE_SITE = [
  {
    ...cleEnLigne({
      nom: 'clé de site en ligne', champsDeGroupe: CHAMPS_DE_GROUPE, occurrence: CHAMP_D_OCCURRENCE,
      separateur: SEPARATEUR_DE_CLE, separateurDeRemede: SEPARATEUR_DE_REMEDE,
      fonctionsDeCle: { [STOCK]: ['cleDeSite', 'groupeDeSite'] },
    }),
    foyer: FOYER_DE_LA_CLE,
  },
  { ...recopieDeCanon({ nom: 'clé de site', membres: CHAMPS_REQUIS, complet: true, formes: ['tableau', 'membres de type'] }), foyer: FOYER_DE_LA_CLE },
  { ...recopieDeCanon({ nom: 'Site', membres: CHAMPS_DE_SITE_OBSERVE, complet: true, formes: ['membres de type'] }), foyer: STOCK },
];

/** Les constructions reconnues dans un texte hors foyer. */
const fixture = (text: string, rel = 'src/fixture.ts') =>
  scanConstructionsReservees({ rel, text }, CLE_DE_SITE).map((t) => t.construction);
const EN_LIGNE = ['clé de site en ligne'];

describe('clé de site (#1903)', () => {
  it('aucune clé de site recopiée hors de son foyer dans le périmètre des gardes', () => {
    expect(constructionsReserveesDuCorpus(corpusDesGardes(), CLE_DE_SITE)).toEqual([]);
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

  it('les champs du site observé, en membres de type', () => {
    expect(fixture('type Y = { file: string; ref: string; row: number };')).toEqual(['Site']);
  });

  it('le foyer', () => {
    expect(fixture("const k = 'f :: a.md :: r :: 1';", 'scripts/guards/lib/stock.test.mjs')).toEqual([]);
    expect(fixture('type Y = { file: string; ref: string };', STOCK)).toEqual([]);
  });
});
