/**
 * Migration #1652 lot 3 — ressources de bord : quatre rangées de bord de `sea-events.json` passent de leur
 * genre (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`).
 *
 *   genre (rangée)          consequence (dérivée des `params` de la rangée)
 *   `debris-cargaison`      `choice` repêcher : ops navire `cargaison` (`cargoEnc`)              MDG 15 l.209-210
 *   `epave-cargaison`       `choice` monter à bord : ops navire `cargaison` (`cargoEnc`)         MDG 15 l.224-225
 *   `penurie-nourriture`    ops navire `provisions` (`gateesPct` = `spoilPct`)                   MDG 15 l.169-170
 *   `manne`                 ops navire `provisions` 1d10 jours, `shipMorale` +2d10 (`params` vide :
 *                           les valeurs sont celles du livre)                                    MDG 15 l.235-236
 *
 * Les Infestations (`infestation`, MDG 15 l.159-164, l.174-178) ne sont pas des entrées de cette migration.
 *
 * Entrée : src/data/sea-events.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucune rangée ne porte plus un genre migré, aucune ne porte à la fois
 * `consequence` et `kind`/`params`. Des `params` hors de la forme attendue ou un document non canonique
 * sont un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const GENRES_MIGRES = new Set(['debris-cargaison', 'epave-cargaison', 'penurie-nourriture', 'manne']);

const arrets = [];

const estDe = (d) => d && Number.isInteger(d.n) && d.n > 0 && Number.isInteger(d.sides) && d.plus === undefined;
const estTirage = (q) => q && Object.keys(q).length === 1 && estDe(q.dice);
const surLeNavire = (ops) => ({ kind: 'do', effect: { type: 'ops', on: 'navire', ops } });

function consequenceDe(e, ou) {
  const p = e.params ?? {};
  const cles = (attendues) => {
    const hors = Object.keys(p).filter((k) => !attendues.includes(k));
    if (hors.length) arrets.push(`${ou} : params inattendus ${hors.join(', ')}`);
  };
  const enc = () => {
    if (!estTirage(p.cargoEnc)) arrets.push(`${ou} : params.cargoEnc hors de la forme {dice}`);
    return { dice: p.cargoEnc?.dice };
  };
  switch (e.kind) {
    case 'debris-cargaison':
      cles(['cargoEnc']);
      return { kind: 'choice', prompt: 'Repêcher les caisses', yes: surLeNavire([{ op: 'cargaison', enc: enc() }]) };
    case 'epave-cargaison':
      cles(['cargoEnc']);
      return { kind: 'choice', prompt: 'Monter à bord', yes: surLeNavire([{ op: 'cargaison', enc: enc() }]) };
    case 'penurie-nourriture':
      cles(['spoilPct']);
      if (!Number.isInteger(p.spoilPct) || p.spoilPct < 1 || p.spoilPct > 100) arrets.push(`${ou} : params.spoilPct « ${p.spoilPct} » hors de 1-100`);
      return surLeNavire([{ op: 'provisions', gateesPct: p.spoilPct }]);
    case 'manne':
      cles([]);
      return surLeNavire([
        { op: 'provisions', jours: { dice: { n: 1, sides: 10 } } },
        { op: 'shipMorale', delta: { sign: 1, dice: { n: 2, sides: 10 } } },
      ]);
  }
  throw new Error(`genre « ${e.kind} » hors de GENRES_MIGRES`);
}

/** Remplace `kind` par `consequence` au même rang, et retire `params`. */
function reecrire(e, consequence) {
  const copie = Object.entries(e);
  for (const k of Object.keys(e)) delete e[k];
  for (const [k, v] of copie) {
    if (k === 'params') continue;
    if (k === 'kind') e.consequence = consequence;
    else e[k] = v;
  }
}

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
else {
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      if (!GENRES_MIGRES.has(e.kind)) continue;
      reecrire(e, consequenceDe(e, `sea-events.json ${table} « ${e.id} »`));
      gestes++;
    }
  }
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      const ou = `sea-events.json ${table} « ${e.id} »`;
      if (GENRES_MIGRES.has(e.kind)) arrets.push(`${ou} : genre « ${e.kind} » non migré`);
      if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) arrets.push(`${ou} : consequence et kind/params coexistent`);
    }
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
console.log(`migration 1652 (ressources) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}.`);
