/**
 * Migration #3578 L5 — la disponibilité saisonnière `cargoes[].avail.<saison>` (une fourchette d100 portée par
 * l'ENTITÉ) devient les documents TABLE de `cargaisons-aleatoires.json`, famille `entite`, au patron de la
 * migration L4 (`2026-11-11-3578-especes-aleatoires.mjs`) : un document par colonne saisonnière imprimée, une
 * rangée `{ id, min, max }` qui désigne la cargaison, dans l'ordre des bornes, dé `d100`.
 *
 *   id                            source                    colonne
 *   `cargaisons-mer-<saison>`     MDG 15 l.404-418          Printemps / Été / Automne / Hiver (en-tête l.406)
 *   `cargaisons-terre-<saison>`   MSRC 13 l.69-78           une ligne par saison (l.75 / 76 / 77 / 78)
 *
 * Entrées : src/data/cargoes.json (lue et écrite : `avail` retiré), src/data/cargaisons-aleatoires.json (écrite).
 *
 * FORME D'AVANT SEULE : un `cargoes.json` dont aucune entrée ne porte `avail` est laissé tel quel (rejeu sur
 * l'arbre migré : no-op byte-identique). ARRÊT nominatif (exit 1), AUCUNE écriture : un fichier non canonique,
 * `cargaisons-aleatoires.json` déjà présent alors que `cargoes.json` porte encore `avail`, un marqueur
 * (`echangeable: false`) qui porte `avail`, une marchandise sans `avail` ou à qui manque une saison, une colonne
 * dont les rangées ne couvrent pas 1-100 d'un seul tenant.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CARGOES = join(ROOT, 'src/data/cargoes.json');
const TABLE = join(ROOT, 'src/data/cargaisons-aleatoires.json');

const SAISONS = [
  ['printemps', 'Printemps', 75],
  ['ete', 'Été', 76],
  ['automne', 'Automne', 77],
  ['hiver', 'Hiver', 78],
];
const VOIES = {
  mer: {
    label: (s) => `Tableau des cargaisons maritimes — ${s}`,
    source: (s) => ({ book: 'mer-des-griffes', page: 137, note: `ch.15 « Longs voyages » — Générer les cargaisons disponibles, colonne ${s} (l.404-418).` }),
  },
  terre: {
    label: (s) => `Tableau des cargaisons aléatoires terrestres — ${s}`,
    source: (s, l) => ({ book: 'mort-sur-le-reik-compagnon', page: 72, note: `ch.11 « Règles du commerce » — TABLEAU DES CARGAISONS ALÉATOIRES, ligne ${s} (l.69-73, l.${l}).` }),
  },
};

const arrets = [];
const brut = readFileSync(CARGOES, 'utf8');
const cargoes = JSON.parse(brut);
const porteurs = cargoes.filter((c) => 'avail' in c);
if (brut !== serializeDataset(cargoes)) arrets.push('cargoes.json : forme non canonique');
if (porteurs.length) {
  if (existsSync(TABLE)) arrets.push('cargaisons-aleatoires.json : déjà présent alors que cargoes.json porte encore `avail`');
  for (const c of cargoes) {
    if (c.echangeable === false && 'avail' in c) arrets.push(`cargoes.json › ${c.id} : un marqueur porte \`avail\``);
    if (c.echangeable !== false && !('avail' in c)) arrets.push(`cargoes.json › ${c.id} : une marchandise sans \`avail\``);
  }
  const documents = [];
  for (const [voie, v] of Object.entries(VOIES)) {
    for (const [saison, libelle, ligne] of SAISONS) {
      const entries = [];
      for (const c of porteurs.filter((p) => p.voie === voie)) {
        const f = c.avail[saison];
        if (!f) arrets.push(`cargoes.json › ${c.id} : aucune fourchette en ${saison}`);
        else entries.push({ id: c.id, min: f.min, max: f.max });
      }
      entries.sort((a, b) => a.min - b.min);
      let attendu = 1;
      for (const r of entries) {
        if (r.min !== attendu) arrets.push(`${voie} › ${saison} : « ${r.id} » commence à ${r.min} au lieu de ${attendu}`);
        attendu = r.max + 1;
      }
      if (attendu !== 101) arrets.push(`${voie} › ${saison} : la colonne s'arrête à ${attendu - 1} au lieu de 100`);
      documents.push({ id: `cargaisons-${voie}-${saison}`, type: 'cargaisons-aleatoires', label: v.label(libelle), voie, saison, die: 'd100', source: v.source(libelle, ligne), entries });
    }
  }
  if (!arrets.length) {
    writeFileSync(TABLE, serializeDataset(documents), 'utf8');
    writeFileSync(CARGOES, serializeDataset(cargoes.map(({ avail: _avail, ...c }) => c)), 'utf8');
    console.log(`migration 3578 L5 : ${documents.length} document(s) écrits dans cargaisons-aleatoires.json, \`avail\` retiré de ${porteurs.length} cargaison(s).`);
  }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
if (!porteurs.length) console.log('migration 3578 L5 : aucun `avail` dans cargoes.json, rien à faire.');
