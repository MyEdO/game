/**
 * Migration #1684 (fusion partielle #1463) — UN catalogue des cargaisons, la voie PORTÉE par l'entrée.
 *
 *   `sea-cargo.json  › cargoes[]`  → `cargoes.json[]`, `voie: 'mer'`
 *   `land-cargo.json › cargoes[]`  → `cargoes.json[]`, `voie: 'terre'`
 *
 * Les deux chapitres de règles restent dans leur fichier (MDG 15, MSRC 13 : deux livres, deux
 * barèmes) ; seul le catalogue déménage. Chaque entrée est recopiée telle quelle, enveloppe posée
 * (`type`, `voie`), sans toucher une valeur : id, disponibilité, prix et source passent à l'octet près.
 * Les ids des deux catalogues sont déjà distincts (`2026-11-05-1684-ids-de-cargaison-uniques.mjs`,
 * rejouée avant celle-ci) : aucune référence (`naval-ports.json`, `land-cargo.json › rumours[].biens`)
 * ne change.
 *
 * CITATION RACINE : privé de sa liste, `sea-cargo.json` est un objet de config unique ; il prend à la
 * racine la citation de son chapitre (MDG 15 l.309, folio 135), comme `river-navigation.json`.
 * `land-cargo.json` garde ses listes citées par entrée (`wineQuality`, `rumours`) et sa racine nue.
 *
 * ENTRÉES : `src/data/sea-cargo.json`, `src/data/land-cargo.json`, `src/data/cargoes.json` (créé s'il
 * manque) — seuls documents lus et écrits.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : ni `sea-cargo.json` ni `land-cargo.json` ne porte plus `cargoes` ;
 * chaque entrée de `cargoes.json` porte `type: 'cargoes'` et une voie `mer`/`terre`, et son id y est
 * unique. Aucun cardinal : une entrée retirée ou ajoutée depuis passe sans faute. Rejouée, la migration
 * ne voit plus de catalogue à déménager et n'écrit rien. Tout écart (id déjà présent au catalogue
 * d'arrivée, document non canonique) est un ARRÊT nominatif (exit 1), AUCUNE écriture.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const chemin = (fichier) => join(ROOT, 'src/data', fichier);

/** Le fichier source du catalogue de chaque voie. */
const SOURCES = { mer: 'sea-cargo.json', terre: 'land-cargo.json' };

const arrets = [];

/** Lit un document canonique ; `undefined` s'il manque et qu'il est facultatif. */
function lire(fichier, facultatif = false) {
  if (facultatif && !existsSync(chemin(fichier))) return undefined;
  const brut = readFileSync(chemin(fichier), 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) arrets.push(`${fichier} : forme non canonique`);
  return { brut, doc };
}

const sources = Object.fromEntries(Object.entries(SOURCES).map(([voie, fichier]) => [voie, lire(fichier)]));
const arrivee = lire('cargoes.json', true);
const catalogue = arrivee?.doc ?? [];

const deplacees = { mer: 0, terre: 0 };
for (const [voie, { doc }] of Object.entries(sources)) {
  if (!Object.hasOwn(doc, 'cargoes')) continue;
  for (const { id, label, ...reste } of doc.cargoes) {
    if (catalogue.some((e) => e.id === id)) {
      arrets.push(`${SOURCES[voie]} › cargoes « ${id} » : l'id est déjà au catalogue`);
      continue;
    }
    catalogue.push({ id, type: 'cargoes', label, voie, ...reste });
    deplacees[voie]++;
  }
  delete doc.cargoes;
}

/** MDG 15 l.309 */
const CITATION_MARITIME = {
  book: 'mer-des-griffes',
  page: 135,
  note: 'ch.15 « Longs voyages » — COMMERCE MARITIME (l.309-434).',
};
const maritime = sources.mer.doc;
if (!Object.hasOwn(maritime, 'source') && !Object.values(maritime).some((v) => Array.isArray(v))) maritime.source = CITATION_MARITIME;

// FORME SUR LE RÉSULTAT.
const vus = new Set();
for (const e of catalogue) {
  if (e.type !== 'cargoes') arrets.push(`cargoes.json « ${e.id} » : type « ${e.type} », attendu « cargoes »`);
  if (!(e.voie in SOURCES)) arrets.push(`cargoes.json « ${e.id} » : voie « ${e.voie} » hors de mer/terre`);
  if (vus.has(e.id)) arrets.push(`cargoes.json : id « ${e.id} » en double`);
  vus.add(e.id);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

const ecritures = [];
for (const [voie, fichier] of Object.entries(SOURCES)) {
  const out = serializeDataset(sources[voie].doc);
  if (out !== sources[voie].brut) ecritures.push([fichier, out]);
}
const outCatalogue = serializeDataset(catalogue);
if (catalogue.length && outCatalogue !== arrivee?.brut) ecritures.push(['cargoes.json', outCatalogue]);

for (const [fichier, out] of ecritures) writeFileSync(chemin(fichier), out, 'utf8');
console.log(
  `migration 1684 : ${deplacees.mer} entrée(s) maritime(s) + ${deplacees.terre} terrestre(s) déménagée(s), ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([f]) => f).join(', ')})` : ''}.`,
);
