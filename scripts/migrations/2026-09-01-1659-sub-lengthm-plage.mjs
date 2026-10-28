/**
 * Migration #1659 L-1659-3 (vague `plage-en-tuple`) — les deux dernières paires de bornes écrites en
 * TUPLE passent à la FOURCHETTE :
 *
 *   `stars.json            › [].sub`               `[a, b]` → `{ min: a, max: b }`
 *   `ship-construction.json › standard[].lengthM`  `[a, b]` → `{ min: a, max: b }`
 *
 * Les bornes étaient encodées par POSITION (`e.sub[0]`/`[1]`, `row.lengthM[1]`), donc invisibles au
 * Codex comme au lookup partagé. Elles deviennent celles que `findTableEntry` (`src/engine/tables.ts`)
 * lit.
 *
 * SOUS-TIRAGE ASTRAL — `Source/Warhammer v4 - Les archives de l'Empire volume 2/03 - Des signes dans
 * le ciel.md` l.63 :
 *   « | 96-00 | L'Étoile du Sorcier | Lancez un 1d10<br>1-3 : Vous gagnez un niveau dans le Talent
 *     Sixième sens<br>4-6 : Vous gagnez un niveau dans le Talent Seconde vue, -3 Force<br>7-9 : Vous
 *     gagnez un niveau dans le Talent Magie mineure, -3 Force<br>10 : Vous gagnez un niveau dans le
 *     Talent Sorcier !, -5 Force | »
 *   Quatre variantes, 1d10 couvert de 1 à 10.
 *
 * TAILLES DE COQUE — `Source/WH - V4 - La Mer de Griffe/12 - Navires et construction navale.md`
 * l.122-129, colonne « Taille » du tableau CARACTÉRISTIQUES DE BATEAU STANDARD :
 *   « | Minuscule | … | 1-10 | … | Très Petite | … | 11-15 | … | Petite | … | 16-20 | …
 *     | Moyenne | … | 21-35 | … | Grande | … | 36-50 | … | Énorme | … | 51-80 | …
 *     | Monstrueuse | … | 81+ | … »
 *   Sept bandes, la DERNIÈRE sans plafond : le `130` que la donnée portait n'est imprimé NULLE PART
 *   (règle stricte 1) — il devient `max: null` (`plageOuverteSchema`, la graphie du « et plus » que
 *   JSON n'a pas d'Infinity pour dire).
 *
 * FORME D'AVANT SEULE : seul un champ encore TUPLE se convertit ; une entrée absente, ou déjà en
 * fourchette (migrée, ou révisée depuis), est laissée telle quelle.
 *
 * CARDINAL ASSERTÉ SUR CE QUI EST CONVERTI : une table dont un tuple se convertit doit sortir
 * entière en fourchettes (4 sous-tirages, 7 tailles de coque), chaque borne ÉGALE à ce que le livre
 * imprime (tables `ATTENDU_*` ci-dessous, transcrites des lignes citées), le 1d10 couvert de 1 à 10
 * d'un seul tenant et les longueurs couvertes depuis 1 jusqu'à la bande OUVERTE ; tout écart est un
 * ARRÊT (exit 1).
 *
 * ENTRÉES : `src/data/stars.json`, `src/data/ship-construction.json` (seuls documents lus et écrits).
 * IDEMPOTENT : rejouée, elle ne voit plus aucun tuple et n'écrit rien.
 * FORMATAGE : `JSON.stringify(doc, null, 2)`, vérifié canonique AVANT toute écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ETOILES = path.join(ROOT, 'src/data/stars.json');
const COQUES = path.join(ROOT, 'src/data/ship-construction.json');

/** Les deux tables sont CLOSES au livre : un 1d10 à 4 branches, sept bandes de Taille. Leur référence
 *  NUE voyage avec chaque refus — c'est elle qui dit qu'un cardinal vient du LIVRE, pas d'un péage. */
const REF_SUB = 'ADE II 03 l.63';
const REF_LENGTH = 'MDG 12 l.122-129';

/** Sous-tirages attendus au RÉSULTAT (ADE II 03 l.63), `id` → `[min, max]` du 1d10. */
const ATTENDU_SUB = {
  'l-etoile-du-sorcier-sixieme-sens': [1, 3],
  'l-etoile-du-sorcier-seconde-vue': [4, 6],
  'l-etoile-du-sorcier-magie-mineure': [7, 9],
  'l-etoile-du-sorcier-sorcier': [10, 10],
};

/** Longueurs attendues au RÉSULTAT (MDG 12 l.123-129), `id` → `[min, max]` en mètres ; `null` = « + ». */
const ATTENDU_LENGTH = {
  minuscule: [1, 10],
  'tres-petite': [11, 15],
  petite: [16, 20],
  moyenne: [21, 35],
  grande: [36, 50],
  enorme: [51, 80],
  monstrueuse: [81, null],
};

const arrets = [];

/** Lit un document en refusant toute forme non canonique. */
function lire(fichier) {
  const brut = fs.readFileSync(fichier, 'utf8');
  const doc = JSON.parse(brut);
  if (brut !== serializeDataset(doc)) {
    console.error(`FORME NON CANONIQUE — ${path.relative(ROOT, fichier)} ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { brut, doc };
}

const etoiles = lire(ETOILES);
const coques = lire(COQUES);

/**
 * Convertit un champ TUPLE en fourchette, en place. Rend 1 si une conversion a eu lieu.
 * @param {object} porteur entrée qui porte le champ
 * @param {string} champ nom du champ (`sub`, `lengthM`)
 * @param {string} nom nom du site, pour les arrêts
 * @param {number|null} plafond borne haute à POSER au résultat (`null` = bande ouverte)
 */
function enFourchette(porteur, champ, nom, plafond) {
  const cellule = porteur[champ];
  if (!Array.isArray(cellule)) return 0;
  if (cellule.length !== 2 || !cellule.every((v) => typeof v === 'number')) {
    arrets.push(`${nom} : ${JSON.stringify(cellule)} n'est pas une paire de nombres`);
    return 0;
  }
  porteur[champ] = { min: cellule[0], max: plafond };
  return 1;
}

/** CONSTAT sur le RÉSULTAT : la fourchette lue au document, confrontée à ce que le livre imprime. */
function confronter(entrees, champ, attendu, nom, ref) {
  let conformes = 0;
  for (const e of entrees.filter((x) => attendu[x.id])) {
    const f = e[champ];
    const [min, max] = attendu[e.id];
    if (!f || typeof f !== 'object' || Array.isArray(f) || typeof f.min !== 'number' || !(typeof f.max === 'number' || f.max === null)) {
      arrets.push(`${nom} › ${e.id} : ${JSON.stringify(f)} hors forme \`{min, max}\``);
      continue;
    }
    if (f.min !== min || f.max !== max) {
      arrets.push(`${nom} › ${e.id} : ${f.min}–${f.max ?? '+'}, le livre imprime ${min}–${max ?? '+'} — ${ref}`);
      continue;
    }
    conformes++;
  }
  return conformes;
}

/** COUVERTURE d'une suite de fourchettes : d'un seul tenant depuis `depuis` (0 trou, 0 chevauchement). */
function couverture(entrees, champ, nom, depuis, jusqua, ref) {
  const bandes = entrees
    .map((e) => ({ id: e.id, f: e[champ] }))
    .filter((b) => b.f && typeof b.f.min === 'number')
    .sort((a, b) => a.f.min - b.f.min);
  let attenduMin = depuis;
  for (const [i, b] of bandes.entries()) {
    if (b.f.min !== attenduMin) arrets.push(`${nom} : « ${b.id} » commence à ${b.f.min} au lieu de ${attenduMin} — ${ref}`);
    if (i === bandes.length - 1 && jusqua === 'ouverte') {
      if (b.f.max !== null) arrets.push(`${nom} : « ${b.id} » est la DERNIÈRE et porte un plafond (${b.f.max}) — le livre imprime « 81+ », ${ref}`);
      return;
    }
    if (typeof b.f.max !== 'number') {
      arrets.push(`${nom} : « ${b.id} » n'a pas de borne haute — ${ref}`);
      return;
    }
    attenduMin = b.f.max + 1;
  }
  if (jusqua !== 'ouverte' && attenduMin !== jusqua + 1) {
    arrets.push(`${nom} : la suite s'arrête à ${attenduMin - 1} au lieu de ${jusqua} — ${ref}`);
  }
}

/** Une entrée à la forme SOURCE (tuple) absente de la table imprimée (`ref`) : ce passage ne sait pas la migrer. */
const sourceInconnue = (entrees, champ, attendu, nom, ref) => {
  for (const e of entrees)
    if (Array.isArray(e[champ]) && !attendu[e.id])
      arrets.push(`${nom} › ${e.id} : tuple à migrer, ABSENT de la table imprimée — ${ref}`);
};

const variantes = etoiles.doc.filter((e) => e.sub !== undefined);
sourceInconnue(variantes, 'sub', ATTENDU_SUB, 'stars.json › [].sub', REF_SUB);
let migresSub = 0;
for (const e of variantes) migresSub += enFourchette(e, 'sub', `stars.json › ${e.id}.sub`, Array.isArray(e.sub) ? e.sub[1] : null);

const coquesStandard = coques.doc.standard ?? [];
sourceInconnue(coquesStandard, 'lengthM', ATTENDU_LENGTH, 'ship-construction.json › standard[].lengthM', REF_LENGTH);
let migresLength = 0;
for (const r of coquesStandard) {
  const plafond = ATTENDU_LENGTH[r.id]?.[1] ?? null;
  migresLength += enFourchette(r, 'lengthM', `ship-construction.json › standard[${r.id}].lengthM`, plafond);
}

const conformesSub = migresSub ? confronter(variantes, 'sub', ATTENDU_SUB, 'stars.json › [].sub', REF_SUB) : 0;
const conformesLength = migresLength
  ? confronter(coquesStandard, 'lengthM', ATTENDU_LENGTH, 'ship-construction.json › standard[].lengthM', REF_LENGTH)
  : 0;
if (migresSub) {
  couverture(variantes.filter((e) => ATTENDU_SUB[e.id]), 'sub', 'stars.json › le 1d10 de l\'Étoile du Sorcier', 1, 10, REF_SUB);
  if (conformesSub !== 4) arrets.push(`CARDINAL : ${conformesSub} sous-tirage(s) astral(aux) au résultat, attendu 4 — ${REF_SUB}`);
}
if (migresLength) {
  couverture(coquesStandard.filter((r) => ATTENDU_LENGTH[r.id]), 'lengthM', 'ship-construction.json › la colonne Taille', 1, 'ouverte', REF_LENGTH);
  if (conformesLength !== 7) arrets.push(`CARDINAL : ${conformesLength} taille(s) de coque au résultat, attendu 7 — ${REF_LENGTH}`);
}

if (arrets.length) {
  console.error(`ARRÊT — ${arrets.length} anomalie(s), AUCUNE écriture :`);
  for (const a of arrets) console.error(`  ${a}`);
  process.exit(1);
}

let ecrits = 0;
for (const [fichier, etat, migres, quoi] of [
  [ETOILES, etoiles, migresSub, 'sous-tirage(s) astral(aux)'],
  [COQUES, coques, migresLength, 'taille(s) de coque'],
]) {
  const rel = path.relative(ROOT, fichier).replace(/\\/g, '/');
  const out = serializeDataset(etat.doc);
  if (out === etat.brut) { console.log(`${rel} — INCHANGÉ (no-op byte-identique).`); continue; }
  if (out.includes('\r')) {
    console.error(`${fichier} : \\r dans le texte réécrit ; AUCUNE écriture.`);
    process.exit(1);
  }
  fs.writeFileSync(fichier, out, 'utf8');
  ecrits++;
  console.log(`${rel} — réécrit (${migres} ${quoi} passée(s) du tuple à la fourchette).`);
}
console.log(`Fourchettes converties et vérifiées : ${conformesSub} sous-tirage(s) + ${conformesLength} taille(s) de coque.`);
if (!ecrits) process.exit(0);
