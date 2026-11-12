/**
 * Migration #1467 L1b V-P5 — `trappings.json` : le discriminant `type` devient `categorie`, et
 * `merchantFamilies.json` `match.trappingType` (qui NOMMAIT ce champ) devient `match.categorie`.
 *
 * MOTIF MESURÉ : sur les 441 possessions du catalogue, le champ range l'entrée dans une CATÉGORIE
 * de catalogue — mesuré melee 65 / ranged 79 / ammunition 22 / armor 17 / trapping 258. Il n'a rien
 * à voir avec le `Weapon.type` du moteur (`src/engine/types.ts`, `'melee' | 'distance'`, persisté),
 * ni avec `ItemInstance.kind` : le pont entre les deux est `kindOf()` (`src/engine/items.ts`), une
 * TRADUCTION et jamais une recopie. Ces deux-là ne sont pas touchés.
 * `merchantFamilies.match.trappingType` est un nom de champ RÉFÉRENÇANT le champ qui meurt : il suit.
 *
 * POSITION PRÉSERVÉE : `categorie` prend la place exacte qu'occupait `type`/`trappingType`.
 *
 * ENTRÉES : `src/data/trappings.json` et `src/data/merchantFamilies.json` (seules données lues et écrites).
 *
 * IDEMPOTENT / NO-OP TOLÉRANT À LA FORME : une entrée portant déjà `categorie` (et plus de `type`)
 * est reconnue migrée ; rejouée sur l'état final, la migration n'écrit rien et sort 0.
 * FAIL-FAST : entrée portant les deux noms, entrée sans catégorie, valeur hors vocabulaire,
 * cardinaux ≠ 441 / 7 → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : chaque fichier est EXACTEMENT `JSON.stringify(doc, null, 2)` (vérifié avant
 * toute écriture — une forme non canonique fait sortir 1 plutôt que reflower le document en silence).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TRAPPINGS = path.join(ROOT, 'src/data/trappings.json');
const FAMILLES = path.join(ROOT, 'src/data/merchantFamilies.json');
// 440→441 : Anneau d'Opsianon, EDO 11 (folio 148), #672.
/** Vocabulaire de catégorie du CATALOGUE — `vehicle` n'a AUCUN porteur mesuré et meurt du schéma. */
const VALEURS = new Set(['melee', 'distance', 'ammunition', 'armor', 'trapping']);

const echecs = [];

/** Lit un document et REFUSE une forme non canonique (aucune écriture ne suivra). */
function lire(cible) {
  const brut = fs.readFileSync(cible, 'utf8');
  const data = JSON.parse(brut);
  if (JSON.stringify(data, null, 2) !== brut) {
    console.error(`FORME NON CANONIQUE — ${path.relative(ROOT, cible)} n’est pas \`JSON.stringify(doc, null, 2)\` ; AUCUNE écriture.`);
    process.exit(1);
  }
  return { brut, data };
}

// ── trappings.json : `type` → `categorie` ──────────────────────────────────────────────────────
const t = lire(TRAPPINGS);
if (!Array.isArray(t.data)) echecs.push('trappings.json : racine non tableau');
else if (!t.data.length) echecs.push('trappings.json : racine VIDE — périmètre déplacé');

/**
 * `type` D'ENVELOPPE (#1467 L1b V-FLIP-ENTITE-c) : depuis l'adoption de `document()`, chaque entrée
 * de `trappings.json` porte `type: "trappings"` — le NOM DU DOCUMENT, pas l'ancienne catégorie. Sans
 * cette distinction, la migration lit l'enveloppe comme un `type` ressuscité et exige un arbitrage
 * sur les 441 entrées. L'ancien `type` était une valeur de `VALEURS` (melee/ranged/ammunition/armor/
 * trapping), jamais le nom du dataset.
 */
const TYPE_ENVELOPPE = 'trappings';
const typeAncien = (e) => (e?.type !== undefined && e.type !== TYPE_ENVELOPPE ? e.type : undefined);

let migresT = 0;
let dejaT = 0;
const sortieT = Array.isArray(t.data)
  ? t.data.map((e, i) => {
      const aType = typeAncien(e) !== undefined;
      const aCat = e?.categorie !== undefined;
      if (aType && aCat) { echecs.push(`trappings #${i} (${e.id}) : porte À LA FOIS \`type\` et \`categorie\` — arbitrage requis`); return e; }
      if (!aType && !aCat) { echecs.push(`trappings #${i} (${e?.id}) : ni \`type\` ni \`categorie\` — catégorie PERDUE`); return e; }
      const valeur = aCat ? e.categorie : typeAncien(e);
      if (!VALEURS.has(valeur)) { echecs.push(`trappings #${i} (${e.id}) : catégorie ${JSON.stringify(valeur)} hors {${[...VALEURS].join(', ')}}`); return e; }
      if (aCat) { dejaT++; return e; }
      migresT++;
      return Object.fromEntries(Object.entries(e).map(([k, v]) => [k === 'type' ? 'categorie' : k, v]));
    })
  : t.data;

// ── merchantFamilies.json : `match.trappingType` → `match.categorie` ───────────────────────────
const f = lire(FAMILLES);
if (!Array.isArray(f.data)) echecs.push('merchantFamilies.json : racine non tableau');
else if (!f.data.length) echecs.push('merchantFamilies.json : racine VIDE — périmètre déplacé');

let migresF = 0;
let dejaF = 0;
const sortieF = Array.isArray(f.data)
  ? f.data.map((e, i) => {
      const m = e?.match;
      if (m == null || typeof m !== 'object') { echecs.push(`merchantFamilies #${i} (${e?.id}) : \`match\` absent ou non objet`); return e; }
      const aType = m.trappingType !== undefined;
      const aCat = m.categorie !== undefined;
      if (aType && aCat) { echecs.push(`merchantFamilies #${i} (${e.id}) : \`match\` porte À LA FOIS \`trappingType\` et \`categorie\``); return e; }
      if (aCat) { dejaF++; return e; }
      if (!aType) return e; // famille classée par `shield`/`unit`, ou fallback — rien à renommer
      if (!VALEURS.has(m.trappingType)) { echecs.push(`merchantFamilies #${i} (${e.id}) : \`trappingType\` ${JSON.stringify(m.trappingType)} hors vocabulaire de catégorie`); return e; }
      migresF++;
      return { ...e, match: Object.fromEntries(Object.entries(m).map(([k, v]) => [k === 'trappingType' ? 'categorie' : k, v])) };
    })
  : f.data;

if (echecs.length) {
  console.error(`ARBITRAGE REQUIS — ${echecs.length} anomalie(s), AUCUNE écriture :`);
  for (const m of echecs) console.error(`  ${m}`);
  process.exit(1);
}

const outT = JSON.stringify(sortieT, null, 2);
const outF = JSON.stringify(sortieF, null, 2);
if (outT !== t.brut) fs.writeFileSync(TRAPPINGS, outT, 'utf8');
if (outF !== f.brut) fs.writeFileSync(FAMILLES, outF, 'utf8');

// PREUVE post-écriture : plus aucun `type`/`trappingType`, catégories conservées entrée par entrée.
const apresT = JSON.parse(outT);
const apresF = JSON.parse(outF);
const residusT = apresT.filter((e) => typeAncien(e) !== undefined).length;
const residusF = apresF.filter((e) => e.match?.trappingType !== undefined).length;
const avantT = t.data.map((e) => typeAncien(e) ?? e.categorie).join(',');
const renduT = apresT.map((e) => e.categorie).join(',');
const avantF = f.data.map((e) => e.match?.trappingType ?? e.match?.categorie ?? '—').join(',');
const renduF = apresF.map((e) => e.match?.categorie ?? '—').join(',');
if (residusT || residusF || avantT !== renduT || avantF !== renduF || apresT.length !== t.data.length || apresF.length !== f.data.length) {
  console.error(`VÉRIFICATION POST-ÉCRITURE ROUGE : ${residusT}/${residusF} résidu(s), partitions ${avantT === renduT ? 'ok' : 'ALTÉRÉE (trappings)'} ${avantF === renduF ? 'ok' : 'ALTÉRÉE (merchantFamilies)'}`);
  process.exit(1);
}

const parCat = apresT.reduce((m, e) => ({ ...m, [e.categorie]: (m[e.categorie] ?? 0) + 1 }), {});
console.log(`trappings.json — \`type\` → \`categorie\` : ${migresT} migrée(s), ${dejaT} déjà migrée(s)`);
console.log(`Entrées : ${apresT.length} ; \`type\` restant : 0 ; répartition ${JSON.stringify(parCat)} ; porteurs \`vehicle\` : 0`);
console.log(`merchantFamilies.json — \`match.trappingType\` → \`match.categorie\` : ${migresF} migrée(s), ${dejaF} déjà migrée(s), ${apresF.length} famille(s)`);
console.log(`Fichiers ${outT !== t.brut ? 'réécrit' : 'INCHANGÉ'} / ${outF !== f.brut ? 'réécrit' : 'INCHANGÉ'} : src/data/trappings.json, src/data/merchantFamilies.json`);
