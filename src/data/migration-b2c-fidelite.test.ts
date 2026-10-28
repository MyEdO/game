/**
 * FIDÉLITÉ DE LA MIGRATION #1657 B2c — le coup à l'ÉQUIPAGE passé au nœud `test` du Flow n'a RIEN
 * perdu en route, et le script committé REPRODUIT exactement l'arbre committé.
 *
 * La migration porte déjà sa preuve en post-écriture, mais elle ne la porte QUE le jour où elle
 * écrit : rejouée sur l'état final elle sort en no-op sans rien comparer. Ce test la tient au
 * PRÉSENT, sur l'arbre committé, par une DÉ-MIGRATION rangée par rangée :
 *
 *  A. chaque `crewHit` se dé-migre SANS PERTE — le nœud n'a que les clés que la migration pose
 *     (`kind`/`test`/`success`/`fail`), sa `success` est la séquence vide, sa `fail` est la feuille
 *     `{type:'ops', on:'target'}`, et son jet ne porte que `difficulty` + UN sujet
 *     (`skill` XOR `characteristic`). Une forme que la migration n'aurait pas pu produire (branche
 *     de réussite peuplée, `if` imbriqué, clé de jet en plus) rougit ICI, même si personne ne
 *     rejoue le script. Le `crewTarget` (QUI encaisse) reste au PORTEUR, jamais dans le nœud.
 *  B. ALLER-RETOUR par le VRAI script, sur un arbre JETABLE : la pré-image dé-migrée en A, écrite
 *     dans un arbre temporaire puis remigrée, rend l'arbre committé BYTE POUR BYTE. Aucune fixture
 *     figée à maintenir — la pré-image se DÉRIVE de l'arbre.
 *  C. REJEU : le script relancé sur son propre résultat ne réécrit pas un octet.
 *
 * Périmètre : les DEUX fichiers que la migration déclare en ENTRÉES (`river-criticals.json`,
 * `ship-criticals.json`). Le coup SANS jet (`crewHit.ops`, Rames fluviales MSRC 07 l.82) se
 * dé-migre en `onFail` — c'est la conséquence CERTAINE, qui portait ce nom menteur avant le lot.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT = '2026-09-02-1657-b2c-equipage-noeud-test.mjs';
const FICHIERS = ['river-criticals.json', 'ship-criticals.json'] as const;
/**
 * Cardinaux de la migration (sa table `CARDINAUX`) — recopiés ici pour que le test les EXIGE.
 * RECALÉS le 2026-09-04 : la migration B3-2b-a (#1657) a donné son coup à `gouvernail-fluvial`
 * (MSRC 07 l.86, +1 certain) et à 6 rangées MDG qui ne portaient leur Test qu'en prose `note`
 * (MDG 13 l.730/l.734/l.736/l.738/l.751/l.756 — +6 épreuves à l'Athlétisme, donc +6 `skill`), et la
 * CIBLE est devenue REQUISE (`crewTarget` = `crewHit`) ; puis B3-2b-c a donné le sien aux 5 rangées
 * du GRÉEMENT (MDG 13 l.711/l.714/l.715/l.717/l.718 — +5 épreuves à l'Athlétisme, donc +5 `skill`,
 * dont l'échec fait TOMBER : op `fall`, hauteur au livre MDG 13 l.684).
 */
const CARDINAUX = { crewHit: 16, epreuves: 14, certains: 2, crewTarget: 16, characteristic: 2, skill: 12 };

const lire = (f: string) => readFileSync(join(RACINE, 'src', 'data', f), 'utf8');
const canonique = (v: unknown) => JSON.stringify(v, null, 2);

type Noeud = { kind: string; test: Record<string, unknown>; success: unknown; fail: unknown };
type Rangee = Record<string, unknown>;
type Doc = { tables: Record<string, Rangee[]> };

/** Écarts de FORME d'un nœud — tout ce que la migration ne pourrait pas avoir produit. */
function ecartsDeForme(n: Noeud): string[] {
  const e: string[] = [];
  if (Object.keys(n).sort().join(',') !== 'fail,kind,success,test') e.push(`cles du noeud : ${Object.keys(n).sort().join(',')}`);
  if (n.kind !== 'test') e.push(`kind « ${n.kind} »`);
  const cles = Object.keys(n.test).sort().join(',');
  if (cles !== 'characteristic,difficulty' && cles !== 'difficulty,skill') e.push(`cles du jet : ${cles}`);
  if (canonique(n.success) !== canonique({ kind: 'seq', steps: [] })) e.push(`branche success PEUPLEE : ${canonique(n.success)}`);
  const f = n.fail as { kind?: string; effect?: Record<string, unknown> };
  if (f.kind !== 'do') e.push(`branche fail a EMBRANCHEMENT (« ${f.kind} »)`);
  else if (Object.keys(f.effect ?? {}).sort().join(',') !== 'on,ops,type' || f.effect!.type !== 'ops' || f.effect!.on !== 'target') {
    e.push(`feuille d'echec hors forme : ${canonique(f.effect)}`);
  }
  return e;
}

/** Reconstruit la forme ANCIENNE d'un coup (`crewTest {skill?|char?, difficulty?, crewTarget?, onFail}`),
 *  dans l'ordre de clés que le script écrivait : sujet, difficulté, cible, conséquence. */
function demigrer(hit: Rangee): { avant: Rangee; ecarts: string[] } {
  const ecarts: string[] = [];
  const avant: Rangee = {};
  const n = hit.test as Noeud | undefined;
  if (n) {
    ecarts.push(...ecartsDeForme(n));
    if (n.test.skill !== undefined) avant.skill = n.test.skill;
    if (n.test.characteristic !== undefined) avant.char = n.test.characteristic;
    avant.difficulty = n.test.difficulty;
  }
  if (hit.crewTarget !== undefined) avant.crewTarget = hit.crewTarget;
  avant.onFail = n ? (n.fail as { effect: { ops: unknown[] } }).effect.ops : hit.ops;
  for (const k of Object.keys(hit)) {
    if (k !== 'test' && k !== 'ops' && k !== 'crewTarget') ecarts.push(`cle INATTENDUE sur crewHit « ${k} »`);
  }
  return { avant, ecarts };
}

/** L'arbre committé, dé-migré fichier par fichier — la PRÉ-IMAGE, dérivée, jamais figée. */
function preImage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FICHIERS) {
    const doc = JSON.parse(lire(f)) as Doc;
    for (const [loc, table] of Object.entries(doc.tables)) {
      doc.tables[loc] = table.map((e) => {
        if (!e.crewHit) return e;
        const avant = demigrer(e.crewHit as Rangee).avant;
        const rangee: Rangee = {};
        for (const [k, v] of Object.entries(e)) {
          if (k === 'crewHit') rangee.crewTest = avant;
          else rangee[k] = v;
        }
        return rangee;
      });
    }
    out[f] = canonique(doc);
  }
  return out;
}

describe('migration #1657 B2c — fidélité, aller-retour et rejeu', () => {
  it('A. chaque coup à l’équipage se DÉ-MIGRE sans perte, et aucune forme hors migration n’a été authorée', () => {
    const ecarts: string[] = [];
    const compte = { crewHit: 0, epreuves: 0, certains: 0, crewTarget: 0, characteristic: 0, skill: 0 };
    for (const f of FICHIERS) {
      for (const table of Object.values((JSON.parse(lire(f)) as Doc).tables)) {
        for (const e of table) {
          const hit = e.crewHit as Rangee | undefined;
          if (!hit) continue;
          compte.crewHit++;
          const n = hit.test as Noeud | undefined;
          if (n) {
            compte.epreuves++;
            if (n.test.characteristic !== undefined) compte.characteristic++;
            if (n.test.skill !== undefined) compte.skill++;
          } else compte.certains++;
          if (hit.crewTarget !== undefined) compte.crewTarget++;
          const { avant, ecarts: ec } = demigrer(hit);
          ecarts.push(...ec.map((m) => `${f}/${String(e.id)}.crewHit : ${m}`));
          // La forme ancienne est COMPLÈTE : une conséquence, et une Difficulté dès qu'il y a un jet.
          if (!Array.isArray(avant.onFail) || !avant.onFail.length) ecarts.push(`${f}/${String(e.id)} : consequence VIDE apres de-migration`);
          if (n && avant.difficulty === undefined) ecarts.push(`${f}/${String(e.id)} : epreuve sans Difficulte recouvree`);
          if (!n && 'difficulty' in avant) ecarts.push(`${f}/${String(e.id)} : effet certain porteur d'une Difficulte`);
          // Le QUI reste au porteur : le nœud ne connaît que le jet et sa conséquence.
          if (n && 'crewTarget' in n.test) ecarts.push(`${f}/${String(e.id)} : crewTarget INFILTRE dans le jet`);
        }
      }
    }
    expect(ecarts).toEqual([]);
    expect(compte).toEqual(CARDINAUX);
  });

  it('B/C. ALLER-RETOUR par le VRAI script : la pré-image remigrée rend l’arbre committé, et le rejeu est no-op', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mig-1657-b2c-'));
    try {
      mkdirSync(join(dir, 'scripts', 'migrations'), { recursive: true });
      mkdirSync(join(dir, 'src', 'data'), { recursive: true });
      const script = join(dir, 'scripts', 'migrations', SCRIPT);
      copyFileSync(join(RACINE, 'scripts', 'migrations', SCRIPT), script);
      copyFileSync(join(RACINE, 'src', 'data', 'serialize.ts'), join(dir, 'src', 'data', 'serialize.ts'));
      const avant = preImage();
      for (const f of FICHIERS) writeFileSync(join(dir, 'src', 'data', f), avant[f], 'utf8');
      // La pré-image DIFFÈRE de l'arbre : sans quoi le script sortirait en no-op et ne prouverait rien.
      for (const f of FICHIERS) expect(avant[f], `${f} : pre-image identique a l'arbre`).not.toBe(lire(f));

      execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
      for (const f of FICHIERS) expect(readFileSync(join(dir, 'src', 'data', f), 'utf8'), f).toBe(lire(f));

      const apres = FICHIERS.map((f) => readFileSync(join(dir, 'src', 'data', f), 'utf8'));
      execFileSync(process.execPath, [script], { encoding: 'utf8', stdio: 'pipe' });
      FICHIERS.forEach((f, i) => expect(readFileSync(join(dir, 'src', 'data', f), 'utf8'), `${f} : rejeu non no-op`).toBe(apres[i]));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
