/**
 * Migration #1463 L4 P2 — les deux tables encodées par la BORNE HAUTE SEULE reçoivent leur borne
 * BASSE, et rejoignent la fourchette PLATE `{min, max}` que `findTableEntry` (`src/engine/tables.ts`)
 * sait lire. Deux documents, 34 rangées :
 *   - `weather.json` › `seasons[].ranges` : 19 rangées `{max, weather}` → `{min, max, weather}` ;
 *   - `advancementCosts.json` : 15 bandes `{max}` → `{min, max}` (la dernière garde `max: null`).
 *
 * D'OÙ VIENNENT LES `min` — jamais de la POSITION dans le tableau. Chaque valeur est celle IMPRIMÉE
 * par la source, recopiée dans les tables `METEO` / `AUGMENTATIONS` ci-dessous :
 *   - météo : EDOC 08 l.52-59 (« Temps sec | 01-10 | 01-40 | 01-30 | - », etc.) ;
 *   - Augmentations : LDB 07 l.56-70 (« 0 à 5 », « 6 à 10 », … « 71 et + »).
 * La borne basse reconstruite par position aurait donné les mêmes chiffres ICI, et c'est justement ce
 * qui la rendait indétectable : une rangée réordonnée au Codex changeait la météo tirée sans un mot.
 *
 * `max: null` de la DERNIÈRE bande d'Augmentations : la source imprime « 71 et + » et pose l'absence
 * de plafond (LDB 07 l.49). La borne haute reste donc OUVERTE — on écrit `min: 71`, on n'invente
 * aucun plafond. Le consommateur (`src/engine/advancement.ts`) ouvre cette borne au moment du lookup.
 *
 * ENTRÉES : `src/data/weather.json` et `src/data/advancementCosts.json` — seules données lues/écrites.
 *
 * FORME D'AVANT SEULE : un document où aucune rangée ne manque de `min` (migré, ou révisé depuis) est
 * laissé tel quel, sans porte ; seul un document qui a encore une borne basse à poser passe la porte.
 *
 * PORTE DE FIDÉLITÉ (lecture SEULE, avant toute écriture) : pour chaque rangée, la migration exige
 * que le `max` OBSERVÉ soit celui que la source imprime, et que la charge utile identifiante soit la
 * bonne (`weather` pour la météo, `id` pour les Augmentations). Un `max` qui aurait dérivé, une
 * rangée ajoutée/retirée/réordonnée → sortie 1, rien n'est écrit : on ne pose pas une borne basse
 * sur une table qui n'est plus celle qu'on a lue au Source.
 *
 * IDEMPOTENT / NO-OP SÉMANTIQUE : le no-op se décide sur le CARDINAL de ce que ce script POSSÈDE —
 * la pose de la borne basse. Zéro `min` à poser dans un document = rien n'y est écrit et la sortie est
 * 0, quel que soit l'ordre des clés de ses rangées : `avecMin` replace la `min` déjà présente juste
 * avant `max`, et une égalité à l'octet ferait de cette normalisation une réécriture à elle seule.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`, vérifié AVANT
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Tableau de Météo, EDOC 08 l.52-59 — RECOPIE des fourchettes IMPRIMÉES, colonne par colonne
 * (« 00 » de la source = 100). Un tiret de la source = la météo est absente de cette saison, et elle
 * est absente de la liste ici.
 *
 *  | Météo            | Printemps | Été   | Automne | Hiver |
 *  | Temps sec        | 01-10     | 01-40 | 01-30   | -     |
 *  | Beau temps       | 11-30     | 41-70 | 31-60   | 01-10 |
 *  | Pluie            | 31-90     | 71-95 | 61-90   | 11-60 |
 *  | Pluie diluvienne | 91-95     | 96-00 | 91-98   | 61-65 |
 *  | Neige            | 96-00     | -     | 99-00   | 66-90 |
 *  | Blizzard         | -         | -     | -       | 91-00 |
 */
const METEO = {
  printemps: [
    { weather: 'sec', min: 1, max: 10 },
    { weather: 'beau', min: 11, max: 30 },
    { weather: 'pluie', min: 31, max: 90 },
    { weather: 'pluie-diluvienne', min: 91, max: 95 },
    { weather: 'neige', min: 96, max: 100 },
  ],
  ete: [
    { weather: 'sec', min: 1, max: 40 },
    { weather: 'beau', min: 41, max: 70 },
    { weather: 'pluie', min: 71, max: 95 },
    { weather: 'pluie-diluvienne', min: 96, max: 100 },
  ],
  automne: [
    { weather: 'sec', min: 1, max: 30 },
    { weather: 'beau', min: 31, max: 60 },
    { weather: 'pluie', min: 61, max: 90 },
    { weather: 'pluie-diluvienne', min: 91, max: 98 },
    { weather: 'neige', min: 99, max: 100 },
  ],
  hiver: [
    { weather: 'beau', min: 1, max: 10 },
    { weather: 'pluie', min: 11, max: 60 },
    { weather: 'pluie-diluvienne', min: 61, max: 65 },
    { weather: 'neige', min: 66, max: 90 },
    { weather: 'blizzard', min: 91, max: 100 },
  ],
};

/**
 * Tableau de Coût des Augmentations, LDB 07 l.56-70 — RECOPIE de la colonne « Augmentations ».
 * `max: null` = « 71 et + » : la source ne pose PAS de plafond (LDB 07 l.49).
 */
const AUGMENTATIONS = [
  { id: 'adv-0-5', min: 0, max: 5 },
  { id: 'adv-6-10', min: 6, max: 10 },
  { id: 'adv-11-15', min: 11, max: 15 },
  { id: 'adv-16-20', min: 16, max: 20 },
  { id: 'adv-21-25', min: 21, max: 25 },
  { id: 'adv-26-30', min: 26, max: 30 },
  { id: 'adv-31-35', min: 31, max: 35 },
  { id: 'adv-36-40', min: 36, max: 40 },
  { id: 'adv-41-45', min: 41, max: 45 },
  { id: 'adv-46-50', min: 46, max: 50 },
  { id: 'adv-51-55', min: 51, max: 55 },
  { id: 'adv-56-60', min: 56, max: 60 },
  { id: 'adv-61-65', min: 61, max: 65 },
  { id: 'adv-66-70', min: 66, max: 70 },
  { id: 'adv-71-plus', min: 71, max: null },
];

/** CARDINAUX attendus, mesurés sur l'arbre au moment de l'écriture (2026-08-31). */
const CARDINAUX = {
  'weather.json': { saisons: 4, rangees: 19 },
  'advancementCosts.json': { bandes: 15 },
};

const echecs = [];
const rapport = [];

const lire = (fichier) => {
  const cible = path.join(ROOT, 'src/data', fichier);
  const brut = fs.readFileSync(cible, 'utf8');
  const doc = JSON.parse(brut);
  if (serializeDataset(doc) !== brut) {
    echecs.push(`${fichier} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`)`);
    return null;
  }
  return { cible, brut, doc };
};

const meteo = lire('weather.json');
const augm = lire('advancementCosts.json');
if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

/** Les rangées sans `min` d'un document : la forme d'avant, seule à migrer. */
const rangeesDe = (s) => (Array.isArray(s?.ranges) ? s.ranges : []);
const meteoAPoser = (Array.isArray(meteo.doc.seasons) ? meteo.doc.seasons : [])
  .reduce((n, s) => n + rangeesDe(s).filter((r) => !('min' in r)).length, 0);
const augmAPoser = Array.isArray(augm.doc) ? augm.doc.filter((b) => !('min' in b)).length : 0;

// ---- PORTE DE FIDÉLITÉ : lecture SEULE, avant la moindre écriture.
{
  const ecarts = [];

  const saisons = meteo.doc.seasons;
  if (!meteoAPoser) {
    // forme d'après : rien à poser, rien à confronter.
  } else if (!Array.isArray(saisons) || saisons.length !== CARDINAUX['weather.json'].saisons) {
    ecarts.push(`weather.json : ${Array.isArray(saisons) ? saisons.length : 'non-tableau'} saison(s) ≠ ${CARDINAUX['weather.json'].saisons} — table CLOSE, EDOC 08 l.52-59`);
  } else {
    let rangees = 0;
    for (const s of saisons) {
      const raw = METEO[s.id];
      if (!raw) {
        ecarts.push(`weather.json : saison \`${s.id}\` inconnue de la source (EDOC 08 l.52-59)`);
        continue;
      }
      if (!Array.isArray(s.ranges) || s.ranges.length !== raw.length) {
        ecarts.push(`weather.json ${s.id} : ${s.ranges?.length} rangée(s) ≠ ${raw.length} imprimée(s)`);
        continue;
      }
      rangees += s.ranges.length;
      for (let i = 0; i < raw.length; i++) {
        const r = s.ranges[i];
        if (r.weather !== raw[i].weather) ecarts.push(`weather.json ${s.id}[${i}] : \`weather\` ${JSON.stringify(r.weather)} ≠ ${JSON.stringify(raw[i].weather)}`);
        if (r.max !== raw[i].max) ecarts.push(`weather.json ${s.id} ${raw[i].weather} : \`max\` ${JSON.stringify(r.max)} ≠ ${raw[i].max} (SOURCE)`);
        if ('min' in r && r.min !== raw[i].min) ecarts.push(`weather.json ${s.id} ${raw[i].weather} : \`min\` DÉJÀ POSÉ à ${JSON.stringify(r.min)} ≠ ${raw[i].min} (SOURCE)`);
      }
    }
    const attendu = Object.values(METEO).reduce((a, l) => a + l.length, 0);
    if (attendu !== CARDINAUX['weather.json'].rangees) ecarts.push(`table METEO : ${attendu} rangée(s) ≠ ${CARDINAUX['weather.json'].rangees} déclarée(s) — EDOC 08 l.52-59`);
    if (rangees && rangees !== CARDINAUX['weather.json'].rangees) ecarts.push(`weather.json : ${rangees} rangée(s) mesurée(s) ≠ ${CARDINAUX['weather.json'].rangees} — table CLOSE, EDOC 08 l.52-59`);
  }

  const bandes = augm.doc;
  if (!augmAPoser) {
    // forme d'après : rien à poser, rien à confronter.
  } else if (bandes.length !== CARDINAUX['advancementCosts.json'].bandes) {
    ecarts.push(`advancementCosts.json : ${bandes.length} bande(s) ≠ ${CARDINAUX['advancementCosts.json'].bandes} — table CLOSE, LDB 07 l.56-70`);
  } else if (AUGMENTATIONS.length !== CARDINAUX['advancementCosts.json'].bandes) {
    ecarts.push(`table AUGMENTATIONS : ${AUGMENTATIONS.length} bande(s) ≠ ${CARDINAUX['advancementCosts.json'].bandes} déclarée(s) — LDB 07 l.56-70`);
  } else {
    for (let i = 0; i < AUGMENTATIONS.length; i++) {
      const b = bandes[i];
      const raw = AUGMENTATIONS[i];
      if (b.id !== raw.id) ecarts.push(`advancementCosts.json[${i}] : \`id\` ${JSON.stringify(b.id)} ≠ ${JSON.stringify(raw.id)}`);
      if (b.max !== raw.max) ecarts.push(`advancementCosts.json ${raw.id} : \`max\` ${JSON.stringify(b.max)} ≠ ${JSON.stringify(raw.max)} (SOURCE)`);
      if ('min' in b && b.min !== raw.min) ecarts.push(`advancementCosts.json ${raw.id} : \`min\` DÉJÀ POSÉ à ${JSON.stringify(b.min)} ≠ ${raw.min} (SOURCE)`);
    }
  }

  if (ecarts.length) {
    console.error(`FIDÉLITÉ AU SOURCE ROMPUE — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

/** `min` insérée JUSTE AVANT `max`, TOUTES les autres clés dans leur ordre existant (une `min` déjà
 *  présente est reprise à sa place canonique, jamais laissée en double). */
const avecMin = (o, min) =>
  Object.fromEntries(
    Object.entries(o).flatMap(([k, v]) => (k === 'max' ? [['min', min], ['max', v]] : k === 'min' ? [] : [[k, v]])),
  );

// ---- ÉCRITURE : `min` juste AVANT `max`, le reste dans son ordre existant. Le no-op se décide sur
// le CARDINAL des bornes basses à poser — seul geste que ce script possède.
if (meteoAPoser === 0) {
  rapport.push('weather.json : no-op (0 `min` à poser)');
} else {
  const apres = {
    ...meteo.doc,
    seasons: meteo.doc.seasons.map((s) => ({
      ...s,
      ranges: s.ranges.map((r, i) => avecMin(r, METEO[s.id][i].min)),
    })),
  };
  fs.writeFileSync(meteo.cible, serializeDataset(apres), 'utf8');
  rapport.push(`weather.json : ${meteoAPoser} rangée(s) × \`min\` (EDOC 08 l.52-59)`);
}

if (augmAPoser === 0) {
  rapport.push('advancementCosts.json : no-op (0 `min` à poser)');
} else {
  const apres = augm.doc.map((b, i) => avecMin(b, AUGMENTATIONS[i].min));
  fs.writeFileSync(augm.cible, serializeDataset(apres), 'utf8');
  rapport.push(`advancementCosts.json : ${augmAPoser} bande(s) × \`min\` (LDB 07 l.56-70)`);
}

// ---- PREUVE post-écriture : la charge utile est INTACTE, seule `min` s'est ajoutée.
if (meteoAPoser) {
  const relu = JSON.parse(fs.readFileSync(meteo.cible, 'utf8'));
  const avant = JSON.parse(meteo.brut);
  for (const [j, s] of relu.seasons.entries()) {
    for (const [i, r] of s.ranges.entries()) {
      const { min, ...sansMin } = r;
      const { min: _m, ...avantSansMin } = avant.seasons[j].ranges[i];
      if (min !== METEO[s.id][i].min) echecs.push(`POST weather.json ${s.id}[${i}] : \`min\` ${min} ≠ ${METEO[s.id][i].min}`);
      if (JSON.stringify(sansMin) !== JSON.stringify(avantSansMin)) echecs.push(`POST weather.json ${s.id}[${i}] : la charge utile a été ALTÉRÉE`);
    }
  }
}
if (augmAPoser) {
  const relues = JSON.parse(fs.readFileSync(augm.cible, 'utf8'));
  const avantB = JSON.parse(augm.brut);
  for (const [i, b] of relues.entries()) {
    const { min, ...sansMin } = b;
    const { min: _m, ...avantSansMin } = avantB[i];
    if (min !== AUGMENTATIONS[i].min) echecs.push(`POST advancementCosts.json ${b.id} : \`min\` ${min} ≠ ${AUGMENTATIONS[i].min}`);
    if (JSON.stringify(sansMin) !== JSON.stringify(avantSansMin)) echecs.push(`POST advancementCosts.json ${b.id} : la charge utile a été ALTÉRÉE`);
  }
}

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s) :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

for (const l of rapport) console.log(l);
console.log(`OK — ${meteoAPoser + augmAPoser} borne(s) basse(s) posée(s).`);
