/**
 * Migration #1467 L1b V-P4 — `names.json` et `details.json` : les records keyés par LIBELLÉ d'espèce
 * passent à l'id `RaceKey`.
 *
 * MOTIF MESURÉ : deux records portaient encore le libellé français en CLÉ — `names.json` (7 banques
 * de noms, clé racine) et les 5 `texts.*.bySpecies` de `details.json` (surcharges d'aide par espèce).
 * Le code y accédait par un pont id→libellé (`RACE_KEY_LABEL`, `src/data/index.ts`), consommé par
 * `engine/names.poolOf` et `ui/compendium/registry.raceDetailSection`. Le pont MEURT avec cette
 * migration : les deux records se manipulent par `RaceKey` (`schemas/grammaire/valeurs.ts:290`).
 * Les VALEURS (pools de noms, textes d'aide) ne changent pas — seules les clés sont réécrites.
 *
 * TABLE DE CONVERSION : l'INVERSE exact de `RACE_KEY_LABEL` tel qu'il vivait à
 * `src/data/index.ts:2689-2692` (7 paires), recopiée ici car la migration ne dépend d'aucun module
 * du jeu — et le module d'origine disparaît dans le même lot.
 *
 * PORTEURS ET COMPTES MESURÉS :
 *  - `names.json` : 7 clés racine, exigées 7⟺7 (toute RaceKey présente, aucune clé étrangère) ;
 *  - `details.json` : `texts.nom.bySpecies` 7, `texts.age.bySpecies` 6, `texts.taille.bySpecies` 2,
 *    `texts.ambitionShort.bySpecies` 0, `texts.ambitionLong.bySpecies` 0 — records PARTIELS, aucun
 *    compte n'est exigé, seule l'appartenance de chaque clé à la table est vérifiée.
 *
 * ORDRE PRÉSERVÉ : chaque clé est réécrite à sa place (les entrées ne sont pas retriées).
 *
 * ENTRÉES : `src/data/names.json`, `src/data/details.json` (les seules données lues et écrites).
 *
 * PREUVE POST-ÉCRITURE : toute clé des records porteurs est une `RaceKey`, les 7 pools de `names` ET
 * les feuilles de texte de `details` (verbatim LDB 05) sont comparés AVANT/APRÈS, ordre compris.
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une clé déjà `RaceKey` est reconnue migrée ; rejouée sur
 * l'état final, la migration n'écrit rien et sort 0. DEUX FORMES de `names.json` sont admises :
 * forme LISTE (documents à `id`, #1467 L1b V-FLIP-RECORD) — la forme d'après, laissée telle quelle ;
 * forme RECORD (clés de racine, la forme d'avant) — les clés se convertissent. Un texte de `details` sans
 * `bySpecies` est laissé tel quel.
 * FAIL-FAST : clé inconnue (ni libellé de la table, ni `RaceKey`), collision de clés après
 * conversion, `names.json` RECORD dont l'ensemble des clés converties ne fait pas exactement les 7
 * `RaceKey` → rien n'est écrit (pour AUCUN des deux fichiers), sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Inverse de `RACE_KEY_LABEL` (src/data/index.ts:2689-2692 à 61ee08c48) : libellé → `RaceKey`. */
const RACE_KEY_PAR_LIBELLE = {
  Humain: 'humain',
  Halfling: 'halfling',
  Nain: 'nain',
  Gnome: 'gnome',
  Ogre: 'ogre',
  'Haut Elfe': 'haut-elfe',
  'Elfe Sylvain': 'elfe-sylvain',
};
/** Les 7 ids de `raceKeySchema` (schemas/grammaire/valeurs.ts:290). */
const RACE_KEYS = new Set(Object.values(RACE_KEY_PAR_LIBELLE));

const echecs = [];
let migrees = 0;
let dejaMigrees = 0;

/**
 * Réécrit les clés d'un record label→valeur en record RaceKey→valeur, ORDRE PRÉSERVÉ.
 * @param {Record<string, unknown>} rec record source
 * @param {string} ou chemin lisible du record (messages d'erreur)
 * @returns {Record<string, unknown>} record converti (identique si déjà migré)
 */
function convertir(rec, ou) {
  const sortie = {};
  for (const [cle, valeur] of Object.entries(rec)) {
    let neuve;
    if (RACE_KEYS.has(cle)) { neuve = cle; dejaMigrees++; }
    else if (RACE_KEY_PAR_LIBELLE[cle]) { neuve = RACE_KEY_PAR_LIBELLE[cle]; migrees++; }
    else {
      echecs.push(`${ou} : clé ${JSON.stringify(cle)} inconnue (ni libellé de la table, ni RaceKey)`);
      continue;
    }
    if (neuve in sortie) echecs.push(`${ou} : collision de clé sur ${JSON.stringify(neuve)}`);
    sortie[neuve] = valeur;
  }
  return sortie;
}

/** Lit un document et vérifie sa forme canonique. */
function lire(fichier) {
  const chemin = path.join(ROOT, fichier);
  const brut = fs.readFileSync(chemin, 'utf8');
  const data = JSON.parse(brut);
  if (serializeDataset(data) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    return null;
  }
  return { fichier, chemin, brut, data };
}

/** Ids de premier niveau de `names.json`, quelle que soit sa FORME : clés du record d'origine, ou
 *  `id` des 7 DOCUMENTS depuis #1467 L1b V-FLIP-RECORD (le fichier est devenu une LISTE). */
const idsDeNoms = (d) => (Array.isArray(d) ? d.map((e) => e?.id) : Object.keys(d));

// ── names.json RECORD : clés de racine converties, exigées 7⟺7 ─────────────────────────────────────────
const noms = lire('src/data/names.json');
let sortieNoms = noms?.data ?? null;
const nomsRecord = noms !== null && !Array.isArray(noms.data);
if (nomsRecord) {
  // FORME LISTE (#1467 L1b V-FLIP-RECORD) : la forme d'après, rendue telle quelle. FORME RECORD : les
  // clés de racine se convertissent.
  sortieNoms = convertir(noms.data, 'names.json');
  const cles = new Set(idsDeNoms(sortieNoms));
  const manquantes = [...RACE_KEYS].filter((k) => !cles.has(k));
  const etrangeres = [...cles].filter((k) => !RACE_KEYS.has(k));
  if (manquantes.length || etrangeres.length)
    echecs.push(`names.json : les clés ne font pas exactement les 7 RaceKey (manquantes : ${manquantes.join(', ') || 'aucune'} ; étrangères : ${etrangeres.join(', ') || 'aucune'})`);
}

// ── details.json : les `bySpecies` des 5 textes d'aide, records PARTIELS ─────────────────────────
const details = lire('src/data/details.json');
/** État AVANT conversion (les `bySpecies` sont réécrits EN PLACE ci-dessous). */
const avantDetails = details ? JSON.parse(details.brut) : null;
if (details) {
  const textes = details.data?.texts;
  if (textes && typeof textes === 'object') {
    for (const [nom, t] of Object.entries(textes)) {
      if (!t || typeof t !== 'object' || typeof t.bySpecies !== 'object' || t.bySpecies === null) continue;
      t.bySpecies = convertir(t.bySpecies, `details.json texts.${nom}.bySpecies`);
    }
  }
}

// Écriture TOUT OU RIEN : une anomalie sur un seul porteur laisse les deux fichiers intacts.
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture (les 2 fichiers restent intacts) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const plans = [
  { ...noms, out: serializeDataset(sortieNoms) },
  { ...details, out: serializeDataset(details.data) },
];
for (const p of plans) if (p.out !== p.brut) fs.writeFileSync(p.chemin, p.out, 'utf8');

// PREUVE post-écriture : toute clé des records porteurs est une RaceKey, les VALEURS sont conservées.
const apresNoms = JSON.parse(plans[0].out);
const apresDetails = JSON.parse(plans[1].out);
const rouges = [];
const horsEspace = nomsRecord ? idsDeNoms(apresNoms).filter((k) => !RACE_KEYS.has(k)) : [];
if (horsEspace.length) rouges.push(`names.json : clé(s) hors RaceKey ${horsEspace.join(', ')}`);
/** Les textes de `details` qui portent un `bySpecies` (les seuls que la migration convertit). */
const textesAEspeces = (d) => Object.entries(d?.texts ?? {}).filter(([, t]) => t && typeof t.bySpecies === 'object' && t.bySpecies !== null);
for (const [nom, t] of textesAEspeces(apresDetails)) {
  const hors = Object.keys(t.bySpecies).filter((k) => !RACE_KEYS.has(k));
  if (hors.length) rouges.push(`details.json texts.${nom}.bySpecies : clé(s) hors RaceKey ${hors.join(', ')}`);
}
const valeursNoms = (d) => (Array.isArray(d) ? d : Object.values(d)).map((p) => JSON.stringify(p)).join('|');
if (valeursNoms(noms.data) !== valeursNoms(apresNoms)) rouges.push('names.json : VALEURS altérées');
// Les FEUILLES de `details` (verbatim LDB 05) : même multi-ensemble avant/après, ordre compris —
// seules les clés changent, jamais un caractère de texte d'aide.
// Le document ENTIER est comparé, `bySpecies` réduit à ses VALEURS (seules les clés avaient le droit
// de bouger) : les formules d'Âge/Taille et les `all` sont couverts au même titre que les surcharges.
const sansCles = (d) => JSON.stringify(d, (k, v) => (k === 'bySpecies' && v && typeof v === 'object' ? Object.values(v) : v));
const feuilles = (d) => [
  ...textesAEspeces(d).flatMap(([, t]) => [t.all, ...Object.values(t.bySpecies)]),
  ...['ageBase', 'ageRoll', 'heightBase', 'heightRoll'].flatMap((c) => Object.values(d[c] ?? {})),
];
const avantFeuilles = feuilles(avantDetails);
const apresFeuilles = feuilles(apresDetails);
if (sansCles(avantDetails) !== sansCles(apresDetails))
  rouges.push(`details.json : le document diffère AILLEURS que dans les clés de \`bySpecies\` — VALEURS altérées`);
if (avantFeuilles.length !== apresFeuilles.length)
  rouges.push(`details.json : ${avantFeuilles.length} feuille(s) avant, ${apresFeuilles.length} après`);
if (rouges.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE :\n  ${rouges.join('\n  ')}`);
  process.exit(1);
}

console.log(`names.json + details.json — libellé → RaceKey : ${migrees} clé(s) ; déjà migrées (no-op) : ${dejaMigrees}`);
console.log(`names.json : ${idsDeNoms(apresNoms).length} banque(s), ids ${idsDeNoms(apresNoms).join(', ')} ; ${plans[0].out !== plans[0].brut ? 'réécrit' : 'INCHANGÉ'}`);
for (const [nom, t] of textesAEspeces(apresDetails))
  console.log(`  details.texts.${nom}.bySpecies : ${Object.keys(t.bySpecies).length} clé(s) [${Object.keys(t.bySpecies).join(', ')}]`);
console.log(`details.json : ${plans[1].out !== plans[1].brut ? 'réécrit' : 'INCHANGÉ'} ; ${apresFeuilles.length} feuille(s) de texte vérifiées identiques (ordre compris).`);
