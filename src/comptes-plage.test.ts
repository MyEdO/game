/**
 * PORTE DES COMPTES (#2705, `scripts/guards/lib/corpusDesComptes.mts`) : entre la base d'une plage et sa
 * tête, aucun compte d'une collection à compte ne monte et aucun site n'y naît, mesuré à détecteur
 * constant — et aucune ligne de message ne l'admet.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refusDesComptes, jugerLesComptes, type Comptes } from '../scripts/guards/lib/corpusDesComptes.mjs';
import { instanceDeDepot, envDeDepotForge } from '../scripts/guards/lib/depotGabarit.mjs';
import { cleDeSite, remedeNomme } from '../scripts/guards/lib/stock.mjs';
import { tableTotale } from './lib/tableTotale';
import { commitDe, depotDe, reussi, shaDe } from '../scripts/guards/lib/gitPorte.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

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

/** Une op du premier tableau d'ops de `donnee` qui satisfait `choisir`, et ce tableau. */
function opDe(donnee: unknown, choisir: (op: Record<string, unknown>) => boolean): { op: Record<string, unknown>; tableau: unknown[] } {
  const pile = [donnee];
  while (pile.length) {
    const v = pile.pop();
    if (!v || typeof v !== 'object') continue;
    if (Array.isArray(v)) {
      const op = v.find((x) => x && typeof x === 'object' && typeof (x as { op?: unknown }).op === 'string' && choisir(x as Record<string, unknown>));
      if (op) return { op: op as Record<string, unknown>, tableau: v };
    }
    pile.push(...Object.values(v));
  }
  throw new Error('aucune op ne répond au choix');
}

describe('jugerLesComptes — la plage d’un dépôt, chaque borne mesurée dans SON image', () => {
  it('un schéma qui régresse est refusé ; une op TYPÉE ajoutée passe ; une op NON TYPÉE ajoutée est refusée MÊME sous `CLIQUET:`', { timeout: 300_000 }, () => {
    const suivis = execFileSync('git', ['ls-files', '-z', 'src', 'Source'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\0').filter(Boolean);
    const { racine } = instanceDeDepot({ fichiers: tableTotale(suivis, (rel) => readFileSync(join(ROOT, rel), 'utf8')) });
    const depot = depotDe(racine, { env: envDeDepotForge() });
    const commiter = (rel: string, muter: (texte: string) => string, message: string) => {
      writeFileSync(join(racine, rel), muter(readFileSync(join(racine, rel), 'utf8')), 'utf8');
      expect(reussi(commitDe(depot, { message, chemins: [rel] }))).toBe(true);
      return shaDe(depot, 'HEAD')!;
    };
    const ajouterOp = (choisir: (op: Record<string, unknown>) => boolean) => (texte: string) => {
      const spells = JSON.parse(texte) as unknown;
      const { op, tableau } = opDe(spells, choisir);
      tableau.push({ ...op });
      return JSON.stringify(spells);
    };
    try {
      const fondation = shaDe(depot, 'HEAD')!;
      const regression = commiter('src/data/schemas/defs/creatures.ts', (t) => t.replace('skills: z.array(competenceChiffreeAEmplacementSchema),', 'skills: z.array(z.any()),').replace("spells: refs('spell'),", 'spells: z.array(z.string()),'), 'schéma');
      const refus = jugerLesComptes({ cwd: racine, base: fondation, tete: regression });
      expect(refus.ok).toBe(false);
      expect(refus.texte).toContain('SLOTS_SANS_DECLARATION : creatures.json | skills — site NEUF : la dette NAÎT.');
      expect(refus.texte).toContain('SLOTS_SANS_DECLARATION : creatures.json | spells — site NEUF : la dette NAÎT.');
      const typee = commiter('src/data/spells.json', ajouterOp((o) => o.op === 'reduceDiseaseDays'), 'op typée');
      expect(jugerLesComptes({ cwd: racine, base: regression, tete: typee })).toMatchObject({ ok: true });
      const lache = commiter('src/data/spells.json', ajouterOp((o) => o.op === 'freeReroll'), 'op\n\nCLIQUET: scripts/guards/lib/structuresStock.mjs +1 — op de plus');
      const nonTypee = jugerLesComptes({ cwd: racine, base: typee, tete: lache });
      expect(nonTypee.ok).toBe(false);
      expect(nonTypee.texte).toMatch(/STRUCTURES_OPS : freeReroll \| op \| spells\.json — HAUSSE \d+ > \d+ : la dette GRANDIT\./);
      expect(nonTypee.texte).toContain('aucun `CLIQUET:` ne les couvre');
    } finally {
      rmSync(racine, { recursive: true, force: true });
    }
  });
});
