/**
 * Migration L-monnaie-1 (#1463) — le prix d'une machine de guerre CESSE d'être de la PROSE :
 * `warMachines[].price: "75 CO"` → `{ gold: 75, silver: 0, brass: 0 }` (`moneySchema`,
 * `src/data/schemas/grammaire/valeurs.ts`), la forme que porte déjà toute colonne Prix chiffrée
 * du projet (trappings, creatures, vehicles, crew-roles).
 *
 * ENTRÉE : `src/data/mass-battle.json` seul, chemin `warMachines[].price`. Cardinal ASSERTÉ : 10.
 * Aucune valeur ne change : les 10 montants sont écrits en couronnes d'or entières
 * (ADE II 08 l.235-247, colonne « Prix »), la conversion est une pure REPRÉSENTATION.
 * ANOMALIE = arrêt : un `price` chaîne qui n'est pas `«  N CO »` n'est pas converti, rien n'est écrit.
 * IDEMPOTENT : rejouée sur l'état final, elle n'écrit rien et sort 0.
 * PREUVE : l'artefact de sortie ramené à la graphie de PROSE (`${gold} CO`) est deep-equal à l'entrée.
 * FORMATAGE PRÉSERVÉ : `JSON.stringify(doc, null, 2)` exact (LF, aucun `\r`), constaté avant écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FICHIER = 'src/data/mass-battle.json';
const PROSE = /^(\d+) CO$/;

const abs = path.join(ROOT, FICHIER);
const brut = fs.readFileSync(abs, 'utf8');
const data = JSON.parse(brut);
if (JSON.stringify(data, null, 2) !== brut) {
  console.error(`FORME NON CANONIQUE — ${FICHIER} n'est pas un JSON indenté à 2 ; AUCUNE écriture.`);
  process.exit(1);
}

const machines = data.warMachines;
if (Array.isArray(machines) && machines.every((m) => typeof m === 'string')
    && fs.existsSync(new URL('../../src/data/siege-engines.json', import.meta.url))) {
  console.log(`RIEN À FAIRE — ${FICHIER} porte ses références au catalogue des engins.`);
  process.exit(0);
}
assert.equal(Array.isArray(machines), true, 'warMachines absent de mass-battle.json');
// FORME, jamais cardinal (#1812) : la liste des machines de guerre est app-owned et peut grandir.
assert.ok(machines.length > 0, 'warMachines VIDE dans mass-battle.json');

const anomalies = [];
let migres = 0;
for (const m of machines) {
  if (typeof m.price === 'string') {
    const g = PROSE.exec(m.price);
    if (!g) { anomalies.push(`${m.id} : price "${m.price}" hors graphie « N CO »`); continue; }
    m.price = { gold: Number(g[1]), silver: 0, brass: 0 };
    migres++;
    continue;
  }
  const p = m.price;
  const dejaMonnaie = p && typeof p === 'object'
    && typeof p.gold === 'number' && typeof p.silver === 'number' && typeof p.brass === 'number';
  if (!dejaMonnaie) anomalies.push(`${m.id} : price de forme inconnue (${JSON.stringify(p)})`);
}

if (anomalies.length) {
  console.error(`ANOMALIES (${anomalies.length}) — AUCUNE écriture :`);
  for (const a of anomalies) console.error(`  - ${a}`);
  process.exit(1);
}

/** Ramène un document à la graphie de PROSE — le TERRAIN COMMUN où l'avant et l'après doivent
 *  coïncider (une monnaie à pistoles ou à sous n'y a pas d'image : elle serait une VALEUR nouvelle). */
function versProse(doc) {
  const copie = JSON.parse(JSON.stringify(doc));
  for (const m of copie.warMachines) {
    if (typeof m.price === 'string') continue;
    assert.equal(m.price.silver, 0, `${m.id} : pistoles inattendues`);
    assert.equal(m.price.brass, 0, `${m.id} : sous inattendus`);
    m.price = `${m.price.gold} CO`;
  }
  return copie;
}
assert.deepEqual(versProse(data), versProse(JSON.parse(brut)), 'la migration a changé autre chose que la graphie du prix');

const sortie = JSON.stringify(data, null, 2);
if (sortie === brut) {
  console.log(`RIEN À FAIRE — ${FICHIER} porte déjà ses ${machines.length} prix en monnaie.`);
  process.exit(0);
}
fs.writeFileSync(abs, sortie);
console.log(`${FICHIER} : ${migres}/${machines.length} prix de machine de guerre passés de la prose « N CO » à {gold, silver, brass}.`);
