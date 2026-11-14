/**
 * FIDÉLITÉ DE LA MIGRATION #1657 B2b — le cycle des maladies passé au nœud `test` du Flow n'a RIEN
 * perdu en route.
 *
 * La migration porte déjà sa preuve en post-écriture, mais elle ne la porte QUE le jour où elle
 * écrit : rejouée sur l'état final elle sort en no-op sans rien comparer. Ce test la tient au
 * PRÉSENT, sur l'arbre committé, par une DÉ-MIGRATION entrée par entrée :
 *
 *  A. chaque porteur se dé-migre SANS PERTE — le nœud n'a que les clés que la migration pose
 *     (`kind`/`test`/`reussite`/`echec`), sa `reussite` est la séquence vide, sa `echec` est la feuille
 *     `{type:'ops', on:'target'}` et son `test` ne porte que `difficulty` PLUS les ids de ce qui est
 *     testé (`skill` XOR `characteristic`), AUTHORÉS après coup (#1657 B3-3 : `LDB 20 l.145/l.212`
 *     Résistance, `MSRC 16 l.90` Endurance, `EDOC 08 l.104` Résistance). Une forme que ni la
 *     migration ni cet authoring n'auraient pu produire (branche peuplée, `si` imbriqué, 3ᵉ clé de
 *     jet) rougit ICI, même si personne ne rejoue le script.
 *
 * Périmètre : les DEUX fichiers que la migration déclare en ENTRÉES (`symptoms.json`,
 * `maladies.json`). Le cycle SANS jet (`onTick.ops`, Vers du Reik) se dé-migre en `onFail` — c'est
 * la conséquence CERTAINE, qui portait ce nom menteur avant le lot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const FICHIERS = ['symptoms.json', 'maladies.json'] as const;
/** Le porteur du cycle, par fichier — la clé que la migration déclare en ENTRÉES. */
const PORTEUR: Record<string, string> = { 'symptoms.json': 'onTick', 'maladies.json': 'dailyTest' };
/** Cardinaux de la migration (sa table `CARDINAUX`) — recopiés ici pour que le test les EXIGE. */
const CARDINAUX = { onTick: 4, epreuves: 3, certains: 1, dailyTest: 1 };

const lire = (f: string) => readFileSync(join(RACINE, 'src', 'data', f), 'utf8');
const canonique = (v: unknown) => JSON.stringify(v, null, 2);

type Noeud = { kind: string; test: Record<string, unknown>; reussite: unknown; echec: unknown };
type Porteur = Record<string, unknown>;

/** Écarts de FORME d'un nœud — tout ce que la migration ne pourrait pas avoir produit. */
function ecartsDeForme(n: Noeud): string[] {
  const e: string[] = [];
  if (Object.keys(n).sort().join(',') !== 'echec,kind,reussite,test') e.push(`cles du noeud : ${Object.keys(n).sort().join(',')}`);
  if (n.kind !== 'test') e.push(`kind « ${n.kind} »`);
  // Clés du jet : la `difficulty` posée par la migration, et AU PLUS un id de ce qui est testé
  // (authoré en B3-3 ; `skill` XOR `characteristic`, jamais les deux — `FlowTest` le dit).
  const clesJet = Object.keys(n.test).sort();
  const idsJet = clesJet.filter((k) => k === 'skill' || k === 'characteristic');
  if (clesJet.filter((k) => k !== 'skill' && k !== 'characteristic').join(',') !== 'difficulty') e.push(`cles du jet : ${clesJet.join(',')}`);
  if (idsJet.length > 1) e.push(`jet à DEUX ids (skill ET characteristic) : ${idsJet.join(',')}`);
  if (canonique(n.reussite) !== canonique({ kind: 'sequence', etapes: [] })) e.push(`branche reussite PEUPLEE : ${canonique(n.reussite)}`);
  const f = n.echec as { kind?: string; effet?: Record<string, unknown> };
  if (f.kind !== 'effet') e.push(`branche echec a EMBRANCHEMENT (« ${f.kind} »)`);
  else if (Object.keys(f.effet ?? {}).sort().join(',') !== 'on,ops,type' || f.effet!.type !== 'ops' || f.effet!.on !== 'target') {
    e.push(`feuille d'echec hors forme : ${canonique(f.effet)}`);
  }
  return e;
}

/** Reconstruit la forme ANCIENNE d'un porteur (`{difficulty?, onFail, …}`), en PRÉSERVANT l'ordre des clés. */
function demigrer(p: Porteur): { avant: Porteur; ecarts: string[] } {
  const ecarts: string[] = [];
  const avant: Porteur = {};
  for (const [k, v] of Object.entries(p)) {
    if (k === 'test') {
      const n = v as Noeud;
      ecarts.push(...ecartsDeForme(n));
      avant.difficulty = n.test.difficulty;
      avant.onFail = (n.echec as { effet: { ops: unknown[] } }).effet.ops;
    } else if (k === 'ops') {
      avant.onFail = v;
    } else {
      avant[k] = v;
    }
  }
  return { avant, ecarts };
}

/** Les ids AUTHORÉS sur le nœud (`skill` XOR `characteristic`), s'il y en a. */
function idsDuJet(n: Noeud): unknown {
  return n.test.skill ?? n.test.characteristic;
}

describe('migration #1657 B2b — fidélité', () => {
  it('A. chaque porteur se DÉ-MIGRE sans perte, et aucune forme hors migration n’a été authorée', () => {
    const ecarts: string[] = [];
    const compte = { onTick: 0, epreuves: 0, certains: 0, dailyTest: 0 };
    for (const f of FICHIERS) {
      for (const e of JSON.parse(lire(f)) as Porteur[]) {
        const p = e[PORTEUR[f]] as Porteur | undefined;
        if (!p) continue;
        if (f === 'symptoms.json') {
          compte.onTick++;
          if (p.test) compte.epreuves++;
          else compte.certains++;
        } else compte.dailyTest++;
        const { avant, ecarts: ec } = demigrer(p);
        ecarts.push(...ec.map((m) => `${f}/${String(e.id)}.${PORTEUR[f]} : ${m}`));
        // La forme ancienne est COMPLÈTE : une conséquence, et une Difficulté dès qu'il y a un jet.
        if (!Array.isArray(avant.onFail) || !avant.onFail.length) ecarts.push(`${f}/${String(e.id)} : consequence VIDE apres de-migration`);
        if (p.test && avant.difficulty === undefined) ecarts.push(`${f}/${String(e.id)} : epreuve sans Difficulte recouvree`);
        // Une ÉPREUVE dit ce qu'elle teste (#1657 B3-3) : sans ids, la porte n'aurait aucune valeur à
        // calculer et retomberait sur une formule maison (#1685).
        if (p.test && !idsDuJet(p.test as Noeud)) ecarts.push(`${f}/${String(e.id)} : epreuve qui ne NOMME pas ce qu'elle teste`);
        if (p.ops && 'difficulty' in avant) ecarts.push(`${f}/${String(e.id)} : effet certain porteur d'une Difficulte`);
      }
    }
    expect(ecarts).toEqual([]);
    expect(compte).toEqual(CARDINAUX);
  });
});
