/**
 * FIDÉLITÉ DE LA MIGRATION #1657 B2c — le coup à l'ÉQUIPAGE passé au nœud `test` du Flow n'a RIEN
 * perdu en route.
 *
 * La migration porte déjà sa preuve en post-écriture, mais elle ne la porte QUE le jour où elle
 * écrit : rejouée sur l'état final elle sort en no-op sans rien comparer. Ce test la tient au
 * PRÉSENT, sur l'arbre committé, par une DÉ-MIGRATION rangée par rangée :
 *
 *  A. chaque `crewHit` se dé-migre SANS PERTE — le nœud n'a que les clés que la migration pose
 *     (`kind`/`test`/`reussite`/`echec`), sa `reussite` est la séquence vide, sa `echec` est la feuille
 *     `{type:'ops', on:'target'}`, et son jet ne porte que `difficulty` + UN sujet
 *     (`skill` XOR `characteristic`). Une forme que la migration n'aurait pas pu produire (branche
 *     de réussite peuplée, `si` imbriqué, clé de jet en plus) rougit ICI, même si personne ne
 *     rejoue le script. Le `crewTarget` (QUI encaisse) reste au PORTEUR, jamais dans le nœud.
 *
 * Périmètre : les DEUX fichiers que la migration déclare en ENTRÉES (`river-criticals.json`,
 * `ship-criticals.json`). Le coup SANS jet (`crewHit.ops`, Rames fluviales MSRC 07 l.82) se
 * dé-migre en `onFail` — c'est la conséquence CERTAINE, qui portait ce nom menteur avant le lot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
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

type Noeud = { kind: string; test: Record<string, unknown>; reussite: unknown; echec: unknown };
type Rangee = Record<string, unknown>;
type Doc = { tables: Record<string, Rangee[]> };

/** Écarts de FORME d'un nœud — tout ce que la migration ne pourrait pas avoir produit. */
function ecartsDeForme(n: Noeud): string[] {
  const e: string[] = [];
  if (Object.keys(n).sort().join(',') !== 'echec,kind,reussite,test') e.push(`cles du noeud : ${Object.keys(n).sort().join(',')}`);
  if (n.kind !== 'test') e.push(`kind « ${n.kind} »`);
  const cles = Object.keys(n.test).sort().join(',');
  if (cles !== 'characteristic,difficulty' && cles !== 'difficulty,skill') e.push(`cles du jet : ${cles}`);
  if (canonique(n.reussite) !== canonique({ kind: 'sequence', etapes: [] })) e.push(`branche reussite PEUPLEE : ${canonique(n.reussite)}`);
  const f = n.echec as { kind?: string; effet?: Record<string, unknown> };
  if (f.kind !== 'effet') e.push(`branche echec a EMBRANCHEMENT (« ${f.kind} »)`);
  else if (Object.keys(f.effet ?? {}).sort().join(',') !== 'on,ops,type' || f.effet!.type !== 'ops' || f.effet!.on !== 'target') {
    e.push(`feuille d'echec hors forme : ${canonique(f.effet)}`);
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
  avant.onFail = n ? (n.echec as { effet: { ops: unknown[] } }).effet.ops : hit.ops;
  for (const k of Object.keys(hit)) {
    if (k !== 'test' && k !== 'ops' && k !== 'crewTarget') ecarts.push(`cle INATTENDUE sur crewHit « ${k} »`);
  }
  return { avant, ecarts };
}

describe('migration #1657 B2c — fidélité', () => {
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
});
