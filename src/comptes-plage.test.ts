/**
 * PORTE DES COMPTES (#2705, #3021, `scripts/guards/lib/corpusDesComptes.mts`) : entre la base d'une plage et sa
 * tête, aucun compte d'un volet sous la porte ne monte, aucun site n'y naît et aucun plancher ne cède, mesuré à
 * détecteur constant — et aucune ligne de message ne l'admet. Ajouter ou retirer une donnée saine n'en fait bouger aucun
 * (#2995). La plage d'un dépôt jetable : `scripts/guards/comptes-plage.test.mjs`.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import {
  baissesDuDetecteur, detecteurDuCommit, jugerLesComptes, refsAPlat, refusDesComptes, sitesDEnveloppeASourcer, sitesDeDetteDOps,
  verdictDesDetecteurs, type Comptes,
} from '../scripts/guards/lib/corpusDesComptes.mts';
import { idDe, ref, refs } from './data/schemas/grammaire/ref';
import { nommerNoeud } from './data/schemas/grammaire/meta';
import type { SchemaDef } from './data/schemas/types';
import { scanDuCorpus } from '../scripts/docs/lib/structures-scan.mjs';
import { defsDeDocument } from '../scripts/docs/lib/slots-registre.mjs';
import { envDeDepotForge, forgerDepot } from '../scripts/guards/lib/depotGabarit.mjs';
import { cleDeSite, remedeNomme, sitesEnEntrees } from '../scripts/guards/lib/stock.mjs';
import { renommagesDeStructure, SOUS_LA_PORTE, type EntreeDeStructure } from '../scripts/guards/lib/occurrencesStock.mjs';
import { cheminsDeDocument } from '../scripts/guards/lib/structuresLocales.mts';
import { commitDe, depotDe, reussi, shaDe } from '../scripts/guards/lib/gitPorte.mjs';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

const comptes = (entrees: Partial<Record<string, object[]>>): Comptes => new Map(Object.entries(entrees)) as Comptes;

/** Le def des redéclarations de fixture. */
const DEF_DE_FIXTURE = 'criticals.ts';
/** Une redéclaration de fixture, site du volet `STRUCTURES_REDECLARATIONS`. */
const redeclaration = (occurrences: number, champ = 'loss') =>
  ({ def: DEF_DE_FIXTURE, champ, concept: 'test', signature: 'difficulty+…', statut: 'divergente', commun: '', occurrences });

describe('refusDesComptes — la tête comme observé, la base comme stock', () => {
  const base = comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(33)] });

  it('un compte qui MONTE est refusé, avec la cible du site', () => {
    expect(refusDesComptes(base, comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(34)] }))).toEqual([
      'STRUCTURES_REDECLARATIONS : criticals.ts | loss | test | difficulty+… | divergente |  — HAUSSE 34 > 33 : la dette GRANDIT. Migrer : composer le nœud commun de la grammaire (src/data/schemas/grammaire/) au lieu de le re-taper. Aucune écriture ne relève ce nombre.',
    ]);
  });

  it('un compte qui BAISSE, ou un site qui part, ne refuse rien', () => {
    expect(refusDesComptes(base, comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(33 - 1)] }))).toEqual([]);
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
    const tete = comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(33), redeclaration(1, 'gain')] });
    expect(refusDesComptes(base, tete)).toEqual([expect.stringMatching(/^STRUCTURES_REDECLARATIONS : criticals\.ts \| gain \| .* — site NEUF : la dette NAÎT\. Migrer/)]);
  });
});

describe('volets mesurés au SCHÉMA seul : une dette de code naît sous la porte (#3021)', () => {
  const opDefs = {
    typee: z.strictObject({ op: z.literal('typee'), skill: ref('skill') }),
    aPlat: z.strictObject({ op: z.literal('aPlat'), disease: idDe('maladie') }),
  };
  const ops = (nonTypees: string[], defs: Record<string, unknown> = opDefs) => comptes({ DETTE_OPS: sitesDeDetteDOps(nonTypees, defs) });

  it('DETTE_OPS : une op inscrite à `OPS_NON_TYPEES` est refusée ; une op typée, ou retirée, ne refuse rien', () => {
    expect(sitesDeDetteDOps(['loose'], opDefs)).toEqual([{ op: 'loose', motif: 'non typée' }, { op: 'aPlat', motif: 'à plat:disease' }]);
    expect(refusDesComptes(ops(['loose']), ops(['loose', 'neuve']))).toEqual([
      expect.stringMatching(/^DETTE_OPS : neuve \| non typée — site NEUF : la dette NAÎT\. Typer le payload de l’op dans `OP_DEFS`/),
    ]);
    expect(refusDesComptes(ops(['loose', 'neuve']), ops(['loose']))).toEqual([]);
  });

  it('DETTE_OPS : une référence emboîtée mise À PLAT est refusée', () => {
    const aPlat = { ...opDefs, typee: z.strictObject({ op: z.literal('typee'), skill: idDe('skill') }) };
    expect(refusDesComptes(ops([]), ops([], aPlat))).toEqual([expect.stringMatching(/^DETTE_OPS : typee \| à plat:skill — site NEUF : la dette NAÎT\. Emboîter/)]);
  });

  it('DETTE_ENVELOPPE : un type de plus dans `CONTENU_A_SOURCER` est refusé ; un type sourcé, qui en sort, ne refuse rien', () => {
    const enveloppe = (aSourcer: Record<string, string>) => comptes({ DETTE_ENVELOPPE: sitesDEnveloppeASourcer(aSourcer) });
    expect(refusDesComptes(enveloppe({ names: 'x' }), enveloppe({ names: 'x', sizes: 'y' }))).toEqual([
      expect.stringMatching(/^DETTE_ENVELOPPE : sizes — site NEUF : la dette NAÎT\. Sourcer le document/),
    ]);
    expect(refusDesComptes(enveloppe({ names: 'x', sizes: 'y' }), enveloppe({ names: 'x' }))).toEqual([]);
  });
});

describe('FEUILLES_D_ID — un plancher : une référence relâchée refuse, aucune ligne ne l’admet (#3021)', () => {
  const champs = { sort: ref('spell'), sorts: refs('spell'), cle: idDe('spell') };
  const document = (c: Record<string, z.ZodType>): SchemaDef =>
    ({ file: 'sonde.json', root: 'src/data', famille: 'entite', schema: z.array(z.strictObject({ id: z.string(), type: z.literal('sonde'), ...c })) });
  const chemins = (c: Record<string, z.ZodType>) => comptes({ FEUILLES_D_ID: sitesEnEntrees(cheminsDeDocument([document(c)])) });
  const site = (ref: string) => cleDeSite({ fichier: 'src/data#sonde', ref, occurrence: 1 });

  it.each([
    ['`ref` → `z.string()`', { sort: z.string() }, ['[].sort']],
    ['`refs` → `z.array(z.string())`', { sorts: z.array(z.string()) }, ['[].sorts', '[].sorts[]']],
    ['`idDe` → `z.string()`', { cle: z.string() }, ['[].cle']],
    ['union qui admet une chaîne nue', { cle: z.union([idDe('spell'), z.string()]) }, ['[].cle']],
    ['`refs` → liste d’objets à `id` nu', { sorts: z.array(z.strictObject({ id: z.string() })) }, ['[].sorts', '[].sorts[]']],
    ['`ref` → record de chaînes', { sort: z.record(z.string(), z.string()) }, ['[].sort']],
    ['`idDe` → objet sans référence', { cle: z.strictObject({ nom: z.string() }) }, ['[].cle']],
    ['`idDe` → `z.enum`', { cle: z.enum(['a', 'b']) }, ['[].cle']],
    ['`idDe` → `z.transform`', { cle: z.transform((v) => String(v)) }, ['[].cle']],
    ['`idDe` → `.catch`', { cle: idDe('spell').catch(() => 'a' as never) }, ['[].cle']],
    ['union avec `z.unknown()`', { cle: z.union([idDe('spell'), z.unknown()]) }, ['[].cle']],
    ['union avec `z.any()`', { cle: z.union([idDe('spell'), z.any()]) }, ['[].cle']],
    ['union avec `z.custom()`', { cle: z.union([idDe('spell'), z.custom<string>()]) }, ['[].cle']],
    ['union avec `z.transform`', { cle: z.union([idDe('spell'), z.transform(String)]) }, ['[].cle']],
    ['union de `ref` et d’un objet à `id` nu', { sort: z.union([ref('spell'), z.strictObject({ id: z.string() })]) }, ['[].sort']],
    ['union de `ref` et d’un record', { sort: z.union([ref('spell'), z.record(z.string(), z.string())]) }, ['[].sort']],
    ['union de `refs` et d’une liste de chaînes', { sorts: z.union([refs('spell'), z.array(z.string())]) }, ['[].sorts']],
    ['`z.preprocess` devant `idDe`', { cle: z.preprocess((v) => (typeof v === 'string' ? v : 'x'), idDe('spell')) }, ['[].cle']],
    ['pipe dont l’entrée est un `transform`', { cle: z.pipe(z.transform((v) => String(v)), idDe('spell')) }, ['[].cle']],
    ['`refs` → `z.set(z.string())`', { sorts: z.set(z.string()) }, ['[].sorts']],
  ])('%s refuse, à chaque chemin relâché', (_nom, mutation, relaches) => {
    const refus = refusDesComptes(chemins(champs), chemins({ ...champs, ...mutation }));
    expect(refus.map((l) => l.slice(0, l.indexOf(' — '))).sort()).toEqual(relaches.map((c) => `FEUILLES_D_ID : ${site(c)}`).sort());
    for (const chemin of relaches) expect(remedeNomme(refus, site(chemin)), `le refus nomme ${chemin}`).toBe(true);
    for (const l of refus) expect(l).toMatch(/^FEUILLES_D_ID : .* feuille `idDe` RELÂCHÉE : .* Aucune ligne de message ne l’admet\.$/);
  });

  it('un champ retiré, une chaîne nue neuve, une référence gagnée, un extra libre de `ref` ou une alternative close ne refusent rien', () => {
    const { sort: _retire, ...sansSort } = champs;
    expect(refusDesComptes(chemins(champs), chemins(sansSort))).toEqual([]);
    expect(refusDesComptes(chemins(champs), chemins({ ...champs, libelle: z.string() }))).toEqual([]);
    expect(refusDesComptes(chemins({ ...champs, cle: z.string() }), chemins(champs))).toEqual([]);
    expect(refusDesComptes(chemins(champs), chemins({ ...champs, sort: ref('spell', { note: nommerNoeud(z.string(), { nom: 'note' }) }) }))).toEqual([]);
    expect(refusDesComptes(chemins(champs), chemins({ ...champs, cle: idDe('spell').nullable() }))).toEqual([]);
    expect(refusDesComptes(chemins(champs), chemins({ ...champs, cle: z.union([idDe('spell'), z.literal('aucun')]) }))).toEqual([]);
  });

  it('aucune ligne de message n’admet un plancher qui cède', () => {
    const [base, tete] = [chemins(champs), chemins({ ...champs, cle: z.string() })];
    const message = 'FAUX-POSITIF: ' + JSON.stringify(['FEUILLES_D_ID', site('[].cle'), 1]) + ' — la référence relâchée serait un faux positif du détecteur';
    const verdict = verdictDesDetecteurs('fixture', [{ detecteur: 'tête', base, tete }, { detecteur: 'base', base, tete }], message);
    expect(verdict.ok).toBe(false);
    expect(verdict.texte).toContain('RELÂCHÉE');
  });

  it('un DÉTECTEUR qui cesse de tenir un chemin `idDe` de la tête exige sa ligne `FAUX-POSITIF:`', () => {
    const tenus = chemins(champs);
    const affaibli = comptes({ FEUILLES_D_ID: (tenus.get('FEUILLES_D_ID') ?? []).map((e) => (e.ref === '[].cle' ? { ...e, etat: 'libre' } : e)) });
    const sansLeChemin = comptes({ FEUILLES_D_ID: (tenus.get('FEUILLES_D_ID') ?? []).filter((e) => e.ref !== '[].sort') });
    expect(baissesDuDetecteur(tenus, tenus, affaibli)).toEqual([['FEUILLES_D_ID', site('[].cle'), 1]]);
    expect(baissesDuDetecteur(tenus, tenus, sansLeChemin)).toEqual([['FEUILLES_D_ID', site('[].sort'), 1]]);
    const mesures = [{ detecteur: 'tête', base: affaibli, tete: affaibli }, { detecteur: 'base', base: tenus, tete: tenus }];
    expect(verdictDesDetecteurs('fixture', mesures).texte).toContain(`FAUX-POSITIF manquant : ${JSON.stringify(['FEUILLES_D_ID', site('[].cle'), 1])}`);
    const message = 'FAUX-POSITIF: ' + JSON.stringify(['FEUILLES_D_ID', site('[].cle'), 1]) + ' — le détecteur de la tête cesse de classer cette feuille, sonde';
    expect(verdictDesDetecteurs('fixture', mesures, message).ok).toBe(true);
  });
});

describe('STRUCTURES_LOCALES — un site par nœud, un renommage n’est pas une naissance (#3012)', () => {
  const site = (ref: string, empreinte: string, fichier = 'src/data/a.json'): EntreeDeStructure => ({ fichier, ref, occurrence: 1, classe: 'L', empreinte });
  const volet = (...entrees: ReturnType<typeof site>[]) => comptes({ STRUCTURES_LOCALES: entrees as never });
  const objet = site('[].local', '*:never,n:number');

  it('un site NÉ est refusé, avec la cible de sa classe', () => {
    const refus = refusDesComptes(volet(objet), volet(objet, site('[].autre', '*:never,m:string')));
    expect(refus).toEqual([expect.stringMatching(/^STRUCTURES_LOCALES : .*\[\]\.autre :: 1 — site NEUF : la dette NAÎT\. Composer un nœud PARTAGÉ de la grammaire/)]);
    expect(refusDesComptes(volet(objet), volet(objet, { ...site('[].libre', 'unknown'), classe: 'D5' }))[0]).toMatch(/Typer le nœud/);
  });

  it('(i) un site disparu et un site né du même fichier, d’empreinte identique, s’apparient', () => {
    expect(refusDesComptes(volet(objet), volet(site('[].renomme', objet.empreinte)))).toEqual([]);
    expect(refusDesComptes(volet(objet), volet(site('[].renomme', objet.empreinte, 'src/data/b.json'))), 'd’un fichier à l’autre, c’est une naissance.').toHaveLength(1);
    expect(refusDesComptes(volet(objet), volet(site('[].x', objet.empreinte), site('[].y', objet.empreinte))), 'un disparu ne couvre qu’un né.').toHaveLength(1);
  });

  it('(ii) une branche non discriminée qui gagne une clé OPTIONNELLE s’apparie ; une clé requise, ou une autre branche, non', () => {
    const avant = site('.v|{a,op=>=}', '*:never,a:number,op:literal');
    expect(refusDesComptes(volet(avant), volet(site('.v|{a,b,op=>=}', '*:never,a:number,b:optional,op:literal')))).toEqual([]);
    expect(refusDesComptes(volet(avant), volet(site('.v|{a,b,op=>=}', '*:never,a:number,b:string,op:literal')))).toHaveLength(1);
    expect(refusDesComptes(volet(avant), volet(site('.w|{a,b,op=>=}', '*:never,a:number,b:optional,op:literal')))).toHaveLength(1);
  });

  it('les renommages se rendent par la clé de site du né', () => {
    expect([...renommagesDeStructure([objet], [site('[].renomme', objet.empreinte)])]).toEqual([cleDeSite(site('[].renomme', objet.empreinte))]);
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
  const stable = { base: comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(33)] }), tete: comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(33)] }) };
  const hausse = { base: comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(33)] }), tete: comptes({ STRUCTURES_REDECLARATIONS: [redeclaration(34)] }) };

  it('une hausse vue par le SEUL détecteur de la base refuse la plage, et nomme ce détecteur', () => {
    const verdict = verdictDesDetecteurs(plage, [{ detecteur: 'détecteur de la tête', ...stable }, { detecteur: 'détecteur de la base (b)', ...hausse }]);
    expect(verdict.ok).toBe(false);
    expect(verdict.texte).toContain('[détecteur de la base (b)] STRUCTURES_REDECLARATIONS : criticals.ts | loss | test | difficulty+… | divergente |  — HAUSSE 34 > 33');
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
  const compte = (n: number): Comptes => comptes({ STRUCTURES_REDECLARATIONS: n ? [redeclaration(n)] : [] });
  const paire = (base: number, tete: number) => ({ base: compte(base), tete: compte(tete) });
  const mesures = (a: number, b: number, c: number, d: number) => [
    { detecteur: 'détecteur de la tête', ...paire(a, b) },
    { detecteur: 'détecteur de la base (b)', ...paire(c, d) },
  ];
  const ligne = (n: number, cle = 'criticals.ts | loss | test | difficulty+… | divergente | ') =>
    'FAUX-POSITIF: ' + JSON.stringify(['STRUCTURES_REDECLARATIONS', cle, n]) + ' — le schéma classe cette occurrence comme une valeur sans référence';
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
    ['dupliquée', ligne(1) + '\n' + ligne(1)], ['autre site', ligne(1) + '\n' + ligne(2, 'autre.ts | loss | test | difficulty+… | divergente | ')],
    ['preuve vide', 'FAUX-POSITIF: ["STRUCTURES_REDECLARATIONS","criticals.ts | loss | test | difficulty+… | divergente | ",1] — '],
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

describe('#2995 : ajouter ou retirer une donnée saine ne fait refuser aucune plage', () => {
  const ROOT = fileURLToPath(new URL('..', import.meta.url));
  /** Les fichiers TEXTE d'une copie de l'arbre : ce que lisent la génération du code et la mesure. */
  const TEXTE = /\.(?:md|json|ts|tsx|mts|mjs|js|cjs|css|snap)$/;
  const env = Object.fromEntries(Object.entries(process.env).filter(([nom]) => !nom.startsWith('GIT_')));
  /** Les comptes de la racine `cwd`, mesurés par le point d'entrée de la porte dans un processus `tsx`. */
  const mesurer = (cwd: string): Comptes => new Map(JSON.parse(execFileSync(process.execPath,
    [join(ROOT, 'node_modules/tsx/dist/cli.mjs'), join(cwd, 'scripts/guards/lib/corpusDesComptes.mts')],
    { cwd, env, encoding: 'utf8', maxBuffer: 1 << 28 })) as [string, never[]][]) as Comptes;
  /** Le nombre de chaque chaîne des `donnees` (valeur, clé, et chaque terme d'une liste `a, b`) et de chaque chaîne
   *  littérale du `code` authoré (un `.generated.` recopie chaque id). */
  const citations = (donnees: readonly unknown[], code: readonly string[]): Map<string, number> => {
    const n = new Map<string, number>();
    const compter = (v: string) => new Set([v, ...v.split(/\s*,\s*/)]).forEach((t) => n.set(t, (n.get(t) ?? 0) + 1));
    const marcher = (v: unknown): void => {
      if (typeof v === 'string') compter(v);
      else if (v && typeof v === 'object') Object.entries(v).forEach(([cle, x]) => { compter(cle); marcher(x); });
    };
    donnees.forEach(marcher);
    for (const t of code) for (const [, , v] of t.matchAll(/(["'`])([\w.-]{1,120})\1/g)) compter(v);
    return n;
  };
  type Objet = Record<string, unknown>;
  const estObjet = (v: unknown): v is Objet => !!v && typeof v === 'object' && !Array.isArray(v);
  /** Les collections d'ENTRÉES d'un document selon son régime (`scanDuCorpus`) : sa liste racine, la carte d'un record
   *  (sous `entries` quand il est enveloppé), ou chaque liste d'objets d'une config, projets de scène compris. */
  const entreesDe = (donnee: unknown, regime: string): (unknown[] | Objet)[] => {
    if (regime === 'elements') return Array.isArray(donnee) && donnee.length ? [donnee] : [];
    if (regime === 'valeurs') return estObjet(donnee) ? [estObjet(donnee.entries) ? donnee.entries : donnee] : [];
    const listes: unknown[][] = [];
    const marcher = (v: unknown): void => {
      if (Array.isArray(v)) { if (v.length && v.every(estObjet)) listes.push(v); v.forEach(marcher); }
      else if (estObjet(v)) Object.values(v).forEach(marcher);
    };
    marcher(donnee);
    return listes;
  };

  /** Les listes d'une donnée sous sa racine, à toute profondeur. */
  const listesInternes = (v: unknown, racine = true, out: unknown[][] = []): unknown[][] => {
    if (Array.isArray(v)) { if (!racine && v.length) out.push(v); v.forEach((x) => listesInternes(x, false, out)); }
    else if (estObjet(v)) Object.values(v).forEach((x) => listesInternes(x, false, out));
    return out;
  };
  /** Les documents qu'aucun geste sain ne mute : le premier refus MESURÉ de leur schéma, ou `null` sans aucune liste. */
  const FERMES_AU_GESTE: Readonly<Record<string, RegExp | null>> = {
    'src/data/advancementCosts.json': /ne couvrent pas/,
    'src/data/ambiance.json': /doivent croître STRICTEMENT/,
    'src/data/naval-progression.json': /ne couvrent pas/,
    'src/data/obsessions.json': /est absent du catalogue des groupes/,
    'src/data/structure-criticals.json': /ne couvrent pas/,
    'src/data/teintesJeu.json': /Clé non reconnue/,
    'src/data/defauts-de-compilation.json': null,
    'src/data/details.json': null,
    'src/data/semences-de-scene.json': null,
    'src/data/sizes.json': null,
    'src/data/speciesRace.json': null,
  };

  it('dans chaque document, liste, record ou config (projets de scène compris), une entrée copiée sous un id neuf et une entrée NON référencée retirée tant que son schéma l’admet, un projet de scène neuf, cibles de code régénérées : aucun refus dans les deux sens, chaque volet inchangé', { timeout: 260_000 }, () => {
    const dossier = mkdtempSync(join(tmpdir(), 'comptes-2995-'));
    try {
      for (const rel of ['src', 'scripts'])
        cpSync(join(ROOT, rel), join(dossier, rel), { recursive: true, filter: (p) => !p.includes('node_modules') && (!/\.[A-Za-z0-9]+$/.test(p) || TEXTE.test(p)) });
      for (const rel of ['package.json', 'tsconfig.json']) cpSync(join(ROOT, rel), join(dossier, rel));
      symlinkSync(join(ROOT, 'Source'), join(dossier, 'Source'), 'junction');
      const documents = scanDuCorpus(ROOT).scan.documents;
      const lus = documents.map((d) => JSON.parse(readFileSync(join(ROOT, d.chemin), 'utf8')) as unknown);
      const code = readCorpus(['src'], { exts: ['.ts', '.tsx', '.mts', '.mjs'], tests: true }).filter((f) => !f.rel.includes('.generated.')).map((f) => f.text);
      const cite = citations(lus, code);
      const touches = { ajouts: 0, retraits: 0 };
      /** Par document, ses gestes, ceux que son schéma a refusés (et le premier motif) et ceux appliqués. */
      const parDocument = new Map<string, { gestes: number; refuses: number; appliques: number; motif: string }>();
      documents.forEach((d, i) => {
        const def = defsDeDocument().find((x) => d.chemin.endsWith(`/${x.file}`));
        if (!def) throw new Error(`${d.chemin} : aucun def, la donnée mutée ne se validerait pas.`);
        if (!def.schema.safeParse(lus[i]).success) throw new Error(`${d.chemin} : la donnée d’origine est invalide, un geste refusé ne prouverait rien.`);
        const donnee = structuredClone(lus[i]);
        const bilan = { gestes: 0, refuses: 0, appliques: 0, motif: '' };
        parDocument.set(d.chemin, bilan);
        /** Un geste n'est gardé que si le schéma du document admet encore la donnée : elle reste SAINE. */
        const tenter = (faire: () => () => void, sorte: 'ajouts' | 'retraits') => {
          bilan.gestes += 1;
          const defaire = faire();
          const lu = def.schema.safeParse(donnee);
          if (lu.success) { bilan.appliques += 1; touches[sorte] += 1; } else { defaire(); bilan.refuses += 1; bilan.motif ||= lu.error.issues[0]?.message ?? ''; }
        };
        for (const c of entreesDe(donnee, d.regime)) {
          if (Array.isArray(c)) {
            const retiree = c.reduce<number>((r, e, j) => (j > 0 && typeof (e as { id?: unknown }).id === 'string' && cite.get((e as { id: string }).id) === 1 ? j : r), -1);
            if (retiree > 0) tenter(() => { const [e] = c.splice(retiree, 1); return () => c.splice(retiree, 0, e); }, 'retraits');
            const copie = structuredClone(c[0]) as { id?: unknown };
            if (typeof copie.id === 'string') copie.id = `${copie.id}-sonde-2995`;
            tenter(() => { c.push(copie); return () => c.pop(); }, 'ajouts');
          } else {
            const cles = Object.keys(c);
            const retiree = cles.filter((k, j) => j > 0 && cite.get(k) === 1).pop();
            if (retiree) tenter(() => { const v = c[retiree]; delete c[retiree]; return () => { c[retiree] = v; }; }, 'retraits');
            const cle = `${cles[0]}-sonde-2995`;
            tenter(() => { c[cle] = structuredClone(c[cles[0]]); return () => delete c[cle]; }, 'ajouts');
          }
        }
        if (!bilan.appliques)
          for (const l of listesInternes(donnee)) {
            const dernier = l[l.length - 1];
            const ajout = typeof dernier === 'string' ? `${dernier}-sonde-2995` : estObjet(dernier) ? { ...structuredClone(dernier), ...(typeof dernier.id === 'string' ? { id: `${dernier.id}-sonde-2995` } : {}) } : undefined;
            if (ajout !== undefined) tenter(() => { l.push(ajout); return () => l.pop(); }, 'ajouts');
          }
        writeFileSync(join(dossier, d.chemin), JSON.stringify(donnee, null, 2));
      });
      const nonMutes = [...parDocument].filter(([, b]) => !b.appliques);
      expect(nonMutes.map(([chemin]) => chemin).sort(), 'un document n’est pas muté sans être nommé avec sa raison : la sonde ne le prouverait pas.').toEqual(Object.keys(FERMES_AU_GESTE).sort());
      for (const [chemin, b] of nonMutes) {
        const raison = FERMES_AU_GESTE[chemin];
        if (raison === null) expect(b.gestes, `${chemin} : nommé sans liste, il en porte une.`).toBe(0);
        else expect(b.motif, `${chemin} : son schéma refuse le geste pour une autre raison que celle nommée.`).toMatch(raison);
      }
      expect(touches.ajouts, 'aucune entrée copiée : la sonde ne prouverait rien.').toBeGreaterThan(1000);
      expect(touches.retraits, 'aucune entrée NON référencée retirée : la sonde ne prouverait rien.').toBeGreaterThan(50);
      expect([...parDocument.values()].filter((b) => b.appliques).length, 'trop peu de documents mutés : la sonde ne prouverait rien.').toBeGreaterThan(100);
      const projet = 'aaa-sonde-2995/aaa-sonde-2995-projet.json';
      mkdirSync(join(dossier, 'src/scenes/aaa-sonde-2995'), { recursive: true });
      const arene = JSON.parse(readFileSync(join(ROOT, 'src/scenes/arene/arene-projet.json'), 'utf8')) as Record<string, unknown>;
      writeFileSync(join(dossier, 'src/scenes', projet), JSON.stringify({ ...arene, id: 'aaa-sonde-2995' }, null, 2));
      const module = readFileSync(join(ROOT, 'src/data/schemas/defs-scenes/arene.ts'), 'utf8').replace("'arene/arene-projet.json'", `'${projet}'`);
      writeFileSync(join(dossier, 'src/data/schemas/defs-scenes/aaa-sonde-2995.ts'), module);
      execFileSync(process.execPath, ['--input-type=module', '-e', `const { preparerExport } = await import(${JSON.stringify(pathToFileURL(join(ROOT, 'scripts/migrations/replay-head.mjs')).href)}); preparerExport(process.argv[1]);`, dossier], { cwd: dossier, env, stdio: 'pipe' });
      expect(readFileSync(join(dossier, 'src/data/schemas/_registry-scenes.generated.ts'), 'utf8'), 'le projet neuf n’est pas au registre régénéré : la sonde ne prouverait rien.').toContain('aaa-sonde-2995');
      const [original, copie] = [mesurer(ROOT), mesurer(dossier)];
      expect([...original.keys()], 'la mesure ne rend pas chaque volet sous la porte').toEqual(SOUS_LA_PORTE.map((c) => c.nom));
      expect(refusDesComptes(original, copie), 'une donnée ajoutée ou retirée fait refuser la plage : un volet lit la donnée.').toEqual([]);
      expect(refusDesComptes(copie, original), 'retirer la donnée ajoutée fait refuser la plage : un volet lit la donnée.').toEqual([]);
      for (const { nom } of SOUS_LA_PORTE) expect(copie.get(nom), `une donnée a changé le volet ${nom} : il lit la donnée.`).toEqual(original.get(nom));
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
