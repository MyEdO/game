/**
 * Migration #1883 c13e — les véhicules du « Tableau des Structures Courantes » quittent `structures.json`.
 *
 * `src/engine/types.ts:152` : le Véhicule a UN foyer, `src/data/vehicles.json`. Les 8 lignes VÉHICULES
 * et NAVIRES FLUVIAUX du tableau (AA 10 l.30-39) vivaient en Structures marquées `vehicle: true`. Leur
 * publication AA devient un emplacement SECONDAIRE (`alsoIn`) de l'entrée véhicule qui les héberge
 * (design `.superpowers/sdd/1883/design-c13e-v4-vehicules-hors-structures.md`, retouche B6).
 *
 * GESTE, pour chaque Structure `vehicle: true` : l'entrée véhicule cible reçoit
 * `alsoIn: [{ book, page, quote }]` — `book`/`page` RECOPIÉS de la `source` de la Structure (jamais
 * choisis), `quote` = sa `desc` verbatim —, posé juste après `source` ; puis la Structure est retirée.
 * Aucune valeur AA (ENC, Limite d'Encombrement, Endurance, Blessures, Couvert, Taille) n'est écrite sur
 * le véhicule.
 *
 * ENTRÉES : `src/data/structures.json`, `src/data/vehicles.json` (seules données lues et écrites).
 *
 * MARQUEUR D'IDEMPOTENCE : aucune Structure ne porte `vehicle`. Rejoué sur sa sortie, le script
 * n'écrit rien. Un `alsoIn` déjà posé au même `book`/`page` n'est jamais doublé.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : racine non-tableau, forme non canonique, ligne
 * AA sans cible, cible absente de `vehicles.json`, `desc` absente — chaque refus porte sa réf nue.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const STRUCTURES = path.join(ROOT, 'src/data/structures.json');
const VEHICLES = path.join(ROOT, 'src/data/vehicles.json');

/** Ligne AA → entrée véhicule hôte, et la réf de la ligne. Critère : le profil à la Source (ENC,
 *  charge, Endurance, Blessures) égal à la ligne AA ; départage par id, puis par nom à la Source. */
const HOTE = {
  charrette: { vehicule: 'charrette', ref: 'AA 10 l.31' },
  'chariot-leger': { vehicule: 'chariot-leger', ref: 'AA 10 l.32' },
  'chariot-moyen': { vehicule: 'chariot-moyen', ref: 'AA 10 l.33' },
  'chariot-lourd': { vehicule: 'chariot-lourd', ref: 'AA 10 l.34' },
  diligence: { vehicule: 'diligence', ref: 'AA 10 l.35' },
  'barge-moyenne': { vehicule: 'barge-fluviale', ref: 'AA 10 l.37, MSRC 07 l.176' },
  'bateau-de-patrouille': { vehicule: 'bateau-de-patrouille', ref: 'AA 10 l.38' },
  chaloupe: { vehicule: 'chaloupe', ref: 'AA 10 l.39' },
};

const lire = (fichier) => {
  const brut = fs.readFileSync(fichier, 'utf8');
  const doc = JSON.parse(brut);
  const nom = path.relative(ROOT, fichier).replaceAll('\\', '/');
  if (!Array.isArray(doc)) {
    console.error(`${nom} : racine non-TABLEAU — rien n’est écrit`);
    process.exit(1);
  }
  if (JSON.stringify(doc, null, 2) !== brut) {
    console.error(`${nom} : FORME NON CANONIQUE (pas \`JSON.stringify(doc, null, 2)\`) — rien n’est écrit`);
    process.exit(1);
  }
  return doc;
};

const structures = lire(STRUCTURES);
const sortantes = structures.filter((s) => s && 'vehicle' in s);

if (sortantes.length === 0) {
  console.log('src/data/structures.json : no-op (aucune Structure ne porte `vehicle`)');
  process.exit(0);
}

const vehicles = lire(VEHICLES);

// PORTE DE LECTURE — chaque refus porte sa réf nue.
{
  const ecarts = [];
  for (const s of sortantes) {
    const hote = HOTE[s.id];
    if (!hote) {
      ecarts.push(`${s.id} : Structure \`vehicle\` hors des lignes VÉHICULES et NAVIRES FLUVIAUX — AA 10 l.30-39`);
      continue;
    }
    if (!vehicles.some((v) => v?.id === hote.vehicule))
      ecarts.push(`${s.id} : entrée véhicule hôte \`${hote.vehicule}\` absente de vehicles.json — ${hote.ref}`);
    if (typeof s.desc !== 'string' || !s.desc) ecarts.push(`${s.id} : \`desc\` absente, la citation de l’emplacement manque — AA 10 l.55-68`);
    if (typeof s.source?.book !== 'string' || typeof s.source?.page !== 'number')
      ecarts.push(`${s.id} : \`source\` sans folio — AA 10 l.25`);
  }
  if (ecarts.length) {
    console.error(`ARBITRAGE REQUIS — rien n’est écrit (${ecarts.length}) :`);
    for (const m of ecarts) console.error(`  ${m}`);
    process.exit(1);
  }
}

/** L'entrée véhicule avec son emplacement AA, posé juste après `source` (jamais doublé). */
const avecEmplacement = (v, emplacement) => {
  const deja = (v.alsoIn ?? []).some((r) => r.book === emplacement.book && r.page === emplacement.page);
  if (deja) return v;
  const alsoIn = [...(v.alsoIn ?? []), emplacement];
  const sortie = {};
  for (const [k, val] of Object.entries(v)) {
    if (k === 'alsoIn') continue;
    sortie[k] = val;
    if (k === 'source') sortie.alsoIn = alsoIn;
  }
  if (!('alsoIn' in sortie)) sortie.alsoIn = alsoIn;
  return sortie;
};

const parHote = new Map();
for (const s of sortantes) {
  const hote = HOTE[s.id].vehicule;
  parHote.set(hote, [...(parHote.get(hote) ?? []), { book: s.source.book, page: s.source.page, quote: s.desc }]);
}

const vehiclesApres = vehicles.map((v) => (parHote.get(v?.id) ?? []).reduce(avecEmplacement, v));
const structuresApres = structures.filter((s) => !sortantes.includes(s));

fs.writeFileSync(VEHICLES, JSON.stringify(vehiclesApres, null, 2), 'utf8');
fs.writeFileSync(STRUCTURES, JSON.stringify(structuresApres, null, 2), 'utf8');

// PREUVE post-écriture : plus aucune Structure `vehicle`, chaque hôte porte son emplacement, rien d'autre
// n'a bougé.
{
  const post = [];
  const s2 = JSON.parse(fs.readFileSync(STRUCTURES, 'utf8'));
  const v2 = JSON.parse(fs.readFileSync(VEHICLES, 'utf8'));
  if (s2.some((s) => 'vehicle' in s)) post.push('POST : une Structure porte encore `vehicle`');
  if (s2.length !== structures.length - sortantes.length) post.push(`POST : ${s2.length} Structure(s) ≠ ${structures.length} − ${sortantes.length}`);
  if (v2.length !== vehicles.length) post.push(`POST : ${v2.length} véhicule(s) ≠ ${vehicles.length}`);
  for (const [hote, emplacements] of parHote) {
    const v = v2.find((x) => x.id === hote);
    for (const e of emplacements)
      if (!v?.alsoIn?.some((r) => r.book === e.book && r.page === e.page)) post.push(`POST ${hote} : emplacement ${e.book} ${e.page} absent`);
  }
  v2.forEach((v, i) => {
    const { alsoIn: _a, ...reste } = v;
    const { alsoIn: _b, ...resteAvant } = vehicles[i];
    if (JSON.stringify(reste) !== JSON.stringify(resteAvant)) post.push(`POST ${v.id} : champs hors du geste altérés`);
  });
  if (post.length) {
    console.error(`ARBITRAGE REQUIS — ${post.length} anomalie(s) après écriture :`);
    for (const m of post) console.error(`  ${m}`);
    process.exit(1);
  }
}

console.log(`src/data/structures.json : ${sortantes.length} Structure(s) véhicule retirée(s) ; src/data/vehicles.json : ${parHote.size} hôte(s) reçoivent leur emplacement AA (#1883)`);
