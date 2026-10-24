/**
 * PORTE DES COMPTES (#2705, `scripts/guards/lib/corpusDesComptes.mts`) : entre la base d'une plage et sa
 * tête, aucun compte d'une collection à compte ne monte et aucun site n'y naît, mesuré à détecteur
 * constant — et aucune ligne de message ne l'admet. La plage d'un dépôt jetable : `scripts/guards/comptes-plage.test.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { detecteurDuCommit, jugerLesComptes, refsAPlat, refusDesComptes, verdictDesDetecteurs, type Comptes } from '../scripts/guards/lib/corpusDesComptes.mts';
import { idDe } from './data/schemas/grammaire/ref';
import { envDeDepotForge, forgerDepot } from '../scripts/guards/lib/depotGabarit.mjs';
import { cleDeSite, remedeNomme } from '../scripts/guards/lib/stock.mjs';
import { commitDe, depotDe, reussi, shaDe } from '../scripts/guards/lib/gitPorte.mjs';

const comptes = (entrees: Partial<Record<string, { dataset: string; champ: string; occurrences: number }[]>>): Comptes =>
  new Map(Object.entries(entrees)) as Comptes;

describe('refusDesComptes — la tête comme observé, la base comme stock', () => {
  const regle = { dataset: 'voyage-stakes.json', champ: 'rule', occurrences: 33 };
  const base = comptes({ SLOTS_SANS_DECLARATION: [regle] });

  it('un compte qui MONTE est refusé, avec la cible du site', () => {
    expect(refusDesComptes(base, comptes({ SLOTS_SANS_DECLARATION: [{ dataset: 'voyage-stakes.json', champ: 'rule', occurrences: 34 }] }))).toEqual([
      'SLOTS_SANS_DECLARATION : voyage-stakes.json | rule — HAUSSE 34 > 33 : la dette GRANDIT. Migrer : adopter la fabrique `ref`/`refs`/`specRef`/`pick` (`idDe`) sur le schéma du champ. Aucune écriture ne relève ce nombre.',
    ]);
  });

  it('un compte qui BAISSE, ou un site qui part, ne refuse rien', () => {
    expect(refusDesComptes(base, comptes({ SLOTS_SANS_DECLARATION: [{ dataset: 'voyage-stakes.json', champ: 'rule', occurrences: 33 - 1 }] }))).toEqual([]);
    expect(refusDesComptes(base, comptes({}))).toEqual([]);
  });

  it('le volet à `nombre` de `scripts/raw/source-format-stock.json` est sous la porte : un nombre qui MONTE est refusé', () => {
    const site = { famille: 'sup-nu', fichier: 'Source/X/01 - A.md', ref: '<sup>', occurrence: 1 };
    const volet = (nombre: number) => comptes({ 'scripts/raw/source-format-stock.json': [{ ...site, nombre }] as never });
    const refus = refusDesComptes(volet(3), volet(4));
    expect(refus).toHaveLength(1);
    expect(remedeNomme(refus, cleDeSite(site)), 'le refus nomme le site').toBe(true);
    expect(refus[0]).toMatch(/^scripts\/raw\/source-format-stock\.json : .* HAUSSE 4 > 3 : la dette GRANDIT\. Corriger le site : la mise en forme du chapitre/);
    expect(refusDesComptes(volet(3), volet(2))).toEqual([]);
  });

  it('un site qui NAÎT est refusé', () => {
    const tete = comptes({ SLOTS_SANS_DECLARATION: [regle, { dataset: 'voyage-stakes.json', champ: 'kind', occurrences: 1 }] });
    expect(refusDesComptes(base, tete)).toEqual([expect.stringMatching(/^SLOTS_SANS_DECLARATION : voyage-stakes\.json \| kind — site NEUF : la dette NAÎT\. Migrer/)]);
  });
});

describe('refsAPlat — la référence À PLAT d’un payload se lit au SCHÉMA (G9 #2705)', () => {
  it('une clé de premier niveau dont le schéma ouvert est une feuille `idDe` est à plat, quel que soit son NOM', () => {
    const opDefs = {
      contractDisease: z.strictObject({ op: z.literal('contractDisease'), disease: idDe('maladie') }),
      grantWeapon: z.strictObject({ op: z.literal('grantWeapon'), form: idDe('trapping').optional(), weaponId: z.string() }),
      emboitee: z.strictObject({ op: z.literal('emboitee'), skill: z.strictObject({ id: idDe('skill') }) }),
    };
    expect(refsAPlat(opDefs)).toEqual({ contractDisease: ['disease'], grantWeapon: ['form'], emboitee: [] });
  });
});

describe('verdictDesDetecteurs — deux détecteurs constants, la tête et la base (G10 #2705)', () => {
  const plage = 'origin/main (base b)..HEAD (t)';
  const regle = { dataset: 'voyage-stakes.json', champ: 'rule', occurrences: 33 };
  const stable = { base: comptes({ SLOTS_SANS_DECLARATION: [regle] }), tete: comptes({ SLOTS_SANS_DECLARATION: [regle] }) };
  const hausse = { base: comptes({ SLOTS_SANS_DECLARATION: [regle] }), tete: comptes({ SLOTS_SANS_DECLARATION: [{ ...regle, occurrences: 34 }] }) };

  it('une hausse vue par le SEUL détecteur de la base refuse la plage, et nomme ce détecteur', () => {
    const verdict = verdictDesDetecteurs(plage, [{ detecteur: 'détecteur de la tête', ...stable }, { detecteur: 'détecteur de la base (b)', ...hausse }]);
    expect(verdict.ok).toBe(false);
    expect(verdict.texte).toContain('[détecteur de la base (b)] SLOTS_SANS_DECLARATION : voyage-stakes.json | rule — HAUSSE 34 > 33');
  });

  it('une paire qui ne se lie pas est nommée et empêche d’attribuer une baisse à la donnée', () => {
    const verdict = verdictDesDetecteurs(plage, [{ detecteur: 'détecteur de la tête', sautee: 'mesure de l’image en échec' }, { detecteur: 'détecteur de la base (b)', ...stable }]);
    expect(verdict.ok).toBe(false);
    expect(verdict.texte).toContain('paire sautée — détecteur de la tête : mesure de l’image en échec');
    expect(verdictDesDetecteurs(plage, [{ detecteur: 'détecteur de la tête', sautee: 'x' }, { detecteur: 'détecteur de la base (b)', ...hausse }]).ok).toBe(false);
  });

  it('aucune paire liée : la porte refuse ce qu’elle n’a pas mesuré', () => {
    const verdict = verdictDesDetecteurs(plage, [{ detecteur: 'détecteur de la tête', sautee: 'x' }, { detecteur: 'détecteur de la base (b)', sautee: 'y' }]);
    expect(verdict.ok).toBe(false);
    expect(verdict.texte).toContain('aucune paire de détecteur ne se lie');
  });

  it('le détecteur de la base pose le `scripts/` DU COMMIT de base, pas celui qui tourne', () => {
    const racine = mkdtempSync(join(tmpdir(), 'detecteur-base-'));
    const image = mkdtempSync(join(tmpdir(), 'detecteur-image-'));
    try {
      const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' });
      git('init', '-q');
      mkdirSync(join(racine, 'scripts'));
      writeFileSync(join(racine, 'scripts/detecteur.mjs'), 'export const version = 1;\n');
      writeFileSync(join(racine, 'package.json'), '{}\n');
      git('add', '.');
      git('commit', '-q', '-m', 'base');
      const base = git('rev-parse', 'HEAD').trim();
      writeFileSync(join(racine, 'scripts/detecteur.mjs'), 'export const version = 2;\n');
      git('commit', '-q', '-am', 'tête');
      detecteurDuCommit(depotDe(racine, { env: envDeDepotForge() }), base).poser(image);
      expect(readFileSync(join(image, 'scripts/detecteur.mjs'), 'utf8')).toBe('export const version = 1;\n');
    } finally {
      rmSync(racine, { recursive: true, force: true });
      rmSync(image, { recursive: true, force: true });
    }
  });
});

describe('baisses attribuables au détecteur — #2948', () => {
  const site = { concept: 'reference', dataset: 'trappings.json', champ: 'shape', signature: 'id-nu', occurrences: 2 };
  const compte = (n: number): Comptes => new Map([['STRUCTURES_FORMES', n ? [{ ...site, occurrences: n }] : []]]) as Comptes;
  const paire = (base: number, tete: number) => ({ base: compte(base), tete: compte(tete) });
  const mesures = (a: number, b: number, c: number, d: number) => [
    { detecteur: 'détecteur de la tête', ...paire(a, b) },
    { detecteur: 'détecteur de la base (b)', ...paire(c, d) },
  ];
  const ligne = (n: number, cle = 'reference | trappings.json | shape | id-nu') =>
    'FAUX-POSITIF: ' + JSON.stringify(['STRUCTURES_FORMES', cle, n]) + ' — le schéma classe cette occurrence comme une valeur sans référence';
  const juger = (m = mesures(0, 0, 2, 2), message = '') => verdictDesDetecteurs('fixture id-declare', m, message);

  it('le reclassement id-nu en id-declare sans changer la donnée ne fait pas disparaître la dette', () => {
    expect(juger().ok).toBe(false);
    expect(juger().texte).toContain('FAUX-POSITIF');
  });
  it('la même baisse mesurée par le détecteur de base est une migration de donnée', () => {
    expect(juger(mesures(2, 0, 2, 0)).ok).toBe(true);
  });
  it('chaque occurrence retirée exactement déclarée est admise', () => {
    expect(juger(undefined, ligne(1) + '\n' + ligne(2)).ok).toBe(true);
  });
  it.each([
    ['manquante', ligne(1)], ['en trop', ligne(1) + '\n' + ligne(2) + '\n' + ligne(3)],
    ['dupliquée', ligne(1) + '\n' + ligne(1)], ['autre site', ligne(1) + '\n' + ligne(2, 'reference | autre.json | shape | id-nu')],
    ['preuve vide', 'FAUX-POSITIF: ["STRUCTURES_FORMES","reference | trappings.json | shape | id-nu",1] — '],
    ['malformée', 'FAUX-POSITIF: ceci ne nomme aucune occurrence — une preuve assez longue mais sans identité'],
  ])('une déclaration %s refuse', (_nom, message) => {
    expect(juger(undefined, message).ok).toBe(false);
  });
  it('une déclaration sans baisse est surnuméraire', () => {
    expect(juger(mesures(2, 2, 2, 2), ligne(1)).ok).toBe(false);
  });
  it('un trailer ne couvre jamais une hausse', () => {
    expect(juger(mesures(2, 3, 2, 3), ligne(1)).ok).toBe(false);
  });
  it('la baisse partagée par la donnée ne demande pas un trailer', () => {
    expect(juger(mesures(0, 0, 2, 1), ligne(1)).ok).toBe(true);
    expect(juger(mesures(0, 0, 2, 1), ligne(1) + '\n' + ligne(2)).ok).toBe(false);
  });
  it('une migration partielle ne couvre que la baisse réellement mesurée à la base', () => {
    expect(juger(mesures(1, 1, 5, 3), ligne(2) + '\n' + ligne(3)).ok).toBe(true);
    expect(juger(mesures(1, 1, 5, 3), ligne(2)).ok).toBe(false);
    expect(juger(mesures(1, 1, 5, 3), ligne(1) + '\n' + ligne(2) + '\n' + ligne(3)).ok).toBe(false);
  });
  it('SOURCE_FORMAT passe par la même règle et son compte nombre', () => {
    const s = { famille: 'sup-nu', fichier: 'Source/X/01 - A.md', ref: '<sup>', occurrence: 1 };
    const c = (nombre: number): Comptes => new Map([['scripts/raw/source-format-stock.json', nombre ? [{ ...s, nombre }] : []]]) as unknown as Comptes;
    const m = [{ detecteur: 'tête', base: c(0), tete: c(0) }, { detecteur: 'base', base: c(1), tete: c(1) }];
    expect(verdictDesDetecteurs('source', m).ok).toBe(false);
    const message = 'FAUX-POSITIF: ' + JSON.stringify(['scripts/raw/source-format-stock.json', cleDeSite(s), 1]) + ' — cette occurrence est un exemple littéral du format de la source';
    expect(verdictDesDetecteurs('source', m, message).ok).toBe(true);
  });
});

describe('jugerLesComptes — l’image d’une borne se pose HORS de tout dépôt git', () => {
  it('un `os.tmpdir()` contenu dans un dépôt git refuse la mesure par une erreur nommée, avant toute écriture', () => {
    const racine = mkdtempSync(join(tmpdir(), 'image-dans-un-depot-'));
    const ancien = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
    try {
      const depot = forgerDepot(racine);
      const commiter = (texte: string) => {
        writeFileSync(join(racine, 'src.txt'), texte);
        expect(reussi(commitDe(depot, { message: texte, chemins: ['src.txt'] }))).toBe(true);
        return shaDe(depot, 'HEAD')!;
      };
      const base = commiter('base');
      const tete = commiter('tête');
      const dedans = join(racine, 'tmp');
      mkdirSync(dedans);
      Object.assign(process.env, { TMPDIR: dedans, TMP: dedans, TEMP: dedans });
      expect(() => jugerLesComptes({ depot, base, tete })).toThrow(/l’image d’une borne se pose hors de tout dépôt git/);
    } finally {
      for (const [cle, valeur] of Object.entries(ancien)) {
        if (valeur === undefined) delete process.env[cle];
        else process.env[cle] = valeur;
      }
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
