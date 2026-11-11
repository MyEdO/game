/**
 * Migration #1684 — les catalogues de cargaisons maritime (`sea-cargo.json`, MDG 15) et terrestre
 * (`land-cargo.json`, MSRC 13) ne partagent plus aucun id : chaque id que les deux portaient prend le
 * suffixe de son livre, et le Vin terrestre prend le nom imprimé de sa colonne.
 *
 *   maritime   `produits-de-luxe` → `produits-de-luxe-mer`  (MDG 15 l.410, l.426)
 *              `bois`             → `bois-mer`              (MDG 15 l.412, l.428)
 *              `laine`            → `laine-mer`             (MDG 15 l.414, l.430)
 *              `commerce`         → `commerce-mer`          (MDG 15 l.321)
 *   terrestre  `produits-de-luxe` → `produits-de-luxe-terre` (MSRC 13 l.73, l.117)
 *              `bois`             → `bois-terre`            (MSRC 13 l.73, l.111)
 *              `laine`            → `laine-terre`           (MSRC 13 l.73, l.113)
 *              `commerce`         → `commerce-terre`        (MSRC 13 l.24, l.28)
 *              `vin`              → `vin-eau-de-vie`        (MSRC 13 l.73, l.84, l.121)
 *
 * Le Vin maritime garde `vin` (MDG 15 l.413, l.429). Les références suivent leur catalogue :
 * `naval-ports.json` (`production`, clés de `surplus` et `demande`) vers le maritime, `land-cargo.json
 * › rumeurs[].biens` vers le terrestre. Renommage EN PLACE : une entrée, une référence ou une clé garde
 * son rang. Un id absent n'est pas renommé. Un catalogue absent est toléré (doctrine #3080) : il a
 * quitté son document pour `cargoes.json` (`2026-11-05-1684-un-catalogue-des-cargaisons.mjs`).
 *
 * Entrées : src/data/sea-cargo.json, src/data/land-cargo.json, src/data/naval-ports.json.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : aucun id ancien ne reste ni au catalogue ni dans une référence, et
 * les ids d'un catalogue sont distincts. Aucun cardinal. Vrai sur l'arbre d'avant comme au rejeu (no-op
 * byte-identique). Tout écart, tout id ancien dont le nouveau existe déjà au catalogue ou tout document
 * non canonique est un ARRÊT nominatif (exit 1), AUCUNE écriture.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const MER = new Map([
  ['produits-de-luxe', 'produits-de-luxe-mer'],
  ['bois', 'bois-mer'],
  ['laine', 'laine-mer'],
  ['commerce', 'commerce-mer'],
]);
const TERRE = new Map([
  ['produits-de-luxe', 'produits-de-luxe-terre'],
  ['bois', 'bois-terre'],
  ['laine', 'laine-terre'],
  ['commerce', 'commerce-terre'],
  ['vin', 'vin-eau-de-vie'],
]);

const renomme = (table, id) => table.get(id) ?? id;

/** Les clés d'un objet renommées en place. */
function renommerCles(table, objet) {
  const copie = Object.entries(objet);
  for (const k of Object.keys(objet)) delete objet[k];
  for (const [k, v] of copie) objet[renomme(table, k)] = v;
}

function renommerCatalogue(table, doc, fichier, arrets) {
  const ids = new Set((doc.cargoes ?? []).map((c) => c.id));
  for (const c of doc.cargoes ?? []) {
    const neuf = table.get(c.id);
    if (neuf && ids.has(neuf)) arrets.push(`${fichier} › cargoes : \`${c.id}\` et \`${neuf}\` coexistent`);
    else if (neuf) c.id = neuf;
  }
}

/** Les rumeurs de `land-cargo.json` : le tableau à l'écriture de cette migration, `rumeurs.entries` sous
 *  la forme que `2026-11-06-1667-tables-tirees-nichees.mjs` pose — une migration ANTÉRIEURE dans l'ordre
 *  lexical reconnaît la forme qu'une POSTÉRIEURE produit. */
const rumeursDe = (doc) => (Array.isArray(doc.rumeurs) ? doc.rumeurs : doc.rumeurs.entries);

const DOCUMENTS = {
  'sea-cargo.json': (doc, f, arrets) => renommerCatalogue(MER, doc, f, arrets),
  'land-cargo.json': (doc, f, arrets) => {
    renommerCatalogue(TERRE, doc, f, arrets);
    for (const r of rumeursDe(doc)) r.biens = r.biens.map((id) => renomme(TERRE, id));
  },
  'naval-ports.json': (ports) => {
    for (const p of ports) {
      if (p.production) p.production = p.production.map((id) => renomme(MER, id));
      if (p.surplus) renommerCles(MER, p.surplus);
      if (p.demande) renommerCles(MER, p.demande);
    }
  },
};

/** Les ids anciens que porte encore le document, nommés par leur chemin. */
const RESTES = {
  'sea-cargo.json': (doc) => (doc.cargoes ?? []).filter((c) => MER.has(c.id)).map((c) => `cargoes › ${c.id}`),
  'land-cargo.json': (doc) => [
    ...(doc.cargoes ?? []).filter((c) => TERRE.has(c.id)).map((c) => `cargoes › ${c.id}`),
    ...rumeursDe(doc).flatMap((r, i) => r.biens.filter((id) => TERRE.has(id)).map((id) => `rumeurs[${i}].biens › ${id}`)),
  ],
  'naval-ports.json': (ports) => ports.flatMap((p) => [
    ...(p.production ?? []).filter((id) => MER.has(id)).map((id) => `${p.id}.production › ${id}`),
    ...Object.keys(p.surplus ?? {}).filter((id) => MER.has(id)).map((id) => `${p.id}.surplus › ${id}`),
    ...Object.keys(p.demande ?? {}).filter((id) => MER.has(id)).map((id) => `${p.id}.demande › ${id}`),
  ]),
};

const arrets = [];
const ecritures = [];
for (const [fichier, migrer] of Object.entries(DOCUMENTS)) {
  const chemin = join(ROOT, 'src/data', fichier);
  const brut = readFileSync(chemin, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) { arrets.push(`${fichier} : forme non canonique`); continue; }
  migrer(doc, fichier, arrets);
  for (const reste of RESTES[fichier](doc)) arrets.push(`${fichier} : id ancien ${reste}`);
  if (doc.cargoes) {
    const ids = doc.cargoes.map((c) => c.id);
    for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) arrets.push(`${fichier} › cargoes : \`${id}\` en double`);
  }
  const out = serializeDataset(doc);
  if (out !== brut) ecritures.push([chemin, fichier, out]);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
for (const [chemin, , out] of ecritures) writeFileSync(chemin, out, 'utf8');
console.log(`migration 1684 : ${ecritures.length} document(s) réécrit(s)${ecritures.length ? ` (${ecritures.map(([, f]) => f).join(', ')})` : ''}.`);
