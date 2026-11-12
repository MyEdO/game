/**
 * Migration #1652 lot 13a — les vivres de la cale sont typés : `sea-navigation.json` les liste dans l'ordre où
 * l'équipage les mange, et chaque op `provisions` qui en ajoute nomme son vivre.
 *
 *   cible                              geste
 *   `sea-navigation` `longsVoyages`    `rationDeCale` → `vivresDeCale` : le frais, la nourriture préservée, les
 *                                      biscuits de mer ; `maison` : l'ordre, le périssable d'abord   MDG 14 l.238, l.263
 *   `vaisseau-de-pestiferes`           `provisions` `rations` → `ration-biscuits-de-mer`               MDG 15 l.194
 *   `ile-inconnue`                     `provisions` `jours` → `nourriture-courses-journee`             MDG 15 l.223
 *   `manne-de-manann`                  `provisions` `jours` → `nourriture-courses-journee`             MDG 15 l.235-236
 *   `port-desert`                      `provisions` `jours` → `ration-nourriture-preservee`, `maison`  MDG 15 l.249
 *
 * Valeurs MAISON, sur la consigne de l'utilisateur du 2026-11-07 : l'ordre de consommation, et le vivre du butin
 * du port désert, que MDG 15 l.249 ne type pas.
 *
 * Entrées : src/data/sea-events.json, src/data/sea-navigation.json. Une rangée nommée absente, comme un
 * `longsVoyages` absent, n'est pas une anomalie : la migration rejouée après sa suppression sort 0 sans écrire.
 *
 * FORME ASSERTÉE SUR LE RÉSULTAT : une op `provisions` hors de la forme attendue ou un document non canonique sont
 * un ARRÊT nominatif (exit 1), AUCUNE écriture. Rejouée sur l'arbre migré : no-op byte-identique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SEA = join(ROOT, 'src/data/sea-events.json');
const NAV = join(ROOT, 'src/data/sea-navigation.json');
const CONSIGNE = 'consigne utilisateur 2026-11-07';

const FRAIS = 'nourriture-courses-journee';
const PRESERVEE = 'ration-nourriture-preservee';
const BISCUITS = 'ration-biscuits-de-mer';
const VIVRES_DE_CALE = [{ id: FRAIS }, { id: PRESERVEE }, { id: BISCUITS }];
const MAISON_DES_VIVRES = `L'équipage mange les vivres de la cale dans l'ordre de la liste, le périssable d'abord (MDG 14 l.238, l.263) (${CONSIGNE}).`;
const MAISON_DU_PORT_DESERT = `Le butin : 1d10 jours de vivres (l.235), de la nourriture préservée (l.249 ne type pas les provisions), et 1d100 Enc de cargaison (l.209) (${CONSIGNE}).`;
const MAISON_DU_PORT_DESERT_AVANT = `Le butin : 1d10 jours de vivres (l.235) et 1d100 Enc de cargaison (l.209) (${CONSIGNE}).`;

/** Rangée → [champ de quantité, vivre]. */
const VIVRE_DE_LA_RANGEE = {
  'vaisseau-de-pestiferes': ['rations', BISCUITS],
  'ile-inconnue': ['jours', FRAIS],
  'manne-de-manann': ['jours', FRAIS],
  'port-desert': ['jours', PRESERVEE],
};

const arrets = [];
let gestes = 0;

const brut = readFileSync(SEA, 'utf8');
const sea = JSON.parse(brut);
const navBrut = readFileSync(NAV, 'utf8');
const nav = JSON.parse(navBrut);
if (brut !== serializeDataset(sea)) arrets.push('sea-events.json : forme non canonique');
if (navBrut !== serializeDataset(nav)) arrets.push('sea-navigation.json : forme non canonique');

/** Les ops `provisions` de l'arbre `n`. */
function opsDeProvisions(n, acc = []) {
  if (Array.isArray(n)) for (const x of n) opsDeProvisions(x, acc);
  else if (n && typeof n === 'object') {
    if (n.op === 'provisions') acc.push(n);
    for (const v of Object.values(n)) opsDeProvisions(v, acc);
  }
  return acc;
}

/** Réécrit `objet` avec `cle: valeur` inséré juste après `apres`. */
function insererApres(objet, apres, cle, valeur) {
  const copie = Object.entries(objet);
  for (const k of Object.keys(objet)) delete objet[k];
  for (const [k, v] of copie) { objet[k] = v; if (k === apres) objet[cle] = valeur; }
}

if (!arrets.length) {
  for (const table of ['boardEvents', 'portEvents']) {
    for (const e of sea[table]?.entries ?? []) {
      const attendu = VIVRE_DE_LA_RANGEE[e.id];
      const ops = opsDeProvisions(e.consequence);
      for (const o of ops) {
        if (o.jours === undefined && o.rations === undefined) continue;
        const ou = `sea-events.json ${table} « ${e.id} »`;
        if (!attendu) { if (o.vivre === undefined) arrets.push(`${ou} : op provisions sans vivre attendu`); continue; }
        const [champ, vivre] = attendu;
        if (o[champ] === undefined) arrets.push(`${ou} : op provisions sans « ${champ} »`);
        else if (o.vivre === undefined) { insererApres(o, champ, 'vivre', { id: vivre }); gestes++; }
        else if (o.vivre.id !== vivre) arrets.push(`${ou} : vivre « ${o.vivre.id} » ≠ « ${vivre} »`);
      }
      if (e.id === 'port-desert' && e.maison === MAISON_DU_PORT_DESERT_AVANT) { e.maison = MAISON_DU_PORT_DESERT; gestes++; }
    }
  }

  const longs = nav.longsVoyages;
  if (longs && longs.vivresDeCale === undefined) {
    if (longs.rationDeCale === undefined) arrets.push('sea-navigation.json longsVoyages : ni rationDeCale ni vivresDeCale');
    else { insererApres(longs, 'rationDeCale', 'vivresDeCale', structuredClone(VIVRES_DE_CALE)); gestes++; }
  }
  if (longs && longs.rationDeCale !== undefined) { delete longs.rationDeCale; longs.maison = MAISON_DES_VIVRES; gestes++; }
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}
const out = serializeDataset(sea);
if (out !== brut) writeFileSync(SEA, out, 'utf8');
const navOut = serializeDataset(nav);
if (navOut !== navBrut) writeFileSync(NAV, navOut, 'utf8');
console.log(`migration 1652 (vivres de cale) : ${gestes} geste(s)${out !== brut ? ', sea-events.json réécrit' : ''}${navOut !== navBrut ? ', sea-navigation.json réécrit' : ''}.`);
