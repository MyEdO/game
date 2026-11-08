/**
 * Migration #1652 lot 5 — fermeture : les paliers du Voyage rapide de `sea-events.json` passent de leurs
 * quatre champs lus à la main (`crewLostPct`, `cargoLostPct`, `hullLostPct`, `criticals`) à leur
 * `consequence` en grammaire (`Flow`, ops du navire jouées par `runFlow`), et les rangées du genre `rien`
 * deviennent des rangées narratives (ni `kind`, ni `params`, ni `consequence`).
 *
 *   champ du palier   op du navire                                                     MDG 15
 *   `crewLostPct`     `equipage` `perdusPct`                                           l.33-35
 *   `cargoLostPct`    `cargaison` `perduePct`                                          l.33-36
 *   `hullLostPct`     `wounds` d'`amount` la part des Blessures maximales, arrondie à
 *                     l'inférieur ({parTranche, of:{times:{of:{blessuresMax}, factor}}}) l.33-35
 *   `criticals`       `shipCritical` `aleatoire`, `equipageEpargne`                    l.33-35, l.49-51
 *
 * Un palier dont les quatre valent 0 n'a pas de `consequence`. Les rangées `rien` (MDG 15 l.201, l.254)
 * n'ont pas de suite mécanique.
 *
 * Entrée : src/data/sea-events.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucun palier ne porte plus un des quatre champs, aucune rangée ne porte le
 * genre `rien`. Un champ hors de la forme attendue ou un document non canonique sont un ARRÊT nominatif
 * (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const CHAMPS_DU_PALIER = ['crewLostPct', 'cargoLostPct', 'hullLostPct', 'criticals'];
const NARRATIF = 'rien';

const arrets = [];
const estPct = (n) => Number.isInteger(n) && n >= 0 && n <= 100;

/** `pct` % des Blessures maximales, à l'inférieur : la fraction irréductible `pct/100` en tranches. */
function partDesBlessuresMax(pct) {
  const pgcd = (a, b) => (b ? pgcd(b, a % b) : a);
  const d = pgcd(pct, 100);
  const num = pct / d;
  const tranche = 100 / d;
  const of = num === 1 ? { blessuresMax: true } : { times: { of: { blessuresMax: true }, factor: num } };
  return tranche === 1 ? of : { parTranche: tranche, of };
}

/** La `consequence` d'un palier, `null` pour un palier sans perte. */
function consequenceDuPalier(p, ou) {
  for (const k of CHAMPS_DU_PALIER) if (!(k in p)) arrets.push(`${ou} : ${k} absent`);
  for (const k of ['crewLostPct', 'cargoLostPct', 'hullLostPct']) if (!estPct(p[k])) arrets.push(`${ou} : ${k} « ${p[k]} » n'est pas un pourcentage`);
  if (!Number.isInteger(p.criticals) || p.criticals < 0) arrets.push(`${ou} : criticals « ${p.criticals} » n'est pas un nombre de Critiques`);
  const ops = [
    ...(p.crewLostPct > 0 ? [{ op: 'equipage', perdusPct: p.crewLostPct }] : []),
    ...(p.cargoLostPct > 0 ? [{ op: 'cargaison', perduePct: p.cargoLostPct }] : []),
    ...(p.hullLostPct > 0 ? [{ op: 'wounds', amount: partDesBlessuresMax(p.hullLostPct), ignoreTB: true, ignoreAP: true }] : []),
    ...(p.criticals > 0 ? [{ op: 'shipCritical', location: 'aleatoire', count: p.criticals, equipageEpargne: true }] : []),
  ];
  return ops.length ? { kind: 'do', effect: { type: 'ops', on: 'navire', ops } } : null;
}

/** Remplace les quatre champs du palier par sa `consequence` (rien pour un palier sans perte), au rang du premier. */
function reecrirePalier(p, consequence) {
  const copie = Object.entries(p);
  for (const k of Object.keys(p)) delete p[k];
  for (const [k, v] of copie) {
    if (k === CHAMPS_DU_PALIER[0]) { if (consequence) p.consequence = consequence; continue; }
    if (CHAMPS_DU_PALIER.includes(k)) continue;
    p[k] = v;
  }
}

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
let gestes = 0;
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (!arrets.length) {
  for (const p of sea.fastVoyage?.entries ?? []) {
    if (!CHAMPS_DU_PALIER.some((k) => k in p)) continue;
    const ou = `sea-events.json fastVoyage « ${p.id} »`;
    if (p.consequence !== undefined) arrets.push(`${ou} : consequence et champs de palier coexistent`);
    reecrirePalier(p, consequenceDuPalier(p, ou));
    gestes++;
  }
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      if (e.kind !== NARRATIF) continue;
      const ou = `sea-events.json ${table} « ${e.id} »`;
      if (e.params !== undefined && Object.keys(e.params).length) arrets.push(`${ou} : params inattendus ${Object.keys(e.params).join(', ')}`);
      delete e.kind;
      delete e.params;
      gestes++;
    }
  }
  for (const p of sea.fastVoyage?.entries ?? []) {
    const restes = CHAMPS_DU_PALIER.filter((k) => k in p);
    if (restes.length) arrets.push(`sea-events.json fastVoyage « ${p.id} » : ${restes.join(', ')} non migrés`);
  }
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) if (e.kind === NARRATIF) arrets.push(`sea-events.json ${table} « ${e.id} » : genre « ${NARRATIF} » non migré`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
console.log(`migration 1652 (fermeture) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}.`);
