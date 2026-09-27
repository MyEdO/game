import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanLivresRecopies, identitesDe, identitesReelles, estExclu,
  SCAN_DIRS, SCAN_EXTS, SEUIL, SITE_EXEMPTIONS,
} from '../scripts/guards/lib/livresRecopies.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou « liste de LIVRES recopiée dans le code » (#1825).
 *
 * Le code ne nomme AUCUN livre : un livre de plus est UNE entrée de `src/data/books.json`, zéro
 * ligne de code. Une CITATION reste libre (réf nue en commentaire, `source.book` en donnée, sigle
 * isolé dans une phrase) ; ce qui est interdit, c'est de LISTER — de figer dans le code une
 * population que le registre porte déjà, et qui se désynchronisera de lui au livre suivant.
 *
 * Le critère est de FORME et se lit sur l'AST (`scripts/guards/lib/livresRecopies.mjs`) : une
 * énumération LITTÉRALE dont les membres désignent au moins DEUX livres distincts du registre. Le
 * seuil de deux est ce qui sépare la liste de la citation.
 *
 * SANS STOCK : un site qui apparaît se DÉRIVE du registre, il ne s'inscrit nulle part. La seule
 * soupape est l'exemption AU SITE, qui nomme la ligne et porte sa raison datée.
 *
 * FIXTURES À SIGLES INVENTÉS : aucun banc de ce fichier ne recopie une identité du registre réel —
 * la mécanique s'éprouve sur un registre INJECTÉ, ce que la garde exige justement du code qu'elle
 * surveille.
 */

const RACINE = fileURLToPath(new URL('..', import.meta.url));

/** Registre FIXTURE — trois livres qui n'existent pas, deux noms d'identité (`abbr`, `id`). */
const REGISTRE_FIXTURE = [
  { id: 'livre-alpha', abbr: 'ALF' },
  { id: 'livre-beta', abbr: 'BTA' },
  { id: 'livre-gamma', abbr: 'GMA' },
];
const IDS = identitesDe(REGISTRE_FIXTURE);

const formes = (src: string, nom = 'fixture.ts') => scanLivresRecopies(nom, src, IDS).map((s) => s.forme);

describe('listes de livres recopiées — le code ne nomme aucun livre (#1825)', () => {
  it('aucune énumération littérale du code ne recopie le registre des livres', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(SCAN_DIRS, { exts: SCAN_EXTS, tests: true })) {
      if (estExclu(rel)) continue;
      for (const s of scanLivresRecopies(rel, text)) {
        offenders.push(`${rel}:${s.line} — ${s.forme} figeant ${s.valeurs.length} livres : ${s.valeurs.join(', ')}`);
      }
    }
    expect(
      offenders,
      `Liste de livres recopiée (la DÉRIVER du registre \`src/data/books.json\` — \`REGISTRE_LIVRES\`/\`BOOKS\`/\`alternationDe\` de \`scripts/raw/_lib.mjs\`) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('MORSURE : tableau, `Set`, `Map`, objet par ses CLÉS', () => {
    expect(formes("export const A = ['livre-alpha', 'livre-beta'];")).toEqual(['tableau']);
    expect(formes("export const S = new Set(['ALF', 'BTA']);")).toEqual(['tableau']);
    expect(formes("export const M = new Map([['livre-alpha', 1], ['livre-beta', 2]]);")).toEqual(['tableau']);
    expect(formes('export const O = { ALF: 1, BTA: 2 };')).toEqual(['objet-cles']);
  });

  it('MORSURE : objet par ses VALEURS, et tableau d’OBJETS par un même CHAMP', () => {
    expect(formes("export const O = { premier: 'ALF', second: 'BTA' };")).toEqual(['objet-valeurs']);
    expect(formes("export const R = [{ abbr: 'ALF', dir: 'x' }, { abbr: 'BTA', dir: 'y' }];")).toEqual(['tableau-objets']);
    // Un registre recopié par son `id` autant que par son `abbr` : le champ qui porte compte, pas son nom.
    expect(formes("export const R = [{ id: 'livre-alpha' }, { id: 'livre-beta' }];")).toEqual(['tableau-objets']);
  });

  it('MORSURE : ALTERNATION, qu’elle soit en littéral de regex ou en CHAÎNE', () => {
    expect(formes('export const R = /\\b(ALF|BTA)\\s+\\d+/;')).toEqual(['regex']);
    // Un texte destiné à construire une regex : la forme sous laquelle une recopie se déguise.
    expect(formes("export const A = 'ALF|BTA';")).toEqual(['chaine']);
    expect(formes("export const A = new RegExp('\\\\b(ALF|BTA)\\\\s+\\\\d+');")).toEqual(['chaine']);
  });

  it('MORSURE : union de types littéraux, et `enum`', () => {
    expect(formes("export type Sigle = 'ALF' | 'BTA';")).toEqual(['union']);
    expect(formes("export enum Sigle { ALF = 'a', BTA = 'b' }")).toEqual(['enum']);
    expect(formes("export enum Livre { Premier = 'ALF', Second = 'BTA' }")).toEqual(['enum']);
  });

  it('CONTRE-ÉPREUVE : une CITATION (un seul livre) reste verte, quelle que soit la forme', () => {
    expect(SEUIL).toBe(2);
    expect(formes("export const a = { sourceRef: 'ALF' };")).toEqual([]);
    expect(formes("export const b = ['ALF', 'non-un-livre', 'autre-chose'];")).toEqual([]);
    expect(formes('export const c = /\\b(ALF)\\s+\\d+/;')).toEqual([]);
    expect(formes("export const c2 = 'ALF|(\\\\d+)';")).toEqual([]);
    expect(formes("export type S = 'ALF' | 'autre';")).toEqual([]);
    expect(formes("export enum E { ALF = 'a', Autre = 'b' }")).toEqual([]);
    expect(formes("export const r = [{ abbr: 'ALF' }, { abbr: 'ALF' }];")).toEqual([]);
    // Deux énumérations VOISINES d'un livre chacune : chacune se juge pour elle-même.
    expect(formes("export const d = ['ALF']; export const e = ['BTA'];")).toEqual([]);
    // Les DEUX noms d'un MÊME livre (`id` et `abbr`) : le compte porte sur les LIVRES, pas sur les
    // chaînes — une paire de `Map` de sigles cite, elle ne liste pas.
    expect(formes("export const f = { abbrOf: new Map([['livre-alpha', 'ALF']]) };")).toEqual([]);
    // Deux livres dans de la PROSE, sans alternation : un libellé n'est pas une population.
    expect(formes("export const g = 'Voir ALF puis BTA pour le détail.';")).toEqual([]);
  });

  it('CONTRE-ÉPREUVE : l’énumération DÉRIVÉE du registre est verte — c’est la sortie attendue', () => {
    expect(formes('export const tous = registre.map((b) => b.abbr);')).toEqual([]);
    expect(formes('export const alt = registre.map((b) => b.abbr).join("|");')).toEqual([]);
  });

  it('l’outillage `scripts/**` en `.mjs` est parsable et scanné, et les zones hors périmètre sont des FORMES', () => {
    expect(formes("export const A = ['ALF', 'BTA']", 'scripts/raw/probe.mjs')).toEqual(['tableau']);
    expect(estExclu('src/data/schemas/_ids.generated.ts')).toBe(true);
    expect(estExclu('src/data/schemas/defs/books.ts')).toBe(true);
    expect(estExclu('scripts/state/migrations/v12.mjs')).toBe(true);
    // Le reste de `src/data` est DANS le périmètre : c'est là que vivent ses tests.
    expect(estExclu('src/data/index.ts')).toBe(false);
    expect(estExclu('src/data/progression-schemas.test.ts')).toBe(false);
    expect(estExclu('scripts/raw/coverage.mjs')).toBe(false);
    expect(estExclu('src/state/combat/advantage-group.test.ts')).toBe(false);
  });

  it('toute exemption AU SITE nomme sa ligne ET sa forme, et porte sa raison datée', () => {
    const mal = SITE_EXEMPTIONS.filter(
      (e) => !e.fichier || !Number.isInteger(e.ligne) || !e.forme || !e.raison || !/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? ''),
    );
    expect(mal, `Exemption(s) incomplète(s) : ${JSON.stringify(mal)}`).toEqual([]);
    // Une exemption au FICHIER n'existe pas : chacune porte une ligne, donc périme au déplacement.
    expect(SITE_EXEMPTIONS.every((e) => e.ligne > 0)).toBe(true);
  });

  it('toute exemption COUVRE ENCORE un site réel : une entrée périmée rougit, la liste ne survit pas à son motif', () => {
    // Le fichier est rescanné sous un AUTRE nom : l'exemption, keyée par chemin, ne s'y applique pas,
    // et le site doit ressortir à la ligne et sous la forme que l'entrée déclare.
    const perimees = SITE_EXEMPTIONS.filter((e) => {
      const contenu = readFileSync(join(RACINE, e.fichier), 'utf8');
      const nu = e.fichier.replace(/([^/]+)$/, 'sonde-exemption-$1');
      return !scanLivresRecopies(nu, contenu).some((s) => s.line === e.ligne && s.forme === e.forme);
    });
    expect(perimees, `Exemption(s) sans site : ${JSON.stringify(perimees)} — le site a bougé ou a été dérivé, l'entrée se SUPPRIME.`).toEqual([]);
  });

  it('CÂBLAGE : le scan de CORPUS consomme réellement le détecteur (le registre RÉEL mord)', () => {
    // Sans ce banc, un corpus vide ou un détecteur débranché rendrait la garde verte par vacuité.
    // Les identités de la sonde sont PRISES au registre réel, jamais recopiées : deux suffisent.
    const corpus = readCorpus(SCAN_DIRS, { exts: SCAN_EXTS, tests: true });
    expect(corpus.filter((f) => !estExclu(f.rel)).length).toBeGreaterThan(0);
    const unNomParLivre = new Map([...identitesReelles()].map(([nom, livre]) => [livre, nom]));
    const [un, deux] = [...unNomParLivre.values()];
    expect(scanLivresRecopies('sonde.ts', `export const A = ['${un}', '${deux}'];`).length).toBe(1);
  });
});
