/**
 * Migration #1652 lot 3 — ressources de bord : six rangées de bord et deux d'escale de `sea-events.json`
 * passent de leur genre (`kind` + `params`) à leur `consequence` en grammaire (`Flow`, joué par `runFlow`).
 *
 *   genre (rangée)          consequence (dérivée des `params` de la rangée)
 *   `debris-cargaison`      `choice` repêcher : ops navire `cargaison` (`cargoEnc`)              MDG 15 l.209-210
 *   `epave-cargaison`       `choice` monter à bord : ops navire `cargaison` (`cargoEnc`)         MDG 15 l.224-225
 *   `penurie-nourriture`    ops navire `provisions` (`gateesPct` = `spoilPct`)                   MDG 15 l.169-170
 *   `manne`                 ops navire `provisions` 1d10 jours, `shipMorale` +2d10 (`params` vide :
 *                           les valeurs sont celles du livre)                                    MDG 15 l.235-236
 *   `bouteille`             `choice` secourir : ops navire `equipage` +1                         MDG 15 l.202-204
 *   `canot-sauvetage`       `choice` recueillir : table navire (`roll`) des rescapés, `equipage`  MDG 15 l.213-218
 *   `passager-clandestin`   `test` de Perception (`perceptionDifficulty`) ; réussite : `choice`
 *                           le garder ; échec : il reste. Table navire (`roll`), `equipage`      MDG 15 l.258
 *   `gangs-des-quais`       ops navire `cargaison` perte au déchargement (`lostEnc`)             MDG 15 l.250
 *
 * Correspondance MAISON d'un rescapé à un rôle d'équipage (`crew-roles.json`), sur la consigne de
 * l'utilisateur du 2026-11-07 (« met ce qui te semble juste ») : Mousse → `mousse`, Nautonier →
 * `navigateur` (MDG 09, « Vous guidez les navires »), Médecin de bord → `chirurgien` ; Marin, Officier et
 * Mercenaire expérimenté, sans rôle au catalogue, accroissent l'effectif anonyme. Les rescapés du canot à
 * un rôle servent sans solde jusqu'au prochain port (l.216-217).
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
const GENRES_MIGRES = new Set(['debris-cargaison', 'epave-cargaison', 'penurie-nourriture', 'manne', 'bouteille', 'canot-sauvetage', 'passager-clandestin', 'gangs-des-quais']);

const equipage = (delta, role, sansSolde) => ({ op: 'equipage', delta, ...(role ? { role: { id: role } } : {}), ...(sansSolde ? { sansSolde: 'jusquAuPort' } : {}) });
/** Rangées MAISON (rôle) sur le verbatim du livre : `[min, max, ops]`. */
const RESCAPES_DU_CANOT = [
  [1, 3, [equipage(2)]],
  [4, 6, [equipage(1)]],
  [7, 7, [equipage(1)]],
  [8, 8, [equipage(1, 'navigateur', true)]],
  [9, 9, [equipage(1, 'chirurgien', true)]],
  [10, 10, [{ op: 'narrative', text: 'un chat de navire' }]],
];
const PASSAGERS = [
  [1, 3, [equipage(1, 'mousse')]],
  [4, 6, [equipage(1)]],
  [7, 7, [equipage(1)]],
  [8, 8, [equipage(1, 'navigateur')]],
  [9, 9, [equipage(1, 'chirurgien')]],
  [10, 10, [equipage(1)]],
];

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
    case 'bouteille':
      cles([]);
      return { kind: 'choice', prompt: 'Secourir le naufragé', yes: surLeNavire([equipage(1)]) };
    case 'canot-sauvetage':
      cles(['roll', 'contents']);
      return { kind: 'choice', prompt: 'Recueillir les rescapés', yes: surLeNavire([table(p.roll, RESCAPES_DU_CANOT, ou)]) };
    case 'passager-clandestin': {
      cles(['perceptionDifficulty', 'discoverDays', 'roll', 'contents']);
      if (typeof p.perceptionDifficulty !== 'string') arrets.push(`${ou} : params.perceptionDifficulty absent`);
      const rejoint = surLeNavire([table(p.roll, PASSAGERS, ou)]);
      return {
        kind: 'test',
        test: { skill: { id: 'perception' }, difficulty: p.perceptionDifficulty, stake: { key: { dataset: 'voyage', kind: 'sea-passager-clandestin', entryId: e.id, entryCategory: 'seaPortEvents' } } },
        success: { kind: 'choice', prompt: 'Garder le passager à bord', yes: rejoint },
        fail: rejoint,
      };
    }
    case 'gangs-des-quais':
      cles(['lostEnc']);
      if (!estTirage(p.lostEnc)) arrets.push(`${ou} : params.lostEnc hors de la forme {dice}`);
      return surLeNavire([{ op: 'cargaison', perteAuDechargement: { dice: p.lostEnc?.dice } }]);
    case 'manne':
      cles([]);
      return surLeNavire([
        { op: 'provisions', jours: { dice: { n: 1, sides: 10 } } },
        { op: 'shipMorale', delta: { sign: 1, dice: { n: 2, sides: 10 } } },
      ]);
  }
  throw new Error(`genre « ${e.kind} » hors de GENRES_MIGRES`);
}

/** Table navire au dé `roll` (un d10) et aux rangées `rangees`. */
function table(roll, rangees, ou) {
  if (!estTirage(roll) || roll.dice.n !== 1 || roll.dice.sides !== 10) arrets.push(`${ou} : params.roll n'est pas 1d10`);
  return { op: 'rollTable', die: '1d10', entries: rangees.map(([min, max, ops]) => ({ min, max, ops })) };
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
