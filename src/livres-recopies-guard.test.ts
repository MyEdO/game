import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyserLivresRecopies, scanLivresRecopies, identitesDe, identitesReelles, estExclu,
  SCAN_DIRS, SEUIL, SITE_EXEMPTIONS,
} from '../scripts/guards/lib/livresRecopies.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { cleDeLigne, lignesDuContenu } from '../scripts/guards/lib/stock.mjs';
import { analyserCorpus } from '../scripts/guards/lib/dialecte.mjs';

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
  it('aucune énumération littérale du code ne recopie le registre des livres', { timeout: 60_000 }, () => {
    const offenders: string[] = [];
    const perimees = new Set(SITE_EXEMPTIONS);
    const ambigues = [];
    for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(SCAN_DIRS, { tests: true }).filter(({ rel }) => !estExclu(rel)))) {
      const bilan = analyserLivresRecopies(rel, text, undefined, sourceFile!);
      for (const s of bilan.fautes) {
        offenders.push(`${rel}:${s.line} — ${s.forme} figeant ${s.valeurs.length} livres : ${s.valeurs.join(', ')}`);
      }
      for (const e of SITE_EXEMPTIONS) {
        if (e.fichier === rel && !bilan.perimees.includes(e)) perimees.delete(e);
      }
      ambigues.push(...bilan.ambigues);
    }
    expect([...perimees], 'Exemption(s) sans site ou au contenu réécrit').toEqual([]);
    expect(ambigues, 'Exemption(s) ambiguë(s)').toEqual([]);
    expect(
      offenders,
      `Liste de livres recopiée (la DÉRIVER du registre \`src/data/books.json\` — \`REGISTRE_LIVRES\`/\`BOOKS\` de \`scripts/raw/_lib.mjs\`, \`alternationDe\` de \`src/lib/regex.ts\`) :\n${offenders.join('\n')}`,
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
    expect(estExclu('src/noyau/combat/advantage-group.test.ts')).toBe(false);
  });

  it('toute exemption AU SITE nomme son ancre et sa forme, et porte sa raison datée', () => {
    const mal = SITE_EXEMPTIONS.filter(
      (e) => !e.fichier || !e.ancre.trim() || !/^[0-9a-f]{64}$/.test(e.empreinte)
        || !e.forme || !e.raison || !/^\d{4}-\d{2}-\d{2}$/.test(e.date),
    );
    expect(mal, `Exemption(s) incomplète(s) : ${JSON.stringify(mal)}`).toEqual([]);
    const cles = SITE_EXEMPTIONS.map((e) => cleDeLigne(e.fichier, e.ancre));
    expect(new Set(cles).size).toBe(cles.length);
  });

  it('le comparateur suit le site historique et refuse toute disparition ou ambiguïté', () => {
    const [exemption] = SITE_EXEMPTIONS;
    const { fichier, ancre, forme } = exemption;
    const contenu = readFileSync(join(RACINE, fichier), 'utf8');
    const analyser = (texte: string) => analyserLivresRecopies(fichier, texte);
    const lignes = contenu.split('\n');
    const remplacer = (debut: number, longueur: number, ...nouvelles: string[]) => {
      const copie = [...lignes];
      copie.splice(debut, longueur, ...nouvelles);
      return copie.join('\n');
    };
    const [ligne] = lignesDuContenu(fichier, contenu, cleDeLigne(fichier, ancre));
    const fin = lignes.indexOf(']', ligne);
    expect(fin).toBeGreaterThan(ligne);
    const clair = { fautes: [], perimees: [], ambigues: [] };
    expect(analyser(contenu)).toEqual(clair);
    expect(analyser(`// insertion étrangère\n\n${contenu}`)).toEqual(clair);

    const absent = remplacer(ligne - 1, fin - ligne + 2);
    expect(analyser(absent)).toEqual({ ...clair, perimees: [exemption] });

    const membre = lignes[ligne];
    const reecrit = membre.replace(/\.md(?=['"])/, '-retouche.md');
    expect(reecrit).not.toBe(membre);
    const autreCheminHistorique = analyser(remplacer(ligne, 1, reecrit));
    expect(autreCheminHistorique.perimees).toEqual([exemption]);
    expect(autreCheminHistorique.fautes).toEqual([expect.objectContaining({ line: ligne, forme })]);

    const recopies = analyser(`${contenu}\n${lignes.slice(ligne - 1, fin + 1).join('\n')}`);
    expect(recopies.ambigues).toEqual([exemption]);
    expect(recopies.fautes.map((s) => s.forme)).toEqual([forme, forme]);

    const membresDoubles = lignes.slice(ligne, fin).map((m) => m.replace(/abbr: ('[^']+'),/, 'abbr: $1, autre: $1,'));
    const homonymes = analyser(remplacer(ligne, fin - ligne, ...membresDoubles));
    expect(homonymes.ambigues).toEqual([exemption]);
    expect(homonymes.fautes.map((s) => [s.line, s.forme])).toEqual([[ligne, forme], [ligne, forme]]);
  });

  it('CÂBLAGE : le scan de CORPUS consomme réellement le détecteur (le registre RÉEL mord)', () => {
    // Sans ce banc, un corpus vide ou un détecteur débranché rendrait la garde verte par vacuité.
    // Les identités de la sonde sont PRISES au registre réel, jamais recopiées : deux suffisent.
    const corpus = readCorpus(SCAN_DIRS, { tests: true });
    expect(corpus.filter((f) => !estExclu(f.rel)).length).toBeGreaterThan(0);
    const unNomParLivre = new Map([...identitesReelles()].map(([nom, livre]) => [livre, nom]));
    const [un, deux] = [...unNomParLivre.values()];
    expect(scanLivresRecopies('sonde.ts', `export const A = ['${un}', '${deux}'];`).length).toBe(1);
  });
});
