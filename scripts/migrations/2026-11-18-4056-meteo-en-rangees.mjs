/**
 * Migration #4056 — les tableaux croisés de vent vivent dans leurs rangées, les axes de météo marine sont des références.
 *
 *   forme d'avant                                              forme d'après
 *   `sea-weather.json` `effetDuVent[force][aspect]`            `vents[].effet[aspect]` (rangée de la force)
 *   `sea-weather.json` `effetDuVentClinfoc[force][aspect]`     `vents[].effetClinfoc[aspect]`
 *   `sea-weather.json` `table.entries[].vent: "calme-plat"`    `{ "id": "calme-plat" }` (idem les trois autres axes)
 *   `river-navigation.json` `windEffect[force][direction]`     `windForces.entries[].effet[direction]`
 *   `sea-events.json` op `meteoImposee` `meteo.vent: "…"`      `{ "id": "…" }` (et `aggravation.meteo`)
 *
 * Le schéma de chaque document les juge au parse (`src/data/schemas/defs/sea-weather.ts`, `river-navigation.ts`,
 * `meteoImposeeSchema` de `src/data/schemas/grammaire/valeurs.ts`).
 *
 * Entrées : `src/data/sea-weather.json`, `src/data/river-navigation.json`, `src/data/sea-events.json` (ops `meteoImposee`).
 *
 * Une rangée sans cellule, une cellule sans rangée, un axe ni chaîne ni `{ id }` : ARRÊT nominatif (exit 1), AUCUNE
 * écriture. Un axe déjà `{ id }` et un document sans table croisée passent. Rejouée sur l'arbre migré : no-op
 * byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const AXES = ['precipitations', 'temperature', 'visibilite', 'vent'];

const arrets = [];
const gestes = new Map();
const compter = (fichier, n = 1) => gestes.set(fichier, (gestes.get(fichier) ?? 0) + n);

/** Le document sérialisé dans la forme de son texte d'origine : indentation de sa 2e ligne, saut final. */
function reserialise(doc, texte) {
  const indent = /^\n?[[{]\r?\n( +)/.exec(texte)?.[1].length ?? 2;
  return `${JSON.stringify(doc, null, indent)}${texte.endsWith('\n') ? '\n' : ''}`;
}

/** `entree` avec `champs` posés avant sa `source` (à la fin faute de `source`). */
function avantLaSource(entree, champs) {
  const sortie = {};
  for (const [c, v] of Object.entries(entree)) {
    if (c === 'source') Object.assign(sortie, champs);
    sortie[c] = v;
  }
  return 'source' in entree ? sortie : { ...sortie, ...champs };
}

/** Range dans chaque rangée de `rangees` sa cellule de `table` (champ `champ`) ; `table` doit couvrir exactement les rangées. */
function rangerLesCellules(rangees, tables, chemin, fichier) {
  const ids = rangees.map((r) => r.id);
  for (const [nom, table] of Object.entries(tables)) {
    for (const cle of Object.keys(table)) if (!ids.includes(cle)) arrets.push(`${fichier} : ${nom}.${cle} sans rangée dans ${chemin}`);
    for (const id of ids) if (!table[id]) arrets.push(`${fichier} : ${chemin} « ${id} » sans cellule dans ${nom}`);
  }
  return rangees.map((r) => avantLaSource(r, Object.fromEntries(Object.entries(tables).map(([nom, table]) => [champDe[nom], table[r.id]]))));
}
const champDe = { effetDuVent: 'effet', effetDuVentClinfoc: 'effetClinfoc', windEffect: 'effet' };

/** Les axes de `meteo` en références `{ id }`. */
function axesEnRefs(meteo, chemin, fichier) {
  for (const axe of AXES) {
    const v = meteo[axe];
    if (v === undefined || (typeof v === 'object' && v !== null && typeof v.id === 'string')) continue;
    if (typeof v !== 'string') { arrets.push(`${fichier} : ${chemin}.${axe} ni chaîne ni { id }`); continue; }
    meteo[axe] = { id: v };
    compter(fichier);
  }
}

const MIGRATIONS = {
  'sea-weather.json': (doc, fichier) => {
    doc.table.entries.forEach((r, i) => axesEnRefs(r, `table.entries[${i}]`, fichier));
    if (!doc.effetDuVent && !doc.effetDuVentClinfoc) return;
    const { effetDuVent, effetDuVentClinfoc } = doc;
    doc.vents = rangerLesCellules(doc.vents, { effetDuVent, effetDuVentClinfoc }, 'vents', fichier);
    delete doc.effetDuVent;
    delete doc.effetDuVentClinfoc;
    compter(fichier, doc.vents.length);
  },
  'river-navigation.json': (doc, fichier) => {
    if (!doc.windEffect) return;
    doc.windForces.entries = rangerLesCellules(doc.windForces.entries, { windEffect: doc.windEffect }, 'windForces.entries', fichier);
    delete doc.windEffect;
    compter(fichier, doc.windForces.entries.length);
  },
  'sea-events.json': (doc, fichier) => {
    const parcourir = (noeud, chemin) => {
      if (Array.isArray(noeud)) { noeud.forEach((v, i) => parcourir(v, `${chemin}[${i}]`)); return; }
      if (!noeud || typeof noeud !== 'object') return;
      if (noeud.op === 'meteoImposee') {
        if (noeud.meteo) axesEnRefs(noeud.meteo, `${chemin}.meteo`, fichier);
        if (noeud.aggravation?.meteo) axesEnRefs(noeud.aggravation.meteo, `${chemin}.aggravation.meteo`, fichier);
      }
      for (const [c, v] of Object.entries(noeud)) parcourir(v, `${chemin}.${c}`);
    };
    parcourir(doc, fichier);
  },
};

const ecritures = [];
for (const [fichier, migrer] of Object.entries(MIGRATIONS)) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== reserialise(doc, brut)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  migrer(doc, fichier);
  if (gestes.get(fichier)) ecritures.push(() => writeFileSync(chemin, reserialise(doc, brut)));
}

if (arrets.length) {
  console.error(`migration #4056 météo — ${arrets.length} arrêt(s), aucune écriture :\n  ${arrets.join('\n  ')}`);
  process.exit(1);
}
for (const ecrire of ecritures) ecrire();
for (const [fichier, n] of gestes) console.log(`migration #4056 météo — ${fichier} : ${n} geste(s).`);
