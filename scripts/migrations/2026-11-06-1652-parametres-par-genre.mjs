/**
 * Migration #1652 (point 3) — les paramètres d'événement de mer prennent la forme que lit leur genre
 * (`ParametresDeBord`, `ParametresDePort`, `src/engine/seaVoyage.ts`) :
 *
 *   compte signé de d10   `manannD10: n` / `moraleD10: n`            → `manann` / `moral` : `{ sign, dice: { n: |n|, sides: 10 } }`
 *                         (racine des params ; celui de `impressed`/`wrathful` du Triton monte en
 *                         `impressedManann`/`wrathfulManann`)
 *   climat imposé         `visibilite` / `precipitations` / `temperature` / `vents` à plat
 *                         → `weather: { visibilite?, precipitations?, temperature?, vent? }`
 *                         (et `escalation.vents` de la Tempête → `escalation.weather.vent`)
 *   Calme plat            `weather: { vent: "calme-plat" }` (MDG 15 l.189, la valeur que le flux portait)
 *   Rafale de Ghyran      `specs: { focalisation: "vie" }` : la Focalisation (Ghyran) de MDG 15 l.212
 *
 * Entrées : src/data/sea-events.json (seul document lu et écrit).
 * IDEMPOTENT : un paramètre déjà à sa forme n'a aucun geste ; rejouée, rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : document hors de son formatage, compte de d10 non entier
 * ou nul, axe de climat présent à la fois à plat et sous `weather`.
 * Aucun cardinal gelé : les tables sont éditables (#1812).
 * FORMATAGE : `serializeDataset`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = `${ROOT}src/data/sea-events.json`;

const arrets = [];
let gestes = 0;

/** `manannD10: n` de l'objet `o` → `nouveau: {sign, dice}` sur `cible` (`o` par défaut) ; `ou` nomme le site. */
function compteSigne(o, ancien, nouveau, ou, cible = o) {
  if (!(ancien in o)) return;
  const n = o[ancien];
  if (!Number.isInteger(n) || n === 0) { arrets.push(`${ou}.${ancien} : compte de d10 « ${n} » ni entier ni non nul`); return; }
  if (nouveau in cible) { arrets.push(`${ou} : « ${ancien} » et « ${nouveau} » coexistent`); return; }
  const effet = { sign: n < 0 ? -1 : 1, dice: { n: Math.abs(n), sides: 10 } };
  const { [ancien]: _, ...reste } = o;
  for (const k of Object.keys(o)) delete o[k];
  Object.assign(o, reste);
  cible[nouveau] = effet;
  gestes++;
}

const AXES = [['visibilite', 'visibilite'], ['precipitations', 'precipitations'], ['temperature', 'temperature'], ['vents', 'vent']];

/** Range les axes de climat à plat de `o` sous `o.weather`. */
function climat(o, ou) {
  const aPlat = AXES.filter(([ancien]) => ancien in o);
  if (!aPlat.length) return;
  const weather = { ...(o.weather ?? {}) };
  for (const [ancien, nouveau] of aPlat) {
    if (nouveau in weather) { arrets.push(`${ou} : « ${ancien} » à plat et « weather.${nouveau} » coexistent`); return; }
    weather[nouveau] = o[ancien];
    delete o[ancien];
  }
  o.weather = weather;
  gestes++;
}

const doc = JSON.parse(readFileSync(FICHIER, 'utf8'));
const brut = readFileSync(FICHIER, 'utf8');
if (brut !== serializeDataset(doc)) arrets.push('sea-events.json : forme non canonique');

for (const table of ['boardEvents', 'portEvents']) {
  // `boardEvents.entries`, `portEvents.entries` : les formes que posent `2026-11-06-1667-evenements-de-bord-tires.mjs` et
  // `2026-11-06-1667-tables-tirees-de-mer.mjs`, reconnues au rejeu.
  for (const e of (Array.isArray(doc[table]) ? doc[table] : doc[table]?.entries) ?? []) {
    const ou = `${table} « ${e.id} »`;
    const p = e.params;
    if (!p || typeof p !== 'object') continue;
    compteSigne(p, 'manannD10', 'manann', `${ou} params`);
    compteSigne(p, 'moraleD10', 'moral', `${ou} params`);
    for (const issue of ['impressed', 'wrathful']) if (p[issue]) compteSigne(p[issue], 'manannD10', `${issue}Manann`, `${ou} params.${issue}`, p);
    climat(p, `${ou} params`);
    if (p.escalation) climat(p.escalation, `${ou} params.escalation`);
    if (e.kind === 'calme-plat' && !p.weather) { p.weather = { vent: 'calme-plat' }; gestes++; }
    if (e.kind === 'rafale-ghyran' && !p.specs) { p.specs = { focalisation: 'vie' }; gestes++; }
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(doc);
if (out !== brut) writeFileSync(FICHIER, out, 'utf8');
console.log(`migration 1652 (paramètres par genre) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}.`);
