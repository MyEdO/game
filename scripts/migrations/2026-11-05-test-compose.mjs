/**
 * Migration #3012 (#1463, L4 « Test ») — le Test re-tapé à plat dans un porteur compose la forme unique
 * du jet en donnée, `flowTestSchema` (`src/data/schemas/grammaire/mecanique.ts`), sous la clé `test` du
 * porteur ; les extensions du porteur (`onFail`, `totalDR`, `extendedDR`, `combatTest`, `fallM`…)
 * restent à côté.
 *
 * GESTE, par porteur de `CIBLES` : `skill`, `characteristic` (ou sa graphie `char`) et `difficulty`
 * quittent le porteur pour son `test`, dans l'ordre de `jetSchema` ; `test` prend le rang de la
 * première d'entre elles, les autres clés gardent le leur. Deux porteurs ont déjà un `test` :
 *  - `sea-cargo.json › opportunite` : son `test` rend `totalDR` et `maxAttempts` au porteur, juste
 *    après lui ;
 *  - `tavernGames.json › [].throwerPenalty` : sa `difficulty` entre dans son `test`.
 *
 * ENTRÉES : `src/data/miscast.json`, `src/data/sea-perils.json`, `src/data/sea-cargo.json`,
 * `src/data/steam-breakdown.json`, `src/data/tavernGames.json`, `src/data/incidents-monture.json` (les
 * seules données lues et écrites).
 * IDEMPOTENT : un porteur dont le `test` est déjà composé n'a aucun geste ; rejouée sur l'état final,
 * rien ne s'écrit.
 * FAIL-FAST — sortie 1 avant toute écriture : fichier hors de son formatage, porteur à la fois plat et
 * composé, ou ni l'un ni l'autre, et, au RÉSULTAT, un `test` qui ne nomme ni Compétence ni
 * Caractéristique, sans Difficulté, ou qui garde une clé plate.
 * FORMATAGE : `serializeDataset` (`src/data/serialize.ts`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Clés plates du jet, graphie d'avant → graphie de `jetSchema`, dans l'ordre de `jetSchema`. */
const JET = [['skill', 'skill'], ['characteristic', 'characteristic'], ['char', 'characteristic'], ['difficulty', 'difficulty']];
const CLES_PLATES = new Set(JET.map(([avant]) => avant));

/** Remplace les clés de `objet` par `entrees`, en place (l'objet garde son identité dans son parent). */
function reecrire(objet, entrees) {
  for (const k of Object.keys(objet)) delete objet[k];
  Object.assign(objet, Object.fromEntries(entrees));
}

/** Le jet plat de `porteur`, dans l'ordre de `jetSchema`. */
const jetPlat = (porteur) => Object.fromEntries(JET.filter(([avant]) => Object.hasOwn(porteur, avant)).map(([avant, apres]) => [apres, porteur[avant]]));

/** Porteur à jet PLAT → `{ test: jet, …extensions }`. Rend le nombre de gestes (0 ou 1). */
function composer(porteur, ou, fautes) {
  const plates = Object.keys(porteur).filter((k) => CLES_PLATES.has(k));
  if (Object.hasOwn(porteur, 'test')) {
    if (plates.length) fautes.push(`${ou} : \`test\` ET clé(s) plate(s) ${plates.join(', ')}`);
    return 0;
  }
  if (!plates.length) { fautes.push(`${ou} : ni \`test\` ni jet plat`); return 0; }
  const test = jetPlat(porteur);
  const entrees = [];
  for (const [k, v] of Object.entries(porteur)) {
    if (k === plates[0]) entrees.push(['test', test]);
    else if (!CLES_PLATES.has(k)) entrees.push([k, v]);
  }
  reecrire(porteur, entrees);
  return 1;
}

/** `opportunite` : `totalDR`/`maxAttempts` remontent du `test` au porteur, juste après lui. */
function remonterExtensions(porteur, ou, fautes) {
  const test = porteur.test;
  if (!test || typeof test !== 'object') { fautes.push(`${ou} : \`test\` absent`); return 0; }
  const extensions = ['totalDR', 'maxAttempts'].filter((k) => Object.hasOwn(test, k));
  if (!extensions.length) return 0;
  const deja = extensions.filter((k) => Object.hasOwn(porteur, k));
  if (deja.length) { fautes.push(`${ou} : ${deja.join(', ')} au \`test\` ET au porteur`); return 0; }
  const entrees = [];
  for (const [k, v] of Object.entries(porteur)) {
    entrees.push([k, v]);
    if (k === 'test') for (const e of extensions) entrees.push([e, test[e]]);
  }
  for (const e of extensions) delete test[e];
  reecrire(porteur, entrees);
  return 1;
}

/** `throwerPenalty` : la `difficulty` du porteur entre dans son `test`. */
function entrerDifficulte(porteur, ou, fautes) {
  if (!Object.hasOwn(porteur, 'difficulty')) return 0;
  if (Object.hasOwn(porteur.test ?? {}, 'difficulty')) { fautes.push(`${ou} : \`difficulty\` au porteur ET à son \`test\``); return 0; }
  reecrire(porteur.test, Object.entries({ ...jetPlat(porteur.test), difficulty: porteur.difficulty }));
  reecrire(porteur, Object.entries(porteur).filter(([k]) => k !== 'difficulty'));
  return 1;
}

/** Les porteurs d'un document, avec leur adresse. */
const porteurs = (liste, adresse) => liste.flatMap((p, i) => (p && typeof p === 'object' ? [[p, adresse(p, i)]] : []));

const CIBLES = [
  { rel: 'src/data/miscast.json', sites: (d) => [
    { geste: composer, porteurs: d.flatMap((t) => porteurs((t.entries ?? []).map((e) => e.test), (_p, i) => `${t.id} › entries[${t.entries[i].id}].test`)) },
  ] },
  { rel: 'src/data/sea-perils.json', sites: (d) => [
    { geste: composer, porteurs: [[d.tourbillonSwim, 'tourbillonSwim']] },
    { geste: composer, porteurs: porteurs(d.hazards.map((h) => h.freeTest), (_p, i) => `hazards[${d.hazards[i].id}].freeTest`) },
  ] },
  { rel: 'src/data/sea-cargo.json', sites: (d) => [{ geste: remonterExtensions, porteurs: [[d.opportunite, 'opportunite']] }] },
  { rel: 'src/data/steam-breakdown.json', sites: (d) => [
    { geste: composer, porteurs: d.flatMap((b) => porteurs(b.restart ?? [], (_p, i) => `${b.id} › restart[${i}]`)) },
  ] },
  { rel: 'src/data/tavernGames.json', sites: (d) => [
    { geste: composer, porteurs: d.flatMap((g) => porteurs(g.options ?? [], (_p, i) => `${g.id} › options[${i}]`)) },
    { geste: entrerDifficulte, porteurs: d.flatMap((g) => porteurs([g.throwerPenalty], () => `${g.id} › throwerPenalty`)) },
  ] },
  { rel: 'src/data/incidents-monture.json', sites: (d) => [
    { geste: composer, porteurs: porteurs(d.entries.map((e) => e.mount?.riderTest), (_p, i) => `entries[${d.entries[i].id}].mount.riderTest`) },
  ] },
];

/** Le `test` composé est-il à la forme du résultat ? Rend la faute, ou `null`. */
function horsForme(test) {
  if (!test || typeof test !== 'object') return '`test` absent';
  const plates = Object.keys(test).filter((k) => k === 'char');
  if (plates.length) return 'graphie `char` au `test`';
  if (test.skill === undefined && test.characteristic === undefined) return '`test` sans Compétence ni Caractéristique';
  if (test.difficulty === undefined) return '`test` sans Difficulté';
  return null;
}

const fautes = [];
const aEcrire = [];
const bilan = [];
for (const { rel, sites } of CIBLES) {
  const chemin = path.join(ROOT, rel);
  const texte = fs.readFileSync(chemin, 'utf8');
  const doc = JSON.parse(texte);
  if (serializeDataset(doc) !== texte) { fautes.push(`${rel} : formatage non canonique`); continue; }
  let gestes = 0;
  let objets = 0;
  for (const { geste, porteurs: liste } of sites(doc)) {
    for (const [porteur, ou] of liste) {
      objets++;
      gestes += geste(porteur, `${rel} › ${ou}`, fautes);
    }
  }
  for (const { porteurs: liste } of sites(doc)) {
    for (const [porteur, ou] of liste) {
      const faute = horsForme(porteur.test);
      if (faute) fautes.push(`${rel} › ${ou} : au résultat, ${faute}`);
      const plates = Object.keys(porteur).filter((k) => CLES_PLATES.has(k));
      if (plates.length) fautes.push(`${rel} › ${ou} : au résultat, clé(s) plate(s) ${plates.join(', ')} au porteur`);
    }
  }
  bilan.push(`${rel} : ${gestes} geste(s) sur ${objets} porteur(s)`);
  const sortie = serializeDataset(doc);
  if (sortie !== texte) aEcrire.push([chemin, sortie]);
}

if (fautes.length) {
  console.error(`ARRÊT — rien n'est écrit :\n${fautes.join('\n')}`);
  process.exit(1);
}
for (const [chemin, sortie] of aEcrire) fs.writeFileSync(chemin, sortie);
console.log(`migration 3012 test composé : ${aEcrire.length} fichier(s) réécrit(s).\n${bilan.join('\n')}`);
